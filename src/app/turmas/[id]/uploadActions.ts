"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { parseRosterXlsx } from "@/lib/parseRoster";
import { parseRelatoriosXlsx } from "@/lib/parseRelatorios";
import { parseAgendaXlsx } from "@/lib/parseAgenda";
import { sugerirCandidatoUnico } from "@/lib/matching";
import { normalizeName } from "@/lib/normalize";
import { requireTurmaResponsavel } from "@/lib/authz";

type ResumoUpload = {
  criados: number;
  atualizados: number;
  orientadoresCriados: string[];
  semCorrespondencia: string[];
  sugestoesOrientador: {
    nomeOriginal: string;
    alunoId: string;
    alunoNome: string;
    professorId: string;
    professorNome: string;
  }[];
};

export async function uploadRoster(turmaId: string, _prevState: unknown, formData: FormData) {
  const session = await requireTurmaResponsavel(turmaId);
  const file = formData.get("arquivo") as File | null;
  if (!file || file.size === 0) return { erro: "Selecione um arquivo." };

  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = await parseRosterXlsx(buffer);

  if (!parsed.colunaAlunoEncontrada) {
    return {
      erro:
        `Não encontrei uma coluna "ALUNO" em "${file.name}". Confirme que é a planilha com a aba ` +
        `"Aluno e Orientador" (colunas ALUNO, ORIENTADOR, TÍTULO DO TCC, E-mail) — não a planilha ` +
        `de respostas do formulário semanal, que vai no upload de relatórios.`,
    };
  }

  const resumo: ResumoUpload = {
    criados: 0,
    atualizados: 0,
    orientadoresCriados: [],
    semCorrespondencia: [],
    sugestoesOrientador: [],
  };

  // Carregado uma vez e mantido atualizado no laço, pra pegar tanto duplicatas já existentes no
  // banco quanto duplicatas entre linhas da própria planilha sendo importada agora.
  const professores = await prisma.professor.findMany();

  for (const row of parsed.rows) {
    let orientadorId: string | null = null;
    let sugestaoOrientador: { nomeOriginal: string; professorId: string; professorNome: string } | null = null;

    if (row.orientadorNome) {
      const nomeOrientador = row.orientadorNome;
      const normAlvo = normalizeName(nomeOrientador);

      // Match exato por nome normalizado (ignora maiúsculas/acentos/espaço) resolve sozinho a
      // maioria dos "duplicados" que só diferem em grafia — sem precisar perguntar nada.
      const exato = professores.find((p) => normalizeName(p.nome) === normAlvo);

      if (exato) {
        orientadorId = exato.id;
      } else {
        // Nomes de tamanho diferente (ex.: "Carlos Diego" vs "Carlos Diego Cavalcanti Pereira")
        // só sugerem — pode ser abreviação da mesma pessoa ou coincidência de nome comum, e
        // juntar errado misturaria orientandos de gente diferente.
        const sugestao = sugerirCandidatoUnico(
          normAlvo,
          professores.map((p) => ({ id: p.id, nomeNormalizado: normalizeName(p.nome) }))
        );
        if (sugestao) {
          sugestaoOrientador = { nomeOriginal: nomeOrientador, professorId: sugestao.id, professorNome: professores.find((p) => p.id === sugestao.id)!.nome };
        } else {
          const novo = await prisma.professor.create({ data: { nome: nomeOrientador } });
          professores.push(novo);
          resumo.orientadoresCriados.push(nomeOrientador);
          orientadorId = novo.id;
        }
      }

      if (orientadorId) {
        await prisma.turmaProfessor.upsert({
          where: { turmaId_professorId_papel: { turmaId, professorId: orientadorId, papel: "ORIENTADOR" } },
          create: { turmaId, professorId: orientadorId, papel: "ORIENTADOR" },
          update: {},
        });
      }
    } else {
      resumo.semCorrespondencia.push(`${row.nome} (sem orientador na planilha)`);
    }

    const existente = await prisma.aluno.findFirst({
      where: { turmaId, nomeNormalizado: row.nomeNormalizado },
    });

    if (existente) {
      const orientadorMudou = orientadorId && existente.orientadorId !== orientadorId;
      await prisma.aluno.update({
        where: { id: existente.id },
        data: {
          nome: row.nome,
          email: row.email ?? existente.email,
          tituloTcc: row.tituloTcc ?? existente.tituloTcc,
          orientadorId: orientadorId ?? existente.orientadorId,
        },
      });
      if (orientadorMudou) {
        await prisma.alocacaoHistorico.updateMany({
          where: { alunoId: existente.id, fim: null },
          data: { fim: new Date() },
        });
        await prisma.alocacaoHistorico.create({
          data: { alunoId: existente.id, orientadorId },
        });
      }
      resumo.atualizados += 1;
    } else {
      const novo = await prisma.aluno.create({
        data: {
          nome: row.nome,
          nomeNormalizado: row.nomeNormalizado,
          email: row.email,
          tituloTcc: row.tituloTcc,
          turmaId,
          orientadorId,
        },
      });
      await prisma.alocacaoHistorico.create({ data: { alunoId: novo.id, orientadorId } });
      resumo.criados += 1;
    }

    if (sugestaoOrientador) {
      const alunoAtual = existente ?? (await prisma.aluno.findFirst({ where: { turmaId, nomeNormalizado: row.nomeNormalizado } }));
      if (alunoAtual) {
        resumo.sugestoesOrientador.push({
          nomeOriginal: sugestaoOrientador.nomeOriginal,
          alunoId: alunoAtual.id,
          alunoNome: alunoAtual.nome,
          professorId: sugestaoOrientador.professorId,
          professorNome: sugestaoOrientador.professorNome,
        });
      }
    }
  }

  await prisma.uploadLog.create({
    data: {
      turmaId,
      tipo: "roster",
      nomeArquivo: file.name,
      registrosAfetados: resumo.criados + resumo.atualizados,
      professorId: session?.kind === "professor" ? session.id : null,
      resumoJson: JSON.stringify(resumo),
    },
  });

  revalidatePath(`/turmas/${turmaId}`);
  return { ok: true as const, resumo };
}

