import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { computeStatus } from "@/lib/semaforo";
import { requireAlunoAccess } from "@/lib/authz";
import ComposeEmail from "@/components/ComposeEmail";

export default async function AlertaEmailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAlunoAccess(id);

  const aluno = await prisma.aluno.findUnique({
    where: { id },
    include: {
      turma: {
        include: {
          ciclos: true,
          coordenador: true,
          coordenadores: { include: { coordenador: true } },
        },
      },
      orientador: true,
      relatorios: true,
      observacoes: true,
    },
  });
  if (!aluno) notFound();

  const status = computeStatus(aluno, aluno.turma, aluno.turma.ciclos, aluno.relatorios, aluno.observacoes);

  // Destinatários vêm pré-preenchidos (pessoa orientadora, aluno, coordenação da turma), mas o
  // campo fica aberto pra edição — às vezes só faz sentido avisar uma parte deles, ou incluir
  // mais alguém.
  const coordenadores = [
    aluno.turma.coordenador,
    ...aluno.turma.coordenadores.map((v) => v.coordenador),
  ].filter((c): c is NonNullable<typeof c> => !!c);
  const destinatarios = Array.from(
    new Set(
      [aluno.orientador?.email, aluno.email, ...coordenadores.map((c) => c.email)].filter((e): e is string => !!e)
    )
  );

  // Saudação nomeia todo mundo que de fato vai receber (orientador, coordenação, aluno) — não faz
  // sentido incluir alguém na lista de "Olá" que não está nos destinatários, nem deixar de citar
  // quem está.
  const nomesSaudacao = [aluno.orientador?.nome, ...coordenadores.map((c) => c.nome), aluno.nome].filter(
    (n): n is string => !!n
  );
  const saudacao =
    nomesSaudacao.length <= 1
      ? nomesSaudacao.join("")
      : `${nomesSaudacao.slice(0, -1).join(", ")} e ${nomesSaudacao[nomesSaudacao.length - 1]}`;

  const assunto = `[${aluno.turma.nome}] Acompanhamento — ${aluno.nome}`;
  const corpo = `Olá ${saudacao},

Este é um alerta de acompanhamento gerado a partir do relatório da turma ${aluno.turma.nome}.

Motivo(s):
${status.motivos.map((m) => `- ${m}`).join("\n") || "- (edite aqui o motivo do alerta)"}

Por favor, se manifestem sobre a situação.

Atenciosamente,
Professor responsável`;

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <Link href={`/alunos/${aluno.id}`} className="text-sm text-zinc-500 hover:underline">
        ← voltar
      </Link>
      <h1 className="text-xl font-semibold">Avisar sobre {aluno.nome}</h1>
      <p className="text-sm text-zinc-500">
        Destinatários e texto vêm pré-preenchidos, mas dá pra editar tudo antes de enviar;{" "}
        <strong>o envio não é automático</strong> — use o botão para abrir seu próprio cliente de
        e-mail (o app não dispara e-mails em seu nome) ou copie o texto.
      </p>

      {destinatarios.length === 0 && (
        <p className="text-sm text-amber-700 border border-amber-300 bg-amber-50 rounded p-3">
          Nenhum e-mail cadastrado (nem da pessoa orientadora, nem do aluno, nem da coordenação) —
          cadastre antes de enviar, ou digite um e-mail direto no campo de destinatários.
        </p>
      )}

      <ComposeEmail to={destinatarios} subjectInicial={assunto} corpoInicial={corpo} />
    </div>
  );
}
