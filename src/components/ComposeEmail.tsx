"use client";

import { useState } from "react";

export default function ComposeEmail({
  to,
  subjectInicial,
  corpoInicial,
}: {
  to: string[];
  subjectInicial: string;
  corpoInicial: string;
}) {
  const [destinatarios, setDestinatarios] = useState(to.join(", "));
  const [subject, setSubject] = useState(subjectInicial);
  const [corpo, setCorpo] = useState(corpoInicial);
  const [copiado, setCopiado] = useState(false);

  const mailtoHref = `mailto:${encodeURIComponent(destinatarios)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(corpo)}`;

  return (
    <div className="space-y-3 border rounded p-4 bg-white">
      <div>
        <label className="block text-sm text-zinc-600 mb-1">
          Destinatários (pré-preenchido: pessoa orientadora, aluno e coordenação — edite à vontade)
        </label>
        <input
          value={destinatarios}
          onChange={(e) => setDestinatarios(e.target.value)}
          className="w-full rounded border px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm text-zinc-600 mb-1">Assunto</label>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full rounded border px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-sm text-zinc-600 mb-1">Mensagem</label>
        <textarea
          value={corpo}
          onChange={(e) => setCorpo(e.target.value)}
          rows={10}
          className="w-full rounded border px-3 py-2 text-sm"
        />
      </div>
      <div className="flex gap-2">
        <a
          href={mailtoHref}
          className="rounded bg-orange-600 text-white px-4 py-2 text-sm hover:bg-orange-700"
        >
          Abrir no seu cliente de e-mail
        </a>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(`Para: ${destinatarios}\nAssunto: ${subject}\n\n${corpo}`);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 2000);
          }}
          className="rounded border border-orange-300 text-orange-700 px-4 py-2 text-sm hover:bg-orange-50"
        >
          {copiado ? "Copiado!" : "Copiar texto"}
        </button>
      </div>
    </div>
  );
}
