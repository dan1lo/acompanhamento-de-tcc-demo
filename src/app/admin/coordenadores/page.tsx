import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import CriarCoordenadorForm from "./CriarCoordenadorForm";

export default async function AdminCoordenadoresPage() {
  await requireAdmin();
  const coordenadores = await prisma.coordenador.findMany({ orderBy: { nome: "asc" } });

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Link href="/admin" className="text-sm text-zinc-500 hover:underline">
        ← voltar
      </Link>
      <h1 className="text-xl font-semibold">Coordenadores</h1>

      <CriarCoordenadorForm />

      <div className="border rounded bg-white overflow-hidden divide-y">
        {coordenadores.map((c) => (
          <Link
            key={c.id}
            href={`/admin/coordenadores/${c.id}`}
            className="flex items-center justify-between px-4 py-2 text-sm hover:bg-zinc-50"
          >
            <span>{c.nome}</span>
            <span className="text-zinc-400 flex items-center gap-2">
              {c.email}
              {c.senhaHash && <span className="text-emerald-700">🔒 com senha</span>}
            </span>
          </Link>
        ))}
        {coordenadores.length === 0 && <p className="px-4 py-3 text-sm text-zinc-400">Nenhum coordenador cadastrado.</p>}
      </div>
    </div>
  );
}
