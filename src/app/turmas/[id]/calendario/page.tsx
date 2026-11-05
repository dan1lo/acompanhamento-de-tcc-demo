import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTurmaResponsavel } from "@/lib/authz";
import { formatDiaCalendario } from "@/lib/format";
import { indiceDoCicloMap, parseGruposComReuniao } from "@/lib/ciclos";
import FormularioComConfirmacao from "@/components/FormularioComConfirmacao";
import { getGruposDisponiveis } from "@/lib/turmaData";
import { addCiclo, gerarCiclosSemanais, removeCiclo } from "../calendarioActions";
import ContagemCicloToggle from "./ContagemCicloToggle";

export default async function CalendarioPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ editar?: string }>;
}) {
  const { id } = await params;
  const { editar } = await searchParams;
  await requireTurmaResponsavel(id);
  const turma = await prisma.turma.findUnique({
    where: { id },
    include: { ciclos: { orderBy: { numeroCiclo: "asc" } } },
  });
  if (!turma) notFound();

  const gruposDisponiveis = await getGruposDisponiveis(id);

  const cicloEmEdicao = editar ? turma.ciclos.find((c) => c.numeroCiclo === Number(editar)) : undefined;
  const gruposEmEdicao = cicloEmEdicao ? parseGruposComReuniao(cicloEmEdicao.gruposComReuniao) : [];
  const todosEmEdicao = gruposEmEdicao.includes("TODOS");
  const indiceRelatorio = indiceDoCicloMap(turma.ciclos);

  const addAction = addCiclo.bind(null, turma.id);
  const gerarAction = gerarCiclosSemanais.bind(null, turma.id);
  const removeAction = removeCiclo.bind(null, turma.id);

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link href={`/turmas/${turma.id}`} className="text-sm text-zinc-500 hover:underline">
          ← voltar
        </Link>
        <Link href={`/turmas/${turma.id}/upload-agenda`} className="rounded border border-orange-300 text-orange-700 px-3 py-1.5 text-sm hover:bg-orange-50">
          Upload agenda
        </Link>
      </div>
      <div>
        <h1 className="text-xl font-semibold">Calendário da turma</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Substitui as colunas de data fixas da planilha. Único para toda a turma; é ele que
          define os ciclos usados no semáforo e nos períodos de nota. Quem tem reunião prevista em
          cada ciclo (por grupo) pode vir do{" "}
          <Link href={`/turmas/${turma.id}/upload-agenda`} className="underline">
            upload da agenda
          </Link>{" "}
          (planilha inteira de uma vez) ou ser ajustado manualmente abaixo, ciclo a ciclo.
        </p>
      </div>

      <section className="border rounded p-4 bg-white space-y-3">
        <h2 className="text-sm font-medium">Gerar ciclos semanais</h2>
        <form action={gerarAction} className="flex gap-3 items-end flex-wrap text-sm">
          <div>
            <label className="block text-zinc-600 mb-1">Data do ciclo 1</label>
            <input type="date" name="dataInicio" required className="rounded border px-3 py-2" />
          </div>
          <div>
            <label className="block text-zinc-600 mb-1">Quantidade de ciclos</label>
            <input type="number" name="quantidade" min={1} defaultValue={7} required className="w-24 rounded border px-3 py-2" />
          </div>
          <button className="rounded bg-orange-600 text-white px-4 py-2 hover:bg-orange-700">Gerar</button>
        </form>
      </section>

      <section className="border rounded p-4 bg-white space-y-3">
        <h2 className="text-sm font-medium">Adicionar/editar um ciclo específico</h2>
        {cicloEmEdicao && (
          <p className="text-xs text-orange-600">
            Editando o ciclo {cicloEmEdicao.numeroCiclo} —{" "}
            <Link href={`/turmas/${turma.id}/calendario`} className="underline">
              cancelar
            </Link>
          </p>
        )}
        <form action={addAction} className="space-y-3 text-sm">
          <div className="flex gap-3 items-end flex-wrap">
            <div>
              <label className="block text-zinc-600 mb-1">Nº do ciclo</label>
              <input
                type="number"
                name="numeroCiclo"
                min={1}
                required
                defaultValue={cicloEmEdicao?.numeroCiclo}
                className="w-24 rounded border px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-zinc-600 mb-1">Data prevista</label>
              <input
                type="date"
                name="dataPrevista"
                required
                defaultValue={cicloEmEdicao ? cicloEmEdicao.dataPrevista.toISOString().slice(0, 10) : undefined}
                className="rounded border px-3 py-2"
              />
            </div>
          </div>
          <div>
            <label className="block text-zinc-600 mb-1">Quem tem reunião prevista nesse ciclo</label>
            <div className="flex flex-wrap gap-3">
              <label className="inline-flex items-center gap-1.5 font-medium">
                <input type="checkbox" name="todosOsGrupos" defaultChecked={todosEmEdicao} />
                Todo mundo
              </label>
              {gruposDisponiveis.map((g) => (
                <label key={g} className="inline-flex items-center gap-1.5 text-zinc-600">
                  <input type="checkbox" name="grupos" value={g} defaultChecked={gruposEmEdicao.includes(g)} />
                  {g}
                </label>
              ))}
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Nenhum marcado = semana só de relatório, sem reunião prevista pra ninguém (diferente
              de &quot;sem encontro&quot;, que também dispensa o relatório — isso se ajusta na
              tabela abaixo).
            </p>
          </div>
          <div>
            <label className="block text-zinc-600 mb-1">
              Nº do relatório esperado aqui — correção manual (opcional)
            </label>
            <input
              type="number"
              name="numeroRelatorioManual"
              min={1}
              defaultValue={cicloEmEdicao?.numeroRelatorioManual ?? undefined}
              placeholder={cicloEmEdicao ? String(indiceRelatorio.get(cicloEmEdicao.numeroCiclo) ?? "") : ""}
              className="w-32 rounded border px-3 py-2"
            />
            <p className="text-xs text-zinc-400 mt-1">
              Por padrão o número é contado automaticamente (1º ciclo que conta = relatório 1, 2º =
              relatório 2, ...). Só preencha aqui quando o calendário mudar no meio do período e os
              alunos já tiverem numerado os relatórios deles pelo esquema antigo, sem como corrigir
              a resposta enviada — os ciclos seguintes continuam a contagem a partir do valor
              informado. Deixe em branco pra voltar ao automático.
            </p>
          </div>
          <button className="rounded border border-orange-300 text-orange-700 px-4 py-2 hover:bg-orange-50">Salvar</button>
        </form>
      </section>

      <section className="border rounded bg-white overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-zinc-500 border-b">
            <tr>
              <th className="px-4 py-2 whitespace-nowrap">Ciclo</th>
              <th className="px-4 py-2 whitespace-nowrap">Data prevista</th>
              <th className="px-4 py-2">Reunião prevista</th>
              <th className="px-4 py-2 whitespace-nowrap">Contagem</th>
              <th className="px-4 py-2 whitespace-nowrap">Nº relatório</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {turma.ciclos.map((c) => {
              const grupos = parseGruposComReuniao(c.gruposComReuniao);
              return (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="px-4 py-2 whitespace-nowrap">{c.numeroCiclo}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{formatDiaCalendario(c.dataPrevista)}</td>
                  <td className="px-4 py-2 text-zinc-500 whitespace-nowrap">
                    {c.semEncontro
                      ? "Sem encontro"
                      : grupos.includes("TODOS")
                        ? "Todo mundo"
                        : grupos.length > 0
                          ? grupos.join(", ")
                          : "—"}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <ContagemCicloToggle turmaId={turma.id} cicloId={c.id} contaAtualmente={!c.semEncontro} />
                  </td>
                  <td className="px-4 py-2 text-zinc-500 whitespace-nowrap">
                    {indiceRelatorio.get(c.numeroCiclo) ?? "—"}
                    {c.numeroRelatorioManual !== null && (
                      <span className="ml-1 text-xs text-orange-600" title="Corrigido manualmente">
                        (manual)
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    <Link href={`/turmas/${turma.id}/calendario?editar=${c.numeroCiclo}`} className="text-xs text-orange-600 underline mr-3">
                      editar
                    </Link>
                    <FormularioComConfirmacao
                      action={removeAction.bind(null, c.id)}
                      mensagem={`Remover o Ciclo ${c.numeroCiclo} (${formatDiaCalendario(c.dataPrevista)})? Isso também apaga a contagem de relatório/falta associada a esse dia.`}
                      className="inline"
                    >
                      <button className="text-xs text-red-700 underline">remover</button>
                    </FormularioComConfirmacao>
                  </td>
                </tr>
              );
            })}
            {turma.ciclos.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-4 text-center text-zinc-400">
                  Nenhum ciclo cadastrado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </section>
    </div>
  );
}
