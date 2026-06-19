-- AlterTable: agrega la columna `source` (Fuente: de quién es la receta, texto libre)
ALTER TABLE "Recipe" ADD COLUMN "source" TEXT;
