import type { TurmaProfessor, Professor } from "@prisma/client";

/** Pessoas orientadoras vinculadas à turma — extrai o Professor de cada vínculo com esse papel. */
export function orientadoresDaTurma<V extends TurmaProfessor & { professor: Professor }>(vinculos: V[]): Professor[] {
  return vinculos.filter((v) => v.papel === "ORIENTADOR").map((v) => v.professor);
}

/** Ids dos professores RESPONSAVEL pela turma — usado pra separar a situação/observações da
 * disciplina das da pessoa orientadora (ver `situacaoAtualDeAutores`). */
export function responsavelIdsDaTurma(vinculos: TurmaProfessor[]): string[] {
  return vinculos.filter((v) => v.papel === "RESPONSAVEL").map((v) => v.professorId);
}
