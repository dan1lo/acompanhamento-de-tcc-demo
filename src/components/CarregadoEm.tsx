/**
 * Timestamp discreto de quando a página foi renderizada no servidor (sempre com os dados mais
 * recentes do banco na hora do request) — ajuda a distinguir "os dados estão realmente
 * desatualizados" de "eu só não recarreguei a aba", confusão que já aconteceu na prática.
 */
export default function CarregadoEm() {
  return (
    <p className="text-xs text-zinc-400">
      Carregado às {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
    </p>
  );
}
