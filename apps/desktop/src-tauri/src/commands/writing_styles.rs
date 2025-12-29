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
pub enum WritingStyleCategory {
    #[serde(rename = "Personal")]
    Personal,
    #[serde(rename = "Work")]
    Work,
    #[serde(rename = "Email")]
    Email,
    #[serde(rename = "General")]
    General,
}

impl WritingStyleCategory {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Personal => "Personal",
            Self::Work => "Work",
            Self::Email => "Email",
            Self::General => "General",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct WritingStyle {
    pub category: String,
    pub selected_style: String,
    pub default_prompt: Option<String>,
    pub custom_prompt: Option<String>,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct UpdateWritingStyleInput {
    pub selected_style: Option<String>,
    pub default_prompt: Option<String>,
    pub custom_prompt: Option<String>,
}

// ============================================================================
// Commands
// ============================================================================

/// List all writing styles
#[tauri::command]
#[specta::specta]
pub fn writing_styles_list() -> Result<Vec<WritingStyle>, CommandError> {
    let conn = get_connection()?;

    let mut stmt = conn.prepare(
        "SELECT category, selected_style, default_prompt, custom_prompt, updated_at FROM writing_styles ORDER BY category ASC",
    )?;

    let styles = stmt
        .query_map([], |row| {
            Ok(WritingStyle {
                category: row.get(0)?,
                selected_style: row.get(1)?,
                default_prompt: row.get(2)?,
                custom_prompt: row.get(3)?,
                updated_at: row.get(4)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(styles)
}

/// Get a single writing style by category
#[tauri::command]
#[specta::specta]
pub fn writing_styles_get(category: WritingStyleCategory) -> Result<WritingStyle, CommandError> {
    let conn = get_connection()?;

    conn.query_row(
        "SELECT category, selected_style, default_prompt, custom_prompt, updated_at FROM writing_styles WHERE category = ?",
        params![category.as_str()],
        |row| {
            Ok(WritingStyle {
                category: row.get(0)?,
                selected_style: row.get(1)?,
                default_prompt: row.get(2)?,
                custom_prompt: row.get(3)?,
                updated_at: row.get(4)?,
            })
        },
    )
    .map_err(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => {
            CommandError::not_found("WritingStyle", category.as_str())
        }
        _ => CommandError::database(e.to_string()),
    })
}

/// Update a writing style (upsert)
#[tauri::command]
#[specta::specta]
pub fn writing_styles_update(
    app: AppHandle,
    category: WritingStyleCategory,
    input: UpdateWritingStyleInput,
) -> Result<WritingStyle, CommandError> {
    let conn = get_connection()?;

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;

    // Get existing if any
    let existing = writing_styles_get(category.clone()).ok();

    let selected_style = input
        .selected_style
        .or_else(|| existing.as_ref().map(|e| e.selected_style.clone()))
        .unwrap_or_else(|| "default".to_string());

    let default_prompt = input
        .default_prompt
        .or_else(|| existing.as_ref().and_then(|e| e.default_prompt.clone()));

    let custom_prompt = input
        .custom_prompt
        .or_else(|| existing.as_ref().and_then(|e| e.custom_prompt.clone()));

    conn.execute(
        "INSERT INTO writing_styles (category, selected_style, default_prompt, custom_prompt, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(category) DO UPDATE SET
           selected_style = excluded.selected_style,
           default_prompt = excluded.default_prompt,
           custom_prompt = excluded.custom_prompt,
           updated_at = excluded.updated_at",
        params![
            category.as_str(),
            selected_style,
            default_prompt,
            custom_prompt,
            now
        ],
    )?;

    let style = WritingStyle {
        category: category.as_str().to_string(),
        selected_style,
        default_prompt,
        custom_prompt,
        updated_at: now,
    };

    emit_entity_event(&app, event_names::WRITING_STYLES_UPDATED, style.clone())?;

    Ok(style)
}
