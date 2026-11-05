import { prisma } from "./prisma";
import { sugerirCandidatoUnico } from "./matching";
import { normalizeName } from "./normalize";
import type { Professor } from "@prisma/client";

/**
 * Acha um Professor já cadastrado por e-mail (exato) ou nome (normalizado, com sugestão de
 * candidato único como fallback pra pequenas variações de grafia) — cria um novo só se ninguém
 * bater. Mesma lógica usada tanto por quem já é responsável de uma turma adicionando outra
 * pessoa (configActions.ts) quanto pelo admin alocando professores em qualquer turma.
 */
export async function encontrarOuCriarProfessor(nome: string, email: string | null): Promise<Professor> {
  let professor = email ? await prisma.professor.findUnique({ where: { email } }) : null;

  if (!professor) {
    const normAlvo = normalizeName(nome);
    const todos = await prisma.professor.findMany();
    professor =
      todos.find((p) => normalizeName(p.nome) === normAlvo) ??
      todos.find(
        (p) => p.id === sugerirCandidatoUnico(normAlvo, todos.map((t) => ({ id: t.id, nomeNormalizado: normalizeName(t.nome) })))?.id
      ) ??
      null;
  }

  if (!professor) {
    professor = await prisma.professor.create({ data: { nome, email } });
  }

  return professor;
}
