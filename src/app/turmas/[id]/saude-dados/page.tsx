import Link from "next/link";
import { notFound } from "next/navigation";
import { getTurmaCompleta } from "@/lib/turmaData";
import { requireTurmaResponsavel } from "@/lib/authz";
import { checarSaudeDados, type AchadoSaudeDados } from "@/lib/saudeDados";
import CarregadoEm from "@/components/CarregadoEm";

export default async function SaudeDadosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireTurmaResponsavel(id);
  const turma = await getTurmaCompleta(id);
  if (!turma) notFound();

  const relatorio = checarSaudeDados(turma);
  const totalAchados =
    relatorio.numeroForaDoEsperado.length +
    relatorio.semNenhumRelatorio.length +
    relatorio.presencaContraditaPorObservacao.length +
    relatorio.duplicatasDeConteudo.length +
    relatorio.reuniaoComDataFutura.length;

  return (
    <div className="space-y-6">
      <Link href={`/turmas/${turma.id}`} className="text-sm text-zinc-500 hover:underline">
        ← voltar
      </Link>
      <div>
        <h1 className="text-xl font-semibold">Saúde dos dados — {turma.nome}</h1>
        <p className="text-sm text-zinc-500">
          Checagens automáticas pra pegar inconsistência antes de precisar caçar na unha — não muda
          nada sozinho, só aponta o que vale olhar.
        </p>
        <CarregadoEm />
      </div>

      {totalAchados === 0 ? (
        <p className="text-sm text-zinc-500 border rounded bg-white p-4">Nenhum problema encontrado. 🎉</p>
      ) : (
        <div className="space-y-4">
          <Secao
            titulo="Número de relatório fora do esperado"
            explicacao='Provavelmente erro de digitação do próprio aluno no Forms (ex.: "11" em vez de "3").'
            achados={relatorio.numeroForaDoEsperado}
          />
          <Secao
            titulo="Aluno sem nenhum relatório"
            explicacao="Pode ser aluno que entrou depois da turma já ter começado, ou que nunca respondeu o Forms."
            achados={relatorio.semNenhumRelatorio}
          />
          <Secao
            titulo="Presença marcada, mas observação sugere falta"
            explicacao='Presença = sim no ciclo, mas uma observação de até 2 dias de distância menciona "falt" no texto.'
            achados={relatorio.presencaContraditaPorObservacao}
          />
          <Secao
            titulo="Possíveis duplicatas de conteúdo"
            explicacao="Dois relatórios do mesmo aluno com o texto de 'o que fez' idêntico — pode ser cópia/teste, não entrega real."
            achados={relatorio.duplicatasDeConteudo}
          />
          <Secao
            titulo="Reunião com data no futuro"
            explicacao='"Data da última reunião" reportada pelo aluno vem depois do dia em que ele enviou o relatório — provavelmente troca de mês/dia, ou confusão com a data da PRÓXIMA reunião agendada.'
            achados={relatorio.reuniaoComDataFutura}
          />
        </div>
      )}
    </div>
  );
}

function Secao({ titulo, explicacao, achados }: { titulo: string; explicacao: string; achados: AchadoSaudeDados[] }) {
  if (achados.length === 0) return null;
  return (
    <details className="border rounded bg-white p-4" open>
      <summary className="cursor-pointer select-none">
        <span className="font-medium">{titulo}</span> <span className="text-zinc-400">({achados.length})</span>
      </summary>
      <p className="text-xs text-zinc-500 mt-2 mb-3">{explicacao}</p>
      <ul className="space-y-2">
        {achados.map((a, i) => (
          <li key={`${a.alunoId}-${i}`} className="text-sm border-b pb-2 last:border-0">
            <Link href={`/alunos/${a.alunoId}`} className="font-medium hover:underline">
              {a.alunoNome}
            </Link>
            <p className="text-zinc-600">{a.detalhe}</p>
          </li>
        ))}
      </ul>
    </details>
  );
}
