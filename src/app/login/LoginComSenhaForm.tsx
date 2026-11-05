"use client";

import { useActionState } from "react";
import { loginComSenha } from "./actions";

type State = { erro: string } | null;

export default function LoginComSenhaForm() {
  const [state, formAction, pending] = useActionState<State, FormData>(loginComSenha, null);

  return (
    <form action={formAction} className="space-y-3 border rounded p-4 bg-white">
      <input
        name="email"
        type="email"
        placeholder="E-mail"
        required
        autoComplete="username"
        className="w-full rounded border px-3 py-2 text-sm"
      />
      <input
        name="senha"
        type="password"
        placeholder="Senha"
        required
        autoComplete="current-password"
        className="w-full rounded border px-3 py-2 text-sm"
      />
      <div className="flex items-center gap-3">
        <button disabled={pending} className="rounded bg-orange-600 text-white px-4 py-2 text-sm hover:bg-orange-700 disabled:opacity-50">
          {pending ? "Entrando…" : "Entrar"}
        </button>
        {state?.erro && <span className="text-red-700 text-xs">{state.erro}</span>}
      </div>
    </form>
  );
}
