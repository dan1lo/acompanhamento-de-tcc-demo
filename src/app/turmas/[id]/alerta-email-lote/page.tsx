import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTurmaResponsavel } from "@/lib/authz";
import { formatDiaCalendario } from "@/lib/format";
import ComposeEmail from "@/components/ComposeEmail";

export default async function AlertaEmailLotePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ semana?: string; alunos?: string | string[] }>;
}) {
  const { id: turmaId } = await params;
  const { semana, alunos: alunosParam } = await searchParams;
  await requireTurmaResponsavel(turmaId);

  const alunoIds = !alunosParam ? [] : Array.isArray(alunosParam) ? alunosParam : [alunosParam];

  const turma = await prisma.turma.findUnique({
    where: { id: turmaId },
    include: { coordenador: true, coordenadores: { include: { coordenador: true } } },
  });
  if (!turma) notFound();

  const alunos = await prisma.aluno.findMany({
    where: { id: { in: alunoIds }, turmaId },
    include: { orientador: true },
    orderBy: { nome: "asc" },
  });

  const numeroCiclo = semana ? Number(semana) : undefined;
  const ciclo = numeroCiclo
    ? await prisma.cicloData.findUnique({ where: { turmaId_numeroCiclo: { turmaId, numeroCiclo } } })
    : null;

  // Mesmos três grupos de destinatário do alerta individual (aluno.email, pessoa orientadora,
  // coordenação) — só que agregados pra todos os alunos selecionados de uma vez, sem repetir
  // e-mail de quem orienta mais de um aluno pendente.
  const coordenadores = [turma.coordenador, ...turma.coordenadores.map((v) => v.coordenador)].filter(
    (c): c is NonNullable<typeof c> => !!c
  );
  const orientadoresUnicos = Array.from(
    new Map(alunos.filter((a) => a.orientador).map((a) => [a.orientador!.id, a.orientador!])).values()
  );
  const destinatarios = Array.from(
    new Set(
      [...alunos.map((a) => a.email), ...orientadoresUnicos.map((o) => o.email), ...coordenadores.map((c) => c.email)].filter(
        (e): e is string => !!e
      )
    )
  );

  const referenciaCiclo = ciclo ? ` do Ciclo ${ciclo.numeroCiclo} (previsto para ${formatDiaCalendario(ciclo.dataPrevista)})` : "";
  const assunto = `[${turma.nome}] Aviso: relatório pendente${ciclo ? ` — Ciclo ${ciclo.numeroCiclo}` : ""}`;
  const listaAlunos = alunos
    .map((a) => `- ${a.nome} (pessoa orientadora: ${a.orientador?.nome ?? "sem orientador"})`)
    .join("\n");
  const corpo = `Olá,

Este é um aviso automático de acompanhamento da disciplina ${turma.disciplina}.

Até o momento, os alunos abaixo ainda não entregaram o relatório${referenciaCiclo}:

${listaAlunos || "(nenhum aluno selecionado)"}

Este e-mail é só pra conhecimento de todos (aluno, pessoa orientadora e coordenação) — se a entrega
já tiver sido feita e o sistema ainda não refletir, por favor nos avisem.

Atenciosamente,
Professor responsável`;

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <Link href={`/turmas/${turmaId}`} className="text-sm text-zinc-500 hover:underline">
        ← voltar
      </Link>
      <h1 className="text-xl font-semibold">Avisar sobre relatórios pendentes</h1>
      <p className="text-sm text-zinc-500">
        Destinatários e texto vêm pré-preenchidos com quem você selecionou, mas dá pra editar tudo
        antes de enviar; <strong>o envio não é automático</strong> — use o botão para abrir seu
        próprio cliente de e-mail (o app não dispara e-mails em seu nome) ou copie o texto.
      </p>

      {alunos.length === 0 && (
        <p className="text-sm text-amber-700 border border-amber-300 bg-amber-50 rounded p-3">
          Nenhum aluno selecionado — volte pro painel da turma e marque quem você quer avisar.
        </p>
      )}

      {alunos.length > 0 && destinatarios.length === 0 && (
        <p className="text-sm text-amber-700 border border-amber-300 bg-amber-50 rounded p-3">
          Nenhum e-mail cadastrado entre os selecionados (nem aluno, nem pessoa orientadora, nem
          coordenação) — cadastre antes de enviar, ou digite um e-mail direto no campo de
          destinatários.
        </p>
      )}

      <ComposeEmail to={destinatarios} subjectInicial={assunto} corpoInicial={corpo} />
    </div>
  );
}
