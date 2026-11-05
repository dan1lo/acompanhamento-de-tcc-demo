"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCoordenadorAccess } from "@/lib/authz";

export async function criarTurmaComoResponsavel(formData: FormData) {
  const { coordenadorId } = await requireCoordenadorAccess();

  const nome = String(formData.get("nome") ?? "").trim();
  const periodoLetivo = String(formData.get("periodoLetivo") ?? "").trim();
  const disciplina = String(formData.get("disciplina") ?? "").trim();
  const responsavelNome = String(formData.get("responsavelNome") ?? "").trim();
  const responsavelEmail = String(formData.get("responsavelEmail") ?? "").trim();

  if (!nome || !periodoLetivo || !disciplina || !responsavelNome || !responsavelEmail) return;

  let responsavel = await prisma.professor.findUnique({ where: { email: responsavelEmail } });
  if (!responsavel) {
    responsavel = await prisma.professor.create({ data: { nome: responsavelNome, email: responsavelEmail } });
  }

  await prisma.turma.create({
    data: {
      nome,
      periodoLetivo,
      disciplina,
      coordenadorId,
      vinculos: { create: { professorId: responsavel.id, papel: "RESPONSAVEL" } },
    },
  });

  revalidatePath("/coordenador");
}

export async function vincularResponsavel(formData: FormData) {
  await requireCoordenadorAccess();

  const turmaId = String(formData.get("turmaId") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  if (!turmaId || !nome || !email) return;

  let professor = await prisma.professor.findUnique({ where: { email } });
  if (!professor) {
    professor = await prisma.professor.create({ data: { nome, email } });
  }

  await prisma.turmaProfessor.upsert({
    where: { turmaId_professorId_papel: { turmaId, professorId: professor.id, papel: "RESPONSAVEL" } },
    create: { turmaId, professorId: professor.id, papel: "RESPONSAVEL" },
    update: {},
  });

  revalidatePath("/coordenador");
}
