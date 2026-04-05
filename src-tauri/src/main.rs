// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Serialize, Deserialize)]
struct SteamGame {
    appid: String,
    name: String,
    install_dir: String,
    icon_url: String,
    header_url: String,
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
                                    });
                                }
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

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![get_games, run_worker])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
