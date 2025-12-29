-- Add support for OpenAI and Gemini cloud transcription providers

-- SQLite doesn't support ALTER TABLE to modify CHECK constraints
-- So we need to recreate the table

-- Create new table with updated constraints
CREATE TABLE IF NOT EXISTS keys_vault_new (
    service TEXT PRIMARY KEY NOT NULL CHECK(service IN ('deepgram', 'groq', 'openai', 'gemini')),
    type TEXT NOT NULL CHECK(type IN ('transcription', 'intelligence')),
    api_key TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- Copy existing data
INSERT INTO keys_vault_new (service, type, api_key, created_at, updated_at)
SELECT service, type, api_key, created_at, updated_at FROM keys_vault;

-- Drop old table
DROP TABLE keys_vault;

-- Rename new table
ALTER TABLE keys_vault_new RENAME TO keys_vault;

-- Recreate index
CREATE INDEX idx_keys_vault_type ON keys_vault(type);
