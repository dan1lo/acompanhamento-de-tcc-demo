import { prisma } from "./prisma";
import { computeStatus, type AlunoStatus } from "./semaforo";

export async function getTurmaCompleta(turmaId: string) {
  const turma = await prisma.turma.findUnique({
    where: { id: turmaId },
    include: {
      ciclos: true,
      coordenador: true,
      vinculos: { include: { professor: true } },
      alunos: {
        include: {
          orientador: true,
          relatorios: true,
          observacoes: true,
        },
      },
    },
  });
  return turma;
}

type TurmaCompleta = NonNullable<Awaited<ReturnType<typeof getTurmaCompleta>>>;
type AlunoCompleto = TurmaCompleta["alunos"][number];

export function statusesPorTurma(turma: TurmaCompleta): AlunoStatus<AlunoCompleto>[] {
  return turma.alunos.map((aluno) =>
    computeStatus(aluno, turma, turma.ciclos, aluno.relatorios, aluno.observacoes)
  );
}

/** Nomes canônicos de grupo (ex.: "Grupo 01") já em uso por algum aluno da turma, ordenados. */
export async function getGruposDisponiveis(turmaId: string): Promise<string[]> {
  const alunosComGrupo = await prisma.aluno.findMany({
    where: { turmaId, grupo: { not: null } },
    select: { grupo: true },
    distinct: ["grupo"],
  });
  return alunosComGrupo.map((a) => a.grupo!).sort();
}
