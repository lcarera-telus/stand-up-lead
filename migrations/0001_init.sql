CREATE TABLE members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One leader per day. A re-spin on the same day replaces the row.
CREATE TABLE standups (
  date TEXT PRIMARY KEY,
  member_id INTEGER NOT NULL REFERENCES members(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO members (name) VALUES
  ('Charley Adams'),
  ('Christina Burky'),
  ('Cristian Cejas'),
  ('Andy Nash'),
  ('Zach White'),
  ('Tiago Zattera'),
  ('Rene Felix'),
  ('Luciano Carera');
