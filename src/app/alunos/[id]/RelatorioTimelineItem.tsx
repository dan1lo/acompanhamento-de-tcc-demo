import type { RelatorioSemanal } from "@prisma/client";
import { formatDiaCalendario } from "@/lib/format";
import OcultarDoOrientadorToggle from "@/components/OcultarDoOrientadorToggle";
import TextoExpansivel from "@/components/TextoExpansivel";
import StatusPill from "./StatusPill";

export default function RelatorioTimelineItem({
  relatorio,
  data,
  podeVerOculto,
  onToggleImpedimento,
}: {
  relatorio: RelatorioSemanal;
  data: Date;
  podeVerOculto: boolean;
  onToggleImpedimento: () => Promise<void>;
}) {
  return (
    <li className="border rounded bg-white p-3 text-sm space-y-2">
      <div className="flex justify-between text-zinc-500 text-xs">
        <span>Relatório #{relatorio.numeroRelatorio}</span>
        <span>{data.toLocaleString("pt-BR")}</span>
      </div>

      <div className="flex flex-wrap gap-2">
        <StatusPill label="Cronograma em dia" valor={relatorio.cronogramaEmDia} />
        <StatusPill
          label="Reunião com a pessoa orientadora (segundo o aluno)"
          valor={relatorio.teveReuniao}
          detalhe={relatorio.dataUltimaReuniao ? formatDiaCalendario(relatorio.dataUltimaReuniao) : null}
        />
        <StatusPill label="Presença na reunião da disciplina" valor={relatorio.presencaReuniaoDisciplina} />
      </div>

      {relatorio.impedimento && (podeVerOculto || !relatorio.impedimentoOcultoDoOrientador) && (
        <div className="text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1 space-y-1">
          <p>
            <span className="font-medium">Impedimento:</span> {relatorio.impedimentoDesc}
            {relatorio.impedimentoOcultoDoOrientador && (
              <span className="ml-2 text-xs">🔒 oculto da pessoa orientadora</span>
            )}
          </p>
          {podeVerOculto && (
            <OcultarDoOrientadorToggle oculto={relatorio.impedimentoOcultoDoOrientador} onToggle={onToggleImpedimento} />
          )}
        </div>
      )}

      {relatorio.oQueFez && (
        <div>
          <p className="text-xs font-medium text-zinc-500 uppercase">O que fez</p>
          <p>
            <TextoExpansivel texto={relatorio.oQueFez} />
          </p>
        </div>
      )}
      {relatorio.oQuePretende && (
        <div>
          <p className="text-xs font-medium text-zinc-500 uppercase">O que pretende fazer</p>
          <p>
            <TextoExpansivel texto={relatorio.oQuePretende} />
          </p>
        </div>
      )}
      {relatorio.linkCronograma && (
        <a
          href={relatorio.linkCronograma}
          target="_blank"
          className="inline-block text-xs underline text-orange-600 hover:text-orange-700"
        >
          cronograma
        </a>
      )}
    </li>
  );
}
