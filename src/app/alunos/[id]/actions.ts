"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAlunoAccess, podeVerConteudoOcultoDoOrientador } from "@/lib/authz";
import { computeStatus } from "@/lib/semaforo";
import { computeNotaAutomaticaPorPeriodo, computeNotaFinal } from "@/lib/notas";
import { encontrarOuCriarProfessor } from "@/lib/professores";

export async function addObservacao(alunoId: string, formData: FormData) {
  const { session } = await requireAlunoAccess(alunoId);
  if (session.kind !== "professor") return; // só professor autora observação (FK exige Professor)

  const texto = String(formData.get("texto") ?? "").trim();
  if (!texto) return;

  await prisma.observacao.create({ data: { alunoId, professorId: session.id, texto } });
  revalidatePath(`/alunos/${alunoId}`);
}

/**
 * Só quem escreveu a observação pode editá-la — a pessoa orientadora edita as dela, o
 * responsável pela disciplina edita as dele. Se a observação tinha `situacao` (registro formal
 * de reunião), a situação também pode ser ajustada; senão fica como uma observação comum.
 */
export async function editarObservacao(alunoId: string, observacaoId: string, _prevState: unknown, formData: FormData) {
  const { session } = await requireAlunoAccess(alunoId);

  const observacao = await prisma.observacao.findUnique({ where: { id: observacaoId } });
  if (!observacao || observacao.alunoId !== alunoId) return { erro: "Observação não encontrada." };
  if (session.kind !== "professor" || session.id !== observacao.professorId) {
    return { erro: "Só quem escreveu essa observação pode editá-la." };
  }

  const texto = String(formData.get("texto") ?? "").trim();
  if (!texto) return { erro: "O texto não pode ficar vazio." };

  const situacaoRaw = String(formData.get("situacao") ?? "");
  const situacao =
    observacao.situacao && ["OK", "ATENCAO", "INTERVENCAO"].includes(situacaoRaw)
      ? (situacaoRaw as "OK" | "ATENCAO" | "INTERVENCAO")
      : observacao.situacao;

  await prisma.observacao.update({ where: { id: observacaoId }, data: { texto, situacao } });

  revalidatePath(`/alunos/${alunoId}`);
  return { ok: true as const };
}

/**
 * Apaga uma observação (situação ou comentário comum) — mesma regra de quem pode: só quem
 * escreveu. Some de vez, não é um "ocultar" (isso já existe via alternarObservacaoOculta, que é
 * pra outra pessoa esconder de um terceiro; aqui é a própria autora apagando o que escreveu).
 */
export async function apagarObservacao(alunoId: string, observacaoId: string) {
  const { session } = await requireAlunoAccess(alunoId);

  const observacao = await prisma.observacao.findUnique({ where: { id: observacaoId } });
  if (!observacao || observacao.alunoId !== alunoId) return;
  if (session.kind !== "professor" || session.id !== observacao.professorId) return;

  await prisma.observacao.delete({ where: { id: observacaoId } });

  revalidatePath(`/alunos/${alunoId}`);
  revalidatePath(`/alunos/${alunoId}/relatorio`);
}

/**
 * Registro formal de reunião da pessoa orientadora com o aluno — data + descrição + situação
 * (tudo bem / atenção / intervenção). Só a pessoa orientadora ATUAL do aluno pode registrar (o
 * RESPONSAVEL da disciplina e o coordenador só enxergam, via addObservacao/ficha do aluno).
 * É uma Observacao como outra qualquer, só que com `situacao` preenchida.
 */
export async function registrarSituacaoOrientador(alunoId: string, _prevState: unknown, formData: FormData) {
  const { session, aluno } = await requireAlunoAccess(alunoId);
  if (session.kind !== "professor" || session.id !== aluno.orientadorId) {
    return { erro: "Só a pessoa orientadora atual do aluno pode registrar essa reunião." };
  }

  const dataStr = String(formData.get("data") ?? "");
  const situacao = String(formData.get("situacao") ?? "");
  const texto = String(formData.get("texto") ?? "").trim();
  const dataReuniao = new Date(dataStr);

  if (Number.isNaN(dataReuniao.getTime())) return { erro: "Informe a data em que a reunião ocorreu." };
  if (!["OK", "ATENCAO", "INTERVENCAO"].includes(situacao)) return { erro: "Selecione a situação do aluno." };
  if (!texto) return { erro: "Descreva brevemente o que aconteceu na reunião." };

  // A data dessa Observacao (com situacao preenchida) É a "última reunião registrada pela pessoa
  // orientadora" — não precisa duplicar em outro lugar. dataUltimaReuniao (RelatorioSemanal) é
  // uma linha separada: o que o próprio ALUNO reporta no Forms, sem relação com este registro.
  await prisma.observacao.create({
    data: { alunoId, professorId: session.id, data: dataReuniao, texto, situacao: situacao as "OK" | "ATENCAO" | "INTERVENCAO" },
  });

  revalidatePath(`/alunos/${alunoId}`);
  revalidatePath(`/turmas/${aluno.turmaId}`);
  return { ok: true as const };
}

