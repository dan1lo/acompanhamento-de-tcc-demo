import type { CicloData } from "@prisma/client";

/**
 * numeroRelatorio corresponde ao ENÉSIMO ciclo que conta (não ao numeroCiclo bruto): ciclos
 * marcados `semEncontro` não pedem relatório numerado, então relatório 1 é o primeiro ciclo que
 * conta, relatório 2 o segundo, etc. — confirmado contra dados reais (relatório 1 caindo no
 * ciclo 3, relatório 2 no ciclo 4, quando os ciclos 1 e 2 são "sem encontro"/onboarding).
 *
 * `numeroRelatorioManual`, quando setado num ciclo, reinicia a contagem a partir dele (os ciclos
 * seguintes continuam a numeração a partir desse valor, não do índice sequencial puro) — usado
 * quando o calendário muda no meio do período e os alunos já numeraram os relatórios deles pelo
 * esquema antigo, sem como corrigir a resposta enviada (ver comentário no schema).
 *
 * Usado tanto pelo cálculo de faltas (`semaforo.ts`) quanto pela tela de Reuniões, pra garantir
 * que os dois concordem sobre qual relatório pertence a qual ciclo.
 */
export function indiceDoCicloMap(ciclos: CicloData[]): Map<number, number> {
  const contaveis = [...ciclos].filter((c) => !c.semEncontro).sort((a, b) => a.numeroCiclo - b.numeroCiclo);
  const map = new Map<number, number>();
  let contador = 0;
  for (const c of contaveis) {
    contador = c.numeroRelatorioManual ?? contador + 1;
    map.set(c.numeroCiclo, contador);
  }
  return map;
}

/** Índice de relatório (numeroRelatorio esperado) pro numeroCiclo dado, ou undefined se o ciclo não conta. */
export function indiceRelatorioDoCiclo(ciclos: CicloData[], numeroCiclo: number): number | undefined {
  return indiceDoCicloMap(ciclos).get(numeroCiclo);
}

/**
 * `CicloData.gruposComReuniao` é um JSON guardado como string (ex.: '["Grupo 01","Grupo 03"]',
 * '["TODOS"]' ou '[]') — helper único pra não repetir o mesmo `JSON.parse` com fallback em cada
 * tela que precisa ler isso.
 */
export function parseGruposComReuniao(gruposComReuniaoJson: string): string[] {
  try {
    const parsed = JSON.parse(gruposComReuniaoJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
