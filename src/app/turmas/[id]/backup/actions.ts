"use server";

import { writeFile, unlink } from "fs/promises";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTurmaResponsavel } from "@/lib/authz";
import { DB_PATH } from "@/lib/dbPath";

const SQLITE_MAGIC = "SQLite format 3\0";

type State = { ok: true; backupSeguranca: string } | { erro: string } | null;

/**
 * Substitui o banco INTEIRO pelo arquivo enviado — irreversível na hora (sobrescreve todas as
 * turmas, não só esta), por isso: valida a assinatura do arquivo antes de mexer em qualquer
 * coisa, e tira um backup do banco ATUAL logo antes de sobrescrever (mesmo mecanismo do botão de
 * backup) — se o restore der errado ou for engano, dá pra voltar usando esse arquivo.
 */
export async function restaurarBackup(turmaId: string, _prevState: State, formData: FormData): Promise<State> {
  await requireTurmaResponsavel(turmaId);

  const file = formData.get("arquivo") as File | null;
  if (!file || file.size === 0) return { erro: "Selecione um arquivo .db." };

  const novoConteudo = Buffer.from(await file.arrayBuffer());
  const assinatura = novoConteudo.subarray(0, SQLITE_MAGIC.length).toString("latin1");
  if (assinatura !== SQLITE_MAGIC) {
    return { erro: "Esse arquivo não parece ser um banco SQLite válido (assinatura não confere)." };
  }

  const seguranca = `${DB_PATH}.antes-do-restore-${Date.now()}.db`;
  try {
    await prisma.$executeRawUnsafe(`VACUUM INTO '${seguranca}'`);
  } catch {
    return { erro: "Não consegui tirar um backup de segurança do banco atual — restore cancelado, nada foi alterado." };
  }

  await prisma.$disconnect();

  // Journal/WAL do banco anterior não deve sobreviver a uma troca de arquivo por baixo dele.
  for (const sufixo of ["-wal", "-shm", "-journal"]) {
    await unlink(`${DB_PATH}${sufixo}`).catch(() => {});
  }

  await writeFile(DB_PATH, novoConteudo);

  revalidatePath(`/turmas/${turmaId}/config`);
  return { ok: true as const, backupSeguranca: seguranca };
}
