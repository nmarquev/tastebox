ALTER TABLE "recipe_tags" ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0;

UPDATE "recipe_tags"
SET "order" = (
  SELECT COUNT(*)
  FROM "recipe_tags" AS previous
  WHERE previous."recipeId" = "recipe_tags"."recipeId"
    AND previous.rowid <= "recipe_tags".rowid
);
