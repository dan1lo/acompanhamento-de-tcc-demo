import Link from "next/link";
import { notFound } from "next/navigation";
import { getTurmaCompleta, statusesPorTurma } from "@/lib/turmaData";
import { requireTurmaResponsavel } from "@/lib/authz";
import { orientadoresDaTurma } from "@/lib/vinculos";

export default async function OrientadoresPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireTurmaResponsavel(id);
  const turma = await getTurmaCompleta(id);
  if (!turma) notFound();

  const statuses = statusesPorTurma(turma);
  const orientadores = orientadoresDaTurma(turma.vinculos);

  const linhas = orientadores.map((o) => {
    const meus = statuses.filter((s) => s.aluno.orientadorId === o.id);
    const entregaMedia = meus.length ? meus.reduce((acc, s) => acc + s.pctEntrega, 0) / meus.length : 0;
    const vermelhos = meus.filter((s) => s.status === "vermelho").length;
    const amarelos = meus.filter((s) => s.status === "amarelo").length;
    return { orientador: o, total: meus.length, entregaMedia, vermelhos, amarelos };
  });

  return (
    <div className="space-y-4">
      <Link href={`/turmas/${turma.id}`} className="text-sm text-zinc-500 hover:underline">
        ← voltar
      </Link>
      <h1 className="text-xl font-semibold">Visão por pessoa orientadora — {turma.nome}</h1>
      <p className="text-sm text-zinc-500">Comparativo entre pessoas orientadoras da turma.</p>

      <div className="border rounded bg-white overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-zinc-500 border-b">
            <tr>
              <th className="px-4 py-2">Pessoa orientadora</th>
              <th className="px-4 py-2">Orientandos</th>
              <th className="px-4 py-2">Entrega média</th>
              <th className="px-4 py-2">Em vermelho</th>
              <th className="px-4 py-2">Em amarelo</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {linhas.map(({ orientador, total, entregaMedia, vermelhos, amarelos }) => (
              <tr key={orientador.id} className="border-b last:border-0">
                <td className="px-4 py-2">{orientador.nome}</td>
                <td className="px-4 py-2">{total}</td>
                <td className="px-4 py-2">{Math.round(entregaMedia * 100)}%</td>
                <td className="px-4 py-2">{vermelhos}</td>
                <td className="px-4 py-2">{amarelos}</td>
                <td className="px-4 py-2 text-right space-x-3 whitespace-nowrap">
                  <Link href={`/turmas/${turma.id}?orientador=${orientador.id}`} className="text-xs text-orange-600 hover:text-orange-700 underline">
                    ver alunos
                  </Link>
                  <Link
                    href={`/turmas/${turma.id}/orientadores/${orientador.id}/relatorio`}
                    className="text-xs text-orange-600 hover:text-orange-700 underline"
                  >
                    relatório PDF
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
