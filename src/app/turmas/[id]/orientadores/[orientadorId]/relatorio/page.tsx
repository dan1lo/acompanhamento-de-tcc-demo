import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireOrientadorRelatorioAccess, podeVerConteudoOcultoDoOrientador } from "@/lib/authz";
import { computeStatus } from "@/lib/semaforo";
import { formatDiaCalendario } from "@/lib/format";
import SemaforoBadge from "@/components/SemaforoBadge";
import AlunoRelatorioSecoes from "@/components/AlunoRelatorioSecoes";
import PrintButton from "@/components/PrintButton";

export default async function RelatorioOrientadorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; orientadorId: string }>;
  searchParams: Promise<{ nivel?: string }>;
}) {
  const { id: turmaId, orientadorId } = await params;
  const { nivel: nivelParam } = await searchParams;
  const nivel = nivelParam === "completo" ? "completo" : "resumo";

  const session = await requireOrientadorRelatorioAccess(turmaId, orientadorId);

  const turma = await prisma.turma.findUnique({ where: { id: turmaId } });
  if (!turma) notFound();

  const orientador = await prisma.professor.findUnique({ where: { id: orientadorId } });
  if (!orientador) notFound();

  const alunos = await prisma.aluno.findMany({
    where: { turmaId, orientadorId },
    include: {
      turma: { include: { ciclos: true } },
      relatorios: { orderBy: { numeroRelatorio: "asc" } },
      observacoes: { include: { professor: true }, orderBy: { data: "asc" } },
      notas: true,
    },
    orderBy: { nome: "asc" },
  });

  const podeVerOculto = await podeVerConteudoOcultoDoOrientador(turmaId, session);

  const linhas = alunos.map((aluno) => {
    const status = computeStatus(aluno, aluno.turma, aluno.turma.ciclos, aluno.relatorios, aluno.observacoes);
    const observacoesVisiveis = podeVerOculto
      ? aluno.observacoes
      : aluno.observacoes.filter((o) => !o.ocultoDoOrientador);
    return { aluno, status, observacoesVisiveis };
  });

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="no-print flex items-center justify-between flex-wrap gap-2">
        <Link href={`/turmas/${turmaId}/orientadores`} className="text-sm text-zinc-500 hover:underline">
          ← voltar
        </Link>
        <div className="flex items-center gap-2 text-sm">
          <Link
            href={`/turmas/${turmaId}/orientadores/${orientadorId}/relatorio?nivel=resumo`}
            className={`rounded border px-3 py-1.5 ${nivel === "resumo" ? "bg-orange-600 text-white border-orange-600" : "border-orange-300 text-orange-700 hover:bg-orange-50"}`}
          >
            Resumo
          </Link>
          <Link
            href={`/turmas/${turmaId}/orientadores/${orientadorId}/relatorio?nivel=completo`}
            className={`rounded border px-3 py-1.5 ${nivel === "completo" ? "bg-orange-600 text-white border-orange-600" : "border-orange-300 text-orange-700 hover:bg-orange-50"}`}
          >
            Completo
          </Link>
          <PrintButton />
        </div>
      </div>

      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Relatório de orientandos — {orientador.nome}</h1>
        <p className="text-sm text-zinc-500">
          {turma.disciplina} · {turma.nome} · {turma.periodoLetivo}
        </p>
        <p className="text-xs text-zinc-400">Gerado em {formatDiaCalendario(new Date())}</p>
      </div>

      {linhas.length === 0 && (
        <p className="text-sm text-zinc-400">Essa pessoa orientadora não tem orientandos alocados nessa turma.</p>
      )}

      {nivel === "resumo" && linhas.length > 0 && (
        <section className="border rounded bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-zinc-500 border-b">
                <tr>
                  <th className="px-4 py-2">Aluno</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Relatórios entregues</th>
                  <th className="px-4 py-2">Faltas</th>
                  <th className="px-4 py-2">Impedimento</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map(({ aluno, status }) => (
                  <tr key={aluno.id} className="border-b last:border-0">
                    <td className="px-4 py-2">{aluno.nome}</td>
                    <td className="px-4 py-2">
                      <SemaforoBadge status={status.status} />
                    </td>
                    <td className="px-4 py-2">
                      {status.ciclosConsiderados - status.relatoriosNaoEntregues} de {status.ciclosConsiderados}
                    </td>
                    <td className="px-4 py-2 font-medium">
                      {status.totalFaltas} de {turma.limiteFaltas}
                    </td>
                    <td className="px-4 py-2">{status.impedimentoAberto ? "Sim" : "Não"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {nivel === "completo" &&
        linhas.map(({ aluno, status, observacoesVisiveis }, i) => (
          <div key={aluno.id} className={`space-y-4 ${i < linhas.length - 1 ? "page-break" : ""}`}>
            <h2 className="text-lg font-semibold border-b pb-2">{aluno.nome}</h2>
            <AlunoRelatorioSecoes
              aluno={aluno}
              status={status}
              observacoesVisiveis={observacoesVisiveis}
              podeVerOculto={podeVerOculto}
            />
          </div>
        ))}
    </div>
  );
}
