import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTurmaResponsavel, getGruposResponsavel } from "@/lib/authz";
import { computeStatus } from "@/lib/semaforo";
import { formatDiaCalendario } from "@/lib/format";
import { indiceRelatorioDoCiclo, parseGruposComReuniao } from "@/lib/ciclos";
import { situacaoAtualDeAutores } from "@/lib/situacao";
import { responsavelIdsDaTurma } from "@/lib/vinculos";
import RestricaoGrupoAviso from "@/components/RestricaoGrupoAviso";
import AlunoReuniaoCard from "./AlunoReuniaoCard";

export default async function ReuniaoDoDiaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; numeroCiclo: string }>;
  searchParams: Promise<{ todos?: string }>;
}) {
  const { id, numeroCiclo: numeroCicloStr } = await params;
  const numeroCiclo = Number(numeroCicloStr);
  const filtros = await searchParams;
  const session = await requireTurmaResponsavel(id);
  const restricaoConfigurada = await getGruposResponsavel(id, session);
  const verTodos = filtros.todos === "1";
  const gruposResponsavel = verTodos ? null : restricaoConfigurada;

  const turma = await prisma.turma.findUnique({ where: { id }, include: { ciclos: true, vinculos: true } });
  if (!turma) notFound();

  const responsavelIds = responsavelIdsDaTurma(turma.vinculos);
  const podeRegistrarSituacaoResponsavel = session.kind === "professor" && responsavelIds.includes(session.id);

  const ciclo = turma.ciclos.find((c) => c.numeroCiclo === numeroCiclo);
  if (!ciclo) notFound();

  const grupos = parseGruposComReuniao(ciclo.gruposComReuniao);
  const todos = grupos.includes("TODOS");

  // Restrição por grupo (mesma da visão de "meus alunos" no dashboard) — uma pessoa responsável
  // só de parte da disciplina não deve ver os alunos de outro grupo, mesmo quando os dois grupos
  // têm reunião no mesmo dia.
  const gruposDoDia = gruposResponsavel && !todos ? grupos.filter((g) => gruposResponsavel.includes(g)) : grupos;
  const semAlunosPraVer = gruposResponsavel && !todos && gruposDoDia.length === 0;

  const alunos =
    ciclo.semEncontro || semAlunosPraVer
      ? []
      : await prisma.aluno.findMany({
          where: {
            turmaId: id,
            ...(todos && !gruposResponsavel
              ? {}
              : todos
                ? { grupo: { in: gruposResponsavel! } }
                : { grupo: { in: gruposDoDia } }),
          },
          include: {
            orientador: true,
            relatorios: { orderBy: { numeroRelatorio: "asc" } },
            observacoes: { include: { professor: true }, orderBy: { data: "asc" } },
          },
        });

  const alunosOrdenados = [...alunos].sort((a, b) => {
    const slotA = a.ordemSlot ?? 999;
    const slotB = b.ordemSlot ?? 999;
    return slotA - slotB || a.nome.localeCompare(b.nome);
  });

  // numeroRelatorio não é igual a numeroCiclo quando existem ciclos "sem encontro" antes deste
  // (ver src/lib/ciclos.ts) — sem isso, a tela mostraria/gravaria no número de relatório errado.
  const numeroRelatorioEsperado = indiceRelatorioDoCiclo(turma.ciclos, numeroCiclo);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link href={`/turmas/${id}/reunioes`} className="text-sm text-zinc-500 hover:underline">
        ← voltar
      </Link>
      <div>
        <h1 className="text-xl font-semibold">
          Reunião — Ciclo {numeroCiclo}
          {numeroRelatorioEsperado !== undefined && ` (relatório #${numeroRelatorioEsperado})`} —{" "}
          {formatDiaCalendario(ciclo.dataPrevista)}
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          {ciclo.semEncontro
            ? "Sem encontro previsto pra ninguém neste dia."
            : todos
              ? "Reunião prevista pra todo mundo."
              : `Reunião prevista pra: ${grupos.join(", ") || "—"}. Alunos de outros grupos ainda precisam mandar o relatório da semana, só não têm reunião marcada.`}
        </p>
        <RestricaoGrupoAviso
          gruposResponsavel={gruposResponsavel}
          gruposParaMostrar={gruposDoDia}
          restricaoConfigurada={restricaoConfigurada}
          verTodos={verTodos}
          hrefVerTodos={`/turmas/${id}/reunioes/${numeroCiclo}?todos=1`}
          hrefVoltar={`/turmas/${id}/reunioes/${numeroCiclo}`}
        />
      </div>

      {!ciclo.semEncontro && alunosOrdenados.length === 0 && (
        <p className="text-sm text-zinc-400">
          Nenhum aluno encontrado pra esse(s) grupo(s) — confira se a agenda já foi importada.
        </p>
      )}

      <div className="space-y-4">
        {alunosOrdenados.map((aluno) => {
          const status = computeStatus(aluno, turma, turma.ciclos, aluno.relatorios, aluno.observacoes);
          const relatorioDoDia =
            numeroRelatorioEsperado !== undefined
              ? aluno.relatorios.find((r) => r.numeroRelatorio === numeroRelatorioEsperado) ?? null
              : null;

          // Se ainda não tem relatório pra esse ciclo (o aluno não mandou o Forms ainda, ou o
          // professor está preenchendo antes/durante a reunião), puxa impedimento e link do
          // cronograma dos relatórios anteriores como ponto de partida — são dados mais "de
          // estado" (o cronograma não muda toda semana). "O que fez" e "o que pretende fazer" são
          // relatos daquela semana específica: só aparecem se o aluno realmente respondeu o
          // relatório desse ciclo, senão ficam em branco (não herdam de semanas antigas).
          //
          // Só olha pra TRÁS (numeroRelatorio <= o desse ciclo) — um relatório de um ciclo FUTURO
          // (ex.: o aluno já respondeu o Forms da semana que vem) não pode aparecer como se fosse
          // dado desse ciclo aqui; isso mostraria como "preenchido" algo que na verdade ele não
          // entregou pra essa reunião.
          //
          // Cada campo busca pra trás o relatório mais recente que TEM aquele campo preenchido,
          // em vez de travar num único "relatório mais recente" — um relatório recente pode ter
          // ficado com um campo em branco (ex.: um registro criado só pra marcar presença nesta
          // própria tela) sem que isso deva esconder um dado real de um relatório mais antigo.
          const relatoriosAteEsseCiclo =
            numeroRelatorioEsperado !== undefined
              ? aluno.relatorios.filter((r) => r.numeroRelatorio <= numeroRelatorioEsperado)
              : aluno.relatorios;
          const relatoriosDoMaisNovoProMaisVelho = [...relatoriosAteEsseCiclo].sort((a, b) => b.numeroRelatorio - a.numeroRelatorio);
          const heranca = {
            impedimento: relatoriosDoMaisNovoProMaisVelho.find((r) => r.impedimento)?.impedimento ?? false,
            impedimentoDesc: relatoriosDoMaisNovoProMaisVelho.find((r) => r.impedimentoDesc)?.impedimentoDesc ?? null,
            linkCronograma: relatoriosDoMaisNovoProMaisVelho.find((r) => r.linkCronograma)?.linkCronograma ?? null,
          };

          // Duas fontes distintas, mostradas separadas — não são a mesma reunião nem a mesma
          // pessoa registrando: uma é o que o próprio aluno reporta no Forms semanal, a outra é o
          // que a pessoa orientadora registra por conta própria (ver registrarSituacaoOrientador).
          const ultimaReuniaoSegundoAluno =
            relatoriosDoMaisNovoProMaisVelho.find((r) => r.dataUltimaReuniao)?.dataUltimaReuniao ?? null;
          const orientadorIds = aluno.orientadorId ? [aluno.orientadorId] : [];
          const situacaoOrientadorAtual = situacaoAtualDeAutores(aluno.observacoes, orientadorIds);
          const situacaoResponsavelAtual = situacaoAtualDeAutores(aluno.observacoes, responsavelIds);
          const ultimaReuniaoRegistradaPeloOrientador = situacaoOrientadorAtual?.data ?? null;

          const timeline = [
            ...aluno.relatorios.map((r) => ({
              tipo: "relatorio" as const,
              data: r.timestampEnvio,
              numeroRelatorio: r.numeroRelatorio,
              teveReuniao: r.teveReuniao,
            })),
            ...aluno.observacoes.map((o) => ({
              tipo: "observacao" as const,
              data: o.data,
              texto: o.texto,
              autor: o.professor.nome,
              situacao: o.situacao,
              // Uma Observacao com `situacao` preenchida é um registro formal, não um comentário
              // solto — de quem exatamente depende de quem escreveu: a pessoa orientadora
              // (registrarSituacaoOrientador, é uma reunião) ou o responsável pela disciplina
              // (registrarSituacaoResponsavel, é a tag da disciplina).
              origemSituacao: !o.situacao
                ? null
                : orientadorIds.includes(o.professorId)
                  ? ("orientador" as const)
                  : responsavelIds.includes(o.professorId)
                    ? ("disciplina" as const)
                    : null,
            })),
          ].sort((a, b) => b.data.getTime() - a.data.getTime());

          return (
            <AlunoReuniaoCard
              key={aluno.id}
              turmaId={id}
              alunoId={aluno.id}
              alunoNome={aluno.nome}
              tituloTcc={aluno.tituloTcc}
              orientadorNome={aluno.orientador?.nome ?? null}
              horario={aluno.horarioReuniao}
              status={status.status}
              totalFaltas={status.totalFaltas}
              limiteFaltas={turma.limiteFaltas}
              numeroCiclo={numeroCiclo}
              ultimaReuniaoSegundoAluno={ultimaReuniaoSegundoAluno}
              ultimaReuniaoRegistradaPeloOrientador={ultimaReuniaoRegistradaPeloOrientador}
              situacaoOrientador={situacaoOrientadorAtual?.situacao ?? null}
              situacaoResponsavel={situacaoResponsavelAtual?.situacao ?? null}
              podeRegistrarSituacaoResponsavel={podeRegistrarSituacaoResponsavel}
              dadosHerdados={!relatorioDoDia && (heranca.linkCronograma !== null || heranca.impedimento)}
              relatorioDoDia={
                relatorioDoDia
                  ? {
                      cronogramaEmDia: relatorioDoDia.cronogramaEmDia,
                      presencaReuniaoDisciplina: relatorioDoDia.presencaReuniaoDisciplina,
                      relatorioEntregue: relatorioDoDia.relatorioEntregue,
                      impedimento: relatorioDoDia.impedimento,
                      impedimentoDesc: relatorioDoDia.impedimentoDesc,
                      oQueFez: relatorioDoDia.oQueFez,
                      oQuePretende: relatorioDoDia.oQuePretende,
                      linkCronograma: relatorioDoDia.linkCronograma,
                    }
                  : {
                      cronogramaEmDia: null,
                      presencaReuniaoDisciplina: null,
                      relatorioEntregue: false,
                      impedimento: heranca.impedimento,
                      impedimentoDesc: heranca.impedimentoDesc,
                      oQueFez: null,
                      oQuePretende: null,
                      linkCronograma: heranca.linkCronograma,
                    }
              }
              timeline={timeline}
            />
          );
        })}
      </div>
    </div>
  );
}
