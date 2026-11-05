-- AlterTable
ALTER TABLE "Aluno" ADD COLUMN "grupo" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CicloData" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "turmaId" TEXT NOT NULL,
    "numeroCiclo" INTEGER NOT NULL,
    "dataPrevista" DATETIME NOT NULL,
    "semEncontro" BOOLEAN NOT NULL DEFAULT false,
    "gruposComReuniao" TEXT NOT NULL DEFAULT '[]',
    CONSTRAINT "CicloData_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CicloData" ("dataPrevista", "id", "numeroCiclo", "turmaId") SELECT "dataPrevista", "id", "numeroCiclo", "turmaId" FROM "CicloData";
DROP TABLE "CicloData";
ALTER TABLE "new_CicloData" RENAME TO "CicloData";
CREATE UNIQUE INDEX "CicloData_turmaId_numeroCiclo_key" ON "CicloData"("turmaId", "numeroCiclo");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
