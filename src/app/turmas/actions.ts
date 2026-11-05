"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireProfessor } from "@/lib/authz";

export async function createTurma(formData: FormData) {
  const { id: professorId } = await requireProfessor();

  const nome = String(formData.get("nome") ?? "").trim();
  const periodoLetivo = String(formData.get("periodoLetivo") ?? "").trim();
  const disciplina = String(formData.get("disciplina") ?? "").trim();
  const coordenadorId = String(formData.get("coordenadorId") ?? "") || null;

  if (!nome || !periodoLetivo || !disciplina) return;

  const turma = await prisma.turma.create({
    data: {
      nome,
      periodoLetivo,
      disciplina,
      coordenadorId,
      vinculos: {
        create: { professorId, papel: "RESPONSAVEL" },
      },
    },
  });

  revalidatePath("/turmas");
  redirect(`/turmas/${turma.id}`);
}
