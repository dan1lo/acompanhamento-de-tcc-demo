import Link from "next/link";
import type { Aluno, Observacao } from "@prisma/client";
import type { AlunoStatus } from "@/lib/semaforo";
import { situacaoAtualDeAutores } from "@/lib/situacao";
import SemaforoBadge from "@/components/SemaforoBadge";
import SituacaoBadge from "@/components/SituacaoBadge";

type AlunoComOrientadorEObservacoes = Aluno & {
  orientador: { nome: string } | null;
  observacoes: Observacao[];
};

/**
 * Tabela de alunos com semáforo/faltas/situação — usada tanto na lista alfabética quanto em cada
 * grupo da visão "por pessoa orientadora" do dashboard da turma. A única diferença entre os dois
 * usos é a coluna de pessoa orientadora (que não faz sentido repetir dentro de um grupo que já é
 * de uma única pessoa orientadora).
 */
export default function AlunoStatusTable<A extends AlunoComOrientadorEObservacoes & { orientadorId: string | null }>({
  statuses,
  limiteFaltas,
  mostrarOrientador,
  responsavelIds,
  mensagemVazia,
}: {
  statuses: AlunoStatus<A>[];
  limiteFaltas: number;
  mostrarOrientador: boolean;
  /** Ids dos professores RESPONSAVEL da turma — pra separar a situação da disciplina da situação da pessoa orientadora. */
  responsavelIds: string[];
  mensagemVazia?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-zinc-500 border-b">
          <tr>
            <th className="px-4 py-2">Aluno</th>
            {mostrarOrientador && <th className="px-4 py-2">Pessoa orientadora</th>}
            <th className="px-4 py-2">Faltas</th>
            <th className="px-4 py-2">Entregas / reuniões</th>
            <th className="px-4 py-2">Situação (orientador)</th>
            <th className="px-4 py-2">Situação (disciplina)</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {statuses.map((s) => (
            <tr key={s.aluno.id} className="border-b last:border-0">
              <td className="px-4 py-2">
                <Link href={`/alunos/${s.aluno.id}`} className="hover:underline inline-flex items-center gap-1.5">
                  {s.aluno.nome}
                  {s.impedimentoAberto && (
                    <span
                      title="Impedimento em aberto"
                      className="inline-flex h-2 w-2 rounded-full bg-red-500 shrink-0"
                    />
                  )}
                </Link>
                <p className="text-xs text-zinc-400">
                  Último envio: {s.ultimoEnvio ? new Date(s.ultimoEnvio).toLocaleDateString("pt-BR") : "—"}
                </p>
              </td>
              {mostrarOrientador && (
                <td className="px-4 py-2 text-zinc-500">{s.aluno.orientador?.nome ?? "—"}</td>
              )}
              <td className="px-4 py-2">
                <SemaforoBadge status={s.status} />
                <p className="text-xs text-zinc-500 mt-0.5">
                  {s.totalFaltas} de {limiteFaltas}
                </p>
              </td>
              <td className="px-4 py-2 text-zinc-500">
                {s.relatoriosNaoEntregues} de {s.ciclosConsiderados} relat. · {s.faltasReuniao} reunião(ões)
              </td>
              <td className="px-4 py-2">
                <SituacaoBadge
                  situacao={
                    situacaoAtualDeAutores(s.aluno.observacoes, s.aluno.orientadorId ? [s.aluno.orientadorId] : [])
                      ?.situacao ?? null
                  }
                />
              </td>
              <td className="px-4 py-2">
                <SituacaoBadge situacao={situacaoAtualDeAutores(s.aluno.observacoes, responsavelIds)?.situacao ?? null} />
              </td>
              <td className="px-4 py-2 text-right">
                {(s.status === "vermelho" || s.impedimentoAberto) && (
                  <Link
                    href={`/alunos/${s.aluno.id}/alerta-email`}
                    className="text-xs rounded border border-orange-300 text-orange-700 px-2 py-1 hover:bg-orange-50"
                  >
                    Avisar
                  </Link>
                )}
              </td>
            </tr>
          ))}
          {statuses.length === 0 && (
            <tr>
              <td colSpan={mostrarOrientador ? 7 : 6} className="px-4 py-4 text-center text-zinc-400">
                {mensagemVazia ?? "Nenhum aluno pra mostrar com esses filtros."}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
