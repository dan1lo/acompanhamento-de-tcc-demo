"use client";

import { useActionState, useEffect, useRef, useState } from "react";

type Orientador = { id: string; nome: string };
type EstadoCriar = { ok: true; nome: string } | { erro: string } | null;

function normaliza(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Combobox com busca pra escolher a pessoa orientadora (a lista de todas as turmas grandes
 * ficava difícil de navegar num <select> comum) + opção de cadastrar alguém que ainda não está
 * na lista, sem precisar sair da ficha do aluno pra ir no admin cadastrar antes.
 */
export default function OrientadorCombobox({
  orientadorAtualId,
  orientadores,
  reatribuirAction,
  criarEAtribuirAction,
}: {
  orientadorAtualId: string | null;
  orientadores: Orientador[];
  reatribuirAction: (formData: FormData) => void;
  criarEAtribuirAction: (prevState: EstadoCriar, formData: FormData) => Promise<EstadoCriar>;
}) {
  const orientadoresOrdenados = [...orientadores].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const nomeAtual = orientadoresOrdenados.find((o) => o.id === orientadorAtualId)?.nome ?? "— nenhum —";

  const [selecionadoId, setSelecionadoId] = useState(orientadorAtualId ?? "");
  const [termo, setTermo] = useState("");
  const [aberto, setAberto] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function aoClicarFora(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, []);

  const termoNormalizado = normaliza(termo.trim());
  const filtrados = termoNormalizado
    ? orientadoresOrdenados.filter((o) => normaliza(o.nome).includes(termoNormalizado))
    : orientadoresOrdenados;

  const [criarState, criarFormAction, criarPending] = useActionState<EstadoCriar, FormData>(criarEAtribuirAction, null);
  const [mostrarNovoContato, setMostrarNovoContato] = useState(false);

  return (
    <div className="space-y-2">
      <form
        action={reatribuirAction}
        onSubmit={(e) => {
          const novoNome = orientadoresOrdenados.find((o) => o.id === selecionadoId)?.nome ?? "nenhuma pessoa orientadora";
          if (!confirm(`Trocar a pessoa orientadora pra "${novoNome}"? O histórico de relatórios já enviados é preservado.`)) {
            e.preventDefault();
          }
        }}
        className="flex gap-2 items-center text-sm"
      >
        <div className="relative flex-1 min-w-0" ref={containerRef}>
          <input
            value={aberto ? termo : nomeAtual}
            onFocus={() => {
              setAberto(true);
              setTermo("");
            }}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="Buscar pessoa orientadora..."
            className="w-full rounded border px-2 py-1.5"
          />
          <input type="hidden" name="orientadorId" value={selecionadoId} />
          {aberto && (
            <div className="absolute left-0 right-0 z-10 mt-1 max-h-56 overflow-y-auto rounded border bg-white shadow-lg">
              <button
                type="button"
                onClick={() => {
                  setSelecionadoId("");
                  setAberto(false);
                }}
                className="block w-full text-left px-3 py-1.5 text-zinc-500 hover:bg-zinc-100"
              >
                — nenhum —
              </button>
              {filtrados.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => {
                    setSelecionadoId(o.id);
                    setAberto(false);
                  }}
                  className="block w-full text-left px-3 py-1.5 hover:bg-zinc-100"
                >
                  {o.nome}
                </button>
              ))}
              {filtrados.length === 0 && (
                <p className="px-3 py-1.5 text-zinc-400">Nenhum resultado — cadastre abaixo.</p>
              )}
            </div>
          )}
        </div>
        <button className="rounded border border-orange-300 text-orange-700 px-3 py-1.5 hover:bg-orange-50 shrink-0">
          Reatribuir
        </button>
      </form>

      {criarState && "ok" in criarState ? (
        <p className="text-xs text-emerald-700">{criarState.nome} cadastrado(a) e atribuído(a).</p>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setMostrarNovoContato((v) => !v)}
            className="text-xs text-orange-600 hover:text-orange-700 underline"
          >
            {mostrarNovoContato ? "cancelar" : "+ a pessoa não está na lista, cadastrar nova"}
          </button>
          {mostrarNovoContato && (
            <form action={criarFormAction} className="flex flex-wrap gap-2 items-center text-sm">
              <input
                name="nome"
                defaultValue={termo}
                placeholder="Nome"
                required
                className="rounded border px-2 py-1.5 flex-1 min-w-[10rem]"
              />
              <input name="email" type="email" placeholder="E-mail (opcional)" className="rounded border px-2 py-1.5 flex-1 min-w-[10rem]" />
              <button
                disabled={criarPending}
                className="rounded bg-orange-600 text-white px-3 py-1.5 hover:bg-orange-700 disabled:opacity-50 shrink-0"
              >
                {criarPending ? "Cadastrando…" : "Criar e atribuir"}
              </button>
              {criarState && "erro" in criarState && <span className="text-red-700 text-xs w-full">{criarState.erro}</span>}
            </form>
          )}
        </>
      )}
    </div>
  );
}
