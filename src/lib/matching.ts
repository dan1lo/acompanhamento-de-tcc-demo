/**
 * Sugestão de correspondência quando o nome não bate exato (ex.: agenda usa "Julia Felix",
 * roster tem "JULIA FELIX CORDEIRO [Ativo]"). Só sugere quando existe EXATAMENTE UM candidato
 * plausível — nomes comuns (ex.: "Maria Julia") podem casar com várias pessoas diferentes, e
 * adivinhar errado juntaria duas pessoas por engano. Ambíguo ou sem candidato = não sugere,
 * fica pra confirmação manual.
 */

function tokens(nomeNormalizado: string): string[] {
  return nomeNormalizado.split(/\s+/).filter(Boolean);
}

/** true se todo token de `menor` aparece em `maior`, na mesma ordem (não precisa ser contíguo). */
function ehSubsequenciaDeTokens(menor: string[], maior: string[]): boolean {
  let i = 0;
  for (const t of maior) {
    if (i < menor.length && t === menor[i]) i += 1;
  }
  return i === menor.length;
}

export type CandidatoNome = { id: string; nomeNormalizado: string };

export function sugerirCandidatoUnico<T extends CandidatoNome>(
  nomeNormalizadoAlvo: string,
  candidatos: T[]
): T | null {
  const alvoTokens = tokens(nomeNormalizadoAlvo);
  if (alvoTokens.length === 0) return null;

  const encontrados = candidatos.filter((c) => {
    const candidatoTokens = tokens(c.nomeNormalizado);
    if (candidatoTokens.length === 0) return false;
    return (
      ehSubsequenciaDeTokens(alvoTokens, candidatoTokens) || ehSubsequenciaDeTokens(candidatoTokens, alvoTokens)
    );
  });

  return encontrados.length === 1 ? encontrados[0] : null;
}
