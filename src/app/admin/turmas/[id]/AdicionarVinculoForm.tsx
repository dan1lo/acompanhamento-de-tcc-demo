"use client";

import { useActionState } from "react";
import { adicionarVinculo } from "../actions";

type State = { ok: true; professorNome: string } | { erro: string } | null;

export default function AdicionarVinculoForm({ turmaId }: { turmaId: string }) {
  const action = adicionarVinculo.bind(null, turmaId);
  const [state, formAction, pending] = useActionState<State, FormData>(action, null);

  return (
    <form action={formAction} className="border rounded p-4 bg-white space-y-2">
      <h2 className="text-sm font-medium">Alocar professor nessa turma</h2>
      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-1.5">
          <input type="radio" name="papel" value="RESPONSAVEL" defaultChecked /> Responsável pela disciplina
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" name="papel" value="ORIENTADOR" /> Orientador
        </label>
      </div>
      <input name="nome" placeholder="Nome" required className="w-full rounded border px-3 py-2 text-sm" />
      <input name="email" type="email" placeholder="E-mail (opcional)" className="w-full rounded border px-3 py-2 text-sm" />
      <p className="text-xs text-zinc-400">
        Reaproveita cadastro existente por e-mail ou nome — não cria duplicata.
      </p>
      <button disabled={pending} className="rounded bg-orange-600 text-white px-4 py-2 text-sm hover:bg-orange-700 disabled:opacity-50">
        {pending ? "Alocando…" : "Alocar"}
      </button>
      {state && "ok" in state && <span className="ml-2 text-emerald-700 text-xs">{state.professorNome} alocado(a)</span>}
      {state && "erro" in state && <span className="ml-2 text-red-700 text-xs">{state.erro}</span>}
    </form>
  );
}