export async function confirmarSugestoesOrientador(turmaId: string, _prevState: unknown, formData: FormData) {
  await requireTurmaResponsavel(turmaId);

  const total = Number(formData.get("total") ?? 0);
  let confirmadas = 0;

  for (let i = 0; i < total; i++) {
    if (formData.get(`confirmar_${i}`) !== "on") continue;
    const alunoId = String(formData.get(`alunoId_${i}`) ?? "");
    const professorId = String(formData.get(`professorId_${i}`) ?? "");
    if (!alunoId || !professorId) continue;

    const aluno = await prisma.aluno.findUnique({ where: { id: alunoId } });
    if (!aluno || aluno.orientadorId === professorId) continue;

    await prisma.turmaProfessor.upsert({
      where: { turmaId_professorId_papel: { turmaId, professorId, papel: "ORIENTADOR" } },
      create: { turmaId, professorId, papel: "ORIENTADOR" },
      update: {},
    });
    await prisma.aluno.update({ where: { id: alunoId }, data: { orientadorId: professorId } });
    await prisma.alocacaoHistorico.updateMany({ where: { alunoId, fim: null }, data: { fim: new Date() } });
    await prisma.alocacaoHistorico.create({ data: { alunoId, orientadorId: professorId } });
    confirmadas += 1;
  }

  revalidatePath(`/turmas/${turmaId}`);
  return { ok: true as const, confirmadas };
}

type ResumoRelatorios = {
  processados: number;
  semCorrespondencia: string[];
};

