ALTER TABLE app_user ADD COLUMN password_hash TEXT;
ALTER TABLE app_user ADD COLUMN password_salt TEXT;
