import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import EditarCoordenadorForm from "./EditarCoordenadorForm";

export default async function AdminCoordenadorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdmin();

  const coordenador = await prisma.coordenador.findUnique({
    where: { id },
    include: { turmas: true, turmasVinculadas: { include: { turma: true } } },
  });
  if (!coordenador) notFound();

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <Link href="/admin/coordenadores" className="text-sm text-zinc-500 hover:underline">
        ← voltar
      </Link>
      <h1 className="text-xl font-semibold">{coordenador.nome}</h1>

      <EditarCoordenadorForm
        coordenadorId={coordenador.id}
        nome={coordenador.nome}
        email={coordenador.email}
        temSenha={!!coordenador.senhaHash}
      />

      <div>
        <h2 className="text-sm font-medium mb-2">Turmas</h2>
        <div className="border rounded bg-white overflow-hidden divide-y">
          {coordenador.turmas.map((t) => (
            <div key={t.id} className="px-4 py-2 text-sm">
              {t.nome} <span className="text-zinc-400 text-xs">(principal)</span>
            </div>
          ))}
          {coordenador.turmasVinculadas.map((v) => (
            <div key={v.id} className="px-4 py-2 text-sm">
              {v.turma.nome}
            </div>
          ))}
          {coordenador.turmas.length === 0 && coordenador.turmasVinculadas.length === 0 && (
            <p className="px-4 py-3 text-sm text-zinc-400">Nenhuma turma ainda.</p>
          )}
        </div>
      </div>
    </div>
  );
}
