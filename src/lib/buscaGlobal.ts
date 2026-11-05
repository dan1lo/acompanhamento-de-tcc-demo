import { prisma } from "./prisma";
import { normalizeName } from "./normalize";
import { coordenadorIdDoProfessor } from "./authz";
import type { Session } from "./auth";

export type ResultadoBusca = { id: string; nome: string; turmaNome: string };

/**
 * Busca alunos por nome, respeitando o MESMO escopo de acesso já usado em `authz.ts` (nunca
 * devolve nomes de turma que a pessoa logada não teria acesso ao abrir a ficha diretamente): pessoa
 * orientadora vê seus orientandos, RESPONSAVEL vê a turma inteira, coordenador (login próprio ou
 * vinculado a um Professor) vê as turmas que coordena. `Professor.isAdmin` NÃO amplia esse escopo —
 * admin só aloca papéis, não ganha visão de conteúdo à toa (ver `requireAdmin` em authz.ts).
 */
export async function buscarAlunosAcessiveis(query: string, session: Session): Promise<ResultadoBusca[]> {
  const termo = normalizeName(query);
  if (!termo) return [];

  const orCondicoes: Array<Record<string, unknown>> = [];

  if (session.kind === "coordenador") {
    orCondicoes.push({ turma: { OR: [{ coordenadorId: session.id }, { coordenadores: { some: { coordenadorId: session.id } } }] } });
  } else {
    orCondicoes.push({ orientadorId: session.id });
    orCondicoes.push({ turma: { vinculos: { some: { professorId: session.id, papel: "RESPONSAVEL" } } } });
    const coordenadorId = await coordenadorIdDoProfessor(session.id);
    if (coordenadorId) {
      orCondicoes.push({ turma: { OR: [{ coordenadorId }, { coordenadores: { some: { coordenadorId } } }] } });
    }
  }

  const alunos = await prisma.aluno.findMany({
    where: { nomeNormalizado: { contains: termo }, OR: orCondicoes },
    include: { turma: true },
    take: 8,
    orderBy: { nome: "asc" },
  });

  return alunos.map((a) => ({ id: a.id, nome: a.nome, turmaNome: a.turma.nome }));
}
