"use client";

import { useActionState } from "react";
import { uploadRelatorios } from "../uploadActions";

type State =
  | { ok: true; resumo: { processados: number; semCorrespondencia: string[] } }
  | { erro: string }
  | null;

export default function UploadRelatoriosForm({ turmaId }: { turmaId: string }) {
  const action = uploadRelatorios.bind(null, turmaId);
  const [state, formAction, pending] = useActionState<State, FormData>(action, null);

  return (
    <form action={formAction} className="space-y-3 border rounded p-4 bg-white">
      <input type="file" name="arquivo" accept=".xlsx" required className="text-sm" />
      <button
        disabled={pending}
        className="rounded bg-orange-600 text-white px-4 py-2 text-sm hover:bg-orange-700 disabled:opacity-50"
      >
        {pending ? "Processando…" : "Enviar planilha"}
      </button>

      {state && "erro" in state && <p className="text-sm text-red-700">{state.erro}</p>}

      {state && "ok" in state && (
        <div className="text-sm space-y-2 border-t pt-3">
          <p>
            <strong>{state.resumo.processados}</strong> relatório(s) processado(s) (criados ou
            substituídos).
          </p>
          {state.resumo.semCorrespondencia.length > 0 && (
            <div>
              <p className="text-red-700">
                Sem correspondência na turma ({state.resumo.semCorrespondencia.length}):
              </p>
              <ul className="list-disc list-inside text-zinc-500">
                {state.resumo.semCorrespondencia.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
              <p className="text-xs text-zinc-500 mt-1">
                Confira se o nome bate com o cadastrado no upload de alunos ou se o aluno ainda
                não foi cadastrado.
              </p>
            </div>
          )}
        </div>
      )}
    </form>
  );
}
