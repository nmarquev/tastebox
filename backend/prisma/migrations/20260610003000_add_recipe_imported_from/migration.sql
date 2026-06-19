ALTER TABLE "recipes" ADD COLUMN "importedFrom" TEXT;

UPDATE "recipes"
SET "importedFrom" = CASE
  WHEN lower("sourceUrl") LIKE '%instagram.com/%' THEN 'instagram'
  WHEN lower("sourceUrl") LIKE '%youtube.com/%'
    OR lower("sourceUrl") LIKE '%youtu.be/%' THEN 'youtube'
  ELSE 'www'
END
WHERE "sourceUrl" IS NOT NULL;
