"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Resultado = { id: string; nome: string; turmaNome: string };

/** Busca de aluno por nome, disponível em qualquer página — evita ter que abrir a turma certa só
 * pra achar a ficha de alguém. Os resultados já vêm filtrados pelo escopo de acesso de quem
 * está logado (ver `buscaGlobal.ts`). */
export default function BuscaGlobal() {
  const router = useRouter();
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [aberto, setAberto] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Resultados só aparecem com 2+ caracteres (checado também na renderização) — abaixo disso
    // não vale a pena nem buscar, e não precisa limpar `resultados` porque o dropdown já fica
    // escondido nesse caso.
    if (termo.trim().length < 2) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      fetch(`/api/buscar-aluno?q=${encodeURIComponent(termo)}`, { signal: controller.signal })
        .then((r) => r.json())
        .then((data) => setResultados(data.resultados ?? []))
        .catch(() => {});
    }, 250);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [termo]);

  useEffect(() => {
    function aoClicarFora(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <input
        value={termo}
        onChange={(e) => {
          setTermo(e.target.value);
          setAberto(true);
        }}
        onFocus={() => setAberto(true)}
        placeholder="Buscar aluno..."
        className="w-40 sm:w-56 rounded-full border border-orange-300/50 bg-orange-700/30 px-3 py-1 text-sm text-white placeholder:text-orange-100 focus:outline-none focus:ring-2 focus:ring-white/60"
      />
      {aberto && termo.trim().length >= 2 && (
        <div className="absolute right-0 mt-1 w-72 rounded border bg-white shadow-lg text-sm text-zinc-900 z-50 overflow-hidden">
          {resultados.length === 0 ? (
            <p className="px-3 py-2 text-zinc-400">Nenhum aluno encontrado.</p>
          ) : (
            <ul>
              {resultados.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setAberto(false);
                      setTermo("");
                      router.push(`/alunos/${r.id}`);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-zinc-100"
                  >
                    {r.nome}
                    <span className="block text-xs text-zinc-400">{r.turmaNome}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
