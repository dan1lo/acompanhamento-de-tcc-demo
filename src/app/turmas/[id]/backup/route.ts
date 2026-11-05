import { NextResponse } from "next/server";
import { readFile, unlink } from "fs/promises";
import path from "path";
import os from "os";
import { prisma } from "@/lib/prisma";
import { requireTurmaResponsavel } from "@/lib/authz";

/**
 * Backup do banco INTEIRO (todas as turmas, não só esta) — o SQLite é um arquivo único
 * compartilhado. Usa `VACUUM INTO` em vez de copiar o arquivo direto: gera um snapshot
 * consistente mesmo com o servidor rodando e escrevendo no banco ao mesmo tempo.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireTurmaResponsavel(id);

  const destino = path.join(os.tmpdir(), `tcc-backup-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);

  try {
    await prisma.$executeRawUnsafe(`VACUUM INTO '${destino}'`);
    const conteudo = await readFile(destino);

    const dataHora = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    return new NextResponse(new Uint8Array(conteudo), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="tcc-backup-${dataHora}.db"`,
      },
    });
  } finally {
    await unlink(destino).catch(() => {});
  }
}