export async function uploadRelatorios(turmaId: string, _prevState: unknown, formData: FormData) {
  const session = await requireTurmaResponsavel(turmaId);
  const file = formData.get("arquivo") as File | null;
  if (!file || file.size === 0) return { erro: "Selecione um arquivo." };

  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = await parseRelatoriosXlsx(buffer);

  const alunos = await prisma.aluno.findMany({ where: { turmaId } });
  if (alunos.length === 0) {
    return {
      erro:
        "Esta turma ainda não tem alunos cadastrados. Faça primeiro o upload de alunos e " +
        "orientadores (planilha \"Aluno e Orientador\") — sem isso, nenhum relatório vai encontrar " +
        "correspondência.",
    };
  }
  const porNome = new Map(alunos.map((a) => [a.nomeNormalizado, a]));

  const resumo: ResumoRelatorios = { processados: 0, semCorrespondencia: [] };
  const semCorrespondenciaContagem = new Map<string, number>();
  const registrarSemCorrespondencia = (motivo: string) => {
    semCorrespondenciaContagem.set(motivo, (semCorrespondenciaContagem.get(motivo) ?? 0) + 1);
  };

  for (const row of parsed.rows) {
    const aluno = porNome.get(row.alunoNomeNormalizado);
    if (!aluno) {
      registrarSemCorrespondencia(row.alunoNome);
      continue;
    }
    if (row.numeroRelatorio === null) {
      registrarSemCorrespondencia(`${row.alunoNome} (sem número de relatório)`);
      continue;
    }

    // Envio do mesmo número substitui o anterior (upsert), sem duplicar.
    await prisma.relatorioSemanal.upsert({
      where: { alunoId_numeroRelatorio: { alunoId: aluno.id, numeroRelatorio: row.numeroRelatorio } },
      create: {
        alunoId: aluno.id,
        numeroRelatorio: row.numeroRelatorio,
        timestampEnvio: row.timestampEnvio,
        relatorioEntregue: true,
        cronogramaEmDia: row.cronogramaEmDia,
        teveReuniao: row.teveReuniao,
        dataUltimaReuniao: row.dataUltimaReuniao,
        impedimento: row.impedimento,
        impedimentoDesc: row.impedimentoDesc,
        oQueFez: row.oQueFez,
        oQuePretende: row.oQuePretende,
        linkCronograma: row.linkCronograma,
        orientadorDeclarado: row.orientadorDeclarado,
      },
      update: {
        timestampEnvio: row.timestampEnvio,
        relatorioEntregue: true,
        cronogramaEmDia: row.cronogramaEmDia,
        teveReuniao: row.teveReuniao,
        dataUltimaReuniao: row.dataUltimaReuniao,
        impedimento: row.impedimento,
        impedimentoDesc: row.impedimentoDesc,
        oQueFez: row.oQueFez,
        oQuePretende: row.oQuePretende,
        linkCronograma: row.linkCronograma,
        orientadorDeclarado: row.orientadorDeclarado,
      },
    });

    if (!aluno.email && row.alunoEmail) {
      await prisma.aluno.update({ where: { id: aluno.id }, data: { email: row.alunoEmail } });
    }

    resumo.processados += 1;
  }

  resumo.semCorrespondencia = [...semCorrespondenciaContagem.entries()].map(([motivo, vezes]) =>
    vezes > 1 ? `${motivo} (${vezes} relatórios)` : motivo
  );

  await prisma.uploadLog.create({
    data: {
      turmaId,
      tipo: "relatorios",
      nomeArquivo: file.name,
      registrosAfetados: resumo.processados,
      professorId: session?.kind === "professor" ? session.id : null,
      resumoJson: JSON.stringify(resumo),
    },
  });

  revalidatePath(`/turmas/${turmaId}`);
  return { ok: true as const, resumo };
}

type ResumoAgenda = {
  ciclos: number;
  gruposAtribuidos: number;
  semCorrespondencia: string[];
  sugestoes: {
    nomeOriginal: string;
    grupo: string;
    ordemSlot: number;
    horario: string | null;
    alunoId: string;
    alunoNome: string;
  }[];
};

