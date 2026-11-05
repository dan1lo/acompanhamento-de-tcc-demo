export default function StatusPill({ label, valor, detalhe }: { label: string; valor: boolean | null; detalhe?: string | null }) {
  const estilo =
    valor === null
      ? "bg-zinc-100 text-zinc-500 border-zinc-300"
      : valor
        ? "bg-emerald-100 text-emerald-800 border-emerald-300"
        : "bg-red-100 text-red-800 border-red-300";
  const texto = valor === null ? "—" : valor ? "Sim" : "Não";

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${estilo}`}>
      {label}: {texto}
      {detalhe && <span className="text-zinc-500 font-normal">({detalhe})</span>}
    </span>
  );
}
