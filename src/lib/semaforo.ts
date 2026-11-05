import type { Aluno, CicloData, Observacao, RelatorioSemanal, Turma } from "@prisma/client";
import { indiceDoCicloMap, parseGruposComReuniao } from "./ciclos";

/**
 * Cálculo do semáforo a partir dos limiares configuráveis por turma.
 *
 * Regra de faltas (confirmada com o Danilo): os atendimentos são quinzenais, por grupo (o
 * calendário — ver `parseAgenda.ts` — diz quais grupos têm reunião prevista em cada ciclo);
 * o relatório é semanal e numeroRelatorio corresponde ao ENÉSIMO ciclo que conta, não ao
 * numeroCiclo bruto (ver `ciclos.ts`). Entregar o relatório e comparecer à reunião são duas
 * coisas independentes — cada uma pode faltar sozinha ou as duas juntas, com custo maior nesse
 * último caso. Por ciclo já vencido (exceto os marcados `semEncontro`, onde o relatório não é
 * exigido de ninguém):
 *
 * - Sem reunião prevista pro aluno naquele ciclo + não mandou relatório → 3 faltas.
 * - Com reunião prevista:
 *   - mandou relatório + foi à reunião → 0
 *   - mandou relatório + faltou a reunião → 2
 *   - não mandou relatório + foi à reunião (apareceu mas não preencheu o Forms) → 2
 *   - não mandou relatório + faltou a reunião (faltou tudo) → 3 (mesmo teto do caso "sem reunião
 *     prevista" acima, não soma as duas faltas isoladas nem multiplica — confirmado com o Danilo)
 * - Qualquer outro caso → 0 falta nesse ciclo.
 *
 * "Mandou relatório" é `RelatorioSemanal.relatorioEntregue`, não a mera existência da linha —
 * uma linha pode existir só porque o professor marcou presença na tela de Reuniões sem o aluno
 * ter enviado nada (ver `relatorioEntregue` no schema).
 *
 * Status (também confirmado): vermelho é reprovação de verdade — atingiu o limite de faltas da
 * disciplina (`limiteFaltas`, ex.: 11 no TCC, 14 no Pré-Projeto). Amarelo é alerta, não
 * reprovação: ou já está perto do limite (dentro do `bufferAmarelo`, ex.: 8 de 11), ou tem um
 * padrão de risco (`faltasConsecutivasAlerta` ciclos seguidos com falta) mesmo estando longe do
 * limite numérico ainda. Um impedimento sem resposta tem prioridade de exibição sobre os dois —
 * é o mais urgente de resolver, mas não é a mesma coisa que estar reprovando.
 */

/** Um item por ciclo considerado, na ordem cronológica — base do relatório exportável do aluno. */
export type DetalheCiclo = {
  numeroCiclo: number;
  dataPrevista: Date;
  reuniaoPrevista: boolean;
  relatorioEntregue: boolean;
  /** null quando não havia reunião prevista pro aluno nesse ciclo (pergunta não se aplica). */
  foiAReuniao: boolean | null;
  faltas: number;
  descricao: string;
  /** Direto do RelatorioSemanal daquele ciclo específico — null se não entregue, nunca herdado. */
  oQueFez: string | null;
  oQuePretende: string | null;
};

export type AlunoStatus<A extends Aluno = Aluno> = {
  aluno: A;
  status: "vermelho" | "amarelo" | "verde" | "impedimento";
  /** Nº de ciclos considerados (exclui "sem encontro" e ciclos sem grupo conhecido). */
  ciclosConsiderados: number;
  /** Relatórios semanais que faltam entre os ciclos considerados (não entregues). */
  relatoriosNaoEntregues: number;
  /** Faltas especificamente em reuniões previstas (não conta semana sem reunião marcada). */
  faltasReuniao: number;
  /** Total de faltas na "moeda" da disciplina — o que conta pro limite de reprovação. */
  totalFaltas: number;
  /** Mantido por compatibilidade (nota automática, telas que ainda mostram %). */
  pctEntrega: number;
  pctFaltas: number;
  faltasConsecutivas: number;
  ultimoEnvio: Date | null;
  impedimentoAberto: boolean;
  semOrientador: boolean;
  grupoDesconhecido: boolean;
  motivos: string[];
  detalhePorCiclo: DetalheCiclo[];
};

function ciclosVencidos(ciclos: CicloData[]): CicloData[] {
  const agora = new Date();
  return ciclos
    .filter((c) => c.dataPrevista <= agora)
    .sort((a, b) => a.numeroCiclo - b.numeroCiclo);
}


