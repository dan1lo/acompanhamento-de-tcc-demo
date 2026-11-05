import type { Aluno, Nota, Observacao, Professor, RelatorioSemanal, Turma } from "@prisma/client";
import type { AlunoStatus } from "@/lib/semaforo";
import { formatDiaCalendario } from "@/lib/format";
import { SITUACAO_LABEL } from "@/lib/situacao";
import SemaforoBadge from "@/components/SemaforoBadge";

type AlunoComRelatorio = Aluno & {
  turma: Turma;
  relatorios: RelatorioSemanal[];
  notas: Nota[];
};

/**
 * Corpo do relatório de um único aluno (resumo, dias com falta, histórico completo, notas,
 * observações e relatórios semanais entregues) — sem o cabeçalho de página, pra poder ser
 * reaproveitado tanto na ficha individual (`alunos/[id]/relatorio`) quanto no relatório em lote
 * por pessoa orientadora (`turmas/[id]/orientadores/[orientadorId]/relatorio`).
 */
export default function AlunoRelatorioSecoes({
  aluno,
  status,
  observacoesVisiveis,
  podeVerOculto,
}: {
  aluno: AlunoComRelatorio;
  status: AlunoStatus;
  observacoesVisiveis: (Observacao & { professor: Professor })[];
  podeVerOculto: boolean;
}) {
  const ciclosComFalta = status.detalhePorCiclo.filter((d) => d.faltas > 0);

  // Mesma lógica da ficha do aluno (`alunos/[id]/page.tsx`) — dedupe por data (várias semanas
  // seguidas costumam repetir a mesma "dataUltimaReuniao" enquanto não rola uma reunião nova) e
  // ordena pela data da reunião, não por numeroRelatorio.
  const reunioesComOrientador = [
    ...new Set(aluno.relatorios.filter((r) => r.dataUltimaReuniao).map((r) => r.dataUltimaReuniao!.getTime())),
  ]
    .sort((a, b) => b - a)
    .map((t) => new Date(t));

  return (
    <>
      <section className="border rounded bg-white p-4 space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-medium text-sm">Resumo</h2>
          <SemaforoBadge status={status.status} />
        </div>
        <p className="text-sm">Relatórios não entregues: {status.relatoriosNaoEntregues} de {status.ciclosConsiderados}</p>
        <p className="text-sm">Faltas em reuniões: {status.faltasReuniao}</p>
        <p className="text-sm font-medium">Falta total: {status.totalFaltas} de {aluno.turma.limiteFaltas}</p>
        {status.motivos.length > 0 && (
          <ul className="text-sm text-zinc-600 list-disc list-inside">
            {status.motivos.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="border rounded bg-white p-4 space-y-2">
        <h2 className="font-medium text-sm">Reuniões com a pessoa orientadora (segundo o aluno)</h2>
        {reunioesComOrientador.length === 0 ? (
          <p className="text-sm text-zinc-400">Nenhuma reunião reportada ainda.</p>
        ) : (
          <p className="text-sm">{reunioesComOrientador.map((d) => formatDiaCalendario(d)).join(", ")}</p>
        )}
      </section>

      <section className="border rounded bg-white p-4 space-y-2">
        <h2 className="font-medium text-sm">Dias com falta (relatório e/ou reunião)</h2>
        {ciclosComFalta.length === 0 ? (
          <p className="text-sm text-zinc-400">Nenhuma falta registrada.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-zinc-500 border-b">
              <tr>
                <th className="py-1 pr-4">Data</th>
                <th className="py-1 pr-4">Ocorrido</th>
                <th className="py-1">Faltas</th>
              </tr>
            </thead>
            <tbody>
              {ciclosComFalta.map((d) => (
                <tr key={d.numeroCiclo} className="border-b last:border-0">
                  <td className="py-1 pr-4">{formatDiaCalendario(d.dataPrevista)}</td>
                  <td className="py-1 pr-4">{d.descricao}</td>
                  <td className="py-1">{d.faltas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="border rounded bg-white p-4 space-y-2">
        <h2 className="font-medium text-sm">Histórico completo por ciclo</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-zinc-500 border-b">
            <tr>
              <th className="py-1 pr-4">Data</th>
              <th className="py-1 pr-4">Reunião prevista?</th>
              <th className="py-1 pr-4">Relatório entregue?</th>
              <th className="py-1 pr-4">Foi à reunião?</th>
              <th className="py-1">Faltas</th>
            </tr>
          </thead>
          <tbody>
            {status.detalhePorCiclo.map((d) => (
              <tr key={d.numeroCiclo} className="border-b last:border-0">
                <td className="py-1 pr-4">{formatDiaCalendario(d.dataPrevista)}</td>
                <td className="py-1 pr-4">{d.reuniaoPrevista ? "Sim" : "Não"}</td>
                <td className="py-1 pr-4">{d.relatorioEntregue ? "Sim" : "Não"}</td>
                <td className="py-1 pr-4">{d.foiAReuniao === null ? "—" : d.foiAReuniao ? "Sim" : "Não"}</td>
                <td className="py-1">{d.faltas}</td>
              </tr>
            ))}
            {status.detalhePorCiclo.length === 0 && (
              <tr>
                <td colSpan={5} className="py-2 text-center text-zinc-400">
                  Nenhum ciclo vencido ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {aluno.notas.length > 0 && (
        <section className="border rounded bg-white p-4 space-y-2">
          <h2 className="font-medium text-sm">Notas</h2>
          {aluno.notas.map((n) => (
            <div key={n.id} className="text-sm border rounded p-3">
              <div className="font-medium">{n.periodo}</div>
              <p>Automática: {n.notaAutomatica ?? "—"}</p>
              <p>Pessoa orientadora: {n.notaOrientador ?? "—"}</p>
              <p>Final: {n.notaFinal ?? "—"}</p>
              {n.comentario && <p className="text-zinc-500 mt-1">{n.comentario}</p>}
            </div>
          ))}
        </section>
      )}

      <section className="border rounded bg-white p-4 space-y-3">
        <h2 className="font-medium text-sm">Observações (pessoa orientadora e responsável pela disciplina)</h2>
        {observacoesVisiveis.length === 0 ? (
          <p className="text-sm text-zinc-400">Nenhuma observação registrada.</p>
        ) : (
          <ol className="space-y-2">
            {observacoesVisiveis.map((o) => (
              <li key={o.id} className="text-sm border-b pb-2 last:border-0">
                <div className="flex justify-between text-zinc-500 text-xs mb-1 gap-2">
                  <span>{o.professor.nome}</span>
                  <span>{formatDiaCalendario(o.data)}</span>
                </div>
                {o.situacao && <p className="text-xs font-medium text-zinc-700">{SITUACAO_LABEL[o.situacao]}</p>}
                {o.texto && <p>{o.texto}</p>}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="border rounded bg-white p-4 space-y-2">
        <h2 className="font-medium text-sm">Relatórios semanais entregues</h2>
        {aluno.relatorios.filter((r) => r.relatorioEntregue).length === 0 ? (
          <p className="text-sm text-zinc-400">Nenhum relatório entregue ainda.</p>
        ) : (
          <ol className="space-y-2">
            {aluno.relatorios
              .filter((r) => r.relatorioEntregue)
              .map((r) => (
                <li key={r.id} className="text-sm border-b pb-2 last:border-0">
                  <div className="flex justify-between text-zinc-500 text-xs mb-1 gap-2">
                    <span>Relatório #{r.numeroRelatorio}</span>
                    <span>{formatDiaCalendario(r.timestampEnvio)}</span>
                  </div>
                  {r.impedimento && (podeVerOculto || !r.impedimentoOcultoDoOrientador) && (
                    <p className="text-red-700">Impedimento: {r.impedimentoDesc}</p>
                  )}
                  {r.oQueFez && <p>Fez: {r.oQueFez}</p>}
                  {r.oQuePretende && <p>Pretende: {r.oQuePretende}</p>}
                </li>
              ))}
          </ol>
        )}
      </section>
    </>
  );
}
