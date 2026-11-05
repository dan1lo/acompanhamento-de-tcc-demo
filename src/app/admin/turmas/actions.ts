"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { encontrarOuCriarProfessor } from "@/lib/professores";
import type { Papel } from "@prisma/client";

type State = { ok: true; professorNome: string } | { erro: string } | null;

/** Aloca um professor (existente ou novo) numa turma, com o papel escolhido — mesma lógica de
 * "adicionar responsável" da tela de Configurações da turma, só que sem exigir que quem está
 * logado já seja responsável por ela (o admin aloca em qualquer turma). */
export async function adicionarVinculo(turmaId: string, _prevState: State, formData: FormData): Promise<State> {
  await requireAdmin();

  const nome = String(formData.get("nome") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  const papel = String(formData.get("papel") ?? "") as Papel;
  if (!nome) return { erro: "Informe o nome." };
  if (papel !== "RESPONSAVEL" && papel !== "ORIENTADOR") return { erro: "Selecione o papel." };

  const professor = await encontrarOuCriarProfessor(nome, email);

  await prisma.turmaProfessor.upsert({
    where: { turmaId_professorId_papel: { turmaId, professorId: professor.id, papel } },
    create: { turmaId, professorId: professor.id, papel },
    update: {},
  });

  revalidatePath(`/admin/turmas/${turmaId}`);
  return { ok: true as const, professorNome: professor.nome };
}

export async function removerVinculo(turmaId: string, vinculoId: string) {
  await requireAdmin();

  const vinculo = await prisma.turmaProfessor.findUnique({ where: { id: vinculoId } });
  if (!vinculo || vinculo.turmaId !== turmaId) return;

  if (vinculo.papel === "RESPONSAVEL") {
    const total = await prisma.turmaProfessor.count({ where: { turmaId, papel: "RESPONSAVEL" } });
    if (total <= 1) return; // nunca deixa a turma sem ninguém responsável
  }

  await prisma.turmaProfessor.delete({ where: { id: vinculoId } });
  revalidatePath(`/admin/turmas/${turmaId}`);
}