export function computeStatus<A extends Aluno>(
  aluno: A,
  turma: Turma,
  ciclos: CicloData[],
  relatorios: RelatorioSemanal[],
  observacoes: Observacao[]
): AlunoStatus<A> {
  const motivos: string[] = [];
  const relatorioPorNumero = new Map(relatorios.map((r) => [r.numeroRelatorio, r]));
  const indiceDoCiclo = indiceDoCicloMap(ciclos);

  let totalFaltas = 0;
  let faltasReuniao = 0;
  let ciclosConsiderados = 0;
  let ciclosComRelatorio = 0;
  let grupoDesconhecido = false;
  const faltaPorCiclo: boolean[] = []; // na ordem dos ciclos considerados, do mais antigo pro mais recente
  const detalhePorCiclo: DetalheCiclo[] = [];

  for (const ciclo of ciclosVencidos(ciclos)) {
    if (ciclo.semEncontro) continue;

    const grupos = parseGruposComReuniao(ciclo.gruposComReuniao);
    let reuniaoPrevista: boolean;
    if (grupos.includes("TODOS")) {
      reuniaoPrevista = true;
    } else if (!aluno.grupo) {
      grupoDesconhecido = true;
      continue; // sem saber o grupo, não dá pra afirmar se havia reunião prevista
    } else {
      reuniaoPrevista = grupos.includes(aluno.grupo);
    }

    ciclosConsiderados += 1;
    const indice = indiceDoCiclo.get(ciclo.numeroCiclo);
    const relatorio = indice !== undefined ? relatorioPorNumero.get(indice) : undefined;

    const relatorioEntregue = relatorio?.relatorioEntregue ?? false;
    if (relatorioEntregue) ciclosComRelatorio += 1;
    const oQueFez = relatorio?.oQueFez ?? null;
    const oQuePretende = relatorio?.oQuePretende ?? null;

    if (!reuniaoPrevista) {
      if (!relatorioEntregue) {
        totalFaltas += 3;
        faltaPorCiclo.push(true);
        detalhePorCiclo.push({
          numeroCiclo: ciclo.numeroCiclo,
          dataPrevista: ciclo.dataPrevista,
          reuniaoPrevista,
          relatorioEntregue,
          foiAReuniao: null,
          faltas: 3,
          descricao: "Não entregou o relatório (sem reunião prevista essa semana)",
          oQueFez,
          oQuePretende,
        });
      } else {
        faltaPorCiclo.push(false);
        detalhePorCiclo.push({
          numeroCiclo: ciclo.numeroCiclo,
          dataPrevista: ciclo.dataPrevista,
          reuniaoPrevista,
          relatorioEntregue,
          foiAReuniao: null,
          faltas: 0,
          descricao: "Relatório em dia",
          oQueFez,
          oQuePretende,
        });
      }
      continue;
    }

    // Sem registro de presença nenhum (nem linha criada na tela de Reuniões) é tratado como
    // ausência — se tivesse comparecido, alguém teria marcado presença ali. É a presença na
    // reunião DA DISCIPLINA (presencaReuniaoDisciplina) que conta pra falta — nunca `teveReuniao`
    // (esse é auto-relatado pelo aluno sobre a reunião com a pessoa orientadora, evento
    // independente, ver comentário no schema).
    const foiAReuniao = relatorio?.presencaReuniaoDisciplina ?? false;

    if (relatorioEntregue && foiAReuniao) {
      faltaPorCiclo.push(false); // 0 — tudo em dia
      detalhePorCiclo.push({
        numeroCiclo: ciclo.numeroCiclo,
        dataPrevista: ciclo.dataPrevista,
        reuniaoPrevista,
        relatorioEntregue,
        foiAReuniao,
        faltas: 0,
        descricao: "Tudo em dia",
        oQueFez,
        oQuePretende,
      });
    } else if (relatorioEntregue && !foiAReuniao) {
      totalFaltas += 2;
      faltasReuniao += 1;
      faltaPorCiclo.push(true); // só faltou a reunião
      detalhePorCiclo.push({
        numeroCiclo: ciclo.numeroCiclo,
        dataPrevista: ciclo.dataPrevista,
        reuniaoPrevista,
        relatorioEntregue,
        foiAReuniao,
        faltas: 2,
        descricao: "Faltou a reunião",
        oQueFez,
        oQuePretende,
      });
    } else if (!relatorioEntregue && foiAReuniao) {
      totalFaltas += 2;
      faltaPorCiclo.push(true); // só faltou o relatório (apareceu mas não preencheu o Forms)
      detalhePorCiclo.push({
        numeroCiclo: ciclo.numeroCiclo,
        dataPrevista: ciclo.dataPrevista,
        reuniaoPrevista,
        relatorioEntregue,
        foiAReuniao,
        faltas: 2,
        descricao: "Não entregou o relatório (mas foi à reunião)",
        oQueFez,
        oQuePretende,
      });
    } else {
      totalFaltas += 3;
      faltasReuniao += 1;
      faltaPorCiclo.push(true); // faltou tudo
      detalhePorCiclo.push({
        numeroCiclo: ciclo.numeroCiclo,
        dataPrevista: ciclo.dataPrevista,
        reuniaoPrevista,
        relatorioEntregue,
        foiAReuniao,
        faltas: 3,
        descricao: "Faltou tudo (relatório e reunião)",
        oQueFez,
        oQuePretende,
      });
    }
  }

  const pctEntrega = ciclosConsiderados > 0 ? ciclosComRelatorio / ciclosConsiderados : relatorios.length > 0 ? 1 : 0;
  const pctFaltas = turma.limiteFaltas ? totalFaltas / turma.limiteFaltas : 0;

  let faltasConsecutivas = 0;
  for (let i = faltaPorCiclo.length - 1; i >= 0; i--) {
    if (faltaPorCiclo[i]) faltasConsecutivas += 1;
    else break;
  }

  const ultimoEnvio = relatorios
    .filter((r) => r.relatorioEntregue)
    .reduce<Date | null>((max, r) => (max === null || r.timestampEnvio > max ? r.timestampEnvio : max), null);

  // Só o ÚLTIMO relatório enviado conta pro status de impedimento — um impedimento antigo,
  // de semanas atrás, não deveria manter o aluno sinalizado pra sempre mesmo depois de resolvido
  // (ou simplesmente superado pelas semanas seguintes).
  const ultimoRelatorio = relatorios.reduce<RelatorioSemanal | null>(
    (max, r) => (max === null || r.numeroRelatorio > max.numeroRelatorio ? r : max),
    null
  );
  const impedimentoAberto =
    !!ultimoRelatorio?.impedimento && !observacoes.some((o) => o.data >= ultimoRelatorio.timestampEnvio);

  const semOrientador = aluno.orientadorId === null;

  // Vermelho = reprovado de verdade (bateu o limite). Amarelo = alerta (perto do limite, ou
  // padrão de faltas seguidas), mas ainda não é reprovação.
  let status: AlunoStatus["status"] = "verde";

  if (totalFaltas >= turma.limiteFaltas) {
    status = "vermelho";
    motivos.push(`reprovado por faltas: ${totalFaltas} de ${turma.limiteFaltas}`);
  } else {
    const limiarAlerta = turma.limiteFaltas - turma.bufferAmarelo;
    if (totalFaltas >= limiarAlerta) {
      status = "amarelo";
      motivos.push(`perto do limite de faltas: ${totalFaltas} de ${turma.limiteFaltas} (alerta a partir de ${limiarAlerta})`);
    }
    if (faltasConsecutivas >= turma.faltasConsecutivasAlerta) {
      status = "amarelo";
      motivos.push(`${faltasConsecutivas} ciclo(s) seguido(s) com falta (limiar ${turma.faltasConsecutivasAlerta})`);
    }
  }

  // Impedimento sem resposta tem prioridade de exibição sobre o semáforo de frequência — é o
  // mais urgente de resolver, mas não é a mesma coisa que estar reprovando.
  if (impedimentoAberto) {
    status = "impedimento";
    motivos.push("impedimento relatado sem resposta do orientador");
  }

  if (grupoDesconhecido) {
    motivos.push("grupo do aluno desconhecido — algumas semanas não entraram no cálculo de faltas");
  }

  return {
    aluno,
    status,
    ciclosConsiderados,
    relatoriosNaoEntregues: ciclosConsiderados - ciclosComRelatorio,
    faltasReuniao,
    totalFaltas,
    pctEntrega,
    pctFaltas,
    faltasConsecutivas,
    ultimoEnvio,
    impedimentoAberto,
    semOrientador,
    grupoDesconhecido,
    motivos,
    detalhePorCiclo,
  };
}
