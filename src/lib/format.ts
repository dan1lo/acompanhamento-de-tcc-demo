/**
 * Formata uma data de CALENDÁRIO (ex.: CicloData.dataPrevista, guardada como meia-noite UTC
 * representando um dia, não um instante) sem deixar o fuso horário do navegador empurrar pro
 * dia anterior. `toLocaleDateString` comum usa o fuso local — em fusos negativos (ex.: UTC-3),
 * meia-noite UTC vira "ontem às 21h" e a data exibida fica um dia errada.
 */
export function formatDiaCalendario(data: Date | string): string {
  const d = new Date(data);
  const dia = String(d.getUTCDate()).padStart(2, "0");
  const mes = String(d.getUTCMonth() + 1).padStart(2, "0");
  const ano = d.getUTCFullYear();
  return `${dia}/${mes}/${ano}`;
}
