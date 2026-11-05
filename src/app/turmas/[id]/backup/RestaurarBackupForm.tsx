"use client";

import { useActionState } from "react";
import { restaurarBackup } from "./actions";

type State = { ok: true; backupSeguranca: string } | { erro: string } | null;

export default function RestaurarBackupForm({ turmaId }: { turmaId: string }) {
  const action = restaurarBackup.bind(null, turmaId);
  const [state, formAction, pending] = useActionState<State, FormData>(action, null);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (
          !confirm(
            "Isso substitui TODO o banco de dados atual (todas as turmas) pelo conteúdo desse arquivo. Não tem como desfazer pela tela — só restaurando um backup depois. Confirma?"
          )
        ) {
          e.preventDefault();
        }
      }}
      className="space-y-2 border rounded p-4 bg-red-50 border-red-200"
    >
      <label className="block text-sm text-red-800 mb-1">
        Restaurar backup (substitui o banco inteiro — use com cuidado)
      </label>
      <input type="file" name="arquivo" accept=".db" required className="text-sm" />
      <div>
        <button
          disabled={pending}
          className="rounded bg-red-700 text-white px-4 py-2 text-sm hover:bg-red-800 disabled:opacity-50"
        >
          {pending ? "Restaurando…" : "Restaurar backup"}
        </button>
      </div>
      {state && "ok" in state && (
        <p className="text-sm text-emerald-700">
          Banco restaurado. Um backup do estado anterior foi salvo automaticamente em{" "}
          <code className="text-xs">{state.backupSeguranca}</code> antes da troca — recarregue a
          página pra ver os dados novos.
        </p>
      )}
      {state && "erro" in state && <p className="text-sm text-red-700">{state.erro}</p>}
    </form>
  );
}
