CREATE TABLE IF NOT EXISTS keyterms (
    id TEXT PRIMARY KEY NOT NULL,
    text TEXT NOT NULL,
    category TEXT NOT NULL CHECK(category IN ('all', 'Personal', 'Work', 'Email', 'Notes')),
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX idx_keyterms_category ON keyterms(category);
CREATE INDEX idx_keyterms_text ON keyterms(text);
