DELETE FROM app_user;

ALTER TABLE app_user DROP COLUMN password_hash;
ALTER TABLE app_user DROP COLUMN password_salt;

ALTER TABLE app_user ADD COLUMN password_hash BYTEA NOT NULL;
ALTER TABLE app_user ADD COLUMN password_salt BYTEA NOT NULL;
