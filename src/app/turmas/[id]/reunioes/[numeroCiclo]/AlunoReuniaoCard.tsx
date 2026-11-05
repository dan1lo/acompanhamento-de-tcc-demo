"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { salvarRelatorioReuniao } from "../actions";
import { addObservacao } from "@/app/alunos/[id]/actions";
import RegistrarSituacaoResponsavelForm from "@/app/alunos/[id]/RegistrarSituacaoResponsavelForm";
import SemaforoBadge from "@/components/SemaforoBadge";
import SituacaoBadge from "@/components/SituacaoBadge";
import { formatDiaCalendario } from "@/lib/format";
import { SITUACAO_LABEL, ORIGEM_SITUACAO_LABEL, ORIGEM_SITUACAO_STYLE } from "@/lib/situacao";
import TextoExpansivel from "@/components/TextoExpansivel";
import type { SituacaoOrientacao } from "@prisma/client";

type RelatorioDoDia = {
  cronogramaEmDia: boolean | null;
  presencaReuniaoDisciplina: boolean | null;
  relatorioEntregue: boolean;
  impedimento: boolean;
  impedimentoDesc: string | null;
  oQueFez: string | null;
  oQuePretende: string | null;
  linkCronograma: string | null;
} | null;

type EventoTimeline =
  | { tipo: "relatorio"; data: Date; numeroRelatorio: number; teveReuniao: boolean | null }
  | {
      tipo: "observacao";
      data: Date;
      texto: string;
      autor: string;
      situacao: SituacaoOrientacao | null;
      origemSituacao: "orientador" | "disciplina" | null;
    };

type State = { ok: true } | { erro: string } | null;

