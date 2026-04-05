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

    // Some versions of steamworks-rs require App ID specifically if not using SteamAppId env var
    // We'll use init_app directly just in case it works better.
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
                    
                    achievements.push(AchievementResult {
                        id: name.clone(),
                        name: display_name,
                        description,
                        unlocked,
                        hidden,
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
                println!("{{\"success\": true}}");
            }
        }
        _ => {
            eprintln!("Unknown command: {}", command);
            process::exit(1);
        }
    }
}
