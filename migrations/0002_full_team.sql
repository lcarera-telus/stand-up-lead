-- Complete the EWW ASCENSUS roster. Skips anyone already active with the same name.
INSERT INTO members (name)
SELECT v.name FROM (
  SELECT 'Alan Daniel Maldonado (Danu)' AS name
  UNION ALL SELECT 'Heera Kalkur'
  UNION ALL SELECT 'Jesse Rosenblatt'
  UNION ALL SELECT 'Jose Leonardo Perez Hernandez'
) v
WHERE NOT EXISTS (
  SELECT 1 FROM members m WHERE m.active = 1 AND m.name = v.name COLLATE NOCASE
);
