"use client";

import { useState, useTransition } from "react";
import type { SituacaoOrientacao } from "@prisma/client";
import { editarObservacao, alternarObservacaoOculta, apagarObservacao } from "./actions";
import { SITUACAO_LABEL, ORIGEM_SITUACAO_LABEL, ORIGEM_SITUACAO_STYLE } from "@/lib/situacao";
import TextoExpansivel from "@/components/TextoExpansivel";
import OcultarDoOrientadorToggle from "@/components/OcultarDoOrientadorToggle";

const ESTILO_AMARELO = "border-amber-200 bg-amber-50 text-amber-900";

export default function ObservacaoItem({
  alunoId,
  observacaoId,
  autorNome,
  data,
  texto,
  situacao,
  origemSituacao,
  podeEditar,
  oculto,
  podeAlternarVisibilidade,
}: {
  alunoId: string;
  observacaoId: string;
  autorNome: string;
  data: Date;
  texto: string;
  situacao: SituacaoOrientacao | null;
  /** Mesma classificação usada na tela de Reuniões — de quem escreveu, não da situacao em si. */
  origemSituacao: "orientador" | "disciplina" | null;
  podeEditar: boolean;
  oculto: boolean;
  podeAlternarVisibilidade: boolean;
}) {
  const estiloCaixa = origemSituacao ? ORIGEM_SITUACAO_STYLE[origemSituacao] : ESTILO_AMARELO;
  const rotuloCabecalho = origemSituacao ? ORIGEM_SITUACAO_LABEL[origemSituacao] : "Observação";
  const [editando, setEditando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function salvar(formData: FormData) {
    setErro(null);
    startTransition(async () => {
      const resultado = await editarObservacao(alunoId, observacaoId, null, formData);
      if (resultado && "erro" in resultado) setErro(resultado.erro ?? "Não foi possível salvar.");
      else setEditando(false);
    });
  }

  function apagar() {
    if (!confirm("Apagar esse registro? Não tem como desfazer.")) return;
    startTransition(() => {
      apagarObservacao(alunoId, observacaoId);
    });
  }

  if (editando) {
    return (
      <li className={`border rounded p-3 text-sm ${estiloCaixa}`}>
        <form action={salvar} className="space-y-2">
          {situacao && (
            <select name="situacao" defaultValue={situacao} className="rounded border px-2 py-1.5 text-sm">
              <option value="OK">Tudo indo bem</option>
              <option value="ATENCAO">Precisa de atenção</option>
              <option value="INTERVENCAO">Precisa de intervenção</option>
            </select>
          )}
          <textarea name="texto" defaultValue={texto} required rows={3} className="w-full rounded border px-3 py-2" />
          <div className="flex gap-2 items-center">
            <button disabled={pending} className="rounded bg-orange-600 text-white px-3 py-1.5 hover:bg-orange-700 disabled:opacity-50">
              {pending ? "Salvando…" : "Salvar"}
            </button>
            <button type="button" onClick={() => setEditando(false)} className="rounded border border-orange-300 text-orange-700 px-3 py-1.5 hover:bg-orange-50">
              Cancelar
            </button>
            <button type="button" onClick={apagar} disabled={pending} className="text-red-700 hover:underline disabled:opacity-50">
              apagar
            </button>
            {erro && <span className="text-red-700 text-xs">{erro}</span>}
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className={`border rounded p-3 text-sm ${estiloCaixa}`}>
      <div className="flex justify-between items-center text-xs mb-1 gap-2">
        <span className="font-medium">
          {rotuloCabecalho} — {autorNome}
          {oculto && <span className="ml-2 text-red-700">🔒 oculto da pessoa orientadora</span>}
        </span>
        <span className="flex items-center gap-2">
          {data.toLocaleString("pt-BR")}
          {podeEditar && (
            <>
              <button onClick={() => setEditando(true)} className="text-orange-600 hover:text-orange-700 underline">
                editar
              </button>
              <button onClick={apagar} className="text-red-700 hover:underline">
                apagar
              </button>
            </>
          )}
        </span>
      </div>
      {situacao && <p className="text-xs font-medium text-zinc-700 mb-1">{SITUACAO_LABEL[situacao]}</p>}
      {texto && (
        <p>
          <TextoExpansivel texto={texto} />
        </p>
      )}
      {podeAlternarVisibilidade && (
        <div className="mt-2">
          <OcultarDoOrientadorToggle oculto={oculto} onToggle={() => alternarObservacaoOculta(alunoId, observacaoId)} />
        </div>
      )}
    </li>
  );
}
