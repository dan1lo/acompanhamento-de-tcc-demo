"use client";

import { useActionState } from "react";
import { criarCoordenador } from "../actions";

type State = { ok: true } | { erro: string } | null;

export default function CriarCoordenadorForm() {
  const [state, formAction, pending] = useActionState<State, FormData>(criarCoordenador, null);

  return (
    <form action={formAction} className="border rounded p-4 bg-white space-y-2">
      <h2 className="text-sm font-medium">Novo coordenador</h2>
      <input name="nome" placeholder="Nome" required className="w-full rounded border px-3 py-2 text-sm" />
      <input name="email" type="email" placeholder="E-mail" required className="w-full rounded border px-3 py-2 text-sm" />
      <input name="senha" type="password" placeholder="Senha (opcional)" className="w-full rounded border px-3 py-2 text-sm" />
      <button disabled={pending} className="rounded bg-orange-600 text-white px-4 py-2 text-sm hover:bg-orange-700 disabled:opacity-50">
        {pending ? "Criando…" : "Criar"}
      </button>
      {state && "ok" in state && <span className="ml-2 text-emerald-700 text-xs">criado</span>}
      {state && "erro" in state && <span className="ml-2 text-red-700 text-xs">{state.erro}</span>}
    </form>
  );
}
