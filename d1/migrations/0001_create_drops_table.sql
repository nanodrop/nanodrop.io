-- Migration number: 0001 	 2023-09-17T13:06:27.438Z
DROP TABLE IF EXISTS drops;

CREATE TABLE IF NOT EXISTS drops (
    hash TEXT PRIMARY KEY,
    account VARCHAR(65) NOT NULL,
    amount TEXT NOT NULL,
    ip TEXT NOT NULL,
    timestamp INT NOT NULL,
    took INT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ip) REFERENCES ip_info(ip)
);