/**
 * Mesma ideia de registrarSituacaoOrientador, mas pro RESPONSAVEL da disciplina — uma tag
 * separada e independente da situação da pessoa orientadora, sem data de reunião (não é um
 * registro de reunião individual, é uma avaliação geral do responsável sobre o aluno).
 */
export async function registrarSituacaoResponsavel(alunoId: string, _prevState: unknown, formData: FormData) {
  const { session, aluno } = await requireAlunoAccess(alunoId);
  if (session.kind !== "professor") return { erro: "Só um professor pode registrar isso." };

  const ehResponsavel = await prisma.turmaProfessor.findFirst({
    where: { turmaId: aluno.turmaId, professorId: session.id, papel: "RESPONSAVEL" },
  });
  if (!ehResponsavel) return { erro: "Só um professor responsável pela disciplina pode registrar isso." };

  const situacao = String(formData.get("situacao") ?? "");
  const texto = String(formData.get("texto") ?? "").trim();

  if (!["OK", "ATENCAO", "INTERVENCAO"].includes(situacao)) return { erro: "Selecione a situação do aluno." };

  await prisma.observacao.create({
    data: { alunoId, professorId: session.id, texto, situacao: situacao as "OK" | "ATENCAO" | "INTERVENCAO" },
  });

  revalidatePath(`/alunos/${alunoId}`);
  revalidatePath(`/turmas/${aluno.turmaId}`);
  return { ok: true as const };
}

/**
 * Esconde (ou reexibe) uma observação da pessoa orientadora — pro caso do aluno ter falado algo
 * sensível sobre ela. Só quem já pode ver esse tipo de conteúdo oculto (RESPONSAVEL da turma ou
 * coordenação) pode alternar, e só em observações escritas por um RESPONSAVEL — não faz sentido
 * esconder de uma pessoa orientadora algo que ela mesma escreveu.
 */
export async function alternarObservacaoOculta(alunoId: string, observacaoId: string) {
  const { session, aluno } = await requireAlunoAccess(alunoId);
  if (!(await podeVerConteudoOcultoDoOrientador(aluno.turmaId, session))) return;

  const observacao = await prisma.observacao.findUnique({ where: { id: observacaoId } });
  if (!observacao || observacao.alunoId !== alunoId) return;

  const autorEhResponsavel = await prisma.turmaProfessor.findFirst({
    where: { turmaId: aluno.turmaId, professorId: observacao.professorId, papel: "RESPONSAVEL" },
  });
  if (!autorEhResponsavel) return;

  await prisma.observacao.update({
    where: { id: observacaoId },
    data: { ocultoDoOrientador: !observacao.ocultoDoOrientador },
  });
  revalidatePath(`/alunos/${alunoId}`);
}

/**
 * Esconde (ou reexibe) a descrição de um impedimento da pessoa orientadora — o fato de "tem
 * impedimento" (o badge) continua igual pra todo mundo, só o texto sensível fica oculto. Mesma
 * regra de quem pode alternar que alternarObservacaoOculta.
 */
export async function alternarImpedimentoOculto(alunoId: string, relatorioId: string) {
  const { session, aluno } = await requireAlunoAccess(alunoId);
  if (!(await podeVerConteudoOcultoDoOrientador(aluno.turmaId, session))) return;

  const relatorio = await prisma.relatorioSemanal.findUnique({ where: { id: relatorioId } });
  if (!relatorio || relatorio.alunoId !== alunoId) return;

  await prisma.relatorioSemanal.update({
    where: { id: relatorioId },
    data: { impedimentoOcultoDoOrientador: !relatorio.impedimentoOcultoDoOrientador },
  });
  revalidatePath(`/alunos/${alunoId}`);
}

/** Preserva o histórico de vínculos em vez de sobrescrever sem rastro — usado tanto pra
 * reatribuir a alguém já cadastrado quanto pra atribuir uma pessoa recém-criada. */
