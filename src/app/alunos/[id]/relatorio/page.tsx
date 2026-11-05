import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAlunoAccess, podeVerConteudoOcultoDoOrientador } from "@/lib/authz";
import { computeStatus } from "@/lib/semaforo";
import { formatDiaCalendario } from "@/lib/format";
import AlunoRelatorioSecoes from "@/components/AlunoRelatorioSecoes";
import PrintButton from "@/components/PrintButton";

export default async function RelatorioAlunoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session } = await requireAlunoAccess(id);

  const aluno = await prisma.aluno.findUnique({
    where: { id },
    include: {
      turma: { include: { ciclos: true } },
      orientador: true,
      relatorios: { orderBy: { numeroRelatorio: "asc" } },
      observacoes: { include: { professor: true }, orderBy: { data: "asc" } },
      notas: true,
    },
  });
  if (!aluno) notFound();

  const status = computeStatus(aluno, aluno.turma, aluno.turma.ciclos, aluno.relatorios, aluno.observacoes);

  // Mesma regra da ficha do aluno: quem só é pessoa orientadora não vê impedimento/observação
  // marcado como oculto — nem no relatório exportado/impresso.
  const podeVerOculto = await podeVerConteudoOcultoDoOrientador(aluno.turmaId, session);
  const observacoesVisiveis = podeVerOculto ? aluno.observacoes : aluno.observacoes.filter((o) => !o.ocultoDoOrientador);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="no-print flex items-center justify-between">
        <Link href={`/alunos/${aluno.id}`} className="text-sm text-zinc-500 hover:underline">
          ← voltar
        </Link>
        <PrintButton />
      </div>

      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Relatório de acompanhamento — {aluno.nome}</h1>
        <p className="text-sm text-zinc-500">
          {aluno.turma.disciplina} · {aluno.turma.nome} · {aluno.turma.periodoLetivo}
        </p>
        <p className="text-sm text-zinc-500">
          Pessoa orientadora: {aluno.orientador?.nome ?? "sem pessoa orientadora"} · Título do TCC:{" "}
          {aluno.tituloTcc && aluno.tituloTcc.toLowerCase() !== "não informado" ? aluno.tituloTcc : "ainda sem título"}
        </p>
        <p className="text-xs text-zinc-400">Gerado em {formatDiaCalendario(new Date())}</p>
      </div>

      <AlunoRelatorioSecoes
        aluno={aluno}
        status={status}
        observacoesVisiveis={observacoesVisiveis}
        podeVerOculto={podeVerOculto}
      />
    </div>
  );
}
