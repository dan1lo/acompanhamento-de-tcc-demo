import path from "path";

/**
 * Caminho absoluto do arquivo SQLite — resolvido do mesmo jeito que o Prisma resolve
 * `DATABASE_URL="file:./data/tcc.db"`: relativo à pasta `prisma/`, não à raiz do projeto.
 */
export const DB_PATH = path.join(process.cwd(), "prisma", "data", "tcc.db");
