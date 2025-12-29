mod migrations;
pub mod pool;

use tauri::Manager;
use tauri_plugin_sql::Builder as SqlBuilder;

pub fn init_database() -> impl tauri::plugin::Plugin<tauri::Wry> {
    SqlBuilder::default()
        .add_migrations("sqlite:dicto.db", migrations::get_migrations())
        .build()
}

/// Initialize database connection pool after migrations run
pub fn setup_pool(app: &tauri::App) -> Result<(), String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    let db_path = app_data_dir.join("dicto.db");
    pool::init_pool(db_path)
}
