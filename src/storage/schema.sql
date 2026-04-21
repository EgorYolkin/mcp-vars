CREATE TABLE IF NOT EXISTS variables (
    key TEXT NOT NULL,
    value_json TEXT NOT NULL,
    expires_at TEXT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (key)
);

CREATE INDEX IF NOT EXISTS idx_variables_key
ON variables(key);
