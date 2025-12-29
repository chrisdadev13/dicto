use serde::Serialize;
use tauri::{AppHandle, Emitter};

/// Event names for reactive updates
pub mod names {
    // Transcriptions
    pub const TRANSCRIPTIONS_CREATED: &str = "transcriptions:created";
    pub const TRANSCRIPTIONS_UPDATED: &str = "transcriptions:updated";
    pub const TRANSCRIPTIONS_DELETED: &str = "transcriptions:deleted";

    // Keyterms
    pub const KEYTERMS_CREATED: &str = "keyterms:created";
    pub const KEYTERMS_UPDATED: &str = "keyterms:updated";
    pub const KEYTERMS_DELETED: &str = "keyterms:deleted";

    // Shortcuts
    pub const SHORTCUTS_CREATED: &str = "shortcuts:created";
    pub const SHORTCUTS_UPDATED: &str = "shortcuts:updated";
    pub const SHORTCUTS_DELETED: &str = "shortcuts:deleted";

    // Writing styles
    pub const WRITING_STYLES_UPDATED: &str = "writing_styles:updated";

    // Keys vault
    pub const KEYS_VAULT_CREATED: &str = "keys_vault:created";
    pub const KEYS_VAULT_UPDATED: &str = "keys_vault:updated";
    pub const KEYS_VAULT_DELETED: &str = "keys_vault:deleted";

    // Settings
    pub const SETTINGS_UPDATED: &str = "settings:updated";

    // Notes
    pub const NOTES_CREATED: &str = "notes:created";
    pub const NOTES_UPDATED: &str = "notes:updated";
    pub const NOTES_DELETED: &str = "notes:deleted";
}

/// Emit an entity event with full entity data
pub fn emit_entity_event<T: Serialize + Clone>(
    app: &AppHandle,
    event_name: &str,
    data: T,
) -> Result<(), String> {
    app.emit(event_name, data)
        .map_err(|e| format!("Failed to emit event '{}': {}", event_name, e))
}

/// Emit a delete event with the entity ID
pub fn emit_delete_event(app: &AppHandle, event_name: &str, id: String) -> Result<(), String> {
    app.emit(event_name, id)
        .map_err(|e| format!("Failed to emit event '{}': {}", event_name, e))
}
