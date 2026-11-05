import ExcelJS from "exceljs";
import { normalizeName } from "./normalize";

/**
 * Parser da planilha "Agenda - Acompanhamento de TCC ...xlsx".
 *
 * Duas tabelas na mesma aba, lidas independentemente (compartilham linhas por layout, não por
 * relação lógica):
 *
 * 1. Colunas "DATA" / "GRUPOS" (+ uma coluna adjacente para um segundo grupo na mesma semana):
 *    uma linha por ciclo do calendário. GRUPOS diz o que acontece naquela semana:
 *    - "Grupo NN" (uma ou duas colunas preenchidas) → só os alunos desse(s) grupo(s) têm
 *      reunião prevista naquela semana; relatório ainda é obrigatório pra todo mundo.
 *    - "Todo Mundo - ..." → reunião prevista pra todos.
 *    - qualquer outro texto ("Sem Encontro (...)", "Dia CESAR (Sem aula)", etc.) → semana sem
 *      encontro: relatório não é exigido de ninguém nessa semana.
 *
 * 2. Colunas com cabeçalho "Grupo NN (inicia .../...) - Fulano": a lista de alunos daquele
 *    grupo (um nome por linha/horário fixo pro semestre inteiro).
 *
 * numero_relatorio do RelatorioSemanal corresponde 1:1 ao numeroCiclo aqui (ciclo N = relatório
 * N sempre, sem pular numeração mesmo em semanas "Sem Encontro").
 */

const GRUPO_PREFIXO = /^\s*grupo\s*0*(\d+)/i;
const TODO_MUNDO_PREFIXO = /^\s*todo\s*mundo/i;

type AgendaCiclo = {
  numeroCiclo: number;
  dataPrevista: Date;
  semEncontro: boolean;
  /** Nomes canônicos de grupo com reunião prevista nesse ciclo; ["TODOS"] pra semana de todo mundo. */
  gruposComReuniao: string[];
};

type AgendaAlunoGrupo = {
  alunoNome: string;
  alunoNomeNormalizado: string;
  grupo: string;
  /** Número do horário fixo do aluno (1, 2, 3...) — define a ordem de atendimento no dia. */
  ordemSlot: number;
  /** Texto do horário (ex.: "13:30 - 13:40"), pra exibir na tela de reuniões. */
  horario: string | null;
};

export type AgendaParseResult = {
  ciclos: AgendaCiclo[];
  alunosGrupo: AgendaAlunoGrupo[];
};

function canonicalGrupo(raw: string): string | null {
  const m = raw.match(GRUPO_PREFIXO);
  if (!m) return null;
  return `Grupo ${m[1].padStart(2, "0")}`;
}

function cellText(cell: ExcelJS.Cell | undefined): string | null {
  if (!cell) return null;
  const v = cell.value;
  if (v === null || v === undefined) return null;
  if (typeof v === "object" && "richText" in (v as object)) {
    return (v as { richText: { text: string }[] }).richText.map((r) => r.text).join("");
  }
  if (typeof v === "object" && "text" in (v as object)) {
    return String((v as { text: unknown }).text);
  }
  return String(v).trim();
}

function cellDate(cell: ExcelJS.Cell | undefined): Date | null {
  if (!cell) return null;
  const v = cell.value;
  if (v instanceof Date) return v;
  return null;
}

