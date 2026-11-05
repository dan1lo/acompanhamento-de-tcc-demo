"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTurmaResponsavel } from "@/lib/authz";

/**
 * Grupos com reunião prevista costumam vir do upload da agenda (planilha), mas dá pra editar
 * manualmente aqui também — útil pra um ciclo novo isolado, sem precisar subir uma planilha só
 * por causa dele. "todosOsGrupos" marcado vence os checkboxes individuais.
 */
export async function addCiclo(turmaId: string, formData: FormData) {
  await requireTurmaResponsavel(turmaId);
  const numeroCiclo = Number(formData.get("numeroCiclo"));
  const dataPrevista = new Date(String(formData.get("dataPrevista")));
  if (Number.isNaN(numeroCiclo) || Number.isNaN(dataPrevista.getTime())) return;

  const todosOsGrupos = formData.get("todosOsGrupos") === "on";
  const gruposSelecionados = formData.getAll("grupos").map(String);
  const gruposComReuniao = JSON.stringify(todosOsGrupos ? ["TODOS"] : gruposSelecionados);

  const numeroRelatorioManualRaw = String(formData.get("numeroRelatorioManual") ?? "").trim();
  const numeroRelatorioManual = numeroRelatorioManualRaw ? Number(numeroRelatorioManualRaw) : null;

  await prisma.cicloData.upsert({
    where: { turmaId_numeroCiclo: { turmaId, numeroCiclo } },
    create: { turmaId, numeroCiclo, dataPrevista, gruposComReuniao, numeroRelatorioManual },
    update: { dataPrevista, gruposComReuniao, numeroRelatorioManual },
  });

  revalidatePath(`/turmas/${turmaId}/calendario`);
  revalidatePath(`/turmas/${turmaId}`);
  revalidatePath(`/turmas/${turmaId}/reunioes`);
}

export async function gerarCiclosSemanais(turmaId: string, formData: FormData) {
  await requireTurmaResponsavel(turmaId);
  const inicio = new Date(String(formData.get("dataInicio")));
  const quantidade = Number(formData.get("quantidade"));
  if (Number.isNaN(inicio.getTime()) || !quantidade || quantidade < 1) return;

  for (let i = 0; i < quantidade; i++) {
    const dataPrevista = new Date(inicio);
    dataPrevista.setDate(dataPrevista.getDate() + i * 7);
    await prisma.cicloData.upsert({
      where: { turmaId_numeroCiclo: { turmaId, numeroCiclo: i + 1 } },
      create: { turmaId, numeroCiclo: i + 1, dataPrevista },
      update: { dataPrevista },
    });
  }

  revalidatePath(`/turmas/${turmaId}/calendario`);
}

export async function removeCiclo(turmaId: string, cicloId: string) {
  await requireTurmaResponsavel(turmaId);
  await prisma.cicloData.delete({ where: { id: cicloId } });
  revalidatePath(`/turmas/${turmaId}/calendario`);
}

/**
 * Override manual pra excluir um ciclo do cálculo de faltas e da tela de Reuniões,
 * independente do que a agenda importada calculou (ex.: um ciclo de "todo mundo" que na
 * prática foi só apresentação/onboarding, sem cobrança real de relatório ainda).
 */
export async function definirContagemCiclo(turmaId: string, cicloId: string, formData: FormData) {
  await requireTurmaResponsavel(turmaId);
  const conta = formData.get("conta") === "on";
  await prisma.cicloData.update({ where: { id: cicloId }, data: { semEncontro: !conta } });
  revalidatePath(`/turmas/${turmaId}/calendario`);
  revalidatePath(`/turmas/${turmaId}`);
  revalidatePath(`/turmas/${turmaId}/reunioes`);
}