export async function uploadAgenda(turmaId: string, _prevState: unknown, formData: FormData) {
  const session = await requireTurmaResponsavel(turmaId);
  const file = formData.get("arquivo") as File | null;
  if (!file || file.size === 0) return { erro: "Selecione um arquivo." };

  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = await parseAgendaXlsx(buffer);

  if (parsed.ciclos.length === 0) {
    return {
      erro:
        `Não encontrei as colunas "DATA"/"GRUPOS" em "${file.name}". Confirme que é a planilha ` +
        `de agenda (com essas colunas e as de "Grupo NN" listando os alunos).`,
    };
  }

  for (const ciclo of parsed.ciclos) {
    await prisma.cicloData.upsert({
      where: { turmaId_numeroCiclo: { turmaId, numeroCiclo: ciclo.numeroCiclo } },
      create: {
        turmaId,
        numeroCiclo: ciclo.numeroCiclo,
        dataPrevista: ciclo.dataPrevista,
        semEncontro: ciclo.semEncontro,
        gruposComReuniao: JSON.stringify(ciclo.gruposComReuniao),
      },
      update: {
        dataPrevista: ciclo.dataPrevista,
        semEncontro: ciclo.semEncontro,
        gruposComReuniao: JSON.stringify(ciclo.gruposComReuniao),
      },
    });
  }

  const alunos = await prisma.aluno.findMany({ where: { turmaId } });
  const porNome = new Map(alunos.map((a) => [a.nomeNormalizado, a]));

  const resumo: ResumoAgenda = { ciclos: parsed.ciclos.length, gruposAtribuidos: 0, semCorrespondencia: [], sugestoes: [] };

  for (const item of parsed.alunosGrupo) {
    const aluno = porNome.get(item.alunoNomeNormalizado);
    if (aluno) {
      if (aluno.grupo !== item.grupo || aluno.horarioReuniao !== item.horario || aluno.ordemSlot !== item.ordemSlot) {
        await prisma.aluno.update({
          where: { id: aluno.id },
          data: { grupo: item.grupo, horarioReuniao: item.horario, ordemSlot: item.ordemSlot },
        });
      }
      resumo.gruposAtribuidos += 1;
      continue;
    }

    const sugestao = sugerirCandidatoUnico(item.alunoNomeNormalizado, alunos);
    if (sugestao) {
      resumo.sugestoes.push({
        nomeOriginal: item.alunoNome,
        grupo: item.grupo,
        ordemSlot: item.ordemSlot,
        horario: item.horario,
        alunoId: sugestao.id,
        alunoNome: sugestao.nome,
      });
    } else {
      resumo.semCorrespondencia.push(item.alunoNome);
    }
  }

  await prisma.uploadLog.create({
    data: {
      turmaId,
      tipo: "agenda",
      nomeArquivo: file.name,
      registrosAfetados: resumo.ciclos + resumo.gruposAtribuidos,
      professorId: session?.kind === "professor" ? session.id : null,
      resumoJson: JSON.stringify(resumo),
    },
  });

  revalidatePath(`/turmas/${turmaId}`);
  return { ok: true as const, resumo };
}

export async function confirmarSugestoesAgenda(turmaId: string, _prevState: unknown, formData: FormData) {
  await requireTurmaResponsavel(turmaId);

  const total = Number(formData.get("total") ?? 0);
  let confirmadas = 0;

  for (let i = 0; i < total; i++) {
    if (formData.get(`confirmar_${i}`) !== "on") continue;
    const alunoId = String(formData.get(`alunoId_${i}`) ?? "");
    const grupo = String(formData.get(`grupo_${i}`) ?? "");
    if (!alunoId || !grupo) continue;
    const ordemSlotRaw = formData.get(`ordemSlot_${i}`);
    const ordemSlot = ordemSlotRaw !== null && ordemSlotRaw !== "" ? Number(ordemSlotRaw) : null;
    const horario = String(formData.get(`horario_${i}`) ?? "") || null;
    await prisma.aluno.update({ where: { id: alunoId }, data: { grupo, ordemSlot, horarioReuniao: horario } });
    confirmadas += 1;
  }

  revalidatePath(`/turmas/${turmaId}`);
  return { ok: true as const, confirmadas };
}
