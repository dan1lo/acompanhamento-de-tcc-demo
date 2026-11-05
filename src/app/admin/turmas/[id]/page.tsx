import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { removerVinculo } from "../actions";
import AdicionarVinculoForm from "./AdicionarVinculoForm";
import FormularioComConfirmacao from "@/components/FormularioComConfirmacao";

export default async function AdminTurmaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdmin();

  const turma = await prisma.turma.findUnique({
    where: { id },
    include: { vinculos: { include: { professor: true }, orderBy: { professor: { nome: "asc" } } } },
  });
  if (!turma) notFound();

  const responsaveis = turma.vinculos.filter((v) => v.papel === "RESPONSAVEL");
  const orientadores = turma.vinculos.filter((v) => v.papel === "ORIENTADOR");

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <Link href="/admin" className="text-sm text-zinc-500 hover:underline">
        ← voltar
      </Link>
      <h1 className="text-xl font-semibold">{turma.nome}</h1>
      <p className="text-sm text-zinc-500">
        {turma.disciplina} · {turma.periodoLetivo}
      </p>

      <AdicionarVinculoForm turmaId={turma.id} />

      <div>
        <h2 className="text-sm font-medium mb-2">Responsáveis pela disciplina</h2>
        <div className="border rounded bg-white overflow-hidden divide-y">
          {responsaveis.map((v) => {
            const removerAction = removerVinculo.bind(null, turma.id, v.id);
            return (
              <div key={v.id} className="flex items-center justify-between px-4 py-2 text-sm">
                <span>{v.professor.nome}</span>
                {responsaveis.length > 1 && (
                  <FormularioComConfirmacao
                    action={removerAction}
                    mensagem={`Remover ${v.professor.nome} como responsável dessa turma?`}
                  >
                    <button className="text-xs text-red-700 hover:underline">remover</button>
                  </FormularioComConfirmacao>
                )}
              </div>
            );
          })}
          {responsaveis.length === 0 && <p className="px-4 py-3 text-sm text-zinc-400">Nenhum ainda.</p>}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-medium mb-2">Orientadores</h2>
        <div className="border rounded bg-white overflow-hidden divide-y">
          {orientadores.map((v) => {
            const removerAction = removerVinculo.bind(null, turma.id, v.id);
            return (
              <div key={v.id} className="flex items-center justify-between px-4 py-2 text-sm">
                <span>{v.professor.nome}</span>
                <FormularioComConfirmacao
                  action={removerAction}
                  mensagem={`Remover ${v.professor.nome} como orientador(a) dessa turma? Os alunos que ela orienta ficam sem pessoa orientadora.`}
                >
                  <button className="text-xs text-red-700 hover:underline">remover</button>
                </FormularioComConfirmacao>
              </div>
            );
          })}
          {orientadores.length === 0 && <p className="px-4 py-3 text-sm text-zinc-400">Nenhum ainda.</p>}
        </div>
      </div>
    </div>
  );
}
