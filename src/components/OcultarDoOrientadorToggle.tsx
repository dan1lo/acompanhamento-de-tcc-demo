"use client";

import { useTransition } from "react";

/**
 * Botão genérico pra alternar visibilidade de algo (observação, impedimento) pra pessoa
 * orientadora — só aparece pra quem já pode ver conteúdo oculto (RESPONSAVEL/coordenação), a
 * própria pessoa orientadora nunca vê esse controle.
 */
export default function OcultarDoOrientadorToggle({
  oculto,
  onToggle,
}: {
  oculto: boolean;
  onToggle: () => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      disabled={pending}
      onClick={() => startTransition(onToggle)}
      className={`text-xs underline disabled:opacity-50 ${oculto ? "text-red-700 hover:text-red-800" : "text-zinc-500 hover:text-zinc-700"}`}
    >
      {oculto ? "oculto da pessoa orientadora — mostrar" : "esconder da pessoa orientadora"}
    </button>
  );
}
