import { prisma } from "@/lib/prisma";
import { createTurma } from "../actions";

export default async function NovaTurmaPage() {
  const coordenadores = await prisma.coordenador.findMany({ orderBy: { nome: "asc" } });

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <h1 className="text-xl font-semibold">Nova turma</h1>
      <p className="text-sm text-zinc-500">
        Você vira automaticamente o professor responsável desta turma.
      </p>
      <form action={createTurma} className="space-y-3 border rounded p-4 bg-white">
        <div>
          <label className="block text-sm text-zinc-600 mb-1">Nome da turma</label>
          <input
            name="nome"
            required
            placeholder="Ex.: TCC 2026.2"
            className="w-full rounded border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm text-zinc-600 mb-1">Disciplina</label>
          <input
            name="disciplina"
            required
            placeholder="Ex.: Pré-Projeto de TCC"
            className="w-full rounded border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm text-zinc-600 mb-1">Período letivo</label>
          <input
            name="periodoLetivo"
            required
            placeholder="Ex.: 2026.2"
            className="w-full rounded border px-3 py-2 text-sm"
          />
        </div>
        {coordenadores.length > 0 && (
          <div>
            <label className="block text-sm text-zinc-600 mb-1">Coordenador (opcional)</label>
            <select name="coordenadorId" className="w-full rounded border px-3 py-2 text-sm">
              <option value="">— nenhum —</option>
              {coordenadores.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
        )}
        <button className="rounded bg-orange-600 text-white px-4 py-2 text-sm hover:bg-orange-700">
          Criar turma
        </button>
      </form>
    </div>
  );
}
