use serde::Serialize;
use std::env;
use std::process;
use steamworks::Client;
use std::time::Duration;

#[derive(Serialize)]
struct AchievementResult {
    id: String,
    name: String,
    description: String,
    unlocked: bool,
    hidden: bool,
    icon_rgba: Option<Vec<u8>>,
}

fn main() {
    let args: Vec<String> = env::args().collect();
    if args.len() < 3 {
        eprintln!("Usage: triumph_worker <appid> <command> [args...]");
        process::exit(1);
    }

    let app_id = &args[1];
    let command = &args[2];

    env::set_var("SteamAppId", app_id);

    let app_id_u32 = app_id.parse::<u32>().unwrap_or(480);
    
    let (client, single) = match Client::init_app(app_id_u32) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("Failed to initialize Steamworks: {}", e);
            process::exit(1);
        }
    };

    let user_stats = client.user_stats();
    
    user_stats.request_current_stats();
    std::thread::sleep(Duration::from_millis(500));
    single.run_callbacks();

    match command.as_str() {
        "idle" => {
            println!("Idling started for AppID {}", app_id);
            // We just loop forever, occasionally running callbacks so Steam knows we are alive
            loop {
                std::thread::sleep(Duration::from_millis(2000));
                single.run_callbacks();
            }
        }
        "list" => {
            let mut achievements = Vec::new();
            let names = user_stats.get_achievement_names().unwrap_or_default();

            // First pass: collect all achievement metadata
            for name in &names {
                let ach = user_stats.achievement(name);
                let unlocked = ach.get().unwrap_or(false);
                let mut display_name = ach.get_achievement_display_attribute("name")
                    .unwrap_or("").to_string();
                if display_name.is_empty() { display_name = name.clone(); }
                let description = ach.get_achievement_display_attribute("desc")
                    .unwrap_or("").to_string();
                let hidden = ach.get_achievement_display_attribute("hidden")
                    .unwrap_or("0") == "1";
                achievements.push(AchievementResult {
                    id: name.clone(),
                    name: display_name,
                    description,
                    unlocked,
                    hidden,
                    icon_rgba: None, // filled in retry loop below
                });
            }

            // Icon retry loop: Steam may need time to download/cache icon data
            // Run up to 5 callback passes with 300ms sleep between each
            for _retry in 0..5 {
                let mut all_loaded = true;
                for (i, name) in names.iter().enumerate() {
                    if achievements[i].icon_rgba.is_none() {
                        let ach = user_stats.achievement(name);
                        let icon = ach.get_achievement_icon();
                        if icon.is_some() {
                            achievements[i].icon_rgba = icon;
                        } else {
                            all_loaded = false;
                        }
                    }
                }
                if all_loaded { break; }
                std::thread::sleep(Duration::from_millis(300));
                single.run_callbacks();
            }

            let json = serde_json::to_string(&achievements).unwrap();
            println!("{}", json);
        }
        "toggle" => {
            if args.len() < 5 {
                eprintln!("Usage: triumph_worker <appid> toggle <achievement_id> <true/false>");
                process::exit(1);
            }
            let ach_id = &args[3];
            let state: bool = args[4].parse().unwrap_or(false);

            let ach = user_stats.achievement(ach_id);
            let res = if state { ach.set() } else { ach.clear() };
            
            if let Err(e) = res {
                eprintln!("Failed to toggle achievement: {:?}", e);
            } else if let Err(e) = user_stats.store_stats() {
                eprintln!("Failed to store stats: {:?}", e);
            } else {
                println!("{}", r#"{"success": true}"#);
            }
        }
        "unlock_all" => {
            let names = user_stats.get_achievement_names();
            if let Some(names) = names {
                for name in names {
                    let _ = user_stats.achievement(&name).set();
                }
            }
            if let Err(e) = user_stats.store_stats() {
                eprintln!("Failed to store stats: {:?}", e);
            } else {
                println!("{}", r#"{"success": true}"#);
            }
        }
        "lock_all" => {
            let names = user_stats.get_achievement_names();
            if let Some(names) = names {
                for name in names {
                    let _ = user_stats.achievement(&name).clear();
                }
            }
            if let Err(e) = user_stats.store_stats() {
                eprintln!("Failed to store stats: {:?}", e);
            } else {
                println!("{}", r#"{"success": true}"#);
            }
        }
        "restore" => {
            if args.len() < 4 {
                eprintln!("Needs backup path");
                process::exit(1);
            }
            let file_path = &args[3];
            let content = std::fs::read_to_string(file_path).unwrap_or_default();
            
            #[derive(serde::Deserialize)]
            struct AchRestore { id: String, unlocked: bool }
            
            if let Ok(backup) = serde_json::from_str::<Vec<AchRestore>>(&content) {
                for ach in backup {
                    let a = user_stats.achievement(&ach.id);
                    if ach.unlocked {
                        let _ = a.set();
                    } else {
                        let _ = a.clear();
                    }
                }
                if let Err(e) = user_stats.store_stats() {
                    eprintln!("Failed: {:?}", e);
                } else {
                    println!("{}", r#"{"success": true}"#);
                }
            } else {
                eprintln!("Parse fail");
            }
        }
        "fetch_owned" => {
            // Get Steam install path from registry
            let steam_path = {
                use winreg::enums::*;
                use winreg::RegKey;
                let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
                hklm.open_subkey("SOFTWARE\\WOW6432Node\\Valve\\Steam")
                    .or_else(|_| hklm.open_subkey("SOFTWARE\\Valve\\Steam"))
                    .and_then(|k| k.get_value::<String, _>("InstallPath"))
                    .unwrap_or_else(|_| "C:\\Program Files (x86)\\Steam".to_string())
            };

            let appdata = std::env::var("APPDATA").unwrap_or_else(|_| ".".to_string());
            let tr_dir = std::path::Path::new(&appdata).join("triumph");
            std::fs::create_dir_all(&tr_dir).ok();
            let cache_file = tr_dir.join("owned_games_cache.json");

            // Check cache age (max 1 day)
            let mut use_cache = false;
            if let Ok(metadata) = std::fs::metadata(&cache_file) {
                if let Ok(modified) = metadata.modified() {
                    if let Ok(duration) = std::time::SystemTime::now().duration_since(modified) {
                        if duration.as_secs() < 24 * 3600 {
                            use_cache = true;
                        }
                    }
                }
            }

            if use_cache {
                let cached = std::fs::read_to_string(&cache_file).unwrap_or_default();
                println!("{}", cached);
                process::exit(0);
            }

            // Collect all known appids from steamapps folders (installed) + steam library
            let mut known_appids: std::collections::HashMap<u32, String> = std::collections::HashMap::new();

            // 1. Scan steamapps folders for appmanifest_*.acf files (installed games)
            let steam_path_obj = std::path::Path::new(&steam_path);
            let mut library_paths = vec![steam_path_obj.join("steamapps")];

            // Parse libraryfolders.vdf to find extra library folders
            let lf_path = steam_path_obj.join("steamapps").join("libraryfolders.vdf");
            if let Ok(lf_content) = std::fs::read_to_string(&lf_path) {
                for line in lf_content.lines() {
                    let trimmed = line.trim();
                    if trimmed.starts_with("\"path\"") {
                        if let Some(path_str) = trimmed.splitn(3, '"').nth(2) {
                            let clean = path_str.trim_matches('"').replace("\\\\", "\\");
                            let lib_steam = std::path::Path::new(&clean).join("steamapps");
                            if lib_steam.exists() {
                                library_paths.push(lib_steam);
                            }
                        }
                    }
                }
            }

            // Scan all library folders for appmanifests
            for lib in &library_paths {
                if let Ok(entries) = std::fs::read_dir(lib) {
                    for entry in entries.flatten() {
                        let fname = entry.file_name();
                        let fname_str = fname.to_string_lossy();
                        if fname_str.starts_with("appmanifest_") && fname_str.ends_with(".acf") {
                            if let Some(id_str) = fname_str
                                .strip_prefix("appmanifest_")
                                .and_then(|s| s.strip_suffix(".acf"))
                            {
                                if let Ok(appid) = id_str.parse::<u32>() {
                                    // Read name from manifest
                                    let mut name = format!("App {}", appid);
                                    if let Ok(content) = std::fs::read_to_string(entry.path()) {
                                        for mline in content.lines() {
                                            let t = mline.trim();
                                            if t.starts_with("\"name\"") {
                                                if let Some(n) = t.splitn(3, '"').nth(2) {
                                                    let clean_name = n.trim_matches('"');
                                                    if !clean_name.is_empty() {
                                                        name = clean_name.to_string();
                                                    }
                                                }
                                                break;
                                            }
                                        }
                                    }
                                    known_appids.insert(appid, name);
                                }
                            }
                        }
                    }
                }
            }

            // 2. Also check IsSubscribedApp for apps we've seen before in cache
            // to catch uninstalled but owned games - use steamworks to query them
            // Read a list of possible appids from the Steam registry (apps the user has interacted with)
            {
                use winreg::enums::*;
                use winreg::RegKey;
                let hkcu = RegKey::predef(HKEY_CURRENT_USER);
                if let Ok(apps_key) = hkcu.open_subkey("SOFTWARE\\Valve\\Steam\\Apps") {
                    let steam_apps_api = client.apps();
                    for subkey_name in apps_key.enum_keys().flatten() {
                        if let Ok(appid) = subkey_name.parse::<u32>() {
                            if !known_appids.contains_key(&appid) {
                                if steam_apps_api.is_subscribed_app(steamworks::AppId(appid)) {
                                    // Try to get name from registry
                                    let name = apps_key.open_subkey(&subkey_name)
                                        .and_then(|k| k.get_value::<String, _>("Name"))
                                        .unwrap_or_else(|_| format!("App {}", appid));
                                    known_appids.insert(appid, name);
                                }
                            }
                        }
                    }
                }
            }

            #[derive(serde::Serialize)]
            struct OwnedApp {
                appid: u32,
                name: String,
            }

            let owned_games: Vec<OwnedApp> = known_appids.into_iter()
                .map(|(appid, name)| OwnedApp { appid, name })
                .collect();

            let result = serde_json::to_string(&owned_games).unwrap_or_else(|_| "[]".to_string());
            // Save cache
            std::fs::write(&cache_file, &result).ok();
            println!("{}", result);
        }
        _ => {
            eprintln!("Unknown command: {}", command);
            process::exit(1);
        }
    }
}
