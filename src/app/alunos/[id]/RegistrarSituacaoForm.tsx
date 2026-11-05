"use client";

import { useActionState } from "react";
import { registrarSituacaoOrientador } from "./actions";

type State = { ok: true } | { erro: string } | null;

export default function RegistrarSituacaoForm({ alunoId }: { alunoId: string }) {
  const action = registrarSituacaoOrientador.bind(null, alunoId);
  const [state, formAction, pending] = useActionState<State, FormData>(action, null);

  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label className="block text-zinc-600 mb-1">Data da reunião</label>
          <input name="data" type="date" defaultValue={hoje} required className="w-full rounded border px-3 py-2" />
        </div>
        <div>
          <label className="block text-zinc-600 mb-1">Situação do aluno</label>
          <select name="situacao" required defaultValue="" className="w-full rounded border px-3 py-2">
            <option value="" disabled>
              Selecione…
            </option>
            <option value="OK">Tudo indo bem</option>
            <option value="ATENCAO">Precisa de atenção</option>
            <option value="INTERVENCAO">Precisa de intervenção</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-zinc-600 mb-1">O que aconteceu</label>
        <textarea name="texto" required rows={3} className="w-full rounded border px-3 py-2" />
      </div>
      <button disabled={pending} className="rounded bg-orange-600 text-white px-4 py-2 hover:bg-orange-700 disabled:opacity-50">
        {pending ? "Salvando…" : "Registrar reunião"}
      </button>
      {state && "ok" in state && <span className="ml-2 text-emerald-700 text-xs">salvo</span>}
      {state && "erro" in state && <span className="ml-2 text-red-700 text-xs">{state.erro}</span>}
    </form>
  );
}
