"use client";

import { useState } from "react";
import { normalizeName } from "@/lib/normalize";

/**
 * Mesma ideia do autocomplete de aluno (datalist nativo), mas aqui o filtro precisa de um ID,
 * não do nome — então um input escondido carrega o ID de verdade, atualizado conforme o texto
 * digitado casa com um nome da lista. Só filtra quando o nome bate exatamente com uma opção
 * (nunca por substring), pra não escolher a pessoa errada.
 */
export default function OrientadorBusca({
  orientadores,
  orientadorIdInicial,
}: {
  orientadores: { id: string; nome: string }[];
  orientadorIdInicial: string;
}) {
  const inicial = orientadores.find((o) => o.id === orientadorIdInicial);
  const [texto, setTexto] = useState(inicial?.nome ?? "");
  const [id, setId] = useState(orientadorIdInicial);

  function onChange(valor: string) {
    setTexto(valor);
    const match = orientadores.find((o) => normalizeName(o.nome) === normalizeName(valor));
    setId(match ? match.id : "");
  }

  return (
    <>
      <input
        list="orientadores-datalist"
        value={texto}
        onChange={(e) => onChange(e.target.value)}
        placeholder="nome da pessoa orientadora"
        autoComplete="off"
        className="rounded border px-2 py-1.5 max-w-full"
      />
      <datalist id="orientadores-datalist">
        {orientadores.map((o) => (
          <option key={o.id} value={o.nome} />
        ))}
      </datalist>
      <input type="hidden" name="orientador" value={id} />
    </>
  );
}
