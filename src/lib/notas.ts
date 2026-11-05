import type { DetalheCiclo } from "./semaforo";

/**
 * Nota automática = nota de presença, numa escala de 0 a 10, proporcional às faltas (relatório +
 * reunião) sobre o MÁXIMO POSSÍVEL até agora — não o limite de faltas da disciplina inteira (esse
 * é só o teto pra reprovar no semestre todo). O teto por ciclo é sempre 3 (o pior caso, "faltou
 * tudo" num ciclo com reunião prevista, também vale 3 — não soma nem multiplica as duas faltas
 * isoladas, ver semaforo.ts). Ex.: até agora só venceram 3 ciclos → máximo possível 9; aluno com
 * 6 faltas reais → 6/9 = 66,7% de falta → nota automática (1 - 0,667) * 10 ≈ 3,33.
 *
 * SR1/SR2 têm faltas separadas: `cicloCorteSR1` é o último numeroCiclo que conta pra SR1 — a
 * contagem reinicia do zero pra SR2 a partir do ciclo seguinte (ver `Turma.cicloCorteSR1`).
 */
export function computeNotaAutomaticaPorPeriodo(
  detalhePorCiclo: DetalheCiclo[],
  periodo: "SR1" | "SR2",
  cicloCorteSR1: number | null
): number {
  const ciclosDoPeriodo =
    periodo === "SR1"
      ? detalhePorCiclo.filter((d) => cicloCorteSR1 === null || d.numeroCiclo <= cicloCorteSR1)
      : detalhePorCiclo.filter((d) => cicloCorteSR1 !== null && d.numeroCiclo > cicloCorteSR1);

  const faltas = ciclosDoPeriodo.reduce((soma, d) => soma + d.faltas, 0);
  const maxPossivel = ciclosDoPeriodo.length * 3;

  if (maxPossivel === 0) return 10; // nenhum ciclo nesse período ainda — não penaliza por algo que não aconteceu
  const proporcaoFalta = Math.min(faltas / maxPossivel, 1);
  return Math.round((1 - proporcaoFalta) * 10 * 100) / 100;
}

/**
 * Combina nota do orientador + nota automática de presença pelo peso configurado na turma.
 * `pesoOrientador` é o peso da pessoa ORIENTADORA (ex.: 0.6 = 60%) — o resto vai pra nota
 * automática de presença.
 */
export function computeNotaFinal(
  notaAutomatica: number | null,
  notaOrientador: number | null,
  pesoOrientador: number
): number | null {
  if (notaAutomatica === null && notaOrientador === null) return null;
  if (notaOrientador === null) return notaAutomatica;
  if (notaAutomatica === null) return notaOrientador;
  const nota = pesoOrientador * notaOrientador + (1 - pesoOrientador) * notaAutomatica;
  return Math.round(nota * 100) / 100;
}
