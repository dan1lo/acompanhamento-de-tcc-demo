"use client";

import { useActionState } from "react";
import { uploadRoster, confirmarSugestoesOrientador } from "../uploadActions";

type SugestaoOrientador = {
  nomeOriginal: string;
  alunoId: string;
  alunoNome: string;
  professorId: string;
  professorNome: string;
};

type State =
  | {
      ok: true;
      resumo: {
        criados: number;
        atualizados: number;
        orientadoresCriados: string[];
        semCorrespondencia: string[];
        sugestoesOrientador: SugestaoOrientador[];
      };
    }
  | { erro: string }
  | null;

type ConfirmState = { ok: true; confirmadas: number } | null;

export default function UploadRosterForm({ turmaId }: { turmaId: string }) {
  const action = uploadRoster.bind(null, turmaId);
  const [state, formAction, pending] = useActionState<State, FormData>(action, null);

  const confirmAction = confirmarSugestoesOrientador.bind(null, turmaId);
  const [confirmState, confirmFormAction, confirmPending] = useActionState<ConfirmState, FormData>(
    confirmAction,
    null
  );

  const sugestoes = state && "ok" in state ? state.resumo.sugestoesOrientador : [];

  return (
    <div className="space-y-4">
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
              <strong>{state.resumo.criados}</strong> aluno(s) criado(s),{" "}
              <strong>{state.resumo.atualizados}</strong> atualizado(s).
            </p>
            {state.resumo.orientadoresCriados.length > 0 && (
              <div>
                <p className="text-zinc-600">Pessoas orientadoras novas cadastradas automaticamente:</p>
                <ul className="list-disc list-inside text-zinc-500">
                  {state.resumo.orientadoresCriados.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
                <p className="text-xs text-amber-700 mt-1">
                  Cadastre o e-mail dessas pessoas depois — vieram sem e-mail da planilha.
                </p>
              </div>
            )}
            {state.resumo.semCorrespondencia.length > 0 && (
              <div>
                <p className="text-red-700">Sem correspondência ({state.resumo.semCorrespondencia.length}):</p>
                <ul className="list-disc list-inside text-zinc-500">
                  {state.resumo.semCorrespondencia.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </form>

      {sugestoes.length > 0 && !(confirmState && "ok" in confirmState) && (
        <form action={confirmFormAction} className="space-y-3 border rounded p-4 bg-amber-50">
          <p className="text-sm font-medium">
            {sugestoes.length} nome(s) de pessoa orientadora não bateram exato com ninguém já
            cadastrado, mas achei um candidato único. Confira e marque os que estão certos —
            desmarcados ficam sem pessoa orientadora resolvida por enquanto (não criam duplicata):
          </p>
          <input type="hidden" name="total" value={sugestoes.length} />
          <ul className="space-y-2">
            {sugestoes.map((s, i) => (
              <li key={`${s.alunoId}-${i}`} className="flex items-start gap-2 text-sm">
                <input type="hidden" name={`alunoId_${i}`} value={s.alunoId} />
                <input type="hidden" name={`professorId_${i}`} value={s.professorId} />
                <input type="checkbox" name={`confirmar_${i}`} defaultChecked className="mt-1" />
                <span>
                  <span className="text-zinc-500">&quot;{s.nomeOriginal}&quot;</span> (orientador(a)
                  de <strong>{s.alunoNome}</strong>) é <strong>{s.professorNome}</strong>
                </span>
              </li>
            ))}
          </ul>
          <button
            disabled={confirmPending}
            className="rounded bg-orange-600 text-white px-4 py-2 text-sm hover:bg-orange-700 disabled:opacity-50"
          >
            {confirmPending ? "Confirmando…" : "Confirmar selecionados"}
          </button>
        </form>
      )}

      {confirmState && "ok" in confirmState && (
        <p className="text-sm text-emerald-700">
          {confirmState.confirmadas} pessoa(s) orientadora(s) confirmada(s) e atualizada(s).
        </p>
      )}
    </div>
  );
}
