"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string };

/**
 * Agrupa os links de painel por papel (admin/coordenador/orientandos) num só dropdown — antes
 * cada um virava um botão solto na barra, e quem acumula vários papéis (comum: a mesma conta é
 * responsável + orientador + coordenador + admin ao mesmo tempo) via a barra toda lotada.
 * "Minhas turmas" fica fora, como link direto, por ser o destino mais usado.
 */
export default function PainelDropdown({ itens }: { itens: Item[] }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    function aoClicarFora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, []);

  if (itens.length === 0) return null;

  const algumAtivo = itens.some((i) => pathname === i.href || pathname.startsWith(`${i.href}/`));

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className={
          algumAtivo
            ? "bg-white text-orange-700 rounded-full px-3 py-1 font-medium inline-flex items-center gap-1"
            : "text-orange-50 hover:text-white px-3 py-1 inline-flex items-center gap-1"
        }
      >
        Outros painéis
        <svg viewBox="0 0 20 20" fill="currentColor" className={`h-3.5 w-3.5 transition-transform ${aberto ? "rotate-180" : ""}`}>
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.25a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08Z" clipRule="evenodd" />
        </svg>
      </button>
      {aberto && (
        <div className="absolute left-0 mt-1 w-56 rounded border bg-white text-sm text-zinc-700 shadow-lg py-1 z-20">
          {itens.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setAberto(false)}
              className="block px-3 py-2 hover:bg-orange-50 hover:text-orange-700"
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
