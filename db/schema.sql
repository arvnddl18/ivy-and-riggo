-- Riggo & Ivy Wedding RSVP Schema (Cloudflare D1 / SQLite)
CREATE TABLE IF NOT EXISTS rsvps (
  id TEXT PRIMARY KEY,
  attendance TEXT NOT NULL,
  event_part TEXT NOT NULL,
  guest_side TEXT NOT NULL,
  last_name TEXT NOT NULL,
  first_name TEXT NOT NULL,
  middle_name TEXT DEFAULT '',
  nickname TEXT DEFAULT '',
  postal_code TEXT DEFAULT '',
  address TEXT DEFAULT '',
  phone TEXT NOT NULL,
  email TEXT DEFAULT '',
  dietary TEXT DEFAULT '',
  message TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_rsvps_created_at ON rsvps(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rsvps_guest_side ON rsvps(guest_side);
