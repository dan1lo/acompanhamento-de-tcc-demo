import type { AlunoStatus } from "./semaforo";
import type { DetalheCiclo } from "./semaforo";

/** Versão curta do que faltou, pra caber numa célula — "Entrega", "Reunião" ou os dois juntos. */
export function motivoCurto(d: DetalheCiclo): string {
  if (!d.reuniaoPrevista) return "Entrega";
  const faltouEntrega = !d.relatorioEntregue;
  const faltouReuniao = d.foiAReuniao === false;
  if (faltouEntrega && faltouReuniao) return "Entrega e Reunião";
  if (faltouReuniao) return "Reunião";
  return "Entrega";
}

export type CelulaFalta = { faltou: boolean; motivo: string | null; faltas: number };
export type LinhaFaltas = { alunoId: string; alunoNome: string; celulas: CelulaFalta[]; totalFaltas: number };

/**
 * Pivô "um aluno por linha, um ciclo por coluna" — mesma fonte usada pelo CSV
 * (`turmas/[id]/export/faltas`) e pela tabela em tela (`turmas/[id]/faltas-por-dia`), pra nunca
 * as duas apresentações divergirem. `dias` vem do primeiro status disponível porque todo mundo
 * na turma compartilha o mesmo conjunto de ciclos considerados (o grupo de cada um só decide se
 * aquele dia TINHA reunião prevista pra ele, não se o dia existe ou não na lista).
 */
export function montarPivotDeFaltas(statuses: AlunoStatus[]): { dias: DetalheCiclo[]; linhas: LinhaFaltas[] } {
  const dias = statuses[0]?.detalhePorCiclo ?? [];

  const linhas = statuses.map((s) => {
    const porNumeroCiclo = new Map(s.detalhePorCiclo.map((d) => [d.numeroCiclo, d]));
    const celulas = dias.map((diaRef): CelulaFalta => {
      const d = porNumeroCiclo.get(diaRef.numeroCiclo);
      if (!d || d.faltas <= 0) return { faltou: false, motivo: null, faltas: 0 };
      return { faltou: true, motivo: motivoCurto(d), faltas: d.faltas };
    });
    return { alunoId: s.aluno.id, alunoNome: s.aluno.nome, celulas, totalFaltas: s.totalFaltas };
  });

  return { dias, linhas };
}
