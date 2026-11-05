import ExcelJS from "exceljs";
import { normalizeName } from "./normalize";

/**
 * Parser da aba "Aluno e Orientador" da planilha
 * "Acompanhamento - Pré-Projeto de TCC - ...xlsx".
 * Colunas: ALUNO | ORIENTADOR | TÍTULO DO TCC | E-mail
 */

type RosterRow = {
  nome: string;
  nomeNormalizado: string;
  orientadorNome: string | null;
  tituloTcc: string | null;
  email: string | null;
};

export type RosterParseResult = {
  rows: RosterRow[];
  ignoradas: number;
  /** false quando a planilha não tem uma coluna "ALUNO" reconhecível — provável arquivo errado. */
  colunaAlunoEncontrada: boolean;
};

function cellText(cell: ExcelJS.Cell | undefined): string | null {
  if (!cell) return null;
  let v: unknown = cell.value;
  if (v === null || v === undefined) return null;
  // Fórmulas (ex.: células que apontam para outra aba, como ALUNOS!B3) resolvem pelo `result`.
  if (typeof v === "object" && "formula" in (v as object)) {
    v = (v as { result: unknown }).result;
    if (v === null || v === undefined) return null;
  }
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object" && "richText" in (v as object)) {
    return (v as { richText: { text: string }[] }).richText.map((r) => r.text).join("");
  }
  if (typeof v === "object" && "text" in (v as object)) {
    return String((v as { text: unknown }).text);
  }
  return String(v).trim();
}

export async function parseRosterXlsx(buffer: Buffer): Promise<RosterParseResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);

  const ws = wb.getWorksheet("Aluno e Orientador") ?? wb.worksheets[0];
  const result: RosterParseResult = { rows: [], ignoradas: 0, colunaAlunoEncontrada: false };
  if (!ws) return result;

  const headerRow = ws.getRow(1);
  const colIndex: Record<string, number> = {};
  headerRow.eachCell((cell, colNumber) => {
    const label = (cellText(cell) ?? "").trim().toUpperCase();
    if (label) colIndex[label] = colNumber;
  });

  const idxAluno = colIndex["ALUNO"];
  const idxOrientador = colIndex["ORIENTADOR"];
  const idxTitulo = colIndex["TÍTULO DO TCC"] ?? colIndex["TITULO DO TCC"];
  const idxEmail = colIndex["E-MAIL"] ?? colIndex["EMAIL"];

  if (!idxAluno) return result;
  result.colunaAlunoEncontrada = true;

  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const nome = cellText(row.getCell(idxAluno));
    if (!nome) {
      result.ignoradas += 1;
      continue;
    }
    const orientador = idxOrientador ? cellText(row.getCell(idxOrientador)) : null;
    const tituloRaw = idxTitulo ? cellText(row.getCell(idxTitulo)) : null;
    const email = idxEmail ? cellText(row.getCell(idxEmail)) : null;

    const orientadorLimpo = orientador?.trim();
    const orientadorNome =
      orientadorLimpo && !["sem orientador", "nenhum", "a definir", "-"].includes(orientadorLimpo.toLowerCase())
        ? orientadorLimpo
        : null;

    result.rows.push({
      nome,
      nomeNormalizado: normalizeName(nome),
      orientadorNome,
      tituloTcc: tituloRaw && tituloRaw.trim().toLowerCase() !== "a definir" ? tituloRaw.trim() : null,
      email: email && email.trim() ? email.trim() : null,
    });
  }

  return result;
}
