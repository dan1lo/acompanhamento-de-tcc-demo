"use client";

import { useActionState } from "react";
import { editarCoordenador, removerSenhaCoordenador } from "../../actions";

type State = { ok: true } | { erro: string } | null;

export default function EditarCoordenadorForm({
  coordenadorId,
  nome,
  email,
  temSenha,
}: {
  coordenadorId: string;
  nome: string;
  email: string;
  temSenha: boolean;
}) {
  const action = editarCoordenador.bind(null, coordenadorId);
  const [state, formAction, pending] = useActionState<State, FormData>(action, null);

  return (
    <form action={formAction} className="border rounded p-4 bg-white space-y-2">
      <div>
        <label className="block text-xs text-zinc-500 mb-1">Nome</label>
        <input name="nome" defaultValue={nome} required className="w-full rounded border px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-xs text-zinc-500 mb-1">E-mail</label>
        <input name="email" type="email" defaultValue={email} required className="w-full rounded border px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-xs text-zinc-500 mb-1">
          {temSenha ? "Trocar senha (deixe em branco pra manter a atual)" : "Definir senha"}
        </label>
        <input name="novaSenha" type="password" className="w-full rounded border px-3 py-2 text-sm" />
      </div>
      <div className="flex items-center gap-3">
        <button disabled={pending} className="rounded bg-orange-600 text-white px-4 py-2 text-sm hover:bg-orange-700 disabled:opacity-50">
          {pending ? "Salvando…" : "Salvar"}
        </button>
        {temSenha && (
          <button
            type="button"
            onClick={() => {
              if (confirm("Remover a senha dessa conta? Ela volta a aparecer na lista sem senha do login.")) {
                removerSenhaCoordenador(coordenadorId);
              }
            }}
            className="text-xs text-red-700 hover:underline"
          >
            remover senha
          </button>
        )}
        {state && "ok" in state && <span className="text-emerald-700 text-xs">salvo</span>}
        {state && "erro" in state && <span className="text-red-700 text-xs">{state.erro}</span>}
      </div>
    </form>
  );
}
