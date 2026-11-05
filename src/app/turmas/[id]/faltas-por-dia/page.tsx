import Link from "next/link";
import { notFound } from "next/navigation";
import { getTurmaCompleta, statusesPorTurma } from "@/lib/turmaData";
import { requireTurmaResponsavel, getGruposResponsavel } from "@/lib/authz";
import { formatDiaCalendario } from "@/lib/format";
import { montarPivotDeFaltas } from "@/lib/faltasPivot";
import RestricaoGrupoAviso from "@/components/RestricaoGrupoAviso";

/**
 * Visão navegável de todos os ciclos já vencidos de uma vez — quem faltou o relatório e quem
 * faltou a reunião em cada dia, sem precisar trocar o seletor de ciclo repetidamente como nas
 * seções "Relatórios pendentes"/"Faltou à reunião" do painel da turma (que só mostram um ciclo
 * de cada vez). Duas visões: "Por dia" (cards colapsáveis, um por ciclo) e "Tabela" (aluno ×
 * ciclo, no estilo de planilha de frequência tradicional). Complementa o export "Faltas (CSV)",
 * que usa o mesmo pivô da visão em tabela (`montarPivotDeFaltas`).
 */
export default async function FaltasPorDiaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ todos?: string; visao?: string }>;
}) {
  const { id } = await params;
  const filtros = await searchParams;
  const session = await requireTurmaResponsavel(id);
  const restricaoConfigurada = await getGruposResponsavel(id, session);
  const verTodos = filtros.todos === "1";
  const gruposResponsavel = verTodos ? null : restricaoConfigurada;
  const visaoTabela = filtros.visao === "tabela";

  const turma = await getTurmaCompleta(id);
  if (!turma) notFound();

  const statusesTurma = statusesPorTurma(turma);
  const statuses = gruposResponsavel
    ? statusesTurma.filter((s) => s.aluno.grupo && gruposResponsavel.includes(s.aluno.grupo))
    : statusesTurma;

  const agora = new Date();
  const ciclosVencidos = [...turma.ciclos]
    .filter((c) => !c.semEncontro && c.dataPrevista <= agora)
    .sort((a, b) => b.numeroCiclo - a.numeroCiclo); // mais recente primeiro

  const porCiclo = ciclosVencidos.map((ciclo) => {
    const faltaramRelatorio: { id: string; nome: string }[] = [];
    const faltaramReuniao: { id: string; nome: string }[] = [];

    for (const s of statuses) {
      const d = s.detalhePorCiclo.find((d) => d.numeroCiclo === ciclo.numeroCiclo);
      if (!d) continue;
      if (!d.relatorioEntregue) faltaramRelatorio.push({ id: s.aluno.id, nome: s.aluno.nome });
      if (d.reuniaoPrevista && d.foiAReuniao === false) faltaramReuniao.push({ id: s.aluno.id, nome: s.aluno.nome });
    }

    return { ciclo, faltaramRelatorio, faltaramReuniao };
  });

  const pivot = montarPivotDeFaltas(statuses);
  // Tabela lê melhor do mais antigo pro mais recente (ordem cronológica normal) — diferente dos
  // cards "por dia" acima, que priorizam o mais recente primeiro por ser o mais provável de
  // precisar de ação agora.
  const diasCronologicos = [...pivot.dias].reverse();

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <Link href={`/turmas/${id}`} className="text-sm text-zinc-500 hover:underline">
        ← voltar
      </Link>
      <div>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-xl font-semibold">Faltas por dia</h1>
          <div className="flex gap-2 text-sm">
            <Link
              href={`/turmas/${id}/faltas-por-dia${verTodos ? "?todos=1" : ""}`}
              className={`rounded border px-3 py-1.5 ${!visaoTabela ? "bg-orange-600 text-white border-orange-600" : "border-orange-300 text-orange-700 hover:bg-orange-50"}`}
            >
              Por dia
            </Link>
            <Link
              href={`/turmas/${id}/faltas-por-dia?visao=tabela${verTodos ? "&todos=1" : ""}`}
              className={`rounded border px-3 py-1.5 ${visaoTabela ? "bg-orange-600 text-white border-orange-600" : "border-orange-300 text-orange-700 hover:bg-orange-50"}`}
            >
              Tabela
            </Link>
          </div>
        </div>
        <p className="text-sm text-zinc-500 mt-1">
          {visaoTabela
            ? "Um aluno por linha, um ciclo por coluna — marcado quando faltou (passe o mouse pra ver o motivo)."
            : "Cada ciclo já vencido, com quem faltou o relatório e quem faltou a reunião naquele dia — mais recente primeiro."}
        </p>
        <RestricaoGrupoAviso
          gruposResponsavel={gruposResponsavel}
          restricaoConfigurada={restricaoConfigurada}
          verTodos={verTodos}
          hrefVerTodos={`/turmas/${id}/faltas-por-dia?todos=1${visaoTabela ? "&visao=tabela" : ""}`}
          hrefVoltar={`/turmas/${id}/faltas-por-dia${visaoTabela ? "?visao=tabela" : ""}`}
        />
      </div>

      {visaoTabela ? (
        pivot.linhas.length === 0 ? (
          <p className="text-sm text-zinc-400">Nenhum aluno pra mostrar.</p>
        ) : (
          <div className="border rounded bg-white overflow-x-auto">
            <table className="text-sm border-collapse">
              <thead>
                <tr className="bg-zinc-700 text-white">
                  <th className="px-4 py-2 text-left sticky left-0 bg-zinc-700">Aluno</th>
                  <th className="px-4 py-2 text-center">Faltas</th>
                  {diasCronologicos.map((d) => (
                    <th key={d.numeroCiclo} className="px-2 py-2 text-center font-normal whitespace-nowrap">
                      Ciclo {d.numeroCiclo}
                      <br />
                      {formatDiaCalendario(d.dataPrevista)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pivot.linhas.map((l, i) => (
                  <tr key={l.alunoId} className={i % 2 === 0 ? "bg-white" : "bg-zinc-50"}>
                    <td className="px-4 py-2 sticky left-0 bg-inherit">
                      <Link href={`/alunos/${l.alunoId}`} className="hover:underline">
                        {l.alunoNome}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-center font-medium">{l.totalFaltas}</td>
                    {[...l.celulas].reverse().map((c, j) => (
                      <td key={j} className="px-2 py-2 text-center">
                        <div
                          className="inline-flex items-center gap-1"
                          title={c.faltou ? `${c.motivo} (${c.faltas} falta${c.faltas > 1 ? "s" : ""})` : "Sem falta"}
                        >
                          <input type="checkbox" checked={c.faltou} readOnly disabled className="accent-orange-600" />
                          {c.faltou && <span className="text-xs font-semibold text-orange-700">{c.faltas}</span>}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : porCiclo.length === 0 ? (
        <p className="text-sm text-zinc-400">Nenhum ciclo vencido ainda.</p>
      ) : (
        <div className="space-y-3">
          {porCiclo.map(({ ciclo, faltaramRelatorio, faltaramReuniao }) => (
            <details key={ciclo.id} className="border rounded bg-white p-4">
              <summary className="cursor-pointer select-none text-sm font-medium flex items-center justify-between gap-2 flex-wrap">
                <span>
                  Ciclo {ciclo.numeroCiclo} — {formatDiaCalendario(ciclo.dataPrevista)}
                </span>
                <span className="text-xs text-zinc-400 font-normal">
                  {faltaramRelatorio.length} sem relatório · {faltaramReuniao.length} sem reunião
                </span>
              </summary>
              <div className="mt-3 grid gap-4 sm:grid-cols-2 text-sm">
                <div>
                  <p className="text-xs font-medium text-zinc-500 uppercase mb-1">
                    Faltou o relatório ({faltaramRelatorio.length})
                  </p>
                  {faltaramRelatorio.length === 0 ? (
                    <p className="text-zinc-400">—</p>
                  ) : (
                    <ul className="space-y-1">
                      {faltaramRelatorio.map((a) => (
                        <li key={a.id}>
                          <Link href={`/alunos/${a.id}`} className="hover:underline">
                            {a.nome}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-500 uppercase mb-1">
                    Faltou a reunião ({faltaramReuniao.length})
                  </p>
                  {faltaramReuniao.length === 0 ? (
                    <p className="text-zinc-400">—</p>
                  ) : (
                    <ul className="space-y-1">
                      {faltaramReuniao.map((a) => (
                        <li key={a.id}>
                          <Link href={`/alunos/${a.id}`} className="hover:underline">
                            {a.nome}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
