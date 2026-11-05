"use client";

import { useActionState } from "react";
import { editarProfessor, removerSenhaProfessor } from "../../actions";

type State = { ok: true } | { erro: string } | null;

export default function EditarProfessorForm({
  professorId,
  nome,
  email,
  temSenha,
  isAdmin,
}: {
  professorId: string;
  nome: string;
  email: string | null;
  temSenha: boolean;
  isAdmin: boolean;
}) {
  const action = editarProfessor.bind(null, professorId);
  const [state, formAction, pending] = useActionState<State, FormData>(action, null);

  return (
    <form action={formAction} className="border rounded p-4 bg-white space-y-2">
      <div>
        <label className="block text-xs text-zinc-500 mb-1">Nome</label>
        <input name="nome" defaultValue={nome} required className="w-full rounded border px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-xs text-zinc-500 mb-1">E-mail</label>
        <input name="email" type="email" defaultValue={email ?? ""} className="w-full rounded border px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-xs text-zinc-500 mb-1">
          {temSenha ? "Trocar senha (deixe em branco pra manter a atual)" : "Definir senha"}
        </label>
        <input name="novaSenha" type="password" className="w-full rounded border px-3 py-2 text-sm" />
      </div>
      <label className="flex items-center gap-1.5 text-sm">
        <input type="checkbox" name="isAdmin" defaultChecked={isAdmin} />
        Também é admin (abre o painel de admin com essa mesma conta)
      </label>
      <div className="flex items-center gap-3">
        <button disabled={pending} className="rounded bg-orange-600 text-white px-4 py-2 text-sm hover:bg-orange-700 disabled:opacity-50">
          {pending ? "Salvando…" : "Salvar"}
        </button>
        {temSenha && (
          <button
            type="button"
            onClick={() => {
              if (confirm("Remover a senha dessa conta? Ela volta a aparecer na lista sem senha do login.")) {
                removerSenhaProfessor(professorId);
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
