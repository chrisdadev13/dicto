use crate::commands::error::CommandError;
use crate::db::pool::get_connection;
use crate::events::{emit_entity_event, names as event_names};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use specta::Type;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::AppHandle;

// ============================================================================
// Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct Setting {
    pub key: String,
    pub value: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct SetSettingInput {
    pub key: String,
    pub value: String,
}

// ============================================================================
// Commands
// ============================================================================

/// List all settings
#[tauri::command]
#[specta::specta]
pub fn settings_list() -> Result<Vec<Setting>, CommandError> {
    let conn = get_connection()?;

    let mut stmt =
        conn.prepare("SELECT key, value, created_at, updated_at FROM settings ORDER BY key ASC")?;

    let settings = stmt
        .query_map([], |row| {
            Ok(Setting {
                key: row.get(0)?,
                value: row.get(1)?,
                created_at: row.get(2)?,
                updated_at: row.get(3)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(settings)
}

/// Get a single setting by key
#[tauri::command]
#[specta::specta]
pub fn settings_get(key: String) -> Result<Option<Setting>, CommandError> {
    let conn = get_connection()?;

    let result = conn.query_row(
        "SELECT key, value, created_at, updated_at FROM settings WHERE key = ?",
        params![key],
        |row| {
            Ok(Setting {
                key: row.get(0)?,
                value: row.get(1)?,
                created_at: row.get(2)?,
                updated_at: row.get(3)?,
            })
        },
    );

    match result {
        Ok(setting) => Ok(Some(setting)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(CommandError::database(e.to_string())),
    }
}

/// Set a setting (upsert)
#[tauri::command]
#[specta::specta]
pub fn settings_set(app: AppHandle, input: SetSettingInput) -> Result<Setting, CommandError> {
    let conn = get_connection()?;

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;

    conn.execute(
        "INSERT INTO settings (key, value, created_at, updated_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
        params![input.key, input.value, now, now],
    )?;

    let setting = Setting {
        key: input.key,
        value: input.value,
        created_at: now,
        updated_at: now,
    };

    emit_entity_event(&app, event_names::SETTINGS_UPDATED, setting.clone())?;

    Ok(setting)
}

/// Delete a setting
#[tauri::command]
#[specta::specta]
pub fn settings_delete(key: String) -> Result<(), CommandError> {
    let conn = get_connection()?;

    conn.execute("DELETE FROM settings WHERE key = ?", params![key])?;

    Ok(())
}
