"use client";

import { useActionState } from "react";
import { uploadAgenda, confirmarSugestoesAgenda } from "../uploadActions";

type Sugestao = {
  nomeOriginal: string;
  grupo: string;
  ordemSlot: number;
  horario: string | null;
  alunoId: string;
  alunoNome: string;
};

type UploadState =
  | {
      ok: true;
      resumo: { ciclos: number; gruposAtribuidos: number; semCorrespondencia: string[]; sugestoes: Sugestao[] };
    }
  | { erro: string }
  | null;

type ConfirmState = { ok: true; confirmadas: number } | null;

export default function UploadAgendaForm({ turmaId }: { turmaId: string }) {
  const uploadAction = uploadAgenda.bind(null, turmaId);
  const [state, formAction, pending] = useActionState<UploadState, FormData>(uploadAction, null);

  const confirmAction = confirmarSugestoesAgenda.bind(null, turmaId);
  const [confirmState, confirmFormAction, confirmPending] = useActionState<ConfirmState, FormData>(
    confirmAction,
    null
  );

  const sugestoes = state && "ok" in state ? state.resumo.sugestoes : [];

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
              <strong>{state.resumo.ciclos}</strong> ciclo(s) do calendário atualizado(s),{" "}
              <strong>{state.resumo.gruposAtribuidos}</strong> aluno(s) com grupo atribuído direto.
            </p>
            {state.resumo.semCorrespondencia.length > 0 && (
              <div>
                <p className="text-red-700">
                  Sem correspondência nem sugestão ({state.resumo.semCorrespondencia.length}):
                </p>
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
            {sugestoes.length} nome(s) da agenda não bateram exato, mas achei um candidato único.
            Confira e marque os que estão certos:
          </p>
          <input type="hidden" name="total" value={sugestoes.length} />
          <ul className="space-y-2">
            {sugestoes.map((s, i) => (
              <li key={`${s.alunoId}-${i}`} className="flex items-start gap-2 text-sm">
                <input type="hidden" name={`alunoId_${i}`} value={s.alunoId} />
                <input type="hidden" name={`grupo_${i}`} value={s.grupo} />
                <input type="hidden" name={`ordemSlot_${i}`} value={s.ordemSlot} />
                <input type="hidden" name={`horario_${i}`} value={s.horario ?? ""} />
                <input type="checkbox" name={`confirmar_${i}`} defaultChecked className="mt-1" />
                <span>
                  <span className="text-zinc-500">&quot;{s.nomeOriginal}&quot;</span> é{" "}
                  <strong>{s.alunoNome}</strong>{" "}
                  <span className="text-zinc-400">({s.grupo})</span>
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
          {confirmState.confirmadas} aluno(s) confirmado(s) e atualizado(s).
        </p>
      )}
    </div>
  );
}