async function trocarOrientador(alunoId: string, novoOrientadorId: string | null) {
  await prisma.alocacaoHistorico.updateMany({
    where: { alunoId, fim: null },
    data: { fim: new Date() },
  });
  await prisma.alocacaoHistorico.create({ data: { alunoId, orientadorId: novoOrientadorId } });
  await prisma.aluno.update({ where: { id: alunoId }, data: { orientadorId: novoOrientadorId } });
  revalidatePath(`/alunos/${alunoId}`);
}

export async function reatribuirOrientador(alunoId: string, formData: FormData) {
  const { aluno } = await requireAlunoAccess(alunoId);
  const novoOrientadorId = String(formData.get("orientadorId") ?? "") || null;

  if (aluno.orientadorId === novoOrientadorId) return;
  await trocarOrientador(alunoId, novoOrientadorId);
}

/**
 * Cadastra uma pessoa orientadora nova (não vinculada ainda a essa turma) e já atribui o aluno a
 * ela — usado quando a pessoa certa nem aparece na lista pra escolher. Reaproveita
 * `encontrarOuCriarProfessor` (mesma lógica de "achar por e-mail/nome ou criar" usada em
 * configActions.ts) em vez de criar um Professor solto sem checar duplicata.
 */
export async function criarOrientadorEAtribuir(alunoId: string, _prevState: unknown, formData: FormData) {
  const { aluno } = await requireAlunoAccess(alunoId);

  const nome = String(formData.get("nome") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  if (!nome) return { erro: "Informe o nome." };

  const professor = await encontrarOuCriarProfessor(nome, email);

  await prisma.turmaProfessor.upsert({
    where: { turmaId_professorId_papel: { turmaId: aluno.turmaId, professorId: professor.id, papel: "ORIENTADOR" } },
    create: { turmaId: aluno.turmaId, professorId: professor.id, papel: "ORIENTADOR" },
    update: {},
  });

  await trocarOrientador(alunoId, professor.id);

  return { ok: true as const, nome: professor.nome };
}

export async function salvarNota(alunoId: string, formData: FormData) {
  const { session, aluno: alunoBase } = await requireAlunoAccess(alunoId);

  const aluno = await prisma.aluno.findUniqueOrThrow({
    where: { id: alunoId },
    include: { turma: { include: { ciclos: true } }, relatorios: true, observacoes: true },
  });

  const periodo = String(formData.get("periodo") ?? "").trim();
  if (periodo !== "SR1" && periodo !== "SR2") return;

  // A nota automática é sempre recalculada no servidor (nunca confiar no valor vindo do
  // formulário): evita que alguém edite o campo escondido e force um valor arbitrário. SR1 e SR2
  // têm faltas separadas pelo ciclo de corte configurado na turma (ver computeNotaAutomaticaPorPeriodo).
  const status = computeStatus(aluno, aluno.turma, aluno.turma.ciclos, aluno.relatorios, aluno.observacoes);
  const notaAutomatica = computeNotaAutomaticaPorPeriodo(status.detalhePorCiclo, periodo, aluno.turma.cicloCorteSR1);

  // Só o orientador daquele aluno pode lançar/editar a nota do orientador — e só quando o
  // responsável pela disciplina liberou esse período (Turma.notasSR1/2Liberadas). Checado aqui
  // também, não só escondendo o campo na tela, porque a action pode ser chamada direto.
  const periodoLiberado = periodo === "SR1" ? aluno.turma.notasSR1Liberadas : aluno.turma.notasSR2Liberadas;
  const podeEditarNotaOrientador = session.kind === "professor" && session.id === alunoBase.orientadorId && periodoLiberado;

  const notaOrientadorRaw = formData.get("notaOrientador");
  const comentarioRaw = String(formData.get("comentario") ?? "").trim() || null;

  const existente = await prisma.nota.findUnique({ where: { alunoId_periodo: { alunoId, periodo } } });

  const notaOrientador = podeEditarNotaOrientador
    ? notaOrientadorRaw !== null && notaOrientadorRaw !== ""
      ? Number(notaOrientadorRaw)
      : null
    : (existente?.notaOrientador ?? null);
  const comentario = podeEditarNotaOrientador ? comentarioRaw : (existente?.comentario ?? null);

  const notaFinal = computeNotaFinal(notaAutomatica, notaOrientador, aluno.turma.pesoNotaAutomatica);

  await prisma.nota.upsert({
    where: { alunoId_periodo: { alunoId, periodo } },
    create: { alunoId, periodo, notaAutomatica, notaOrientador, notaFinal, comentario },
    update: { notaAutomatica, notaOrientador, notaFinal, comentario },
  });

  revalidatePath(`/alunos/${alunoId}`);
}
