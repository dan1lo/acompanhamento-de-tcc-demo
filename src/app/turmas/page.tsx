import Link from "next/link";
import { requireProfessor } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export default async function TurmasPage() {
  const session = await requireProfessor();

  const vinculos = await prisma.turmaProfessor.findMany({
    where: { professorId: session.id, papel: "RESPONSAVEL", turma: { arquivadaEm: null } },
    include: { turma: { include: { alunos: true } } },
    orderBy: { turma: { createdAt: "desc" } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Minhas turmas</h1>
        <Link
          href="/turmas/novo"
          className="rounded bg-orange-600 text-white px-4 py-2 text-sm hover:bg-orange-700"
        >
          Nova turma
        </Link>
      </div>

      {vinculos.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Você ainda não é responsável por nenhuma turma. Crie a primeira.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {vinculos.map(({ turma }) => (
            <li key={turma.id}>
              <Link
                href={`/turmas/${turma.id}`}
                className="block rounded border bg-white p-4 hover:border-zinc-400"
              >
                <div className="font-medium">{turma.nome}</div>
                <div className="text-sm text-zinc-500">
                  {turma.disciplina} · {turma.periodoLetivo}
                </div>
                <div className="text-sm text-zinc-500 mt-1">{turma.alunos.length} aluno(s)</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
