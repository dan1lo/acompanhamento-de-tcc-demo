import type { Observacao, SituacaoOrientacao } from "@prisma/client";

/**
 * Situação atual = a mais recente observação com `situacao` preenchida, de qualquer autor. Sem
 * nenhuma observação desse tipo ainda, retorna null — tratado explicitamente na UI como "sem
 * registro", não escondido, porque a pessoa pode simplesmente não ter usado essa parte do
 * sistema ainda.
 */
function situacaoAtual<O extends Observacao>(observacoes: O[]): O | null {
  const comSituacao = observacoes.filter((o) => o.situacao !== null);
  if (comSituacao.length === 0) return null;
  return comSituacao.reduce((maisRecente, o) => (o.data > maisRecente.data ? o : maisRecente));
}

/**
 * Mesma coisa, mas só considerando observações escritas por um dos `professorIds` dados — usado
 * pra separar a situação "segundo a pessoa orientadora" (registrarSituacaoOrientador) da situação
 * "segundo o responsável pela disciplina" (registrarSituacaoResponsavel): são tags diferentes,
 * de pessoas diferentes, não devem se misturar numa única "situação atual".
 */
export function situacaoAtualDeAutores<O extends Observacao>(observacoes: O[], professorIds: string[]): O | null {
  return situacaoAtual(observacoes.filter((o) => professorIds.includes(o.professorId)));
}

export const SITUACAO_LABEL: Record<SituacaoOrientacao, string> = {
  OK: "Tudo indo bem",
  ATENCAO: "Precisa de atenção",
  INTERVENCAO: "Precisa de intervenção",
};

/**
 * Uma Observacao com `situacao` preenchida é um registro formal, não um comentário solto — de
 * quem exatamente depende de quem escreveu (ver `origemSituacao` calculado em cada consumidor:
 * orientadorIds.includes(professorId) vs responsavelIds.includes(professorId)). Rótulo e cor
 * compartilhados entre a ficha do aluno e a tela de Reuniões, pra não divergir visualmente.
 */
export const ORIGEM_SITUACAO_LABEL: Record<"orientador" | "disciplina", string> = {
  orientador: "Reunião registrada pela pessoa orientadora",
  disciplina: "Situação da disciplina",
};

export const ORIGEM_SITUACAO_STYLE: Record<"orientador" | "disciplina", string> = {
  orientador: "border-emerald-200 bg-emerald-50 text-emerald-900",
  disciplina: "border-sky-200 bg-sky-50 text-sky-900",
};
