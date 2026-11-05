import { redirect } from "next/navigation";
import { prisma } from "./prisma";
import { getSession, type Session } from "./auth";

/** Turma.coordenadorId (legado) OU vínculo em TurmaCoordenador — pode ter mais de um coordenador. */
async function ehCoordenadorDaTurma(turmaId: string, coordenadorId: string, coordenadorIdLegado: string | null): Promise<boolean> {
  if (coordenadorIdLegado === coordenadorId) return true;
  const vinculo = await prisma.turmaCoordenador.findFirst({ where: { turmaId, coordenadorId } });
  return !!vinculo;
}

/**
 * Um Professor pode TAMBÉM ser coordenador (Coordenador.professorId apontando de volta pra ele) —
 * uma pessoa só, um login só, mais de um papel. Retorna o id do Coordenador vinculado, ou null se
 * esse professor não tiver esse papel extra. Exportada porque a busca global de alunos
 * (buscaGlobal.ts) precisa da mesma resolução de escopo.
 */
export async function coordenadorIdDoProfessor(professorId: string): Promise<string | null> {
  const coordenador = await prisma.coordenador.findUnique({ where: { professorId } });
  return coordenador?.id ?? null;
}

/** Resolve se quem está logado é coordenador (login próprio ou vinculado via Professor) daquela turma. */
async function souCoordenadorDaTurma(session: Session, turmaId: string, coordenadorIdLegado: string | null): Promise<boolean> {
  if (session.kind === "coordenador") return ehCoordenadorDaTurma(turmaId, session.id, coordenadorIdLegado);
  const coordenadorId = await coordenadorIdDoProfessor(session.id);
  return coordenadorId ? ehCoordenadorDaTurma(turmaId, coordenadorId, coordenadorIdLegado) : false;
}

/**
 * Garante que quem está logado pode ver o painel da turma: o professor RESPONSAVEL daquela
 * turma, ou algum dos coordenadores dela (login próprio de Coordenador, ou Professor com esse
 * papel vinculado). Orientadores NÃO entram aqui — o escopo deles é "apenas os alunos a ele
 * alocados", não a turma inteira.
 */
export async function requireTurmaResponsavel(turmaId: string) {
  const session = await getSession();
  if (!session) redirect("/login");

  const turma = await prisma.turma.findUnique({ where: { id: turmaId } });
  if (!turma) redirect("/login");

  // Turma arquivada some pra quem é responsável/orientador — só a coordenação continua com
  // acesso (pra poder restaurar). Ver Turma.arquivadaEm no schema.
  if (turma.arquivadaEm && !(await souCoordenadorDaTurma(session, turmaId, turma.coordenadorId))) {
    redirect("/turmas");
  }

  if (session.kind === "coordenador") {
    if (await ehCoordenadorDaTurma(turmaId, session.id, turma.coordenadorId)) return session;
    redirect("/login");
  }

  const vinculo = await prisma.turmaProfessor.findFirst({
    where: { turmaId, professorId: session.id, papel: "RESPONSAVEL" },
  });
  if (vinculo) return session;

  const coordenadorId = await coordenadorIdDoProfessor(session.id);
  if (coordenadorId && (await ehCoordenadorDaTurma(turmaId, coordenadorId, turma.coordenadorId))) return session;

  redirect("/login");
}

/**
 * Garante que quem está logado pode ver a ficha do aluno: o professor RESPONSAVEL da turma do
 * aluno, o orientador atual do aluno, ou algum dos coordenadores da turma.
 */
export async function requireAlunoAccess(alunoId: string) {
  const session = await getSession();
  if (!session) redirect("/login");

  const aluno = await prisma.aluno.findUnique({ where: { id: alunoId }, include: { turma: true } });
  if (!aluno) redirect("/login");

  if (aluno.turma.arquivadaEm && !(await souCoordenadorDaTurma(session, aluno.turmaId, aluno.turma.coordenadorId))) {
    redirect("/turmas");
  }

  if (session.kind === "coordenador") {
    if (await ehCoordenadorDaTurma(aluno.turmaId, session.id, aluno.turma.coordenadorId)) return { session, aluno };
    redirect("/login");
  }

  if (aluno.orientadorId === session.id) return { session, aluno };

  const vinculo = await prisma.turmaProfessor.findFirst({
    where: { turmaId: aluno.turmaId, professorId: session.id, papel: "RESPONSAVEL" },
  });
  if (vinculo) return { session, aluno };

  const coordenadorId = await coordenadorIdDoProfessor(session.id);
  if (coordenadorId && (await ehCoordenadorDaTurma(aluno.turmaId, coordenadorId, aluno.turma.coordenadorId))) {
    return { session, aluno };
  }

  redirect("/login");
}

