// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::fs;
use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;
use std::process::Command;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder},
    Manager,
};

fn get_app_dir() -> PathBuf {
    let mut path = PathBuf::from(std::env::var("APPDATA").unwrap_or_else(|_| ".".to_string()));
    path.push("triumph");
    let _ = fs::create_dir_all(&path);
    path
}

fn get_vault_dir() -> PathBuf {
    let mut path = get_app_dir();
    path.push("vault");
    let _ = fs::create_dir_all(&path);
    path
}

#[derive(Serialize, Deserialize)]
struct SteamGame {
    appid: String,
    name: String,
    install_dir: String,
    icon_url: String,
    header_url: String,
    playtime_hours: f64,
}

fn get_steam_path() -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        use winreg::enums::*;
        use winreg::RegKey;
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        if let Ok(steam_key) = hkcu.open_subkey(r"Software\Valve\Steam") {
            if let Ok(steam_path) = steam_key.get_value::<String, _>("SteamPath") {
                return Some(PathBuf::from(steam_path));
            }
        }
    }

    None
}

fn get_active_user_id() -> Option<String> {
    #[cfg(target_os = "windows")]
    {
        use winreg::enums::*;
        use winreg::RegKey;
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        if let Ok(steam_key) = hkcu.open_subkey(r"Software\Valve\Steam\ActiveProcess") {
            if let Ok(active_user) = steam_key.get_value::<u32, _>("ActiveUser") {
                if active_user > 0 {
                    return Some(active_user.to_string());
                }
            }
        }
    }
    None
}

fn get_localconfig_path() -> Option<PathBuf> {
    let steam_path = get_steam_path()?;
    let user_id = get_active_user_id()?;
    let config_path = steam_path.join("userdata").join(user_id).join("config").join("localconfig.vdf");
    if config_path.exists() {
        Some(config_path)
    } else {
        None
    }
}

// Simple parser for VDF key-value pairs
fn parse_acf_value(content: &str, key: &str) -> Option<String> {
    let key_str = format!("\"{}\"", key);
    if let Some(pos) = content.find(&key_str) {
        let rest = &content[pos + key_str.len()..];
        if let Some(start) = rest.find('"') {
            let val_rest = &rest[start + 1..];
            if let Some(end) = val_rest.find('"') {
                return Some(val_rest[..end].to_string());
            }
        }
    }
    None
}

