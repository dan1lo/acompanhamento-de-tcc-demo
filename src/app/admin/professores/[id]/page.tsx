import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { tornarCoordenador, removerVinculoCoordenador } from "../../actions";
import EditarProfessorForm from "./EditarProfessorForm";
import FormularioComConfirmacao from "@/components/FormularioComConfirmacao";

export default async function AdminProfessorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdmin();

  const professor = await prisma.professor.findUnique({
    where: { id },
    include: { vinculos: { include: { turma: true } }, coordenadorVinculado: true },
  });
  if (!professor) notFound();

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <Link href="/admin/professores" className="text-sm text-zinc-500 hover:underline">
        ← voltar
      </Link>
      <h1 className="text-xl font-semibold">{professor.nome}</h1>

      <EditarProfessorForm
        professorId={professor.id}
        nome={professor.nome}
        email={professor.email}
        temSenha={!!professor.senhaHash}
        isAdmin={professor.isAdmin}
      />

      <div className="border rounded p-4 bg-white space-y-2">
        <h2 className="text-sm font-medium">Também é coordenador(a)?</h2>
        {professor.coordenadorVinculado ? (
          <div className="flex items-center gap-3 text-sm">
            <span className="text-emerald-700">Sim — vinculado a {professor.coordenadorVinculado.nome}</span>
            <FormularioComConfirmacao
              action={removerVinculoCoordenador.bind(null, professor.id)}
              mensagem={`Desvincular ${professor.nome} de ${professor.coordenadorVinculado.nome}? A pessoa perde o acesso de coordenação vinculado a essa conta.`}
            >
              <button className="text-xs text-red-700 hover:underline">desvincular</button>
            </FormularioComConfirmacao>
          </div>
        ) : (
          <form action={tornarCoordenador.bind(null, professor.id)}>
            <button
              disabled={!professor.email}
              className="rounded border border-orange-300 text-orange-700 px-3 py-1.5 text-sm hover:bg-orange-50 disabled:opacity-50"
              title={!professor.email ? "Precisa de e-mail cadastrado primeiro" : undefined}
            >
              Vincular como coordenador(a)
            </button>
          </form>
        )}
      </div>

      <div>
        <h2 className="text-sm font-medium mb-2">Vínculos</h2>
        <div className="border rounded bg-white overflow-hidden divide-y">
          {professor.vinculos.map((v) => (
            <div key={v.id} className="px-4 py-2 text-sm">
              {v.turma.nome} · {v.papel}
            </div>
          ))}
          {professor.vinculos.length === 0 && (
            <p className="px-4 py-3 text-sm text-zinc-400">Nenhum vínculo com turma ainda.</p>
          )}
        </div>
      </div>
    </div>
  );
}
