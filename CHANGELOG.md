# Changelog

All notable changes to this project will be documented in this file.

## Unreleased

### Changed

- Bumped the app to 2.0.5 to publish the updater Settings and fallback improvements.
- Improved the updater toast copy, added a GitHub Releases fallback when install fails, and exposed the current app version in Settings.
- Bumped the app to 2.0.4 to publish the startup update check.
- Added a silent startup update check while keeping manual update checks visible from Settings.
- Bumped the app to 2.0.3 to validate the signed GitHub auto update flow from 2.0.2.
- Bumped the app to 2.0.2 and enabled signed Tauri updater artifacts for GitHub Releases.
- Bumped the app to 2.0.1 and configured the Windows NSIS installer for per-machine installation under `Program Files`.
- Refactored the React app shell into typed hooks, shared helpers, and presentational components without changing behavior.
- Ignored local agent/tooling notes, scratch outputs, and experimental test probes so repository status stays focused on product changes.

### Fixed

- Confirmed the updater toast messages are stored as UTF-8 for the 2.0.3 validation release.
- Registered the updater and process plugins so the in-app update flow can install and relaunch after applying an update.
- Standardized worker success and error JSON responses so failed Steam operations no longer produce empty or unparseable responses.
- Improved frontend handling of worker errors so toggle, bulk lock/unlock, and vault restore failures show the real error and avoid unsafe `JSON.parse` calls.
- Stabilized Rust/Tauri validation after cleaning build artifacts by ensuring the worker sidecar path exists before Tauri resource validation.
- Restricted Cargo binary discovery to the official `triumph` and `triumph_worker` binaries so experimental `src/bin/test_*.rs` files do not break `cargo check`.
- Removed unused Rust imports and variables that produced warnings during validation.

### Documentation

- Documented updater signing secrets and the manual GitHub Release checklist.
- Updated README validation commands.
- Updated the React badge to match the React 19 dependency.
- Fixed broken README section heading characters.
