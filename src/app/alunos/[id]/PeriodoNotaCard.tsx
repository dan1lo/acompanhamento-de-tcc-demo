import type { Nota } from "@prisma/client";

export default function PeriodoNotaCard({
  periodo,
  nota,
  notaAutomaticaSugerida,
  podeEditarNotaOrientador,
  liberado,
  notaAction,
}: {
  periodo: string;
  nota: Nota | null;
  notaAutomaticaSugerida: number;
  podeEditarNotaOrientador: boolean;
  liberado: boolean;
  notaAction: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <details className="text-sm border rounded overflow-hidden">
      <summary className="cursor-pointer px-3 py-2 bg-zinc-50 font-medium flex items-center justify-between gap-2">
        <span>
          {periodo}
          {!liberado && <span className="ml-2 text-xs text-amber-700">🔒 travado</span>}
        </span>
        <span className="text-zinc-500 font-normal">Final: {nota?.notaFinal ?? "—"}</span>
      </summary>
      <form action={notaAction} className="p-3 space-y-3">
        <input type="hidden" name="periodo" value={periodo} />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-medium text-zinc-500 uppercase">Automática (presença)</p>
            <input
              value={nota?.notaAutomatica ?? notaAutomaticaSugerida}
              disabled
              className="w-20 rounded border px-2 py-1 bg-zinc-50 text-zinc-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 uppercase mb-1">Pessoa orientadora</label>
            <input
              name="notaOrientador"
              type="number"
              step="0.01"
              defaultValue={nota?.notaOrientador ?? ""}
              disabled={!podeEditarNotaOrientador}
              className="w-20 rounded border px-2 py-1 text-sm disabled:bg-zinc-50 disabled:text-zinc-400"
            />
          </div>
        </div>
        {!podeEditarNotaOrientador && (
          <p className="text-xs text-zinc-400">
            {!liberado
              ? "lançamento travado pelo responsável da disciplina"
              : "só a pessoa orientadora do aluno pode editar a nota dela"}
          </p>
        )}
        <div>
          <label className="block text-xs font-medium text-zinc-500 uppercase mb-1">Comentário</label>
          <input
            name="comentario"
            defaultValue={nota?.comentario ?? ""}
            disabled={!podeEditarNotaOrientador}
            className="w-full rounded border px-2 py-1.5 text-sm disabled:bg-zinc-50 disabled:text-zinc-400"
          />
        </div>
        {podeEditarNotaOrientador && (
          <button className="rounded bg-orange-600 text-white px-3 py-1.5 text-sm hover:bg-orange-700">Salvar</button>
        )}
      </form>
    </details>
  );
}
