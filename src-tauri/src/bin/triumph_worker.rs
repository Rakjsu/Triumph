use serde::{Deserialize, Serialize};
use std::env;
use std::collections::HashMap;
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
    icon_url: String,
    icon_locked_url: String,
}

// Steam Web API schema response types
#[derive(Deserialize)]
struct SchemaResponse {
    game: Option<SchemaGame>,
}

#[derive(Deserialize)]
struct SchemaGame {
    #[serde(rename = "availableGameStats")]
    available_game_stats: Option<SchemaStats>,
}

#[derive(Deserialize)]
struct SchemaStats {
    achievements: Option<Vec<SchemaAchievement>>,
}

#[derive(Deserialize)]
struct SchemaAchievement {
    name: String,
    icon: Option<String>,
    #[serde(rename = "icongray")]
    icon_gray: Option<String>,
}

fn fetch_achievement_icons(appid: u32) -> HashMap<String, (String, String)> {
    let url = format!(
        "https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/?appid={}",
        appid
    );

    let mut map = HashMap::new();

    if let Ok(mut response) = ureq::get(&url).call() {
        if let Ok(text) = response.body_mut().read_to_string() {
            if let Ok(schema) = serde_json::from_str::<SchemaResponse>(&text) {
                if let Some(game) = schema.game {
                    if let Some(stats) = game.available_game_stats {
                        if let Some(achievements) = stats.achievements {
                            for ach in achievements {
                                let icon = ach.icon.unwrap_or_default();
                                let icon_gray = ach.icon_gray.unwrap_or_default();
                                map.insert(ach.name, (icon, icon_gray));
                            }
                        }
                    }
                }
            }
        }
    }

    map
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
    std::thread::sleep(Duration::from_millis(200));
    single.run_callbacks();

    match command.as_str() {
        "list" => {
            // Fetch icon URLs from Steam Web API (no API key needed for public games)
            let icon_map = fetch_achievement_icons(app_id_u32);

            let mut achievements = Vec::new();
            let names = user_stats.get_achievement_names();
            if let Some(names) = names {
                for name in names {
                    let ach = user_stats.achievement(&name);
                    let unlocked = ach.get().unwrap_or(false);
                    
                    let mut display_name = ach.get_achievement_display_attribute("name").unwrap_or("").to_string();
                    if display_name.is_empty() {
                        display_name = name.clone();
                    }
                    
                    let description = ach.get_achievement_display_attribute("desc").unwrap_or("").to_string();
                    let hidden = ach.get_achievement_display_attribute("hidden").unwrap_or("0") == "1";

                    // Get icon URLs from prefetched schema map
                    let (icon_url, icon_locked_url) = icon_map.get(&name)
                        .cloned()
                        .unwrap_or_default();
                    
                    achievements.push(AchievementResult {
                        id: name.clone(),
                        name: display_name,
                        description,
                        unlocked,
                        hidden,
                        icon_url,
                        icon_locked_url,
                    });
                }
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
            let res = if state {
                ach.set()
            } else {
                ach.clear()
            };
            
            if let Err(e) = res {
                eprintln!("Failed to toggle achievement: {:?}", e);
            } else {
                if let Err(e) = user_stats.store_stats() {
                    eprintln!("Failed to store stats: {:?}", e);
                } else {
                println!("{{\"success\": true}}");
                }
            }
        }
        "unlock_all" => {
            let names = user_stats.get_achievement_names();
            if let Some(names) = names {
                for name in names {
                    let ach = user_stats.achievement(&name);
                    let _ = ach.set();
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
                    let ach = user_stats.achievement(&name);
                    let _ = ach.clear();
                }
            }
            if let Err(e) = user_stats.store_stats() {
                eprintln!("Failed to store stats: {:?}", e);
            } else {
                println!("{}", r#"{"success": true}"#);
            }
        }
        _ => {
            eprintln!("Unknown command: {}", command);
            process::exit(1);
        }
    }
}
