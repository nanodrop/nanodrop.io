-- Migration number: 0004 	 2024-02-11T20:30:44.911Z

CREATE INDEX drops_ip_index ON drops(ip);

CREATE INDEX drops_account_index ON drops(account);

CREATE INDEX drops_timestamp_index ON drops(timestamp);
