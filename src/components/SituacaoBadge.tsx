import type { SituacaoOrientacao } from "@prisma/client";
import { SITUACAO_LABEL } from "@/lib/situacao";

const STYLES: Record<SituacaoOrientacao, string> = {
  OK: "bg-emerald-100 text-emerald-800 border-emerald-300",
  ATENCAO: "bg-amber-100 text-amber-800 border-amber-300",
  INTERVENCAO: "bg-red-100 text-red-800 border-red-300",
};

const DOT_STYLES: Record<SituacaoOrientacao, string> = {
  OK: "bg-emerald-500",
  ATENCAO: "bg-amber-500",
  INTERVENCAO: "bg-red-500",
};

/**
 * `null` é um estado de verdade aqui, não "carregando" — a pessoa orientadora ainda não
 * registrou nenhuma reunião pra esse aluno. Mostrar isso explícito em vez de omitir o badge
 * ajuda a notar quem não está usando essa parte do sistema.
 */
export default function SituacaoBadge({ situacao }: { situacao: SituacaoOrientacao | null }) {
  if (!situacao) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium bg-zinc-100 text-zinc-500 border-zinc-300">
        <span className="h-2 w-2 rounded-full bg-zinc-400" />
        Sem registro
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${STYLES[situacao]}`}>
      <span className={`h-2 w-2 rounded-full ${DOT_STYLES[situacao]}`} />
      {SITUACAO_LABEL[situacao]}
    </span>
  );
}