/**
 * Restrição por grupo pra pessoas RESPONSAVEL: null = enxerga todos os alunos da turma
 * (coordenador, ou responsável sem restrição configurada — comportamento de sempre). Um array
 * (mesmo vazio) restringe a visão só aos grupos listados.
 */
export async function getGruposResponsavel(turmaId: string, session: Session): Promise<string[] | null> {
  if (session.kind === "coordenador") return null;

  const coordenadorId = await coordenadorIdDoProfessor(session.id);
  if (coordenadorId) {
    const turma = await prisma.turma.findUnique({ where: { id: turmaId } });
    if (turma && (await ehCoordenadorDaTurma(turmaId, coordenadorId, turma.coordenadorId))) return null;
  }

  const vinculo = await prisma.turmaProfessor.findFirst({
    where: { turmaId, professorId: session.id, papel: "RESPONSAVEL" },
  });
  if (!vinculo?.gruposResponsavel) return null;

  try {
    const parsed = JSON.parse(vinculo.gruposResponsavel);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Quem pode ver conteúdo marcado como "oculto da pessoa orientadora" (impedimento, observações):
 * qualquer RESPONSAVEL da turma, ou qualquer coordenador dela. A própria pessoa orientadora — o
 * alvo da ocultação — nunca entra aqui, mesmo sendo responsável por outra turma.
 */
export async function podeVerConteudoOcultoDoOrientador(turmaId: string, session: Session): Promise<boolean> {
  if (session.kind === "coordenador") {
    const turma = await prisma.turma.findUnique({ where: { id: turmaId } });
    if (!turma) return false;
    return ehCoordenadorDaTurma(turmaId, session.id, turma.coordenadorId);
  }

  const vinculo = await prisma.turmaProfessor.findFirst({
    where: { turmaId, professorId: session.id, papel: "RESPONSAVEL" },
  });
  if (vinculo) return true;

  const coordenadorId = await coordenadorIdDoProfessor(session.id);
  if (coordenadorId) {
    const turma = await prisma.turma.findUnique({ where: { id: turmaId } });
    if (turma && (await ehCoordenadorDaTurma(turmaId, coordenadorId, turma.coordenadorId))) return true;
  }

  return false;
}

/**
 * Garante acesso ao Painel do coordenador e resolve o coordenadorId de verdade a usar nas
 * queries — que é `session.id` pra um login de Coordenador "puro", mas o id do Coordenador
 * VINCULADO quando quem está logado é um Professor com esse papel extra (o `session.id` dele é
 * o id de Professor, não o de Coordenador).
 */
export async function requireCoordenadorAccess() {
  const session = await getSession();
  if (!session) redirect("/login");

  if (session.kind === "coordenador") return { session, coordenadorId: session.id };

  const coordenadorId = await coordenadorIdDoProfessor(session.id);
  if (!coordenadorId) redirect("/login");

  return { session, coordenadorId };
}

/**
 * Quem pode gerar o relatório em lote de uma pessoa orientadora (`turmas/[id]/orientadores/
 * [orientadorId]/relatorio`): qualquer RESPONSAVEL ou coordenador da turma (pode pedir de
 * qualquer orientador), ou a própria pessoa orientadora pedindo o relatório dela mesma.
 */
export async function requireOrientadorRelatorioAccess(turmaId: string, orientadorId: string) {
  const session = await getSession();
  if (!session) redirect("/login");

  if (session.kind === "professor" && session.id === orientadorId) return session;

  const turma = await prisma.turma.findUnique({ where: { id: turmaId } });
  if (!turma) redirect("/login");

  if (session.kind === "coordenador") {
    if (await ehCoordenadorDaTurma(turmaId, session.id, turma.coordenadorId)) return session;
    redirect("/login");
  }

  const vinculo = await prisma.turmaProfessor.findFirst({
    where: { turmaId, professorId: session.id, papel: "RESPONSAVEL" },
  });
  if (vinculo) return session;

  const coordenadorId = await coordenadorIdDoProfessor(session.id);
  if (coordenadorId && (await ehCoordenadorDaTurma(turmaId, coordenadorId, turma.coordenadorId))) return session;

  redirect("/login");
}

/**
 * Garante uma sessão de Professor (não Coordenador) — usado por telas/ações que só fazem sentido
 * pra quem tem conta de Professor (criar turma, "Meus orientandos" etc.), sem exigir nenhum
 * vínculo específico além disso.
 */
export async function requireProfessor(): Promise<Session & { kind: "professor" }> {
  const session = await getSession();
  if (!session || session.kind !== "professor") redirect("/login");
  return session;
}

/**
 * Área de admin é aberta pra quem tem `Professor.isAdmin = true` — não é uma conta separada,
 * é o mesmo login de Professor com esse poder a mais.
 */
export async function requireAdmin() {
  const session = await requireProfessor();

  const professor = await prisma.professor.findUnique({ where: { id: session.id } });
  if (!professor?.isAdmin) redirect("/login");

  return { session, professor };
}
