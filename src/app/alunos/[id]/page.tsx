import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { computeStatus } from "@/lib/semaforo";
import { computeNotaAutomaticaPorPeriodo } from "@/lib/notas";
import { requireAlunoAccess, podeVerConteudoOcultoDoOrientador } from "@/lib/authz";
import { formatDiaCalendario } from "@/lib/format";
import SemaforoBadge from "@/components/SemaforoBadge";
import SituacaoBadge from "@/components/SituacaoBadge";
import { situacaoAtualDeAutores } from "@/lib/situacao";
import { orientadoresDaTurma, responsavelIdsDaTurma } from "@/lib/vinculos";
import { addObservacao, reatribuirOrientador, criarOrientadorEAtribuir, salvarNota, alternarImpedimentoOculto } from "./actions";
import RegistrarSituacaoForm from "./RegistrarSituacaoForm";
import RegistrarSituacaoResponsavelForm from "./RegistrarSituacaoResponsavelForm";
import ObservacaoItem from "./ObservacaoItem";
import Indicador from "./Indicador";
import PeriodoNotaCard from "./PeriodoNotaCard";
import RelatorioTimelineItem from "./RelatorioTimelineItem";
import CarregadoEm from "@/components/CarregadoEm";
import OrientadorCombobox from "./OrientadorCombobox";

/** A disciplina tem exatamente dois períodos de nota — não são criados livremente. */
const PERIODOS_NOTA = ["SR1", "SR2"] as const;

