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
pub struct Transcription {
    pub id: String,
    pub text: String,
    pub formatted_text: Option<String>,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct CreateTranscriptionInput {
    pub text: String,
    pub formatted_text: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct UpdateTranscriptionInput {
    pub text: Option<String>,
    pub formatted_text: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct ListTranscriptionsParams {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct PaginatedTranscriptions {
    pub items: Vec<Transcription>,
    pub total: i64,
    pub has_more: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct TranscriptionAnalytics {
    pub total_count: i64,
    pub total_words: i64,
}

// ============================================================================
// Commands
// ============================================================================

/// List transcriptions with pagination
#[tauri::command]
#[specta::specta]
pub fn transcriptions_list(
    params: Option<ListTranscriptionsParams>,
) -> Result<PaginatedTranscriptions, CommandError> {
    let conn = get_connection()?;

    let limit = params.as_ref().and_then(|p| p.limit).unwrap_or(20);
    let offset = params.as_ref().and_then(|p| p.offset).unwrap_or(0);

    // Get total count
    let total: i64 = conn.query_row("SELECT COUNT(*) FROM transcriptions", [], |row| row.get(0))?;

    // Get paginated items
    let mut stmt = conn.prepare(
        "SELECT id, text, formatted_text, created_at FROM transcriptions
         ORDER BY created_at DESC LIMIT ? OFFSET ?",
    )?;

    let items = stmt
        .query_map(params![limit, offset], |row| {
            Ok(Transcription {
                id: row.get(0)?,
                text: row.get(1)?,
                formatted_text: row.get(2)?,
                created_at: row.get(3)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    let has_more = offset + (items.len() as i64) < total;

    Ok(PaginatedTranscriptions {
        items,
        total,
        has_more,
    })
}

/// Get a single transcription by ID
#[tauri::command]
#[specta::specta]
pub fn transcriptions_get(id: String) -> Result<Transcription, CommandError> {
    let conn = get_connection()?;

    conn.query_row(
        "SELECT id, text, formatted_text, created_at FROM transcriptions WHERE id = ?",
        params![id],
        |row| {
            Ok(Transcription {
                id: row.get(0)?,
                text: row.get(1)?,
                formatted_text: row.get(2)?,
                created_at: row.get(3)?,
            })
        },
    )
    .map_err(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => CommandError::not_found("Transcription", &id),
        _ => CommandError::database(e.to_string()),
    })
}

/// Create a new transcription
#[tauri::command]
#[specta::specta]
pub fn transcriptions_create(
    app: AppHandle,
    input: CreateTranscriptionInput,
) -> Result<Transcription, CommandError> {
    let conn = get_connection()?;

    let id = uuid::Uuid::new_v4().to_string();
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;

    conn.execute(
        "INSERT INTO transcriptions (id, text, formatted_text, created_at) VALUES (?, ?, ?, ?)",
        params![id, input.text, input.formatted_text, now],
    )?;

    let transcription = Transcription {
        id: id.clone(),
        text: input.text,
        formatted_text: input.formatted_text,
        created_at: now,
    };

    emit_entity_event(
        &app,
        event_names::TRANSCRIPTIONS_CREATED,
        transcription.clone(),
    )?;

    Ok(transcription)
}

/// Update an existing transcription
#[tauri::command]
#[specta::specta]
pub fn transcriptions_update(
    app: AppHandle,
    id: String,
    input: UpdateTranscriptionInput,
) -> Result<Transcription, CommandError> {
    // First verify it exists
    let existing = transcriptions_get(id.clone())?;

    let conn = get_connection()?;

    let new_text = input.text.unwrap_or(existing.text);
    let new_formatted_text = input.formatted_text.or(existing.formatted_text);

    conn.execute(
        "UPDATE transcriptions SET text = ?, formatted_text = ? WHERE id = ?",
        params![new_text, new_formatted_text, id],
    )?;

    let updated = Transcription {
        id: id.clone(),
        text: new_text,
        formatted_text: new_formatted_text,
        created_at: existing.created_at,
    };

    emit_entity_event(&app, event_names::TRANSCRIPTIONS_UPDATED, updated.clone())?;

    Ok(updated)
}

/// Delete a transcription
#[tauri::command]
#[specta::specta]
pub fn transcriptions_delete(app: AppHandle, id: String) -> Result<(), CommandError> {
    // Verify it exists first
    transcriptions_get(id.clone())?;

    let conn = get_connection()?;

    conn.execute("DELETE FROM transcriptions WHERE id = ?", params![id])?;

    emit_delete_event(&app, event_names::TRANSCRIPTIONS_DELETED, id)?;

    Ok(())
}

/// Get analytics for transcriptions
#[tauri::command]
#[specta::specta]
pub fn transcriptions_analytics() -> Result<TranscriptionAnalytics, CommandError> {
    let conn = get_connection()?;

    conn.query_row(
        "SELECT COUNT(*) as total_count,
                COALESCE(SUM(LENGTH(text) - LENGTH(REPLACE(text, ' ', '')) + 1), 0) as total_words
         FROM transcriptions",
        [],
        |row| {
            Ok(TranscriptionAnalytics {
                total_count: row.get(0)?,
                total_words: row.get(1)?,
            })
        },
    )
    .map_err(CommandError::from)
}
