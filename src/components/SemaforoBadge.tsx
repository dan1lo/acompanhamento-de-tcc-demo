const STYLES: Record<string, string> = {
  vermelho: "bg-red-100 text-red-800 border-red-300",
  amarelo: "bg-amber-100 text-amber-800 border-amber-300",
  verde: "bg-emerald-100 text-emerald-800 border-emerald-300",
  impedimento: "bg-purple-100 text-purple-800 border-purple-300",
};

const LABELS: Record<string, string> = {
  vermelho: "Reprovado por faltas",
  amarelo: "Alerta de faltas",
  verde: "Em dia",
  impedimento: "Impedimento",
};

const DOT_STYLES: Record<string, string> = {
  vermelho: "bg-red-500",
  amarelo: "bg-amber-500",
  verde: "bg-emerald-500",
  impedimento: "bg-purple-500",
};

export default function SemaforoBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
        STYLES[status] ?? "bg-zinc-100 text-zinc-700 border-zinc-300"
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${DOT_STYLES[status] ?? "bg-zinc-400"}`} />
      {LABELS[status] ?? status}
    </span>
  );
}
