"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTurmaResponsavel } from "@/lib/authz";
import { indiceRelatorioDoCiclo } from "@/lib/ciclos";

function triState(value: FormDataEntryValue | null): boolean | null {
  if (value === "sim") return true;
  if (value === "nao") return false;
  return null;
}

export async function salvarRelatorioReuniao(
  turmaId: string,
  alunoId: string,
  numeroCiclo: number,
  _prevState: unknown,
  formData: FormData
) {
  await requireTurmaResponsavel(turmaId);

  const ciclos = await prisma.cicloData.findMany({ where: { turmaId } });
  // numeroRelatorio não é igual a numeroCiclo quando existem ciclos "sem encontro" antes deste —
  // ver src/lib/ciclos.ts. Sem essa conversão, gravaríamos no número de relatório errado.
  const numeroRelatorio = indiceRelatorioDoCiclo(ciclos, numeroCiclo);
  if (numeroRelatorio === undefined) return { erro: "Esse ciclo não conta relatório (marcado como sem encontro)." };

  const existente = await prisma.relatorioSemanal.findUnique({
    where: { alunoId_numeroRelatorio: { alunoId, numeroRelatorio } },
  });

  const presencaReuniaoDisciplina = triState(formData.get("presencaReuniaoDisciplina"));
  const cronogramaEmDia = triState(formData.get("cronogramaEmDia"));
  const impedimento = formData.get("impedimento") === "on";
  const impedimentoDesc = String(formData.get("impedimentoDesc") ?? "").trim() || null;
  const oQueFez = String(formData.get("oQueFez") ?? "").trim() || null;
  const oQuePretende = String(formData.get("oQuePretende") ?? "").trim() || null;
  const linkCronograma = String(formData.get("linkCronograma") ?? "").trim() || null;
  const tituloTcc = String(formData.get("tituloTcc") ?? "").trim() || null;

  await prisma.aluno.update({ where: { id: alunoId }, data: { tituloTcc } });

  // Nunca escrever `teveReuniao` nem `dataUltimaReuniao` aqui — os dois são auto-relatados pelo
  // ALUNO no Forms, sobre a reunião dele com a pessoa ORIENTADORA (evento independente). Essa
  // action é a pessoa orientadora/responsável confirmando a presença na reunião DA DISCIPLINA
  // (presencaReuniaoDisciplina) — é esse campo que entra no cálculo de falta/nota.
  await prisma.relatorioSemanal.upsert({
    where: { alunoId_numeroRelatorio: { alunoId, numeroRelatorio } },
    create: {
      alunoId,
      numeroRelatorio,
      timestampEnvio: existente?.timestampEnvio ?? new Date(),
      cronogramaEmDia,
      presencaReuniaoDisciplina,
      impedimento,
      impedimentoDesc,
      oQueFez,
      oQuePretende,
      linkCronograma,
    },
    update: {
      cronogramaEmDia,
      presencaReuniaoDisciplina,
      impedimento,
      impedimentoDesc,
      oQueFez,
      oQuePretende,
      linkCronograma,
    },
  });

  revalidatePath(`/turmas/${turmaId}/reunioes/${numeroCiclo}`);
  revalidatePath(`/alunos/${alunoId}`);
  return { ok: true as const };
}
