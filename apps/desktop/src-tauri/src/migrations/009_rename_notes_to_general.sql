-- Rename 'Notes' category to 'General' and update style
-- SQLite doesn't support ALTER TABLE to modify CHECK constraints,
-- so we need to recreate the table

-- Create new table with updated constraint
CREATE TABLE IF NOT EXISTS writing_styles_new (
    category TEXT PRIMARY KEY NOT NULL CHECK(category IN ('Personal', 'Work', 'Email', 'General')),
    selected_style TEXT NOT NULL,
    default_prompt TEXT,
    custom_prompt TEXT,
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- Copy existing data, renaming 'Notes' to 'General' and updating style
INSERT OR REPLACE INTO writing_styles_new (category, selected_style, default_prompt, custom_prompt, updated_at)
SELECT
    CASE WHEN category = 'Notes' THEN 'General' ELSE category END,
    CASE WHEN category = 'Notes' THEN 'casual' ELSE selected_style END,
    default_prompt,
    custom_prompt,
    updated_at
FROM writing_styles;

-- Ensure General exists if Notes didn't exist
INSERT OR IGNORE INTO writing_styles_new (category, selected_style) VALUES ('General', 'casual');

-- Drop old table and rename new one
DROP TABLE writing_styles;
ALTER TABLE writing_styles_new RENAME TO writing_styles;
