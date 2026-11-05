import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import CriarProfessorForm from "./CriarProfessorForm";

export default async function AdminProfessoresPage() {
  await requireAdmin();
  const professores = await prisma.professor.findMany({ orderBy: { nome: "asc" } });

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Link href="/admin" className="text-sm text-zinc-500 hover:underline">
        ← voltar
      </Link>
      <h1 className="text-xl font-semibold">Professores</h1>

      <CriarProfessorForm />

      <div className="border rounded bg-white overflow-hidden divide-y">
        {professores.map((p) => (
          <Link
            key={p.id}
            href={`/admin/professores/${p.id}`}
            className="flex items-center justify-between px-4 py-2 text-sm hover:bg-zinc-50"
          >
            <span>{p.nome}</span>
            <span className="text-zinc-400 flex items-center gap-2">
              {p.email ?? "sem e-mail"}
              {p.senhaHash && <span className="text-emerald-700">🔒 com senha</span>}
            </span>
          </Link>
        ))}
        {professores.length === 0 && <p className="px-4 py-3 text-sm text-zinc-400">Nenhum professor cadastrado.</p>}
      </div>
    </div>
  );
}
