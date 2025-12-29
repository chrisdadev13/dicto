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
pub enum KeytermCategory {
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

impl KeytermCategory {
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
pub struct Keyterm {
    pub id: String,
    pub text: String,
    pub category: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct CreateKeytermInput {
    pub text: String,
    pub category: KeytermCategory,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct UpdateKeytermInput {
    pub text: Option<String>,
    pub category: Option<KeytermCategory>,
}

// ============================================================================
// Commands
// ============================================================================

/// List all keyterms, optionally filtered by category
#[tauri::command]
#[specta::specta]
pub fn keyterms_list(category: Option<KeytermCategory>) -> Result<Vec<Keyterm>, CommandError> {
    let conn = get_connection()?;

    let keyterms = match &category {
        Some(cat) => {
            let mut stmt = conn.prepare(
                "SELECT id, text, category, created_at, updated_at FROM keyterms WHERE category = ? ORDER BY created_at DESC",
            )?;
            let cat_str = cat.as_str();
            let rows = stmt.query_map(params![cat_str], |row| {
                Ok(Keyterm {
                    id: row.get(0)?,
                    text: row.get(1)?,
                    category: row.get(2)?,
                    created_at: row.get(3)?,
                    updated_at: row.get(4)?,
                })
            })?;
            rows.collect::<Result<Vec<_>, _>>()?
        }
        None => {
            let mut stmt = conn.prepare(
                "SELECT id, text, category, created_at, updated_at FROM keyterms ORDER BY created_at DESC",
            )?;
            let rows = stmt.query_map([], |row| {
                Ok(Keyterm {
                    id: row.get(0)?,
                    text: row.get(1)?,
                    category: row.get(2)?,
                    created_at: row.get(3)?,
                    updated_at: row.get(4)?,
                })
            })?;
            rows.collect::<Result<Vec<_>, _>>()?
        }
    };

    Ok(keyterms)
}

/// Get a single keyterm by ID
#[tauri::command]
#[specta::specta]
pub fn keyterms_get(id: String) -> Result<Keyterm, CommandError> {
    let conn = get_connection()?;

    conn.query_row(
        "SELECT id, text, category, created_at, updated_at FROM keyterms WHERE id = ?",
        params![id],
        |row| {
            Ok(Keyterm {
                id: row.get(0)?,
                text: row.get(1)?,
                category: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
            })
        },
    )
    .map_err(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => CommandError::not_found("Keyterm", &id),
        _ => CommandError::database(e.to_string()),
    })
}

/// Create a new keyterm
#[tauri::command]
#[specta::specta]
pub fn keyterms_create(app: AppHandle, input: CreateKeytermInput) -> Result<Keyterm, CommandError> {
    let conn = get_connection()?;

    let id = uuid::Uuid::new_v4().to_string();
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;

    conn.execute(
        "INSERT INTO keyterms (id, text, category, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        params![id, input.text, input.category.as_str(), now, now],
    )?;

    let keyterm = Keyterm {
        id: id.clone(),
        text: input.text,
        category: input.category.as_str().to_string(),
        created_at: now,
        updated_at: now,
    };

    emit_entity_event(&app, event_names::KEYTERMS_CREATED, keyterm.clone())?;

    Ok(keyterm)
}

/// Update an existing keyterm
#[tauri::command]
#[specta::specta]
pub fn keyterms_update(
    app: AppHandle,
    id: String,
    input: UpdateKeytermInput,
) -> Result<Keyterm, CommandError> {
    // First verify it exists
    let existing = keyterms_get(id.clone())?;

    let conn = get_connection()?;

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;

    let new_text = input.text.unwrap_or(existing.text);
    let new_category = input
        .category
        .map(|c| c.as_str().to_string())
        .unwrap_or(existing.category);

    conn.execute(
        "UPDATE keyterms SET text = ?, category = ?, updated_at = ? WHERE id = ?",
        params![new_text, new_category, now, id],
    )?;

    let updated = Keyterm {
        id: id.clone(),
        text: new_text,
        category: new_category,
        created_at: existing.created_at,
        updated_at: now,
    };

    emit_entity_event(&app, event_names::KEYTERMS_UPDATED, updated.clone())?;

    Ok(updated)
}

/// Delete a keyterm
#[tauri::command]
#[specta::specta]
pub fn keyterms_delete(app: AppHandle, id: String) -> Result<(), CommandError> {
    // Verify it exists first
    keyterms_get(id.clone())?;

    let conn = get_connection()?;

    conn.execute("DELETE FROM keyterms WHERE id = ?", params![id])?;

    emit_delete_event(&app, event_names::KEYTERMS_DELETED, id)?;

    Ok(())
}
