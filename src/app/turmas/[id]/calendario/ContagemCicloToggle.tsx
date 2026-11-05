"use client";

import { useTransition } from "react";
import { definirContagemCiclo } from "../calendarioActions";

export default function ContagemCicloToggle({
  turmaId,
  cicloId,
  contaAtualmente,
}: {
  turmaId: string;
  cicloId: string;
  contaAtualmente: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <label
      className="inline-flex items-center gap-1.5 text-xs text-zinc-600 whitespace-nowrap"
      title="Conta pra faltas e aparece em Reuniões"
    >
      <input
        type="checkbox"
        defaultChecked={contaAtualmente}
        disabled={pending}
        onChange={(e) => {
          const formData = new FormData();
          formData.set("conta", e.target.checked ? "on" : "off");
          startTransition(() => {
            definirContagemCiclo(turmaId, cicloId, formData);
          });
        }}
      />
      conta pra faltas
    </label>
  );
}
