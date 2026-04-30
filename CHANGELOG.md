# Changelog

All notable changes to this project will be documented in this file.

## Unreleased

### Changed

- Ignored local agent/tooling notes, scratch outputs, and experimental test probes so repository status stays focused on product changes.

### Fixed

- Standardized worker success and error JSON responses so failed Steam operations no longer produce empty or unparseable responses.
- Improved frontend handling of worker errors so toggle, bulk lock/unlock, and vault restore failures show the real error and avoid unsafe `JSON.parse` calls.
- Stabilized Rust/Tauri validation after cleaning build artifacts by ensuring the worker sidecar path exists before Tauri resource validation.
- Restricted Cargo binary discovery to the official `triumph` and `triumph_worker` binaries so experimental `src/bin/test_*.rs` files do not break `cargo check`.
- Removed unused Rust imports and variables that produced warnings during validation.

### Documentation

- Updated README validation commands.
- Updated the React badge to match the React 19 dependency.
- Fixed broken README section heading characters.
