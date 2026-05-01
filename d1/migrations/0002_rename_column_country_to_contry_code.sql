-- Migration number: 0002 	 2023-10-15T10:07:23.996Z

ALTER TABLE ip_info RENAME COLUMN country TO country_code;
