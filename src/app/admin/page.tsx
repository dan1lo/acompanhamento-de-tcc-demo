import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";

export default async function AdminPage() {
  await requireAdmin();

  const [turmas, professores, coordenadores] = await Promise.all([
    prisma.turma.findMany({ orderBy: { nome: "asc" }, include: { alunos: { select: { id: true } } } }),
    prisma.professor.count(),
    prisma.coordenador.count(),
  ]);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-xl font-semibold">Painel de admin</h1>

      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/admin/professores" className="border rounded p-4 bg-white hover:bg-zinc-50">
          <p className="text-2xl font-semibold">{professores}</p>
          <p className="text-sm text-zinc-500">Professores</p>
        </Link>
        <Link href="/admin/coordenadores" className="border rounded p-4 bg-white hover:bg-zinc-50">
          <p className="text-2xl font-semibold">{coordenadores}</p>
          <p className="text-sm text-zinc-500">Coordenadores</p>
        </Link>
        <Link href="/admin/senha" className="border rounded p-4 bg-white hover:bg-zinc-50">
          <p className="text-sm font-medium">Trocar minha senha</p>
        </Link>
      </div>

      <div>
        <h2 className="text-lg font-medium mb-2">Turmas</h2>
        <p className="text-sm text-zinc-500 mb-2">
          Acesso ao conteúdo de uma turma continua exclusivo de quem é
          responsável/orientador/coordenador dela — o admin só aloca quem tem cada papel.
        </p>
        <div className="border rounded bg-white overflow-hidden divide-y">
          {turmas.map((t) => (
            <Link
              key={t.id}
              href={`/admin/turmas/${t.id}`}
              className="flex items-center justify-between px-4 py-2 text-sm hover:bg-zinc-50"
            >
              <span>
                {t.nome} <span className="text-zinc-400">· {t.disciplina} · {t.periodoLetivo}</span>
              </span>
              <span className="text-zinc-400">{t.alunos.length} aluno(s)</span>
            </Link>
          ))}
          {turmas.length === 0 && <p className="px-4 py-3 text-sm text-zinc-400">Nenhuma turma cadastrada.</p>}
        </div>
      </div>
    </div>
  );
}