#[tauri::command]
fn get_games() -> Vec<SteamGame> {
    let mut games = Vec::new();
    
    if let Some(steam_path) = get_steam_path() {
        // Find steamapps path. Hardcoded for main drive, but could parse libraryfolders.vdf
        let steamapps = steam_path.join("steamapps");
        if steamapps.exists() {
            if let Ok(entries) = fs::read_dir(steamapps) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_file() {
                        let filename = path.file_name().unwrap_or_default().to_string_lossy();
                        if filename.starts_with("appmanifest_") && filename.ends_with(".acf") {
                            if let Ok(content) = fs::read_to_string(&path) {
                                let appid = parse_acf_value(&content, "appid").unwrap_or_default();
                                let name = parse_acf_value(&content, "name").unwrap_or_default();
                                let install_dir = parse_acf_value(&content, "installdir").unwrap_or_default();
                                
                                if !appid.is_empty() && !name.is_empty() && name != "Steamworks Common Redistributables" {
                                    games.push(SteamGame {
                                        appid: appid.clone(),
                                        name,
                                        install_dir,
                                        icon_url: format!("https://steamcdn-a.akamaihd.net/steam/apps/{}/capsule_231x87.jpg", appid),
                                        header_url: format!("https://steamcdn-a.akamaihd.net/steam/apps/{}/header.jpg", appid),
                                        playtime_hours: 0.0,
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    let mut db_path = get_app_dir();
    db_path.push("custom_games.json");
    if let Ok(content) = fs::read_to_string(&db_path) {
        if let Ok(custom_games) = serde_json::from_str::<Vec<SteamGame>>(&content) {
            // Prepend explicit marker or just append
            games.extend(custom_games);
        }
    }
    
    // Parse Playtime from localconfig.vdf
    if let Some(config_path) = get_localconfig_path() {
        if let Ok(config_content) = fs::read_to_string(config_path) {
            for game in &mut games {
                // Regex pattern to find the Playtime for this specific appid
                // Pattern matches: "appid" \n { ... "Playtime" "minutes" ... }
                let pattern = format!(r#""{}"\s*\{{[^}}]*?"Playtime"\s*"(\d+)""#, regex::escape(&game.appid));
                if let Ok(re) = regex::Regex::new(&pattern) {
                    if let Some(caps) = re.captures(&config_content) {
                        if let Some(minutes_match) = caps.get(1) {
                            if let Ok(minutes) = minutes_match.as_str().parse::<f64>() {
                                game.playtime_hours = f64::trunc((minutes / 60.0) * 10.0) / 10.0;
                            }
                        }
                    }
                }
            }
        }
    }

    // Sort games alphabetically
    games.sort_by(|a, b| a.name.cmp(&b.name));
    games
}

fn get_worker_path() -> PathBuf {
    let mut exe = std::env::current_exe().expect("Failed to get current exe");
    exe.pop(); // Remove triumph.exe
    exe.push("triumph_worker.exe");
    if !exe.exists() {
        // Fallback or dev mode: cargo run might use target/debug
        // Let's just try calling 'triumph_worker.exe' and hope it's in PATH or same dir
        return PathBuf::from("triumph_worker.exe");
    }
    exe
}

#[tauri::command]
async fn run_worker(appid: String, args: Vec<String>) -> Result<String, String> {
    let worker = get_worker_path();
    let mut cmd_args = vec![appid];
    cmd_args.extend(args);

    let output = Command::new(&worker)
        .args(&cmd_args)
        .output()
        .map_err(|e| format!("Failed to run worker: {} ({:?})", e, worker))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if output.status.success() {
        Ok(stdout)
    } else {
        let stdout = stdout.trim();
        if !stdout.is_empty() {
            Err(stdout.to_string())
        } else {
            Err(stderr.trim().to_string())
        }
    }
}

#[tauri::command]
async fn start_idle(appid: String) -> Result<u32, String> {
    let worker = get_worker_path();
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    let child = Command::new(&worker)
        .args(&[&appid, "idle"])
        .creation_flags(CREATE_NO_WINDOW)
        .spawn()
        .map_err(|e| format!("Failed to spawn idle worker: {}", e))?;

    Ok(child.id())
}

#[tauri::command]
async fn stop_idle(pid: u32) -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    
    Command::new("taskkill")
        .args(&["/PID", &pid.to_string(), "/F"])
        .creation_flags(CREATE_NO_WINDOW)
        .spawn()
        .map_err(|e| format!("Failed to kill idle worker: {}", e))?;
    Ok(())
}

#[tauri::command]
async fn kill_all_workers() -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    
    let _ = Command::new("taskkill")
        .args(&["/IM", "triumph_worker.exe", "/F"])
        .creation_flags(CREATE_NO_WINDOW)
        .spawn();
    Ok(())
}

#[derive(Serialize, Deserialize)]
struct VaultBackup {
    id: String,
    timestamp: String,
    appid: String,
}

#[tauri::command]
fn log_action(timestamp: String, action: String) -> Result<(), String> {
    let mut log_path = get_app_dir();
    log_path.push("shadow_log.txt");
    let log_entry = format!("[{}] {}\n", timestamp, action);
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_path)
        .map_err(|e| e.to_string())?;
    file.write_all(log_entry.as_bytes()).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_logs() -> Result<String, String> {
    let mut log_path = get_app_dir();
    log_path.push("shadow_log.txt");
    fs::read_to_string(log_path).or_else(|_| Ok("".to_string()))
}

#[tauri::command]
fn save_vault_state(appid: String, timestamp_id: String, payload: String) -> Result<(), String> {
    let mut file_path = get_vault_dir();
    file_path.push(format!("{}_{}.json", appid, timestamp_id));
    fs::write(file_path, payload).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn list_vaults(appid: String) -> Result<Vec<VaultBackup>, String> {
    let vault_dir = get_vault_dir();
    let mut backups = Vec::new();

    if let Ok(entries) = fs::read_dir(vault_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                if name.starts_with(&appid) && name.ends_with(".json") {
                    let timestamp_part = name.replace(&format!("{}_", appid), "").replace(".json", "");
                    backups.push(VaultBackup {
                        id: name.to_string(),
                        timestamp: timestamp_part,
                        appid: appid.clone(),
                    });
                }
            }
        }
    }
    
    backups.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    Ok(backups)
}

#[tauri::command]
async fn add_custom_game(appid: String, name: String) -> Result<(), String> {
    let mut db_path = get_app_dir();
    db_path.push("custom_games.json");
    
    let content = fs::read_to_string(&db_path).unwrap_or_else(|_| "[]".to_string());
    let mut custom_games: Vec<SteamGame> = serde_json::from_str(&content).unwrap_or_default();
    
    if !custom_games.iter().any(|g| g.appid == appid) {
        custom_games.push(SteamGame {
            appid: appid.clone(),
            name,
            install_dir: "FANTASMA".to_string(), // Uninstalled flag
            icon_url: format!("https://steamcdn-a.akamaihd.net/steam/apps/{}/capsule_231x87.jpg", appid),
            header_url: format!("https://steamcdn-a.akamaihd.net/steam/apps/{}/header.jpg", appid),
            playtime_hours: 0.0,
        });
        
        let new_content = serde_json::to_string_pretty(&custom_games).map_err(|e| e.to_string())?;
        fs::write(db_path, new_content).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn fetch_global_games() -> Result<Vec<SteamGame>, String> {
    let worker = get_worker_path();
    use std::os::windows::process::CommandExt;
    let output = Command::new(&worker)
        .args(&["480", "fetch_owned"])
        .creation_flags(0x08000000)
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        let json_str = String::from_utf8_lossy(&output.stdout);
        // Find the JSON array line which triumph_worker generates
        if let Some(json_array) = json_str.lines().rev().find(|l| l.starts_with('[')) {
            #[derive(serde::Deserialize)]
            struct OwnedGame { appid: u64, name: String }
            
            if let Ok(owned) = serde_json::from_str::<Vec<OwnedGame>>(json_array) {
                let mut games = Vec::new();
                for g in owned {
                    // Filter exact name match for Free to Plays? No need, IsSubscribed works well mostly
                    games.push(SteamGame {
                        appid: g.appid.to_string(),
                        name: g.name,
                        install_dir: "FANTASMA".to_string(),
                        icon_url: format!("https://steamcdn-a.akamaihd.net/steam/apps/{}/capsule_231x87.jpg", g.appid),
                        header_url: format!("https://steamcdn-a.akamaihd.net/steam/apps/{}/header.jpg", g.appid),
                        playtime_hours: 0.0,
                    });
                }
                return Ok(games);
            }
        }
    }
    Ok(Vec::new())
}

#[tauri::command]
fn get_vault_path(appid: String, timestamp_id: String) -> Result<String, String> {
    let mut file_path = get_vault_dir();
    file_path.push(format!("{}_{}.json", appid, timestamp_id));
    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
fn close_app(app_handle: tauri::AppHandle) {
    app_handle.exit(0);
}

#[tauri::command]
fn hide_app(app_handle: tauri::AppHandle) {
    use tauri::Manager;
    if let Some(window) = app_handle.get_webview_window("main") {
        let _ = window.hide();
    }
}

#[tauri::command]
fn wipe_caches() -> Result<(), String> {
    let mut app_dir = get_app_dir();
    app_dir.push("owned_games_cache.json");
    let _ = fs::remove_file(app_dir);
    // Note: We don't wipe global_applist_cache.json to avoid hitting the steam web API excessively
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let quit_i = MenuItem::with_id(app, "quit", "Encerrar Motor Fantasma", true, None::<&str>)?;
            let show_i = MenuItem::with_id(app, "show", "Mostrar Triumph", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app: &tauri::AppHandle, event: tauri::menu::MenuEvent| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
                        use std::os::windows::process::CommandExt;
                        let _ = std::process::Command::new("taskkill")
                            .args(&["/IM", "triumph_worker.exe", "/F"])
                            .creation_flags(0x08000000)
                            .spawn();
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray: &tauri::tray::TrayIcon, event: tauri::tray::TrayIconEvent| {
                    if let tauri::tray::TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                        if let Some(window) = tray.app_handle().get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_games, run_worker, start_idle, stop_idle, kill_all_workers,
            log_action, get_logs, save_vault_state, list_vaults, get_vault_path, add_custom_game,
            fetch_global_games, wipe_caches, close_app, hide_app
        ])
        .on_window_event(|_window, event| match event {
            tauri::WindowEvent::Destroyed => {
                use std::os::windows::process::CommandExt;
                let _ = std::process::Command::new("taskkill")
                    .args(&["/IM", "triumph_worker.exe", "/F"])
                    .creation_flags(0x08000000)
                    .spawn();
            }
            _ => {}
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
