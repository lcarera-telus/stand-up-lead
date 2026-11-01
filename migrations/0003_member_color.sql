-- Each person picks their own wheel color. Active members start with the colors the
-- wheel already showed: the palette in id order. New members get a random color from the API.
ALTER TABLE members ADD COLUMN color TEXT;

WITH palette(i, c) AS (
  VALUES (0, '#e8380d'), (1, '#f6a93b'), (2, '#f5dc5a'), (3, '#8bc34a'), (4, '#26a69a'), (5, '#29b6f6'),
         (6, '#3f6fd8'), (7, '#7e57c2'), (8, '#d81b9a'), (9, '#ff8a80'), (10, '#8d6e63'), (11, '#b0bec5')
),
ranked AS (
  SELECT id, (ROW_NUMBER() OVER (ORDER BY id) - 1) % 12 AS i FROM members WHERE active = 1
)
UPDATE members
   SET color = (SELECT p.c FROM ranked r JOIN palette p ON p.i = r.i WHERE r.id = members.id)
 WHERE active = 1;
