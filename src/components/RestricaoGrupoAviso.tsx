import Link from "next/link";

/**
 * Aviso de "sua visão está restrita a X" + link pra ver tudo, usado tanto no dashboard da turma
 * quanto na tela de Reuniões — mesma lógica de escopo por grupo (ver `getGruposResponsavel`),
 * duas telas diferentes.
 */
export default function RestricaoGrupoAviso({
  gruposResponsavel,
  gruposParaMostrar,
  restricaoConfigurada,
  verTodos,
  hrefVerTodos,
  hrefVoltar,
}: {
  /** null = sem restrição ativa agora (ou porque não há, ou porque ?todos=1 foi usado). */
  gruposResponsavel: string[] | null;
  /**
   * Grupos a exibir no aviso, se diferente da restrição bruta — ex.: na tela de um dia
   * específico de reunião, a restrição pode incluir um grupo que não tem encontro previsto
   * NESSE ciclo; mostrar a restrição crua ali dava a entender que a visão estava escondendo
   * gente desse grupo, quando na verdade ele só não se reúne naquele dia. Default: a própria
   * `gruposResponsavel` (comportamento de antes, usado no dashboard da turma).
   */
  gruposParaMostrar?: string[];
  /** A restrição configurada de verdade, independente de ?todos=1 — pra montar o link de volta. */
  restricaoConfigurada: string[] | null;
  verTodos: boolean;
  hrefVerTodos: string;
  hrefVoltar: string;
}) {
  if (gruposResponsavel) {
    const grupos = gruposParaMostrar ?? gruposResponsavel;
    return (
      <p className="inline-flex items-center gap-1.5 mt-2 rounded-full border border-amber-200 bg-amber-50 text-amber-700 px-2.5 py-1 text-xs">
        {grupos.length > 0 ? `Mostrando ${grupos.join(", ")}` : "Nenhum dos seus grupos tem reunião nesse ciclo"}
        <Link href={hrefVerTodos} className="underline font-medium">
          ver tudo
        </Link>
      </p>
    );
  }

  if (restricaoConfigurada && verTodos) {
    return (
      <p className="inline-flex items-center gap-1.5 mt-2 rounded-full border border-zinc-200 bg-zinc-100 text-zinc-600 px-2.5 py-1 text-xs">
        Vendo tudo
        <Link href={hrefVoltar} className="underline font-medium">
          voltar pra minha visão ({restricaoConfigurada.join(", ")})
        </Link>
      </p>
    );
  }

  return null;
}
