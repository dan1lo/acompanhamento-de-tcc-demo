"use client";

import { useActionState, useEffect } from "react";
import { registrarSituacaoResponsavel } from "./actions";

type State = { ok: true } | { erro: string } | null;

export default function RegistrarSituacaoResponsavelForm({
  alunoId,
  onSaved,
}: {
  alunoId: string;
  /** Chamado depois de um registro salvo com sucesso — usado por quem exibe esse formulário
   * dentro de um painel que abre/fecha (ex.: o card de reunião), pra fechar sozinho em vez de
   * ficar aberto esperando a pessoa fechar na mão. */
  onSaved?: () => void;
}) {
  const action = registrarSituacaoResponsavel.bind(null, alunoId);
  const [state, formAction, pending] = useActionState<State, FormData>(action, null);

  useEffect(() => {
    if (state && "ok" in state) onSaved?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="space-y-2">
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
      <div>
        <label className="block text-zinc-600 mb-1">Motivo (opcional)</label>
        <textarea name="texto" rows={3} className="w-full rounded border px-3 py-2" />
      </div>
      <button disabled={pending} className="rounded bg-orange-600 text-white px-4 py-2 hover:bg-orange-700 disabled:opacity-50">
        {pending ? "Salvando…" : "Registrar"}
      </button>
      {state && "ok" in state && <span className="ml-2 text-emerald-700 text-xs">salvo</span>}
      {state && "erro" in state && <span className="ml-2 text-red-700 text-xs">{state.erro}</span>}
    </form>
  );
}
