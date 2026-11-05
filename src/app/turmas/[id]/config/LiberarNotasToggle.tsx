"use client";

import { useTransition } from "react";
import { alternarLiberacaoNotas } from "../configActions";

export default function LiberarNotasToggle({
  turmaId,
  periodo,
  liberadoAtualmente,
}: {
  turmaId: string;
  periodo: "SR1" | "SR2";
  liberadoAtualmente: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        defaultChecked={liberadoAtualmente}
        disabled={pending}
        onChange={(e) => {
          const formData = new FormData();
          formData.set("liberado", e.target.checked ? "on" : "off");
          startTransition(() => {
            alternarLiberacaoNotas(turmaId, periodo, formData);
          });
        }}
      />
      {periodo}: pessoa orientadora pode lançar/editar nota
    </label>
  );
}
