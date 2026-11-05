"use client";

import { useActionState } from "react";
import { trocarSenhaPropria } from "../actions";

type State = { ok: true } | { erro: string } | null;

export default function TrocarSenhaForm() {
  const [state, formAction, pending] = useActionState<State, FormData>(trocarSenhaPropria, null);

  return (
    <form action={formAction} className="border rounded p-4 bg-white space-y-2">
      <div>
        <label className="block text-xs text-zinc-500 mb-1">Senha atual</label>
        <input name="senhaAtual" type="password" required className="w-full rounded border px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-xs text-zinc-500 mb-1">Nova senha</label>
        <input name="novaSenha" type="password" required className="w-full rounded border px-3 py-2 text-sm" />
      </div>
      <button disabled={pending} className="rounded bg-orange-600 text-white px-4 py-2 text-sm hover:bg-orange-700 disabled:opacity-50">
        {pending ? "Salvando…" : "Trocar senha"}
      </button>
      {state && "ok" in state && <span className="ml-2 text-emerald-700 text-xs">senha trocada</span>}
      {state && "erro" in state && <span className="ml-2 text-red-700 text-xs">{state.erro}</span>}
    </form>
  );
}