export default async function AlunoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session } = await requireAlunoAccess(id);

  const aluno = await prisma.aluno.findUnique({
    where: { id },
    include: {
      turma: { include: { ciclos: true, vinculos: { include: { professor: true } } } },
      orientador: true,
      relatorios: { orderBy: { numeroRelatorio: "asc" } },
      observacoes: { include: { professor: true }, orderBy: { data: "asc" } },
      notas: true,
    },
  });
  if (!aluno) notFound();

  const status = computeStatus(aluno, aluno.turma, aluno.turma.ciclos, aluno.relatorios, aluno.observacoes);
  const orientadores = orientadoresDaTurma(aluno.turma.vinculos);

  // Quem pode ver impedimentos/observações marcados como ocultos da pessoa orientadora: qualquer
  // RESPONSAVEL da turma ou coordenação. A própria pessoa orientadora nunca vê esse conteúdo nem
  // sabe que existe — não é só o texto que some, o item inteiro nem aparece na linha do tempo.
  const podeVerOculto = await podeVerConteudoOcultoDoOrientador(aluno.turmaId, session);

  type Evento =
    | { tipo: "relatorio"; data: Date; item: (typeof aluno.relatorios)[number] }
    | { tipo: "observacao"; data: Date; item: (typeof aluno.observacoes)[number] };

  const observacoesVisiveis = podeVerOculto
    ? aluno.observacoes
    : aluno.observacoes.filter((o) => !o.ocultoDoOrientador);

  const timeline: Evento[] = [
    ...aluno.relatorios.map((r) => ({ tipo: "relatorio" as const, data: r.timestampEnvio, item: r })),
    ...observacoesVisiveis.map((o) => ({ tipo: "observacao" as const, data: o.data, item: o })),
  ].sort((a, b) => a.data.getTime() - b.data.getTime());

  const reatribuirAction = reatribuirOrientador.bind(null, aluno.id);
  const criarOrientadorAction = criarOrientadorEAtribuir.bind(null, aluno.id);
  const observacaoAction = addObservacao.bind(null, aluno.id);
  const notaAction = salvarNota.bind(null, aluno.id);
  const ehOrientadorAtual = session.kind === "professor" && session.id === aluno.orientadorId;

  // Duas tags de situação independentes, cada uma só considerando observações do autor
  // correspondente — a pessoa orientadora e o responsável pela disciplina avaliam coisas
  // diferentes e não devem se misturar numa única "situação atual".
  const responsavelIds = responsavelIdsDaTurma(aluno.turma.vinculos);
  const orientadorIds = aluno.orientadorId ? [aluno.orientadorId] : [];
  const situacaoOrientador = situacaoAtualDeAutores(aluno.observacoes, orientadorIds);
  const situacaoResponsavel = situacaoAtualDeAutores(aluno.observacoes, responsavelIds);
  const podeRegistrarSituacaoResponsavel = session.kind === "professor" && responsavelIds.includes(session.id);
  // Todas as datas de reunião com a pessoa orientadora que o aluno já reportou, não só a mais
  // recente — cada relatório semanal traz em "dataUltimaReuniao" a data da última vez que o aluno
  // se reuniu com a pessoa orientadora dele; várias semanas seguidas costumam repetir a mesma
  // data (enquanto não rola uma reunião nova), então dedupe por data pra listar só os encontros
  // de fato, não uma linha por relatório. Ordenado pela DATA da reunião (não por numeroRelatorio)
  // porque um relatório mais recente pode reportar uma reunião mais antiga que uma já listada,
  // se o aluno corrigir/completar uma data que faltava num relatório anterior.
  const reunioesComOrientador = [
    ...new Set(aluno.relatorios.filter((r) => r.dataUltimaReuniao).map((r) => r.dataUltimaReuniao!.getTime())),
  ]
    .sort((a, b) => b - a)
    .map((t) => new Date(t));

  // Mesma fonte do "Dias com falta" do relatório exportado (AlunoRelatorioSecoes) — trazida pra
  // cá pra não precisar abrir/imprimir o relatório só pra ver QUAIS dias pesaram no total.
  const diasComFalta = [...status.detalhePorCiclo].filter((d) => d.faltas > 0).sort((a, b) => b.numeroCiclo - a.numeroCiclo);

  return (
    <div className="space-y-8">
      <Link href={`/turmas/${aluno.turmaId}`} className="text-sm text-zinc-500 hover:underline">
        ← voltar para {aluno.turma.nome}
      </Link>

      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-semibold">{aluno.nome}</h1>
          <p className="text-sm text-zinc-500">
            {aluno.turma.nome}{" "}
            {aluno.tituloTcc && aluno.tituloTcc.toLowerCase() !== "não informado" && <>· “{aluno.tituloTcc}”</>}
          </p>
          <CarregadoEm />
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/alunos/${aluno.id}/relatorio`}
            className="text-xs rounded border border-orange-300 text-orange-700 px-3 py-1.5 hover:bg-orange-50"
          >
            Exportar relatório
          </Link>
          <SemaforoBadge status={status.status} />
        </div>
      </div>

      {status.motivos.length > 0 && (
        <ul className="text-sm text-zinc-600 list-disc list-inside">
          {status.motivos.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}

      <section className="grid gap-6 sm:grid-cols-2">
        <div className="border rounded bg-white p-4 space-y-3">
          <h2 className="font-medium text-sm">Pessoa orientadora</h2>
          <p className="text-sm">{aluno.orientador?.nome ?? "Sem pessoa orientadora alocada"}</p>
          <OrientadorCombobox
            orientadorAtualId={aluno.orientadorId}
            orientadores={orientadores}
            reatribuirAction={reatribuirAction}
            criarEAtribuirAction={criarOrientadorAction}
          />
          <p className="text-xs text-zinc-400">
            A troca preserva o histórico de relatórios já enviados sob a pessoa orientadora anterior.
          </p>
        </div>

        <div className="border rounded bg-white p-4 space-y-3 text-sm">
          <h2 className="font-medium">Indicadores</h2>
          <div className="grid grid-cols-2 gap-3">
            <Indicador label="Grupo" valor={aluno.grupo ?? "desconhecido"} />
            <Indicador
              label="Falta total"
              valor={`${status.totalFaltas} de ${aluno.turma.limiteFaltas}`}
              destaque={status.totalFaltas >= aluno.turma.limiteFaltas ? "vermelho" : status.totalFaltas > 0 ? "amarelo" : "verde"}
            />
            <Indicador label="Relatórios não entregues" valor={`${status.relatoriosNaoEntregues} de ${status.ciclosConsiderados}`} />
            <Indicador label="Faltas em reuniões" valor={status.faltasReuniao} />
            <Indicador label="Faltas consecutivas" valor={`${status.faltasConsecutivas} ciclo(s)`} />
            <Indicador
              label="Impedimento em aberto"
              valor={status.impedimentoAberto ? "Sim" : "Não"}
              destaque={status.impedimentoAberto ? "vermelho" : undefined}
            />
            <div className="col-span-2">
              <p className="text-xs font-medium text-zinc-500 uppercase">
                Reuniões com a pessoa orientadora (segundo o aluno)
              </p>
              <p className="font-medium text-zinc-900">
                {reunioesComOrientador.length === 0
                  ? "—"
                  : reunioesComOrientador.map((d) => formatDiaCalendario(d)).join(", ")}
              </p>
            </div>
          </div>
          {aluno.grupo === null && (
            <p className="text-xs text-amber-700">Grupo desconhecido — upload da agenda ainda não casou esse aluno.</p>
          )}
          {(status.status === "vermelho" || status.impedimentoAberto) && (
            <Link href={`/alunos/${aluno.id}/alerta-email`} className="inline-block text-xs rounded border border-orange-300 text-orange-700 px-2 py-1 hover:bg-orange-50">
              Avisar por e-mail
            </Link>
          )}
        </div>
      </section>

      {/* Situação com a pessoa orientadora */}
      <section className="border rounded bg-white p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-medium text-sm">Situação com a pessoa orientadora</h2>
          <SituacaoBadge situacao={situacaoOrientador?.situacao ?? null} />
        </div>
        {situacaoOrientador && (
          <p className="text-xs text-zinc-500">
            Última reunião registrada pela pessoa orientadora em {formatDiaCalendario(situacaoOrientador.data)}:{" "}
            {situacaoOrientador.texto}
          </p>
        )}
        {ehOrientadorAtual ? (
          <div className="border-t pt-3">
            <RegistrarSituacaoForm alunoId={aluno.id} />
          </div>
        ) : (
          <p className="text-xs text-zinc-400">Só a pessoa orientadora atual do aluno pode registrar uma reunião aqui.</p>
        )}
      </section>

      {/* Situação segundo o responsável pela disciplina — tag independente da situação da
          pessoa orientadora acima, não se misturam. */}
      <section className="border rounded bg-white p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-medium text-sm">Situação com o responsável pela disciplina</h2>
          <SituacaoBadge situacao={situacaoResponsavel?.situacao ?? null} />
        </div>
        {situacaoResponsavel && (
          <p className="text-xs text-zinc-500">
            Registrado pelo responsável em {formatDiaCalendario(situacaoResponsavel.data)}: {situacaoResponsavel.texto}
          </p>
        )}
        {podeRegistrarSituacaoResponsavel ? (
          <div className="border-t pt-3">
            <RegistrarSituacaoResponsavelForm alunoId={aluno.id} />
          </div>
        ) : (
          <p className="text-xs text-zinc-400">Só um responsável pela disciplina pode registrar isso.</p>
        )}
      </section>

      {/* Notas — períodos fixos (SR1 e SR2), não criados livremente */}
      <details className="border rounded bg-white overflow-hidden">
        <summary className="cursor-pointer px-4 py-3 font-medium text-sm flex items-center justify-between gap-2">
          Notas
          <span className="text-xs text-zinc-500 font-normal">clique pra ver/editar SR1 e SR2</span>
        </summary>
        <div className="p-4 pt-0 grid gap-3 sm:grid-cols-2">
          {PERIODOS_NOTA.map((periodo) => {
            const liberado = periodo === "SR1" ? aluno.turma.notasSR1Liberadas : aluno.turma.notasSR2Liberadas;
            return (
              <PeriodoNotaCard
                key={periodo}
                periodo={periodo}
                nota={aluno.notas.find((n) => n.periodo === periodo) ?? null}
                notaAutomaticaSugerida={computeNotaAutomaticaPorPeriodo(status.detalhePorCiclo, periodo, aluno.turma.cicloCorteSR1)}
                podeEditarNotaOrientador={ehOrientadorAtual && liberado}
                liberado={liberado}
                notaAction={notaAction}
              />
            );
          })}
        </div>
      </details>

      {/* Dias com falta — mesma fonte do relatório exportado (AlunoRelatorioSecoes), trazida pra
          cá pra não precisar abrir/imprimir o relatório só pra ver QUAIS dias pesaram no total. */}
      {diasComFalta.length > 0 && (
        <section className="border rounded bg-white p-4 space-y-2">
          <h2 className="font-medium text-sm">Dias com falta ({diasComFalta.length})</h2>
          <table className="w-full text-sm">
            <thead className="text-left text-zinc-500 border-b">
              <tr>
                <th className="py-1 pr-4">Data</th>
                <th className="py-1 pr-4">Ocorrido</th>
                <th className="py-1">Faltas</th>
              </tr>
            </thead>
            <tbody>
              {diasComFalta.map((d) => (
                <tr key={d.numeroCiclo} className="border-b last:border-0">
                  <td className="py-1 pr-4">{formatDiaCalendario(d.dataPrevista)}</td>
                  <td className="py-1 pr-4">{d.descricao}</td>
                  <td className="py-1">{d.faltas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Linha do tempo */}
      <section className="space-y-3">
        <h2 className="font-medium text-sm">Linha do tempo</h2>
        <ol className="space-y-3">
          {timeline.map((evento) =>
            evento.tipo === "relatorio" ? (
              <RelatorioTimelineItem
                key={`r-${evento.item.id}`}
                relatorio={evento.item}
                data={evento.data}
                podeVerOculto={podeVerOculto}
                onToggleImpedimento={alternarImpedimentoOculto.bind(null, aluno.id, evento.item.id)}
              />
            ) : (
              <ObservacaoItem
                key={`o-${evento.item.id}`}
                alunoId={aluno.id}
                observacaoId={evento.item.id}
                autorNome={evento.item.professor.nome}
                data={evento.data}
                texto={evento.item.texto}
                situacao={evento.item.situacao}
                origemSituacao={
                  !evento.item.situacao
                    ? null
                    : orientadorIds.includes(evento.item.professorId)
                      ? "orientador"
                      : responsavelIds.includes(evento.item.professorId)
                        ? "disciplina"
                        : null
                }
                podeEditar={session.kind === "professor" && session.id === evento.item.professorId}
                oculto={evento.item.ocultoDoOrientador}
                podeAlternarVisibilidade={
                  podeVerOculto &&
                  aluno.turma.vinculos.some((v) => v.papel === "RESPONSAVEL" && v.professorId === evento.item.professorId)
                }
              />
            )
          )}
          {timeline.length === 0 && <p className="text-sm text-zinc-400">Ainda sem histórico.</p>}
        </ol>
      </section>

      {/* Observação (autor precisa ser um Professor) */}
      {session.kind === "professor" && (
        <section className="border rounded bg-white p-4 space-y-2">
          <h2 className="font-medium text-sm">Nova observação</h2>
          <form action={observacaoAction} className="space-y-2">
            <textarea name="texto" required rows={3} className="w-full rounded border px-3 py-2 text-sm" />
            <button className="rounded bg-orange-600 text-white px-4 py-2 text-sm hover:bg-orange-700">Adicionar</button>
          </form>
        </section>
      )}
    </div>
  );
}

