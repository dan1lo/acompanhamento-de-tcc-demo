"use client";

import { useState } from "react";

/**
 * Lista com checkbox de quem está pendente numa semana, pra escolher pra quem vale a pena mandar
 * o e-mail de aviso — nem sempre faz sentido avisar todo mundo de uma vez (o professor pode já
 * ter falado com alguns por fora). Tudo vem marcado por padrão; o professor desmarca quem não
 * quer incluir antes de gerar o e-mail.
 */
export default function SelecaoPendentesForm({
  turmaId,
  semana,
  alunos,
}: {
  turmaId: string;
  semana: number;
  alunos: { id: string; nome: string; orientadorNome: string }[];
}) {
  const [selecionados, setSelecionados] = useState(new Set(alunos.map((a) => a.id)));

  function toggle(id: string) {
    setSelecionados((prev) => {
      const proximo = new Set(prev);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });
  }

  return (
    <form action={`/turmas/${turmaId}/alerta-email-lote`} method="get" className="space-y-3">
      <input type="hidden" name="semana" value={semana} />
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-3 text-xs">
          <button
            type="button"
            onClick={() => setSelecionados(new Set(alunos.map((a) => a.id)))}
            className="text-orange-600 hover:underline"
          >
            marcar todos
          </button>
          <button type="button" onClick={() => setSelecionados(new Set())} className="text-orange-600 hover:underline">
            desmarcar todos
          </button>
        </div>
        <button
          disabled={selecionados.size === 0}
          className="rounded bg-orange-600 text-white px-3 py-1.5 text-sm hover:bg-orange-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Gerar e-mail de aviso ({selecionados.size})
        </button>
      </div>
      <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
        {alunos.map((a) => (
          <li key={a.id} className="text-sm">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="alunos"
                value={a.id}
                checked={selecionados.has(a.id)}
                onChange={() => toggle(a.id)}
                className="mt-1"
              />
              <span>
                {a.nome}
                <span className="text-zinc-400"> — {a.orientadorNome}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </form>
  );
}
