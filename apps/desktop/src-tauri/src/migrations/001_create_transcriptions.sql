CREATE TABLE transcriptions (
    id TEXT PRIMARY KEY,
    text TEXT NOT NULL,
    formatted_text TEXT,
    created_at INTEGER NOT NULL
);

CREATE INDEX idx_transcriptions_created_at ON transcriptions(created_at);
