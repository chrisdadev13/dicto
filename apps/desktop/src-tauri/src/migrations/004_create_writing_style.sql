CREATE TABLE IF NOT EXISTS writing_styles (
    category TEXT PRIMARY KEY NOT NULL CHECK(category IN ('Personal', 'Work', 'Email', 'General')),
    selected_style TEXT NOT NULL,
    default_prompt TEXT,
    custom_prompt TEXT,
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

INSERT INTO writing_styles (category, selected_style) VALUES
    ('Personal', 'casual'),
    ('Work', 'professional'),
    ('Email', 'formal'),
    ('General', 'casual');

