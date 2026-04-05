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
        _ => {
            eprintln!("Unknown command: {}", command);
            process::exit(1);
        }
    }
}
