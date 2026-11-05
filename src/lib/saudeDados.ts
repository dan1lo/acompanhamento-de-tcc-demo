import type { Aluno, CicloData, Observacao, RelatorioSemanal } from "@prisma/client";
import { indiceDoCicloMap } from "./ciclos";

type AlunoComDados = Aluno & { relatorios: RelatorioSemanal[]; observacoes: Observacao[] };

export type AchadoSaudeDados = { alunoId: string; alunoNome: string; detalhe: string };

export type RelatorioSaudeDados = {
  numeroForaDoEsperado: AchadoSaudeDados[];
  semNenhumRelatorio: AchadoSaudeDados[];
  presencaContraditaPorObservacao: AchadoSaudeDados[];
  duplicatasDeConteudo: AchadoSaudeDados[];
  reuniaoComDataFutura: AchadoSaudeDados[];
};

const UM_DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Dia civil (AAAA-MM-DD) no fuso do servidor — usado pra comparar datas "no calendário", não em
 * milissegundos. `dataUltimaReuniao` é salva à meia-noite UTC pra representar só um dia (sem
 * horário); comparar timestamp bruto contra `timestampEnvio` (que tem hora real) falsamente
 * acusa "reunião no futuro" quando os dois caem no mesmo dia local, só porque meia-noite UTC de
 * um dia já é o dia anterior aqui (America/Recife, UTC-3).
 */
function diaLocal(d: Date): string {
  return d.toLocaleDateString("en-CA");
}

/**
 * Checagens de integridade nascidas de casos reais encontrados só na unha (ver histórico de
 * conversas): número de relatório digitado errado pelo aluno no Forms, ciclo sem nenhum relatório
 * (aluno que entrou depois ou nunca respondeu), presença marcada mas a própria observação do
 * professor diz que faltou, e linhas duplicadas/de teste com o mesmo texto de um relatório
 * anterior. Roda em memória a partir da turma já carregada — não persiste nada, não é um gate,
 * só um raio-x pra facilitar achar isso sem precisar de scripts ad-hoc toda vez.
 */
export function checarSaudeDados(
  turma: { ciclos: CicloData[]; alunos: AlunoComDados[] }
): RelatorioSaudeDados {
  const indiceDoCiclo = indiceDoCicloMap(turma.ciclos);
  const numerosValidos = new Set(indiceDoCiclo.values());
  const maxNumeroValido = numerosValidos.size > 0 ? Math.max(...numerosValidos) : 0;
  const dataPrevistaPorNumero = new Map<number, Date>();
  for (const [numeroCiclo, numeroRelatorio] of indiceDoCiclo.entries()) {
    const ciclo = turma.ciclos.find((c) => c.numeroCiclo === numeroCiclo);
    if (ciclo) dataPrevistaPorNumero.set(numeroRelatorio, ciclo.dataPrevista);
  }

  const numeroForaDoEsperado: AchadoSaudeDados[] = [];
  const semNenhumRelatorio: AchadoSaudeDados[] = [];
  const presencaContraditaPorObservacao: AchadoSaudeDados[] = [];
  const duplicatasDeConteudo: AchadoSaudeDados[] = [];
  const reuniaoComDataFutura: AchadoSaudeDados[] = [];

  for (const aluno of turma.alunos) {
    if (!aluno.ativo) continue;

    if (aluno.relatorios.length === 0) {
      semNenhumRelatorio.push({ alunoId: aluno.id, alunoNome: aluno.nome, detalhe: "Nenhum relatório registrado ainda." });
    }

    for (const r of aluno.relatorios) {
      // Sem nenhum ciclo cadastrado (turma sem calendário importado, ex.: acompanhamento
      // manual), "máximo esperado" não tem significado nenhum — comparar com 0 sinalizaria TODO
      // relatório como erro, o que é ruído, não achado.
      if (numerosValidos.size > 0 && (r.numeroRelatorio > maxNumeroValido || !Number.isInteger(r.numeroRelatorio))) {
        numeroForaDoEsperado.push({
          alunoId: aluno.id,
          alunoNome: aluno.nome,
          detalhe: `Relatório #${r.numeroRelatorio} não corresponde a nenhum ciclo da turma (máximo esperado: #${maxNumeroValido}).`,
        });
      }

      // "Data da última reunião" reportada pelo próprio aluno vindo DEPOIS do dia em que ele
      // enviou esse relatório não faz sentido pra uma reunião que já aconteceu — geralmente é
      // troca de mês/dia ou confusão com a data da PRÓXIMA reunião agendada, não da última.
      if (r.dataUltimaReuniao && diaLocal(r.dataUltimaReuniao) > diaLocal(r.timestampEnvio)) {
        reuniaoComDataFutura.push({
          alunoId: aluno.id,
          alunoNome: aluno.nome,
          detalhe: `Relatório #${r.numeroRelatorio} (enviado em ${r.timestampEnvio.toLocaleDateString("pt-BR")}) reporta reunião em ${r.dataUltimaReuniao.toLocaleDateString("pt-BR")} — data posterior ao envio.`,
        });
      }

      if (r.presencaReuniaoDisciplina === true) {
        const dataReferencia = dataPrevistaPorNumero.get(r.numeroRelatorio) ?? r.timestampEnvio;
        const contraditoria = aluno.observacoes.find(
          (o) => Math.abs(o.data.getTime() - dataReferencia.getTime()) <= 2 * UM_DIA_MS && /falt/i.test(o.texto ?? "")
        );
        if (contraditoria) {
          presencaContraditaPorObservacao.push({
            alunoId: aluno.id,
            alunoNome: aluno.nome,
            detalhe: `Relatório #${r.numeroRelatorio}: presença = sim, mas observação de ${contraditoria.data.toLocaleDateString("pt-BR")} diz "${contraditoria.texto}".`,
          });
        }
      }
    }

    const porTexto = new Map<string, RelatorioSemanal[]>();
    for (const r of aluno.relatorios) {
      const texto = (r.oQueFez ?? "").trim();
      if (!texto) continue;
      if (!porTexto.has(texto)) porTexto.set(texto, []);
      porTexto.get(texto)!.push(r);
    }
    for (const [texto, relatoriosComMesmoTexto] of porTexto.entries()) {
      if (relatoriosComMesmoTexto.length > 1) {
        const numeros = relatoriosComMesmoTexto.map((r) => `#${r.numeroRelatorio}`).join(" e ");
        duplicatasDeConteudo.push({
          alunoId: aluno.id,
          alunoNome: aluno.nome,
          detalhe: `Relatórios ${numeros} têm o mesmo texto em "o que fez": "${texto.slice(0, 60)}${texto.length > 60 ? "…" : ""}"`,
        });
      }
    }
  }

  return {
    numeroForaDoEsperado,
    semNenhumRelatorio,
    presencaContraditaPorObservacao,
    duplicatasDeConteudo,
    reuniaoComDataFutura,
  };
}
