import ExcelJS from "exceljs";
import { normalizeName } from "./normalize";

/**
 * Parser das respostas do Google Forms
 * ("CESAR School - Acompanhamento de TCC ... (respostas).xlsx").
 *
 * O matching aluno -> Aluno cadastrado é SEMPRE por nome normalizado, nunca por posição de
 * linha ou ciclo. numero_relatorio é sequencial e independente do calendário
 * (RelatorioSemanal.numeroRelatorio), não confundir com CicloData.numeroCiclo.
 */

type RelatorioRow = {
  alunoNome: string;
  alunoNomeNormalizado: string;
  alunoEmail: string | null;
  orientadorDeclarado: string | null;
  numeroRelatorio: number | null;
  timestampEnvio: Date;
  cronogramaEmDia: boolean | null;
  teveReuniao: boolean | null;
  dataUltimaReuniao: Date | null;
  impedimento: boolean;
  impedimentoDesc: string | null;
  oQueFez: string | null;
  oQuePretende: string | null;
  linkCronograma: string | null;
};

export type RelatorioParseResult = {
  rows: RelatorioRow[];
  ignoradas: number;
};

type FieldName =
  | "timestampEnvio"
  | "alunoEmail"
  | "alunoNome"
  | "orientadorDeclarado"
  | "numeroRelatorio"
  | "cronogramaEmDia"
  | "teveReuniao"
  | "dataUltimaReuniao"
  | "impedimento"
  | "impedimentoDesc"
  | "oQueFez"
  | "oQuePretende"
  | "linkCronograma";

const EXACT_HEADER_MAP: Record<string, FieldName> = {
  "carimbo de data/hora": "timestampEnvio",
  "endereço de e-mail": "alunoEmail",
  "endereco de e-mail": "alunoEmail",
  "nome do (a) aluno(a)": "alunoNome",
  "cronograma em dia?": "cronogramaEmDia",
  "algum impedimento?": "impedimento",
  "o que fez esta semana?": "oQueFez",
  "o que pretende fazer próxima semana?": "oQuePretende",
  "o que pretende fazer proxima semana?": "oQuePretende",
};

function matchHeader(label: string): FieldName | null {
  const key = label.trim().toLowerCase();
  if (EXACT_HEADER_MAP[key]) return EXACT_HEADER_MAP[key];
  if (key.startsWith("número do relatório") || key.startsWith("numero do relatorio")) return "numeroRelatorio";
  if (key.startsWith("coloque o nome de seu orientador")) return "orientadorDeclarado";
  if (key.startsWith("teve reunião") || key.startsWith("teve reuniao")) return "teveReuniao";
  if (key.startsWith("data da última reunião") || key.startsWith("data da ultima reuniao")) return "dataUltimaReuniao";
  if (key.startsWith("se há algum impedimento") || key.startsWith("se ha algum impedimento")) return "impedimentoDesc";
  if (key.startsWith("coloque o link do seu cronograma")) return "linkCronograma";
  return null;
}

function yesNo(value: unknown): boolean | null {
  if (value === null || value === undefined) return null;
  const v = String(value).trim().toLowerCase();
  if (["sim", "yes", "true", "1"].includes(v)) return true;
  if (["não", "nao", "no", "false", "0"].includes(v)) return false;
  return null;
}

/**
 * Resolve um valor de célula do ExcelJS até virar algo "plano" (string, número, Date, boolean).
 * Os formatos vêm aninhados de jeitos diferentes — fórmula tem `.result`, hyperlink tem
 * `{ text, hyperlink }` e o próprio `.text` pode ser rich text em vez de string simples (ex.:
 * um link colado no meio de uma frase, com só o trecho do link sublinhado) — por isso é
 * recursivo em vez de tratar só um nível.
 */
function resolveCellValue(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (typeof v !== "object") return v;
  if ("richText" in v) {
    return (v as { richText: { text: string }[] }).richText.map((r) => r.text).join("");
  }
  if ("result" in v) {
    return resolveCellValue((v as { result: unknown }).result);
  }
  // Célula de hyperlink (ex.: link colado que o Sheets converteu em link clicável) vem como
  // { text, hyperlink } — o texto visível é o que interessa (geralmente a própria URL).
  if ("text" in v) {
    return resolveCellValue((v as { text: unknown }).text);
  }
  return v;
}

function cellValue(cell: ExcelJS.Cell | undefined): unknown {
  if (!cell) return null;
  return resolveCellValue(cell.value);
}

function asDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function asText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s ? s : null;
}

export async function parseRelatoriosXlsx(buffer: Buffer): Promise<RelatorioParseResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);

  const ws = wb.worksheets[0];
  const result: RelatorioParseResult = { rows: [], ignoradas: 0 };
  if (!ws) return result;

  const headerRow = ws.getRow(1);
  const fieldByCol = new Map<number, FieldName>();
  headerRow.eachCell((cell, colNumber) => {
    const label = asText(cellValue(cell));
    if (!label) return;
    const field = matchHeader(label);
    if (field) fieldByCol.set(colNumber, field);
  });

  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const data: Partial<Record<FieldName, unknown>> = {};
    fieldByCol.forEach((field, colNumber) => {
      data[field] = cellValue(row.getCell(colNumber));
    });

    const nome = asText(data.alunoNome);
    if (!nome) {
      if (row.hasValues) result.ignoradas += 1;
      continue;
    }

    const numeroRaw = data.numeroRelatorio;
    const numero =
      numeroRaw !== null && numeroRaw !== undefined && numeroRaw !== ""
        ? Number(numeroRaw)
        : null;

    result.rows.push({
      alunoNome: nome,
      alunoNomeNormalizado: normalizeName(nome),
      alunoEmail: asText(data.alunoEmail),
      orientadorDeclarado: asText(data.orientadorDeclarado),
      numeroRelatorio: numero !== null && !Number.isNaN(numero) ? numero : null,
      timestampEnvio: asDate(data.timestampEnvio) ?? new Date(),
      cronogramaEmDia: yesNo(data.cronogramaEmDia),
      teveReuniao: yesNo(data.teveReuniao),
      dataUltimaReuniao: asDate(data.dataUltimaReuniao),
      impedimento: yesNo(data.impedimento) ?? false,
      impedimentoDesc: asText(data.impedimentoDesc),
      oQueFez: asText(data.oQueFez),
      oQuePretende: asText(data.oQuePretende),
      linkCronograma: asText(data.linkCronograma),
    });
  }

  return result;
}
