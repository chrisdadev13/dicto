use crate::commands::error::CommandError;
use crate::db::pool::get_connection;
use crate::events::{emit_delete_event, emit_entity_event, names as event_names};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use specta::Type;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::AppHandle;

// ============================================================================
// Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub enum ShortcutCategory {
    #[serde(rename = "all")]
    All,
    #[serde(rename = "Personal")]
    Personal,
    #[serde(rename = "Work")]
    Work,
    #[serde(rename = "Email")]
    Email,
    #[serde(rename = "Notes")]
    Notes,
}

impl ShortcutCategory {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::All => "all",
            Self::Personal => "Personal",
            Self::Work => "Work",
            Self::Email => "Email",
            Self::Notes => "Notes",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct Shortcut {
    pub id: String,
    pub trigger: String,
    pub replacement: String,
    pub category: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct CreateShortcutInput {
    pub trigger: String,
    pub replacement: String,
    pub category: ShortcutCategory,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct UpdateShortcutInput {
    pub trigger: Option<String>,
    pub replacement: Option<String>,
    pub category: Option<ShortcutCategory>,
}

// ============================================================================
// Commands
// ============================================================================

/// List all shortcuts, optionally filtered by category
#[tauri::command]
#[specta::specta]
pub fn shortcuts_list(category: Option<ShortcutCategory>) -> Result<Vec<Shortcut>, CommandError> {
    let conn = get_connection()?;

    let shortcuts = match &category {
        Some(cat) => {
            let mut stmt = conn.prepare(
                "SELECT id, trigger, replacement, category, created_at, updated_at FROM shortcuts WHERE category = ? ORDER BY created_at DESC",
            )?;
            let cat_str = cat.as_str();
            let rows = stmt.query_map(params![cat_str], |row| {
                Ok(Shortcut {
                    id: row.get(0)?,
                    trigger: row.get(1)?,
                    replacement: row.get(2)?,
                    category: row.get(3)?,
                    created_at: row.get(4)?,
                    updated_at: row.get(5)?,
                })
            })?;
            rows.collect::<Result<Vec<_>, _>>()?
        }
        None => {
            let mut stmt = conn.prepare(
                "SELECT id, trigger, replacement, category, created_at, updated_at FROM shortcuts ORDER BY created_at DESC",
            )?;
            let rows = stmt.query_map([], |row| {
                Ok(Shortcut {
                    id: row.get(0)?,
                    trigger: row.get(1)?,
                    replacement: row.get(2)?,
                    category: row.get(3)?,
                    created_at: row.get(4)?,
                    updated_at: row.get(5)?,
                })
            })?;
            rows.collect::<Result<Vec<_>, _>>()?
        }
    };

    Ok(shortcuts)
}

/// Get a single shortcut by ID
#[tauri::command]
#[specta::specta]
pub fn shortcuts_get(id: String) -> Result<Shortcut, CommandError> {
    let conn = get_connection()?;

    conn.query_row(
        "SELECT id, trigger, replacement, category, created_at, updated_at FROM shortcuts WHERE id = ?",
        params![id],
        |row| {
            Ok(Shortcut {
                id: row.get(0)?,
                trigger: row.get(1)?,
                replacement: row.get(2)?,
                category: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        },
    )
    .map_err(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => CommandError::not_found("Shortcut", &id),
        _ => CommandError::database(e.to_string()),
    })
}

/// Create a new shortcut
#[tauri::command]
#[specta::specta]
pub fn shortcuts_create(
    app: AppHandle,
    input: CreateShortcutInput,
) -> Result<Shortcut, CommandError> {
    let conn = get_connection()?;

    let id = uuid::Uuid::new_v4().to_string();
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;

    conn.execute(
        "INSERT INTO shortcuts (id, trigger, replacement, category, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        params![id, input.trigger, input.replacement, input.category.as_str(), now, now],
    )?;

    let shortcut = Shortcut {
        id: id.clone(),
        trigger: input.trigger,
        replacement: input.replacement,
        category: input.category.as_str().to_string(),
        created_at: now,
        updated_at: now,
    };

    emit_entity_event(&app, event_names::SHORTCUTS_CREATED, shortcut.clone())?;

    Ok(shortcut)
}

/// Update an existing shortcut
#[tauri::command]
#[specta::specta]
pub fn shortcuts_update(
    app: AppHandle,
    id: String,
    input: UpdateShortcutInput,
) -> Result<Shortcut, CommandError> {
    // First verify it exists
    let existing = shortcuts_get(id.clone())?;

    let conn = get_connection()?;

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;

    let new_trigger = input.trigger.unwrap_or(existing.trigger);
    let new_replacement = input.replacement.unwrap_or(existing.replacement);
    let new_category = input
        .category
        .map(|c| c.as_str().to_string())
        .unwrap_or(existing.category);

    conn.execute(
        "UPDATE shortcuts SET trigger = ?, replacement = ?, category = ?, updated_at = ? WHERE id = ?",
        params![new_trigger, new_replacement, new_category, now, id],
    )?;

    let updated = Shortcut {
        id: id.clone(),
        trigger: new_trigger,
        replacement: new_replacement,
        category: new_category,
        created_at: existing.created_at,
        updated_at: now,
    };

    emit_entity_event(&app, event_names::SHORTCUTS_UPDATED, updated.clone())?;

    Ok(updated)
}

/// Delete a shortcut
#[tauri::command]
#[specta::specta]
pub fn shortcuts_delete(app: AppHandle, id: String) -> Result<(), CommandError> {
    // Verify it exists first
    shortcuts_get(id.clone())?;

    let conn = get_connection()?;

    conn.execute("DELETE FROM shortcuts WHERE id = ?", params![id])?;

    emit_delete_event(&app, event_names::SHORTCUTS_DELETED, id)?;

    Ok(())
}
