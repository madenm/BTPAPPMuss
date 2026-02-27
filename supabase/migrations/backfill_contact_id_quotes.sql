-- Backfill contact_id on existing quotes by matching client_name with prospect name
UPDATE quotes q
SET contact_id = (
  SELECT p.id
  FROM prospects p
  WHERE p.user_id = q.user_id
  AND p.name = q.client_name
  LIMIT 1
)
WHERE q.contact_id IS NULL
AND q.client_name IS NOT NULL;