export async function parseAgendaXlsx(buffer: Buffer): Promise<AgendaParseResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const ws = wb.getWorksheet("Agenda") ?? wb.worksheets[0];

  const result: AgendaParseResult = { ciclos: [], alunosGrupo: [] };
  if (!ws) return result;

  // Acha a linha de cabeçalho procurando "DATA" e "GRUPOS" nas células.
  let headerRowNumber: number | null = null;
  let idxData: number | null = null;
  let idxGrupos: number | null = null;
  let idxHorario: number | null = null;
  const gruposColunas: { col: number; grupo: string }[] = [];

  for (let r = 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    let localData: number | null = null;
    let localGrupos: number | null = null;
    let localHorario: number | null = null;
    const localGruposColunas: { col: number; grupo: string }[] = [];

    row.eachCell((cell, colNumber) => {
      const label = cellText(cell);
      if (!label) return;
      // Células de cabeçalho mescladas (ex.: "GRUPOS" ocupando duas colunas) podem repetir o
      // mesmo texto na coluna seguinte — sempre fica com a primeira ocorrência.
      if (label.trim().toUpperCase() === "DATA" && localData === null) localData = colNumber;
      if (label.trim().toUpperCase() === "GRUPOS" && localGrupos === null) localGrupos = colNumber;
      if (label.trim().toUpperCase() === "HORÁRIO" && localHorario === null) localHorario = colNumber;
      const grupo = canonicalGrupo(label);
      if (grupo) localGruposColunas.push({ col: colNumber, grupo });
    });

    if (localData && localGrupos) {
      headerRowNumber = r;
      idxData = localData;
      idxGrupos = localGrupos;
      idxHorario = localHorario;
      gruposColunas.push(...localGruposColunas);
      break;
    }
  }

  if (!headerRowNumber || !idxData || !idxGrupos) return result;

  // --- Tabela 1: ciclos do calendário (colunas DATA / GRUPOS + adjacente) ---
  // O bloco de linhas do calendário é contíguo logo abaixo do cabeçalho; a planilha real tem
  // uma SEGUNDA tabela mais abaixo na mesma aba que reaproveita os mesmos números de coluna
  // (ex.: "Grupos 1 e 2" / "Grupos 3 e 4") com semântica diferente — por isso paramos assim
  // que o bloco contíguo de datas termina, em vez de varrer a planilha inteira.
  let numeroCiclo = 0;
  let ultimaLinhaDoCalendario = headerRowNumber;
  for (let r = headerRowNumber + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const dataPrevista = cellDate(row.getCell(idxData));
    if (!dataPrevista) break;
    ultimaLinhaDoCalendario = r;

    const grupos1 = cellText(row.getCell(idxGrupos));
    const grupos2 = cellText(row.getCell(idxGrupos + 1));

    numeroCiclo += 1;

    if (grupos1 && TODO_MUNDO_PREFIXO.test(grupos1)) {
      result.ciclos.push({ numeroCiclo, dataPrevista, semEncontro: false, gruposComReuniao: ["TODOS"] });
      continue;
    }

    const gruposComReuniao = [grupos1, grupos2]
      .map((g) => (g ? canonicalGrupo(g) : null))
      .filter((g): g is string => !!g);

    if (gruposComReuniao.length > 0) {
      result.ciclos.push({ numeroCiclo, dataPrevista, semEncontro: false, gruposComReuniao });
    } else {
      // Qualquer outro texto ("Sem Encontro (...)", feriado, etc.) = sem relatório exigido.
      result.ciclos.push({ numeroCiclo, dataPrevista, semEncontro: true, gruposComReuniao: [] });
    }
  }

  // --- Tabela 2: aluno -> grupo (colunas "Grupo NN (inicia .../...) - Fulano") ---
  // Mesmo bloco de linhas da Tabela 1 — não continuar além dele pelo motivo explicado acima.
  // Linhas sem um número de horário válido (ex.: uma nota tipo "ALINHAMENTO PROFESSORES" no
  // lugar do 18º horário, que não existe) não são alunos de verdade — pula.
  for (let r = headerRowNumber + 1; r <= ultimaLinhaDoCalendario; r++) {
    const row = ws.getRow(r);
    const ordemSlotRaw = idxHorario !== null ? row.getCell(idxHorario).value : null;
    if (typeof ordemSlotRaw !== "number") continue;
    const horario = idxHorario !== null ? cellText(row.getCell(idxHorario + 1)) : null;

    for (const { col, grupo } of gruposColunas) {
      const nome = cellText(row.getCell(col));
      if (!nome) continue;
      result.alunosGrupo.push({
        alunoNome: nome,
        alunoNomeNormalizado: normalizeName(nome),
        grupo,
        ordemSlot: ordemSlotRaw,
        horario,
      });
    }
  }

  return result;
}
