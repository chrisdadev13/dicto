CREATE TABLE IF NOT EXISTS keys_vault (
    service TEXT PRIMARY KEY NOT NULL CHECK(service IN ('deepgram', 'groq')),
    type TEXT NOT NULL CHECK(type IN ('transcription', 'intelligence')),
    api_key TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX idx_keys_vault_type ON keys_vault(type);
