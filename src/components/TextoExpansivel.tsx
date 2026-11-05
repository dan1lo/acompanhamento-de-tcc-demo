"use client";

import { useState } from "react";

/**
 * Trunca textos longos (observações, "o que fez"/"o que pretende fazer") com um "ver mais" que
 * expande ali mesmo — não é popup/janela nova, então nunca esbarra em bloqueador de popup.
 */
export default function TextoExpansivel({ texto, limite = 220 }: { texto: string; limite?: number }) {
  const [expandido, setExpandido] = useState(false);
  const precisaTruncar = texto.length > limite;

  if (!precisaTruncar) return <>{texto}</>;

  return (
    <>
      {expandido ? texto : `${texto.slice(0, limite).trimEnd()}…`}{" "}
      <button
        onClick={() => setExpandido((v) => !v)}
        className="text-xs text-orange-600 hover:text-orange-700 underline"
      >
        {expandido ? "ver menos" : "ver mais"}
      </button>
    </>
  );
}
