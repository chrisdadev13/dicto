// src/db/migrations.rs
use tauri_plugin_sql::{Migration, MigrationKind};

pub fn get_migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "create_transcriptions_table",
            sql: include_str!("../migrations/001_create_transcriptions.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "create_keyterms_table",
            sql: include_str!("../migrations/002_create_keyterms.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "create_snippets_table",
            sql: include_str!("../migrations/003_create_shortcuts.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "create_writing_styles_table",
            sql: include_str!("../migrations/004_create_writing_style.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "create_keys_vault_table",
            sql: include_str!("../migrations/005_create_keys_vault.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "create_settings_table",
            sql: include_str!("../migrations/006_create_settings.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 7,
            description: "create_notes_table",
            sql: include_str!("../migrations/007_create_notes.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 8,
            description: "add_cloud_transcription_providers",
            sql: include_str!("../migrations/008_add_cloud_transcription_providers.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 9,
            description: "rename_notes_to_general",
            sql: include_str!("../migrations/009_rename_notes_to_general.sql"),
            kind: MigrationKind::Up,
        },
    ]
}
