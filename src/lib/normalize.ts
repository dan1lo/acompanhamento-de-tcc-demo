const BRACKET_SUFFIX = /\s*\[[^\]]*\]\s*$/;
const COMBINING_DIACRITICS = /[̀-ͯ]/g;

/** Normaliza nome para matching: remove sufixo tipo "[Ativo]", acentos, caixa e espaços extras. */
export function normalizeName(raw: string | null | undefined): string {
  if (!raw) return "";
  const noBracket = raw.replace(BRACKET_SUFFIX, "").trim();
  const noAccents = noBracket.normalize("NFKD").replace(COMBINING_DIACRITICS, "");
  return noAccents.replace(/\s+/g, " ").trim().toUpperCase();
}
