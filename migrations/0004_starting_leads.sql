-- A new member starts at the team's average lead count, so they don't get the biggest
-- slice on day one. Existing members start at 0, so their slices don't change.
ALTER TABLE members ADD COLUMN starting_leads REAL NOT NULL DEFAULT 0;
