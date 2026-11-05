import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { computeStatus } from "@/lib/semaforo";
import { requireCoordenadorAccess } from "@/lib/authz";
import { criarTurmaComoResponsavel, vincularResponsavel } from "./actions";
import { restaurarTurma } from "@/app/turmas/[id]/configActions";

export default async function CoordenadorPage() {
  const { coordenadorId } = await requireCoordenadorAccess();

  // Turmas onde é o coordenador "principal" (coordenadorId) OU está vinculado via
  // TurmaCoordenador (pode ter mais de um coordenador acompanhando a mesma turma) — sem visão
  // cruzada de turmas de outros coordenadores. Arquivadas ficam de fora daqui — só a coordenação
  // ainda enxerga essas, numa seção separada mais abaixo, pra poder restaurar.
  const turmasTodas = await prisma.turma.findMany({
    where: { OR: [{ coordenadorId }, { coordenadores: { some: { coordenadorId } } }] },
    include: {
      vinculos: { include: { professor: true } },
      alunos: { include: { relatorios: true, observacoes: true, orientador: true }, },
      ciclos: true,
    },
    orderBy: { createdAt: "desc" },
  });
  const turmas = turmasTodas.filter((t) => !t.arquivadaEm);
  const turmasArquivadas = turmasTodas.filter((t) => t.arquivadaEm);

  const linhas = turmas.map((turma) => {
    const statuses = turma.alunos.map((a) => computeStatus(a, turma, turma.ciclos, a.relatorios, a.observacoes));
    const entregaMedia = statuses.length ? statuses.reduce((acc, s) => acc + s.pctEntrega, 0) / statuses.length : 0;
    const pctVermelho = statuses.length ? statuses.filter((s) => s.status === "vermelho").length / statuses.length : 0;
    const responsaveis = turma.vinculos.filter((v) => v.papel === "RESPONSAVEL").map((v) => v.professor.nome);
    return { turma, total: statuses.length, entregaMedia, pctVermelho, responsaveis };
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Painel do coordenador</h1>
        <p className="text-sm text-zinc-500">
          Comparação entre suas turmas/disciplinas/professores responsáveis.
        </p>
      </div>

      <div className="border rounded bg-white overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-zinc-500 border-b">
            <tr>
              <th className="px-4 py-2">Turma</th>
              <th className="px-4 py-2">Responsável(is)</th>
              <th className="px-4 py-2">Alunos</th>
              <th className="px-4 py-2">Entrega média</th>
              <th className="px-4 py-2">% em vermelho</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {linhas.map(({ turma, total, entregaMedia, pctVermelho, responsaveis }) => (
              <tr key={turma.id} className="border-b last:border-0">
                <td className="px-4 py-2">
                  {turma.nome}
                  <div className="text-xs text-zinc-400">{turma.disciplina} · {turma.periodoLetivo}</div>
                </td>
                <td className="px-4 py-2">{responsaveis.join(", ") || "—"}</td>
                <td className="px-4 py-2">{total}</td>
                <td className="px-4 py-2">{Math.round(entregaMedia * 100)}%</td>
                <td className="px-4 py-2">{Math.round(pctVermelho * 100)}%</td>
                <td className="px-4 py-2 text-right">
                  <Link href={`/turmas/${turma.id}`} className="text-xs text-orange-600 hover:text-orange-700 underline">
                    abrir
                  </Link>
                </td>
              </tr>
            ))}
            {linhas.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-4 text-center text-zinc-400">
                  Nenhuma turma cadastrada ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      {turmasArquivadas.length > 0 && (
        <details className="border rounded bg-white p-4">
          <summary className="cursor-pointer select-none font-medium text-sm">
            Turmas arquivadas ({turmasArquivadas.length})
          </summary>
          <ul className="mt-3 space-y-2">
            {turmasArquivadas.map((turma) => (
              <li key={turma.id} className="flex items-center justify-between gap-2 text-sm border-b pb-2 last:border-0">
                <div>
                  {turma.nome}
                  <div className="text-xs text-zinc-400">
                    {turma.disciplina} · {turma.periodoLetivo} · arquivada em{" "}
                    {turma.arquivadaEm?.toLocaleDateString("pt-BR")}
                  </div>
                </div>
                <form action={restaurarTurma.bind(null, turma.id)}>
                  <button className="rounded border border-orange-300 text-orange-700 px-3 py-1.5 text-xs hover:bg-orange-50">
                    Restaurar
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </details>
      )}

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="border rounded bg-white p-4 space-y-3">
          <h2 className="font-medium text-sm">Criar turma com um professor responsável</h2>
          <form action={criarTurmaComoResponsavel} className="space-y-2 text-sm">
            <input name="nome" placeholder="Nome da turma" required className="w-full rounded border px-3 py-2" />
            <input name="disciplina" placeholder="Disciplina" required className="w-full rounded border px-3 py-2" />
            <input name="periodoLetivo" placeholder="Período letivo" required className="w-full rounded border px-3 py-2" />
            <input name="responsavelNome" placeholder="Nome do professor responsável" required className="w-full rounded border px-3 py-2" />
            <input name="responsavelEmail" type="email" placeholder="E-mail do professor responsável" required className="w-full rounded border px-3 py-2" />
            <button className="rounded bg-orange-600 text-white px-4 py-2 hover:bg-orange-700">Criar</button>
          </form>
        </div>

        {turmas.length > 0 && (
          <div className="border rounded bg-white p-4 space-y-3">
            <h2 className="font-medium text-sm">Vincular responsável a uma turma existente</h2>
            <form action={vincularResponsavel} className="space-y-2 text-sm">
              <select name="turmaId" required className="w-full rounded border px-3 py-2">
                {turmas.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                  </option>
                ))}
              </select>
              <input name="nome" placeholder="Nome do professor" required className="w-full rounded border px-3 py-2" />
              <input name="email" type="email" placeholder="E-mail do professor" required className="w-full rounded border px-3 py-2" />
              <button className="rounded border border-orange-300 text-orange-700 px-4 py-2 hover:bg-orange-50">Vincular</button>
            </form>
          </div>
        )}
      </section>
    </div>
  );
}
