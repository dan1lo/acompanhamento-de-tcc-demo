"use client";

import { useActionState } from "react";
import { adicionarCoordenador } from "../configActions";

type State = { ok: true; coordenadorNome: string } | { erro: string } | null;

export default function AdicionarCoordenadorForm({ turmaId }: { turmaId: string }) {
  const action = adicionarCoordenador.bind(null, turmaId);
  const [state, formAction, pending] = useActionState<State, FormData>(action, null);

  return (
    <form action={formAction} className="border rounded p-4 bg-white space-y-2 text-sm">
      <p className="font-medium">Adicionar outro coordenador</p>
      <p className="text-xs text-zinc-500">
        Pode ter mais de um coordenador acompanhando a mesma turma. Reaproveita cadastro existente
        pelo e-mail — não cria duplicata.
      </p>
      <div className="flex gap-2 flex-wrap">
        <input name="nome" placeholder="Nome" required className="flex-1 min-w-[10rem] rounded border px-3 py-2" />
        <input name="email" type="email" placeholder="E-mail" required className="flex-1 min-w-[10rem] rounded border px-3 py-2" />
        <button disabled={pending} className="rounded bg-orange-600 text-white px-4 py-2 hover:bg-orange-700 disabled:opacity-50">
          {pending ? "Adicionando…" : "Adicionar"}
        </button>
      </div>
      {state && "ok" in state && <p className="text-emerald-700 text-xs">{state.coordenadorNome} adicionado(a) como coordenador(a).</p>}
      {state && "erro" in state && <p className="text-red-700 text-xs">{state.erro}</p>}
    </form>
  );
}
