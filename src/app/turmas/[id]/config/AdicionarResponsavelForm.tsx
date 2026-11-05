"use client";

import { useActionState } from "react";
import { adicionarResponsavel } from "../configActions";

type State = { ok: true; professorNome: string } | { erro: string } | null;

export default function AdicionarResponsavelForm({ turmaId }: { turmaId: string }) {
  const action = adicionarResponsavel.bind(null, turmaId);
  const [state, formAction, pending] = useActionState<State, FormData>(action, null);

  return (
    <form action={formAction} className="border rounded p-4 bg-white space-y-2 text-sm">
      <p className="font-medium">Adicionar outra pessoa responsável</p>
      <p className="text-xs text-zinc-500">
        Se já existir alguém cadastrado com esse nome ou e-mail, reaproveita — não cria duplicata.
      </p>
      <div className="flex gap-2 flex-wrap">
        <input name="nome" placeholder="Nome" required className="flex-1 min-w-[10rem] rounded border px-3 py-2" />
        <input name="email" type="email" placeholder="E-mail (opcional)" className="flex-1 min-w-[10rem] rounded border px-3 py-2" />
        <button disabled={pending} className="rounded bg-orange-600 text-white px-4 py-2 hover:bg-orange-700 disabled:opacity-50">
          {pending ? "Adicionando…" : "Adicionar"}
        </button>
      </div>
      {state && "ok" in state && <p className="text-emerald-700 text-xs">{state.professorNome} adicionado(a) como responsável.</p>}
      {state && "erro" in state && <p className="text-red-700 text-xs">{state.erro}</p>}
    </form>
  );
}
