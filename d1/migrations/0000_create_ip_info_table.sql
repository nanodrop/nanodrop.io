-- Migration number: 0000 	 2023-09-17T13:05:39.689Z
PRAGMA foreign_keys = ON;

DROP TABLE IF EXISTS ip_info;

CREATE TABLE IF NOT EXISTS ip_info (
    ip TEXT PRIMARY KEY,
    country VARCHAR(2) NOT NULL,
    is_proxy BOOLEAN NOT NULL,
    proxy_checked_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
