import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTurmaResponsavel } from "@/lib/authz";
import { orientadoresDaTurma } from "@/lib/vinculos";

export default async function ExportarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireTurmaResponsavel(id);

  const turma = await prisma.turma.findUnique({
    where: { id },
    include: { vinculos: { include: { professor: true } } },
  });
  if (!turma) notFound();

  const orientadores = orientadoresDaTurma(turma.vinculos).sort((a, b) => a.nome.localeCompare(b.nome));

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <Link href={`/turmas/${id}`} className="text-sm text-zinc-500 hover:underline">
        ← voltar
      </Link>
      <h1 className="text-xl font-semibold">Relatórios</h1>

      <a href={`/turmas/${id}/export`} className="block border rounded p-4 bg-white hover:bg-zinc-50">
        <p className="font-medium">Resumo por aluno (CSV)</p>
        <p className="text-sm text-zinc-500">
          Uma linha por aluno: status, faltas, relatórios não entregues, impedimento em aberto.
        </p>
      </a>

      <a href={`/turmas/${id}/export/detalhado`} className="block border rounded p-4 bg-white hover:bg-zinc-50">
        <p className="font-medium">Detalhado por ciclo + comentários (CSV)</p>
        <p className="text-sm text-zinc-500">
          Uma linha por aluno × ciclo (presença, entrega, o que fez e o que pretende fazer), mais
          os comentários que você mesmo escreveu em cada aluno.
        </p>
      </a>

      <a href={`/turmas/${id}/export/faltas`} className="block border rounded p-4 bg-white hover:bg-zinc-50">
        <p className="font-medium">Faltas (CSV)</p>
        <p className="text-sm text-zinc-500">
          Uma linha por aluno, uma coluna por dia — célula em branco quando não faltou, ou com o
          que faltou (Entrega, Reunião, ou os dois) e a quantidade de faltas daquele dia.
        </p>
      </a>

      <div className="border rounded bg-white p-4 space-y-3">
        <div>
          <p className="font-medium">Relatório por pessoa orientadora (PDF)</p>
          <p className="text-sm text-zinc-500">
            Escolha quem, e o nível de detalhe — abre a tela pronta pra imprimir/exportar em PDF.
          </p>
        </div>
        {orientadores.length === 0 ? (
          <p className="text-sm text-zinc-400">Nenhuma pessoa orientadora vinculada a essa turma ainda.</p>
        ) : (
          <ul className="divide-y">
            {orientadores.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span>{o.nome}</span>
                <span className="flex items-center gap-2 text-xs">
                  <Link
                    href={`/turmas/${id}/orientadores/${o.id}/relatorio?nivel=resumo`}
                    className="rounded border border-orange-300 text-orange-700 px-2 py-1 hover:bg-orange-50"
                  >
                    Resumo
                  </Link>
                  <Link
                    href={`/turmas/${id}/orientadores/${o.id}/relatorio?nivel=completo`}
                    className="rounded border border-orange-300 text-orange-700 px-2 py-1 hover:bg-orange-50"
                  >
                    Completo
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border rounded bg-white p-4">
        <p className="font-medium">Relatório individual de um aluno (PDF)</p>
        <p className="text-sm text-zinc-500">
          Abre direto na ficha do aluno (&quot;Exportar relatório&quot;) ou pela busca no topo da tela.
        </p>
      </div>
    </div>
  );
}
