-- Migration number: 0003 	 2023-10-15T10:37:52.211Z

CREATE TABLE IF NOT EXISTS drops_by_country (
    country_code VARCHAR(2) NOT NULL,
    count INT NOT NULL,
    PRIMARY KEY (country_code)
);

CREATE TRIGGER IF NOT EXISTS update_drops_by_country
AFTER INSERT ON drops
BEGIN
    INSERT OR REPLACE INTO drops_by_country (country_code, count)
    VALUES (
        (SELECT country_code FROM ip_info WHERE ip = NEW.ip),
        COALESCE((SELECT count FROM drops_by_country WHERE country_code = (SELECT country_code FROM ip_info WHERE ip = NEW.ip)), 0) + 1
    );
END;

INSERT OR REPLACE INTO drops_by_country (country_code, count)
SELECT ip_info.country_code, COUNT(*)
FROM drops
INNER JOIN ip_info ON drops.ip = ip_info.ip
GROUP BY ip_info.country_code;
