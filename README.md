<div align="center">
  <img src="https://raw.githubusercontent.com/Rakjsu/Triumph/main/src-tauri/icons/128x128.png" alt="Triumph Logo" width="160" />
  <h1>Triumph Nexus</h1>
  <p><b>Advanced Steam Achievement Manager & Game Analyzer</b></p>

  [![Tauri](https://img.shields.io/badge/Tauri-2.0-24C8DB?style=for-the-badge&logo=tauri&logoColor=white)](https://tauri.app/)
  [![React](https://img.shields.io/badge/React-19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
  [![Rust](https://img.shields.io/badge/Rust-Backend-000000?style=for-the-badge&logo=rust&logoColor=white)](https://www.rust-lang.org/)
  [![License](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](#)
</div>

---

Triumph Nexus is a state-of-the-art achievement unlocker built as a blazing fast desktop application. Featuring a premium Glassmorphism design and deep Steamworks integration, it allows you to securely visualize, filter, lock, and unlock your Steam achievements natively.

## Features

- **Blazing Fast Local Client:** Built over Tauri and Rust with a React frontend. Extremely lightweight natively connecting to Steam.
- **Dynamic Theming Engine:** Applies Spotify-like dynamic game covers and UI accent colors depending on the selected game.
- **Flawless Asset Retrieval:** Extracts missing achievement RGBA buffers directly from Steam memory ensuring no 404 icons.
- **Playtime Statistics:** Live extraction of total Hours Played direct from Steam config files.
- **Seamless Integrations:** Lock-all, Unlock-all, progress bars, beautiful Toast Notifications, and filters.
- **Ghost Game Stability:** Safely bypasses internal Steam API panics for unowned or achievement-less games to prevent crashes.
- **Auto Update Ready:** Stay on the cutting edge with the embedded GitHub OTA update module.

## Setup & Development

To run Triumph locally in Developer Mode, you must have [Node.js](https://nodejs.org/) and [Rust](https://www.rust-lang.org/) installed:

```bash
# Clone the repository
git clone https://github.com/Rakjsu/Triumph.git
cd Triumph

# Install dependencies
npm install

# Run the Tauri application
npm run tauri dev
```

Useful validation commands:

```bash
# Validate the frontend
npm run build

# Validate the Tauri/Rust application
cd src-tauri
cargo check
cargo build --release --bin triumph_worker
```

Alternatively, you can just download the `.exe` automatically provided in the **Releases** tab.
The Windows installer is configured as a per-machine installer, so it installs under `Program Files` and requires administrator permission.
Unsigned builds may still show a Windows SmartScreen or unknown publisher warning.

## Release & Auto Update

Triumph uses the Tauri updater with a signed `latest.json` hosted on GitHub Releases:

```bash
$env:TAURI_SIGNING_PRIVATE_KEY=Get-Content -Raw "C:\path\to\private.key"
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD="<private-key-password>"
npm run tauri build
```

Store the same values as GitHub repository secrets when building releases outside your local machine:

- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

Keep `.tauri-updater/` local only. It is ignored by Git and must never be committed.

Manual release checklist:

1. Bump the app version in the npm, Cargo, and Tauri manifests.
2. Export `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.
3. Run `npm run build`, `cd src-tauri && cargo check`, and `cargo build --release --bin triumph_worker`.
4. Run `npm run tauri build`.
5. Generate or verify `latest.json` in `src-tauri/target/release/bundle/nsis/`.
6. Create the matching Git tag and GitHub Release.
7. Upload the generated `.exe`, `.exe.sig`, and `latest.json`.
8. Confirm `https://github.com/Rakjsu/Triumph/releases/latest/download/latest.json` returns the new version.

The installed app checks that endpoint at startup and from the Settings update button. Startup checks are silent unless an update is available.

## Disclaimer

This tool manipulates your local Steam statistics using strictly official Steamworks SDK routines. However, the use of achievement managers might be frowned upon by specific third-party multiplayer tracking services. Use at your own discretion.

## Credits

**Triumph** was engineered and created by **[Rakjsu](https://github.com/Rakjsu)**.

*Special Thanks & Inspiration:*
This application was inspired by the original foundation of [SteamAchievementManager (SAM) by gibbed](https://github.com/gibbed/SteamAchievementManager). We evolved the concept by delivering a vastly superior interface, dynamic parsing capabilities, and modern cross-platform technologies.

---
<div align="center">
  <i>"Forged by code, unlocked by Triumph."</i>
</div>
