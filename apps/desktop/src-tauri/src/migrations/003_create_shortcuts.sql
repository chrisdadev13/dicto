CREATE TABLE IF NOT EXISTS shortcuts (
    id TEXT PRIMARY KEY NOT NULL,
    trigger TEXT NOT NULL,
    replacement TEXT NOT NULL,
    category TEXT NOT NULL CHECK(category IN ('all', 'Personal', 'Work', 'Email', 'Notes')),
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX idx_shortcuts_category ON shortcuts(category);
CREATE INDEX idx_shortcuts_trigger ON shortcuts(trigger);
