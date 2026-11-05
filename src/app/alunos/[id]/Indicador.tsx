export default function Indicador({
  label,
  valor,
  destaque,
}: {
  label: string;
  valor: string | number;
  destaque?: "verde" | "amarelo" | "vermelho";
}) {
  const cor =
    destaque === "vermelho"
      ? "text-red-700"
      : destaque === "amarelo"
        ? "text-amber-700"
        : destaque === "verde"
          ? "text-emerald-700"
          : "text-zinc-900";

  return (
    <div>
      <p className="text-xs font-medium text-zinc-500 uppercase">{label}</p>
      <p className={`font-medium ${cor}`}>{valor}</p>
    </div>
  );
}
