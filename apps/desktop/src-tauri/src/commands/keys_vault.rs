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
pub enum VaultService {
    #[serde(rename = "deepgram")]
    Deepgram,
    #[serde(rename = "groq")]
    Groq,
    #[serde(rename = "openai")]
    OpenAI,
    #[serde(rename = "gemini")]
    Gemini,
}

impl VaultService {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Deepgram => "deepgram",
            Self::Groq => "groq",
            Self::OpenAI => "openai",
            Self::Gemini => "gemini",
        }
    }

    pub fn key_type(&self) -> &'static str {
        match self {
            Self::Deepgram => "transcription",
            Self::Groq | Self::OpenAI | Self::Gemini => "intelligence",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct KeyVaultEntry {
    pub service: String,
    #[serde(rename = "type")]
    pub key_type: String,
    pub api_key: String,
    pub created_at: i64,
    pub updated_at: i64,
}

/// Masked version for listing (hides full API key)
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct KeyVaultEntryMasked {
    pub service: String,
    #[serde(rename = "type")]
    pub key_type: String,
    pub has_key: bool,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct SetKeyInput {
    pub service: VaultService,
    pub api_key: String,
}

// ============================================================================
// Commands
// ============================================================================

/// List all keys (masked - doesn't expose full API keys)
#[tauri::command]
#[specta::specta]
pub fn keys_vault_list() -> Result<Vec<KeyVaultEntryMasked>, CommandError> {
    let conn = get_connection()?;

    let mut stmt = conn.prepare(
        "SELECT service, type, created_at, updated_at FROM keys_vault ORDER BY service ASC",
    )?;

    let entries = stmt
        .query_map([], |row| {
            Ok(KeyVaultEntryMasked {
                service: row.get(0)?,
                key_type: row.get(1)?,
                has_key: true,
                created_at: row.get(2)?,
                updated_at: row.get(3)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(entries)
}

/// Get a specific API key (full key returned - use with caution)
#[tauri::command]
#[specta::specta]
pub fn keys_vault_get(service: VaultService) -> Result<Option<String>, CommandError> {
    let conn = get_connection()?;

    let result = conn.query_row(
        "SELECT api_key FROM keys_vault WHERE service = ?",
        params![service.as_str()],
        |row| row.get(0),
    );

    match result {
        Ok(key) => Ok(Some(key)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(CommandError::database(e.to_string())),
    }
}

/// Set an API key (upsert)
#[tauri::command]
#[specta::specta]
pub fn keys_vault_set(app: AppHandle, input: SetKeyInput) -> Result<(), CommandError> {
    let conn = get_connection()?;

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;

    conn.execute(
        "INSERT INTO keys_vault (service, type, api_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(service) DO UPDATE SET api_key = excluded.api_key, updated_at = excluded.updated_at",
        params![
            input.service.as_str(),
            input.service.key_type(),
            input.api_key,
            now,
            now
        ],
    )?;

    // Emit event without the actual API key for security
    emit_entity_event(
        &app,
        event_names::KEYS_VAULT_UPDATED,
        KeyVaultEntryMasked {
            service: input.service.as_str().to_string(),
            key_type: input.service.key_type().to_string(),
            has_key: true,
            created_at: now,
            updated_at: now,
        },
    )?;

    Ok(())
}

/// Delete an API key
#[tauri::command]
#[specta::specta]
pub fn keys_vault_delete(app: AppHandle, service: VaultService) -> Result<(), CommandError> {
    let conn = get_connection()?;

    conn.execute(
        "DELETE FROM keys_vault WHERE service = ?",
        params![service.as_str()],
    )?;

    emit_delete_event(
        &app,
        event_names::KEYS_VAULT_DELETED,
        service.as_str().to_string(),
    )?;

    Ok(())
}
