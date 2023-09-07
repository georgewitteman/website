CREATE TABLE IF NOT EXISTS app_user (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash BYTEA NOT NULL,
  password_salt BYTEA NOT NULL
);
INSERT INTO public.app_user (id, email, password_hash, password_salt)
  VALUES (
    'b51547d2-1f9c-44f9-8426-d48b9ab6bbaf',
    'george@witteman.me',
    '\x7723459ac4df1faa3e1febb00377c40188fcd9f0eca3dd99e4c0d2e849153f77b3a6fa65e1eaeddc284d889de5c83484f52a919a66229d8f153712845f71fb66',
    '\x6046716332d90b322305f3f4c79c6594'
  );

CREATE TABLE IF NOT EXISTS session (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT REFERENCES app_user(id),
  expires_at TIMESTAMP NOT NULL,
  cookie JSON
);
