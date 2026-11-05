"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { encontrarOuCriarProfessor } from "@/lib/professores";
import { requireTurmaResponsavel, requireCoordenadorAccess } from "@/lib/authz";

export async function updateDadosTurma(turmaId: string, formData: FormData) {
  await requireTurmaResponsavel(turmaId);

  const nome = String(formData.get("nome") ?? "").trim();
  const disciplina = String(formData.get("disciplina") ?? "").trim();
  const periodoLetivo = String(formData.get("periodoLetivo") ?? "").trim();
  const coordenadorId = String(formData.get("coordenadorId") ?? "") || null;
  if (!nome || !disciplina || !periodoLetivo) return;

  await prisma.turma.update({
    where: { id: turmaId },
    data: { nome, disciplina, periodoLetivo, coordenadorId },
  });

  revalidatePath(`/turmas/${turmaId}`);
  revalidatePath(`/turmas/${turmaId}/config`);
  redirect(`/turmas/${turmaId}`);
}

/**
 * Adiciona outra pessoa como RESPONSAVEL da disciplina (ex.: Danilo adiciona a Carol) — antes só
 * o coordenador conseguia fazer isso (`vincularResponsavel`, na área de coordenador). Qualquer
 * responsável atual da turma pode convidar outra.
 */
export async function adicionarResponsavel(turmaId: string, _prevState: unknown, formData: FormData) {
  await requireTurmaResponsavel(turmaId);

  const nome = String(formData.get("nome") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  if (!nome) return { erro: "Informe o nome." };

  const professor = await encontrarOuCriarProfessor(nome, email);

  await prisma.turmaProfessor.upsert({
    where: { turmaId_professorId_papel: { turmaId, professorId: professor.id, papel: "RESPONSAVEL" } },
    create: { turmaId, professorId: professor.id, papel: "RESPONSAVEL" },
    update: {},
  });

  revalidatePath(`/turmas/${turmaId}/config`);
  return { ok: true as const, professorNome: professor.nome };
}

export async function removerResponsavel(turmaId: string, vinculoId: string) {
  await requireTurmaResponsavel(turmaId);

  const total = await prisma.turmaProfessor.count({ where: { turmaId, papel: "RESPONSAVEL" } });
  if (total <= 1) return; // nunca deixa a turma sem ninguém responsável

  await prisma.turmaProfessor.delete({ where: { id: vinculoId } });
  revalidatePath(`/turmas/${turmaId}/config`);
}

export async function updateConfig(turmaId: string, formData: FormData) {
  await requireTurmaResponsavel(turmaId);
  const num = (name: string) => Number(formData.get(name));
  const cicloCorteSR1Raw = String(formData.get("cicloCorteSR1") ?? "");

  await prisma.turma.update({
    where: { id: turmaId },
    data: {
      limiteFaltas: num("limiteFaltas"),
      bufferAmarelo: num("bufferAmarelo"),
      faltasConsecutivasAlerta: num("faltasConsecutivasAlerta"),
      pesoNotaAutomatica: num("pesoNotaAutomatica") / 100,
      cicloCorteSR1: cicloCorteSR1Raw ? Number(cicloCorteSR1Raw) : null,
    },
  });

  revalidatePath(`/turmas/${turmaId}`);
  redirect(`/turmas/${turmaId}`);
}

/**
 * Restringe a visão de uma pessoa RESPONSAVEL a só alguns grupos da disciplina (ex.: Danilo vê
 * Grupo 01/02, Carol vê Grupo 03/04). Nenhum grupo marcado = sem restrição, vê todo mundo.
 */
export async function updateGruposResponsavel(turmaId: string, vinculoId: string, formData: FormData) {
  await requireTurmaResponsavel(turmaId);
  const grupos = formData.getAll("grupos").map(String);

  await prisma.turmaProfessor.update({
    where: { id: vinculoId },
    data: { gruposResponsavel: grupos.length > 0 ? JSON.stringify(grupos) : null },
  });

  revalidatePath(`/turmas/${turmaId}/config`);
  revalidatePath(`/turmas/${turmaId}`);
}

/**
 * Vincula outro coordenador à turma (pode ter mais de um acompanhando a mesma disciplina) — além
 * do coordenador "principal" em Turma.coordenadorId. Reaproveita cadastro existente por e-mail.
 */
export async function adicionarCoordenador(turmaId: string, _prevState: unknown, formData: FormData) {
  await requireTurmaResponsavel(turmaId);

  const nome = String(formData.get("nome") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  if (!nome || !email) return { erro: "Informe nome e e-mail." };

  const coordenador = await prisma.coordenador.upsert({
    where: { email },
    create: { nome, email },
    update: {},
  });

  await prisma.turmaCoordenador.upsert({
    where: { turmaId_coordenadorId: { turmaId, coordenadorId: coordenador.id } },
    create: { turmaId, coordenadorId: coordenador.id },
    update: {},
  });

  revalidatePath(`/turmas/${turmaId}/config`);
  return { ok: true as const, coordenadorNome: coordenador.nome };
}

export async function removerCoordenador(turmaId: string, vinculoId: string) {
  await requireTurmaResponsavel(turmaId);
  await prisma.turmaCoordenador.delete({ where: { id: vinculoId } });
  revalidatePath(`/turmas/${turmaId}/config`);
}

/**
 * Só o RESPONSAVEL da disciplina libera/trava o lançamento de nota de cada período (SR1/SR2)
 * pra pessoa orientadora — enquanto travado, ela não consegue lançar/editar a própria nota (nem
 * pela tela, nem direto na action salvarNota).
 */
export async function alternarLiberacaoNotas(turmaId: string, periodo: "SR1" | "SR2", formData: FormData) {
  await requireTurmaResponsavel(turmaId);
  const liberado = formData.get("liberado") === "on";

  await prisma.turma.update({
    where: { id: turmaId },
    data: periodo === "SR1" ? { notasSR1Liberadas: liberado } : { notasSR2Liberadas: liberado },
  });

  // Páginas de aluno são renderizadas sob demanda (não estáticas), então não precisam de
  // revalidação explícita aqui — só a tela de configurações mesmo.
  revalidatePath(`/turmas/${turmaId}/config`);
}

/**
 * Arquiva a turma: some da visão de quem é RESPONSAVEL/orientador (ver Turma.arquivadaEm e o
 * bloqueio em requireTurmaResponsavel/requireAlunoAccess) — só a coordenação continua com
 * acesso, e só ela consegue restaurar (`restaurarTurma`). Não apaga nenhum dado.
 */
export async function arquivarTurma(turmaId: string) {
  await requireTurmaResponsavel(turmaId);

  await prisma.turma.update({ where: { id: turmaId }, data: { arquivadaEm: new Date() } });

  revalidatePath("/turmas");
  revalidatePath("/meus-alunos");
  revalidatePath("/coordenador");
  redirect("/turmas");
}

/**
 * Restaura uma turma arquivada — só quem é coordenador DAQUELA turma especificamente (não
 * qualquer coordenador do sistema), diferente de `arquivarTurma` que qualquer RESPONSAVEL
 * também pode fazer.
 */
export async function restaurarTurma(turmaId: string) {
  const { coordenadorId } = await requireCoordenadorAccess();

  const turma = await prisma.turma.findUnique({ where: { id: turmaId } });
  if (!turma) redirect("/coordenador");

  const ehCoordenadorDelas =
    turma.coordenadorId === coordenadorId ||
    !!(await prisma.turmaCoordenador.findFirst({ where: { turmaId, coordenadorId } }));
  if (!ehCoordenadorDelas) redirect("/coordenador");

  await prisma.turma.update({ where: { id: turmaId }, data: { arquivadaEm: null } });

  revalidatePath("/turmas");
  revalidatePath("/meus-alunos");
  revalidatePath("/coordenador");
  redirect(`/turmas/${turmaId}`);
}