function SetaExpandir({ aberto }: { aberto: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform ${aberto ? "rotate-90" : ""}`}
    >
      <path
        fillRule="evenodd"
        d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function triStateValue(v: boolean | null | undefined): string {
  if (v === true) return "sim";
  if (v === false) return "nao";
  return "";
}

export default function AlunoReuniaoCard({
  turmaId,
  alunoId,
  alunoNome,
  tituloTcc,
  orientadorNome,
  horario,
  status,
  totalFaltas,
  limiteFaltas,
  numeroCiclo,
  relatorioDoDia,
  dadosHerdados,
  timeline,
  ultimaReuniaoSegundoAluno,
  ultimaReuniaoRegistradaPeloOrientador,
  situacaoOrientador,
  situacaoResponsavel,
  podeRegistrarSituacaoResponsavel,
}: {
  turmaId: string;
  alunoId: string;
  alunoNome: string;
  tituloTcc: string | null;
  orientadorNome: string | null;
  horario: string | null;
  status: string;
  totalFaltas: number;
  limiteFaltas: number;
  numeroCiclo: number;
  relatorioDoDia: RelatorioDoDia;
  dadosHerdados: boolean;
  timeline: EventoTimeline[];
  ultimaReuniaoSegundoAluno: Date | null;
  ultimaReuniaoRegistradaPeloOrientador: Date | null;
  situacaoOrientador: SituacaoOrientacao | null;
  situacaoResponsavel: SituacaoOrientacao | null;
  podeRegistrarSituacaoResponsavel: boolean;
}) {
  const salvarAction = salvarRelatorioReuniao.bind(null, turmaId, alunoId, numeroCiclo);
  const [state, formAction, pending] = useActionState<State, FormData>(salvarAction, null);

  const observacaoAction = addObservacao.bind(null, alunoId);

  const [linkCronograma, setLinkCronograma] = useState(relatorioDoDia?.linkCronograma ?? "");
  const linkValido = /^https?:\/\//i.test(linkCronograma.trim());

  // Campos controlados (não `defaultValue`/`defaultChecked`) — depois que uma Server Action
  // roda com sucesso, o navegador dispara um reset nativo do <form> (como um form.reset()),
  // que reescreve o valor do DOM direto, por fora do React. Isso não desfazia o que já tinha
  // sido salvo no banco, mas a TELA voltava a mostrar o valor antigo até um refresh manual —
  // por isso também tem o onReset com preventDefault no <form> abaixo, pra esse reset nativo
  // nunca acontecer.
  const [presencaReuniaoDisciplina, setPresencaReuniaoDisciplina] = useState(
    triStateValue(relatorioDoDia?.presencaReuniaoDisciplina)
  );
  const [cronogramaEmDia, setCronogramaEmDia] = useState(triStateValue(relatorioDoDia?.cronogramaEmDia));
  const [tituloTccValue, setTituloTccValue] = useState(
    tituloTcc && tituloTcc.toLowerCase() !== "não informado" ? tituloTcc : ""
  );
  const [impedimento, setImpedimento] = useState(relatorioDoDia?.impedimento ?? false);
  const [impedimentoDesc, setImpedimentoDesc] = useState(relatorioDoDia?.impedimentoDesc ?? "");
  const [oQueFez, setOQueFez] = useState(relatorioDoDia?.oQueFez ?? "");
  const [oQuePretende, setOQuePretende] = useState(relatorioDoDia?.oQuePretende ?? "");

  const [alterandoSituacaoDisciplina, setAlterandoSituacaoDisciplina] = useState(false);
  const [aberto, setAberto] = useState(false);

  // É sobre a PRESENÇA que a pessoa responsável/orientadora registra nessa própria tela — não
  // sobre o aluno ter entregue o relatório do Forms. São dois badges separados de propósito
  // (ver `relatorioEntregue` logo abaixo), justamente pra não misturar "eu já processei esse
  // aluno na reunião" com "ele já mandou o dele" — são independentes.
  const presenca = relatorioDoDia?.presencaReuniaoDisciplina ?? null;
  const relatorioEntregue = relatorioDoDia?.relatorioEntregue ?? false;

  return (
    <div className="border rounded bg-white p-4 space-y-3">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setAberto((v) => !v)}
              aria-expanded={aberto}
              aria-label={aberto ? "Recolher relatório dessa reunião" : "Expandir relatório dessa reunião"}
              className="shrink-0 rounded hover:bg-zinc-100"
            >
              <SetaExpandir aberto={aberto} />
            </button>
            {horario && <span className="text-xs text-zinc-400 mr-2">{horario}</span>}
            <Link href={`/alunos/${alunoId}`} className="font-medium hover:underline">
              {alunoNome}
            </Link>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5 pl-[22px]">
            Pessoa orientadora: {orientadorNome ?? "sem pessoa orientadora"}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1">
            <span className="text-xs text-zinc-400">orientador:</span>
            <SituacaoBadge situacao={situacaoOrientador} />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-zinc-400">disciplina:</span>
            <SituacaoBadge situacao={situacaoResponsavel} />
            {podeRegistrarSituacaoResponsavel && (
              <button
                type="button"
                onClick={() => setAlterandoSituacaoDisciplina((v) => !v)}
                className="text-xs text-orange-600 hover:text-orange-700 underline"
              >
                alterar
              </button>
            )}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-zinc-400">faltas:</span>
            <SemaforoBadge status={status} />
            <span className="text-xs text-zinc-500">
              ({totalFaltas} de {limiteFaltas})
            </span>
          </div>
        </div>
      </div>

      {alterandoSituacaoDisciplina && (
        <div className="border-t pt-3">
          <RegistrarSituacaoResponsavelForm alunoId={alunoId} onSaved={() => setAlterandoSituacaoDisciplina(false)} />
        </div>
      )}

      <div className="border-t pt-3">
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          aria-expanded={aberto}
          className="w-full cursor-pointer select-none text-sm flex items-center gap-2"
        >
          <SetaExpandir aberto={aberto} />
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${
              presenca === true
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : presenca === false
                  ? "border-red-200 bg-red-50 text-red-800"
                  : "border-amber-200 bg-amber-50 text-amber-800"
            }`}
          >
            {presenca === true ? "presente" : presenca === false ? "faltou" : "presença pendente"}
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${
              relatorioEntregue ? "border-sky-200 bg-sky-50 text-sky-800" : "border-zinc-200 bg-zinc-100 text-zinc-500"
            }`}
          >
            {relatorioEntregue ? "relatório entregue" : "relatório não entregue"}
          </span>
          <span className="text-orange-600">Ver/editar relatório dessa reunião</span>
        </button>

        {aberto && (
        <div className="mt-3 space-y-3 text-sm">
          <p className="text-xs text-zinc-500">
            Última reunião com a pessoa orientadora (segundo o aluno):{" "}
            {ultimaReuniaoSegundoAluno ? formatDiaCalendario(ultimaReuniaoSegundoAluno) : "—"} · Última reunião
            registrada pela pessoa orientadora:{" "}
            {ultimaReuniaoRegistradaPeloOrientador ? formatDiaCalendario(ultimaReuniaoRegistradaPeloOrientador) : "—"}
          </p>

          <form action={formAction} onReset={(e) => e.preventDefault()} className="space-y-3 text-sm border-t pt-3">
            {dadosHerdados && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                Ainda sem relatório pra esse ciclo — os campos abaixo (exceto presença/cronograma)
                vieram do último relatório do aluno. Revise antes de salvar.
              </p>
            )}

            <div>
              <label className="block text-zinc-600 mb-1">Título do TCC</label>
              <input
                name="tituloTcc"
                value={tituloTccValue}
                onChange={(e) => setTituloTccValue(e.target.value)}
                placeholder="ainda sem título definido"
                className="w-full rounded border px-2 py-1.5"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-zinc-600 mb-1">Presença na reunião (da disciplina)</label>
                <select
                  name="presencaReuniaoDisciplina"
                  value={presencaReuniaoDisciplina}
                  onChange={(e) => setPresencaReuniaoDisciplina(e.target.value)}
                  className="w-full rounded border px-2 py-1.5"
                >
                  <option value="">— não registrado —</option>
                  <option value="sim">Presente</option>
                  <option value="nao">Faltou</option>
                </select>
              </div>
              <div>
                <label className="block text-zinc-600 mb-1">Cronograma em dia</label>
                <select
                  name="cronogramaEmDia"
                  value={cronogramaEmDia}
                  onChange={(e) => setCronogramaEmDia(e.target.value)}
                  className="w-full rounded border px-2 py-1.5"
                >
                  <option value="">— não registrado —</option>
                  <option value="sim">Sim</option>
                  <option value="nao">Não</option>
                </select>
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 text-zinc-600">
                <input
                  type="checkbox"
                  name="impedimento"
                  checked={impedimento}
                  onChange={(e) => setImpedimento(e.target.checked)}
                />
                Impedimento relatado
              </label>
              <input
                name="impedimentoDesc"
                value={impedimentoDesc}
                onChange={(e) => setImpedimentoDesc(e.target.value)}
                placeholder="Descrição do impedimento"
                className="w-full rounded border px-2 py-1.5 mt-1"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-zinc-600 mb-1">O que fez</label>
                <textarea
                  name="oQueFez"
                  value={oQueFez}
                  onChange={(e) => setOQueFez(e.target.value)}
                  rows={2}
                  className="w-full rounded border px-2 py-1.5"
                />
              </div>
              <div>
                <label className="block text-zinc-600 mb-1">O que pretende fazer</label>
                <textarea
                  name="oQuePretende"
                  value={oQuePretende}
                  onChange={(e) => setOQuePretende(e.target.value)}
                  rows={2}
                  className="w-full rounded border px-2 py-1.5"
                />
              </div>
            </div>

            <div>
              <label className="block text-zinc-600 mb-1">Link do cronograma</label>
              <div className="flex gap-2 items-center">
                <input
                  name="linkCronograma"
                  value={linkCronograma}
                  onChange={(e) => setLinkCronograma(e.target.value)}
                  placeholder="https://…"
                  className="w-full rounded border px-2 py-1.5"
                />
                {linkValido ? (
                  <a
                    href={linkCronograma.trim()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-xs rounded border border-orange-300 text-orange-700 px-2 py-1.5 hover:bg-orange-50"
                  >
                    Abrir ↗
                  </a>
                ) : (
                  linkCronograma.trim() && (
                    <span className="shrink-0 text-xs text-amber-700" title="Precisa começar com http:// ou https:// pra abrir">
                      link inválido
                    </span>
                  )
                )}
              </div>
            </div>

            <button
              disabled={pending}
              className="rounded bg-orange-600 text-white px-4 py-2 hover:bg-orange-700 disabled:opacity-50"
            >
              {pending ? "Salvando…" : "Salvar relatório desse dia"}
            </button>
            {state && "ok" in state && <span className="ml-2 text-emerald-700 text-xs">salvo</span>}
            {state && "erro" in state && <span className="ml-2 text-red-700 text-xs">{state.erro}</span>}
          </form>

          <details className="text-sm border-t pt-3">
            <summary className="cursor-pointer text-zinc-600">
              Histórico completo ({timeline.length} evento(s)) — ou{" "}
              <Link href={`/alunos/${alunoId}`} className="underline">
                abrir ficha do aluno
              </Link>
            </summary>
            <ol className="space-y-2 mt-2">
              {timeline.map((ev, i) =>
                ev.tipo === "relatorio" ? (
                  <li key={`r-${i}`} className="text-zinc-600">
                    Relatório #{ev.numeroRelatorio} — {ev.data.toLocaleDateString("pt-BR")} — reunião com a pessoa
                    orientadora (segundo o aluno): {ev.teveReuniao === null ? "—" : ev.teveReuniao ? "Sim" : "Não"}
                  </li>
                ) : ev.origemSituacao ? (
                  <li key={`o-${i}`} className={`border rounded px-2 py-1.5 ${ORIGEM_SITUACAO_STYLE[ev.origemSituacao]}`}>
                    <span className="font-medium">
                      {ORIGEM_SITUACAO_LABEL[ev.origemSituacao]}
                      {ev.situacao && ` — ${SITUACAO_LABEL[ev.situacao]}`}
                    </span>{" "}
                    ({ev.autor}, {ev.data.toLocaleDateString("pt-BR")})
                    {ev.texto && (
                      <>
                        : <TextoExpansivel texto={ev.texto} limite={140} />
                      </>
                    )}
                  </li>
                ) : (
                  <li key={`o-${i}`} className="border rounded px-2 py-1.5 border-amber-200 bg-amber-50 text-amber-900">
                    <span className="font-medium">Observação</span> ({ev.autor}, {ev.data.toLocaleDateString("pt-BR")}):{" "}
                    <TextoExpansivel texto={ev.texto} limite={140} />
                  </li>
                )
              )}
              {timeline.length === 0 && <li className="text-zinc-400">Ainda sem histórico.</li>}
            </ol>
          </details>

          <form action={observacaoAction} className="text-sm border-t pt-3 space-y-2">
            <label className="block text-zinc-600">Nova observação</label>
            <textarea name="texto" required rows={2} className="w-full rounded border px-2 py-1.5" />
            <button className="rounded border border-orange-300 text-orange-700 px-3 py-1.5 hover:bg-orange-50">
              Adicionar
            </button>
          </form>
        </div>
        )}
      </div>
    </div>
  );
}
