// The desktop shell holds no application logic: it opens a window onto the web
// build. Anything that needs native access gets a Tauri command here, and a
// matching browser fallback in apps/web.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running 3DSFERA desktop shell");
}
