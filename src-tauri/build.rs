fn main() {
    let manifest_dir = std::path::PathBuf::from(
        std::env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR is set by Cargo"),
    );
    let worker_path = manifest_dir
        .join("target")
        .join("release")
        .join("triumph_worker.exe");

    if !worker_path.exists() {
        if let Some(parent) = worker_path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let _ = std::fs::File::create(&worker_path);
    }

    tauri_build::build()
}
