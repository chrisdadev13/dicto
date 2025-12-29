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
pub struct Note {
    pub id: String,
    pub title: String,
    pub content: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct CreateNoteInput {
    pub title: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct UpdateNoteInput {
    pub title: Option<String>,
    pub content: Option<String>,
}

// ============================================================================
// Commands
// ============================================================================

/// List all notes
#[tauri::command]
#[specta::specta]
pub fn notes_list() -> Result<Vec<Note>, CommandError> {
    let conn = get_connection()?;

    let mut stmt = conn.prepare(
        "SELECT id, title, content, created_at, updated_at FROM notes ORDER BY created_at DESC",
    )?;

    let notes = stmt
        .query_map([], |row| {
            Ok(Note {
                id: row.get(0)?,
                title: row.get(1)?,
                content: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(notes)
}

/// Get a single note by ID
#[tauri::command]
#[specta::specta]
pub fn notes_get(id: String) -> Result<Note, CommandError> {
    let conn = get_connection()?;

    conn.query_row(
        "SELECT id, title, content, created_at, updated_at FROM notes WHERE id = ?",
        params![id],
        |row| {
            Ok(Note {
                id: row.get(0)?,
                title: row.get(1)?,
                content: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
            })
        },
    )
    .map_err(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => CommandError::not_found("Note", &id),
        _ => CommandError::database(e.to_string()),
    })
}

/// Create a new note
#[tauri::command]
#[specta::specta]
pub fn notes_create(app: AppHandle, input: CreateNoteInput) -> Result<Note, CommandError> {
    let conn = get_connection()?;

    let id = uuid::Uuid::new_v4().to_string();
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;

    conn.execute(
        "INSERT INTO notes (id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        params![id, input.title, input.content, now, now],
    )?;

    let note = Note {
        id: id.clone(),
        title: input.title,
        content: input.content,
        created_at: now,
        updated_at: now,
    };

    emit_entity_event(&app, event_names::NOTES_CREATED, note.clone())?;

    Ok(note)
}

/// Update an existing note
#[tauri::command]
#[specta::specta]
pub fn notes_update(
    app: AppHandle,
    id: String,
    input: UpdateNoteInput,
) -> Result<Note, CommandError> {
    // First verify it exists
    let existing = notes_get(id.clone())?;

    let conn = get_connection()?;

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;

    let new_title = input.title.unwrap_or(existing.title);
    let new_content = input.content.unwrap_or(existing.content);

    conn.execute(
        "UPDATE notes SET title = ?, content = ?, updated_at = ? WHERE id = ?",
        params![new_title, new_content, now, id],
    )?;

    let updated = Note {
        id: id.clone(),
        title: new_title,
        content: new_content,
        created_at: existing.created_at,
        updated_at: now,
    };

    emit_entity_event(&app, event_names::NOTES_UPDATED, updated.clone())?;

    Ok(updated)
}

/// Delete a note
#[tauri::command]
#[specta::specta]
pub fn notes_delete(app: AppHandle, id: String) -> Result<(), CommandError> {
    // Verify it exists first
    notes_get(id.clone())?;

    let conn = get_connection()?;

    conn.execute("DELETE FROM notes WHERE id = ?", params![id])?;

    emit_delete_event(&app, event_names::NOTES_DELETED, id)?;

    Ok(())
}
