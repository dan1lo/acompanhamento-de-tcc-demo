import Link from "next/link";
import { notFound } from "next/navigation";
import MenuDropdown from "@/components/MenuDropdown";
import { getTurmaCompleta, statusesPorTurma } from "@/lib/turmaData";
import { requireTurmaResponsavel, getGruposResponsavel } from "@/lib/authz";
import { situacaoAtualDeAutores } from "@/lib/situacao";
import { normalizeName } from "@/lib/normalize";
import { formatDiaCalendario } from "@/lib/format";
import { orientadoresDaTurma, responsavelIdsDaTurma } from "@/lib/vinculos";
import { indiceRelatorioDoCiclo } from "@/lib/ciclos";
import RestricaoGrupoAviso from "@/components/RestricaoGrupoAviso";
import CarregadoEm from "@/components/CarregadoEm";
import AlunoStatusTable from "./AlunoStatusTable";
import OrientadorBusca from "./OrientadorBusca";
import SelecaoPendentesForm from "./SelecaoPendentesForm";

export default async function TurmaDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    orientador?: string;
    status?: string;
    todos?: string;
    visao?: string;
    busca?: string;
    semana?: string;
    semanaReuniao?: string;
  }>;
}) {
  const { id } = await params;
  const filtros = await searchParams;
  const session = await requireTurmaResponsavel(id);
  const restricaoConfigurada = await getGruposResponsavel(id, session);
  // ?todos=1 deixa a pessoa responsável ver a turma inteira mesmo tendo uma restrição de grupo
  // configurada — a restrição é o padrão de visão, não uma permissão bloqueada.
  const verTodos = filtros.todos === "1";
  const gruposResponsavel = verTodos ? null : restricaoConfigurada;

  const turma = await getTurmaCompleta(id);
  if (!turma) notFound();

  const statusesTurma = statusesPorTurma(turma);
  // Restrição por grupo (visão de "meus alunos" pra quem é responsável só de parte da
  // disciplina) — null = sem restrição, vê todo mundo (comportamento de sempre).
  const statuses = gruposResponsavel
    ? statusesTurma.filter((s) => s.aluno.grupo && gruposResponsavel.includes(s.aluno.grupo))
    : statusesTurma;

  const semOrientador = statuses.filter((s) => s.semOrientador);
  const vermelhos = statuses.filter((s) => s.status === "vermelho");
  const impedimentosAbertos = statuses.filter((s) => s.impedimentoAberto);

  const orientadores = orientadoresDaTurma(turma.vinculos);
  const responsavelIds = responsavelIdsDaTurma(turma.vinculos);

  // "Semana" pra fins de "quem ainda não entregou" = um ciclo que conta pra relatório (não "sem
  // encontro"). Inclui tanto os já vencidos quanto o ciclo EM ANDAMENTO (o próximo ainda não
  // vencido) — o prazo de entrega vale até a data prevista, mas dá pra acompanhar quem já
  // entregou desde o dia em que o ciclo anterior fechou, sem precisar esperar o prazo vencer pra
  // começar a cobrar quem falta. Por padrão mostra o ciclo em andamento (ou, se não houver mais
  // nenhum agendado, o último já vencido) — mas dá pra escolher outro pelo seletor.
  const agora = new Date();
  const todosCiclosContaveis = [...turma.ciclos]
    .filter((c) => !c.semEncontro)
    .sort((a, b) => a.numeroCiclo - b.numeroCiclo);
  const ciclosVencidosContaveis = todosCiclosContaveis.filter((c) => c.dataPrevista <= agora);
  const cicloEmAndamento = todosCiclosContaveis.find((c) => c.dataPrevista > agora);
  const ciclosSelecionaveis = cicloEmAndamento ? [...ciclosVencidosContaveis, cicloEmAndamento] : ciclosVencidosContaveis;
  const semanaEscolhida = filtros.semana
    ? Number(filtros.semana)
    : (cicloEmAndamento ?? ciclosVencidosContaveis.at(-1))?.numeroCiclo;
  const cicloDaSemana = ciclosSelecionaveis.find((c) => c.numeroCiclo === semanaEscolhida);
  const numeroRelatorioDaSemana =
    cicloDaSemana && indiceRelatorioDoCiclo(turma.ciclos, cicloDaSemana.numeroCiclo);
  const pendentesDaSemana =
    cicloDaSemana && numeroRelatorioDaSemana !== undefined
      ? statuses.filter(
          (s) => !s.aluno.relatorios.some((r) => r.numeroRelatorio === numeroRelatorioDaSemana && r.relatorioEntregue)
        )
      : [];

  // Quem faltou à reunião quinzenal COM O PROFESSOR DA DISCIPLINA (presencaReuniaoDisciplina) no
  // ciclo escolhido — diferente de "relatório não entregue" (uma coisa pode faltar sem a outra).
  // Só dá pra escolher entre ciclos já vencidos (reunião é um evento pontual que já aconteceu ou
  // não, ao contrário do relatório, que ainda pode ser entregue dentro do prazo em andamento).
  // Por padrão mostra o último ciclo vencido, mas dá pra escolher outro pelo seletor, igual ao
  // painel de relatórios pendentes.
  const semanaReuniaoEscolhida = filtros.semanaReuniao
    ? Number(filtros.semanaReuniao)
    : ciclosVencidosContaveis.at(-1)?.numeroCiclo;
  const cicloReuniaoEscolhido = ciclosVencidosContaveis.find((c) => c.numeroCiclo === semanaReuniaoEscolhida);
  const faltaramReuniao = cicloReuniaoEscolhido
    ? statuses.filter((s) => {
        const detalhe = s.detalhePorCiclo.find((d) => d.numeroCiclo === cicloReuniaoEscolhido.numeroCiclo);
        return detalhe?.reuniaoPrevista && detalhe.foiAReuniao === false;
      })
    : [];

  const precisamIntervencaoOrientador = statuses.filter(
    (s) =>
      situacaoAtualDeAutores(s.aluno.observacoes, s.aluno.orientadorId ? [s.aluno.orientadorId] : [])?.situacao ===
      "INTERVENCAO"
  );
  const precisamIntervencaoDisciplina = statuses.filter(
    (s) => situacaoAtualDeAutores(s.aluno.observacoes, responsavelIds)?.situacao === "INTERVENCAO"
  );

  let visiveis = statuses;
  if (filtros.orientador) {
    visiveis = visiveis.filter((s) => s.aluno.orientadorId === filtros.orientador);
  }
  if (filtros.status) {
    visiveis = visiveis.filter((s) => s.status === filtros.status);
  }
  if (filtros.busca) {
    const buscaNormalizada = normalizeName(filtros.busca);
    visiveis = visiveis.filter((s) => normalizeName(s.aluno.nome).includes(buscaNormalizada));
  }

  const porOrientador = new Map<string, typeof visiveis>();
  for (const s of visiveis) {
    const key = s.aluno.orientadorId ?? "__sem_orientador__";
    if (!porOrientador.has(key)) porOrientador.set(key, []);
    porOrientador.get(key)!.push(s);
  }

  const visaoLista = filtros.visao !== "orientador";
  const emOrdemAlfabetica = [...visiveis].sort((a, b) => a.aluno.nome.localeCompare(b.aluno.nome));

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-baseline gap-3 flex-wrap">
            <h1 className="text-xl font-semibold">{turma.nome}</h1>
            <CarregadoEm />
          </div>
          <p className="text-sm text-zinc-500 mt-0.5">
            {turma.disciplina} · {turma.periodoLetivo}
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="inline-flex items-center rounded-full bg-zinc-100 text-zinc-700 px-2.5 py-1 text-xs font-medium">
              {gruposResponsavel ? `${statuses.length} de ${turma.alunos.length} aluno(s)` : `${turma.alunos.length} aluno(s)`}
            </span>
            <span className="inline-flex items-center rounded-full bg-zinc-100 text-zinc-700 px-2.5 py-1 text-xs font-medium">
              {orientadores.length} pessoa(s) orientadora(s)
            </span>
          </div>
          <RestricaoGrupoAviso
            gruposResponsavel={gruposResponsavel}
            restricaoConfigurada={restricaoConfigurada}
            verTodos={verTodos}
            hrefVerTodos={`/turmas/${turma.id}${buildQuery({ ...filtros, todos: "1" })}`}
            hrefVoltar={`/turmas/${turma.id}${buildQuery({ ...filtros, todos: undefined })}`}
          />
        </div>
        <div className="flex gap-2 flex-wrap text-sm">
          <Link href={`/turmas/${turma.id}/uploads`} className="rounded border border-orange-300 text-orange-700 px-3 py-1.5 hover:bg-orange-50">
            Uploads
          </Link>
          <Link href={`/turmas/${turma.id}/reunioes`} className="rounded border border-orange-300 text-orange-700 px-3 py-1.5 hover:bg-orange-50">
            Reuniões
          </Link>
          <MenuDropdown
            label="Visualizações"
            itens={[
              { href: `/turmas/${turma.id}/orientadores`, label: "Visão por pessoa orientadora" },
              { href: `/turmas/${turma.id}/faltas-por-dia`, label: "Faltas por dia" },
              { href: `/turmas/${turma.id}/exportar`, label: "Relatórios" },
            ]}
          />
          <MenuDropdown
            label="Configurações"
            itens={[
              { href: `/turmas/${turma.id}/calendario`, label: "Calendário" },
              { href: `/turmas/${turma.id}/config`, label: "Configurações da turma" },
              { href: `/turmas/${turma.id}/saude-dados`, label: "Saúde dos dados" },
            ]}
          />
        </div>
      </div>

      {/* Painel de alertas */}
      <section className="rounded border bg-white p-4">
        <h2 className="font-medium mb-3">Painel de alertas</h2>
        {semOrientador.length === 0 &&
        vermelhos.length === 0 &&
        impedimentosAbertos.length === 0 &&
        precisamIntervencaoOrientador.length === 0 &&
        precisamIntervencaoDisciplina.length === 0 ? (
          <p className="text-sm text-zinc-500">Nenhum alerta no momento.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <AlertaBox
              titulo="Sem pessoa orientadora"
              itens={semOrientador.map((s) => ({ id: s.aluno.id, texto: s.aluno.nome }))}
            />
            <AlertaBox
              titulo="Em vermelho"
              itens={vermelhos.map((s) => ({ id: s.aluno.id, texto: s.aluno.nome, sub: s.motivos.join("; ") }))}
              acao="alerta"
            />
            <AlertaBox
              titulo="Impedimento sem resposta"
              itens={impedimentosAbertos.map((s) => ({ id: s.aluno.id, texto: s.aluno.nome }))}
              acao="alerta"
            />
            <AlertaBox
              titulo="Precisa de intervenção (orientador)"
              itens={precisamIntervencaoOrientador.map((s) => ({ id: s.aluno.id, texto: s.aluno.nome }))}
              acao="alerta"
            />
            <AlertaBox
              titulo="Precisa de intervenção (disciplina)"
              itens={precisamIntervencaoDisciplina.map((s) => ({ id: s.aluno.id, texto: s.aluno.nome }))}
              acao="alerta"
            />
          </div>
        )}
      </section>

      {/* Faltas em reunião do ciclo escolhido */}
      <section className="rounded border bg-white p-4">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <h2 className="font-medium">Faltou à reunião</h2>
          <form className="flex items-center gap-2 text-sm">
            <label className="text-zinc-600">Ciclo:</label>
            <select name="semanaReuniao" defaultValue={semanaReuniaoEscolhida ?? ""} className="rounded border px-2 py-1.5">
              {ciclosVencidosContaveis.map((c) => (
                <option key={c.numeroCiclo} value={c.numeroCiclo}>
                  Ciclo {c.numeroCiclo} — {formatDiaCalendario(c.dataPrevista)}
                </option>
              ))}
            </select>
            {filtros.semana && <input type="hidden" name="semana" value={filtros.semana} />}
            {filtros.orientador && <input type="hidden" name="orientador" value={filtros.orientador} />}
            {filtros.status && <input type="hidden" name="status" value={filtros.status} />}
            {filtros.busca && <input type="hidden" name="busca" value={filtros.busca} />}
            {filtros.visao && <input type="hidden" name="visao" value={filtros.visao} />}
            {filtros.todos && <input type="hidden" name="todos" value={filtros.todos} />}
            <button className="rounded border border-orange-300 text-orange-700 px-3 py-1.5 hover:bg-orange-50">Ver</button>
          </form>
        </div>
        {!cicloReuniaoEscolhido ? (
          <p className="text-sm text-zinc-400">Nenhum ciclo já vencido ainda.</p>
        ) : faltaramReuniao.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Ninguém faltou à reunião do Ciclo {cicloReuniaoEscolhido.numeroCiclo} (entre quem tinha reunião prevista).
          </p>
        ) : (
          <details>
            <summary className="text-sm font-medium text-zinc-600 cursor-pointer select-none">
              Ver {faltaramReuniao.length} aluno(s) que faltaram
            </summary>
            <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3 mt-3">
              {faltaramReuniao.map((s) => (
                <li key={s.aluno.id} className="text-sm flex items-center justify-between gap-2">
                  <Link href={`/alunos/${s.aluno.id}`} className="hover:underline">
                    {s.aluno.nome}
                  </Link>
                  <Link href={`/alunos/${s.aluno.id}/alerta-email`} className="text-xs text-orange-700 underline shrink-0">
                    avisar
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {/* Relatórios pendentes da semana escolhida */}
      <section className="rounded border bg-white p-4">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <h2 className="font-medium">Relatórios pendentes da semana</h2>
          <form className="flex items-center gap-2 text-sm">
            <label className="text-zinc-600">Semana:</label>
            <select name="semana" defaultValue={semanaEscolhida ?? ""} className="rounded border px-2 py-1.5">
              {ciclosSelecionaveis.map((c) => (
                <option key={c.numeroCiclo} value={c.numeroCiclo}>
                  Ciclo {c.numeroCiclo} — {formatDiaCalendario(c.dataPrevista)}
                  {c.numeroCiclo === cicloEmAndamento?.numeroCiclo ? " (em andamento)" : ""}
                </option>
              ))}
            </select>
            {filtros.orientador && <input type="hidden" name="orientador" value={filtros.orientador} />}
            {filtros.status && <input type="hidden" name="status" value={filtros.status} />}
            {filtros.busca && <input type="hidden" name="busca" value={filtros.busca} />}
            {filtros.visao && <input type="hidden" name="visao" value={filtros.visao} />}
            {filtros.todos && <input type="hidden" name="todos" value={filtros.todos} />}
            <button className="rounded border border-orange-300 text-orange-700 px-3 py-1.5 hover:bg-orange-50">Ver</button>
          </form>
        </div>
        {!cicloDaSemana ? (
          <p className="text-sm text-zinc-400">Nenhum ciclo com relatório aberto ainda.</p>
        ) : (
          <p className="text-xs text-zinc-400 mb-2">
            {cicloDaSemana.numeroCiclo === cicloEmAndamento?.numeroCiclo
              ? `Prazo até ${formatDiaCalendario(cicloDaSemana.dataPrevista)} (ainda não venceu) — quem já entregou não aparece na lista.`
              : `Venceu em ${formatDiaCalendario(cicloDaSemana.dataPrevista)}.`}
          </p>
        )}
        {cicloDaSemana && pendentesDaSemana.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Todo mundo já entregou o relatório do Ciclo {cicloDaSemana.numeroCiclo}.
          </p>
        ) : cicloDaSemana ? (
          <details>
            <summary className="text-sm font-medium text-zinc-600 cursor-pointer select-none">
              Ver {pendentesDaSemana.length} pendente(s) e selecionar quem avisar
            </summary>
            <div className="mt-3">
              <SelecaoPendentesForm
                turmaId={turma.id}
                semana={cicloDaSemana.numeroCiclo}
                alunos={pendentesDaSemana.map((s) => ({
                  id: s.aluno.id,
                  nome: s.aluno.nome,
                  orientadorNome: s.aluno.orientador?.nome ?? "sem orientador",
                }))}
              />
            </div>
          </details>
        ) : null}
      </section>

      {/* Filtros */}
      <form className="flex gap-3 items-end flex-wrap text-sm">
        <div className="min-w-0 max-w-full">
          <label className="block text-zinc-600 mb-1">Buscar aluno</label>
          <input
            name="busca"
            defaultValue={filtros.busca ?? ""}
            placeholder="nome do aluno"
            list="alunos-datalist"
            autoComplete="off"
            className="rounded border px-2 py-1.5 max-w-full"
          />
          <datalist id="alunos-datalist">
            {statuses.map((s) => (
              <option key={s.aluno.id} value={s.aluno.nome} />
            ))}
          </datalist>
        </div>
        <div className="min-w-0 max-w-full">
          <label className="block text-zinc-600 mb-1">Pessoa orientadora</label>
          <OrientadorBusca
            orientadores={orientadores.filter((o): o is NonNullable<typeof o> => !!o).map((o) => ({ id: o.id, nome: o.nome }))}
            orientadorIdInicial={filtros.orientador ?? ""}
          />
        </div>
        <div>
          <label className="block text-zinc-600 mb-1">Status</label>
          <select name="status" defaultValue={filtros.status ?? ""} className="rounded border px-2 py-1.5">
            <option value="">Todos</option>
            <option value="vermelho">Vermelho</option>
            <option value="amarelo">Amarelo</option>
            <option value="verde">Verde</option>
            <option value="impedimento">Impedimento</option>
          </select>
        </div>
        {filtros.visao && <input type="hidden" name="visao" value={filtros.visao} />}
        {filtros.todos && <input type="hidden" name="todos" value={filtros.todos} />}
        <button className="rounded border border-orange-300 text-orange-700 px-3 py-1.5 hover:bg-orange-50">Filtrar</button>
        {(filtros.orientador || filtros.status || filtros.busca) && (
          <Link
            href={`/turmas/${turma.id}${buildQuery({ visao: filtros.visao, todos: filtros.todos })}`}
            className="text-zinc-500 underline"
          >
            limpar
          </Link>
        )}
      </form>

      {/* Alterna entre a visão agrupada por pessoa orientadora e uma lista única alfabética */}
      <div className="flex gap-2 text-sm">
        <Link
          href={`/turmas/${turma.id}${buildQuery({ ...filtros, visao: undefined })}`}
          className={`rounded border px-3 py-1.5 ${visaoLista ? "bg-orange-600 text-white border-orange-600" : "border-orange-300 text-orange-700 hover:bg-orange-50"}`}
        >
          Lista alfabética
        </Link>
        <Link
          href={`/turmas/${turma.id}${buildQuery({ ...filtros, visao: "orientador" })}`}
          className={`rounded border px-3 py-1.5 ${!visaoLista ? "bg-orange-600 text-white border-orange-600" : "border-orange-300 text-orange-700 hover:bg-orange-50"}`}
        >
          Por pessoa orientadora
        </Link>
      </div>

      {visaoLista ? (
        <section className="rounded border bg-white overflow-hidden">
          <AlunoStatusTable
            statuses={emOrdemAlfabetica}
            limiteFaltas={turma.limiteFaltas}
            mostrarOrientador
            responsavelIds={responsavelIds}
          />
        </section>
      ) : (
        <section className="space-y-6">
          {[...porOrientador.entries()].map(([orientadorId, alunos]) => {
            const orientador =
              orientadorId === "__sem_orientador__"
                ? null
                : orientadores.find((o) => o?.id === orientadorId) ?? alunos[0].aluno.orientador;
            return (
              <div key={orientadorId} className="rounded border bg-white overflow-hidden">
                <div className="px-4 py-2 bg-zinc-100 font-medium text-sm">
                  {orientador ? orientador.nome : "Sem pessoa orientadora alocada"} — {alunos.length} aluno(s)
                </div>
                <AlunoStatusTable
                  statuses={alunos}
                  limiteFaltas={turma.limiteFaltas}
                  mostrarOrientador={false}
                  responsavelIds={responsavelIds}
                />
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}

function buildQuery(filtros: {
  orientador?: string;
  status?: string;
  visao?: string;
  todos?: string;
  busca?: string;
}): string {
  const params = new URLSearchParams();
  if (filtros.orientador) params.set("orientador", filtros.orientador);
  if (filtros.status) params.set("status", filtros.status);
  if (filtros.visao) params.set("visao", filtros.visao);
  if (filtros.todos) params.set("todos", filtros.todos);
  if (filtros.busca) params.set("busca", filtros.busca);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

function AlertaBox({
  titulo,
  itens,
  acao,
}: {
  titulo: string;
  itens: { id: string; texto: string; sub?: string }[];
  acao?: "alerta";
}) {
  return (
    <details>
      <summary className="text-xs font-medium text-zinc-500 uppercase mb-1 cursor-pointer select-none">
        {titulo} ({itens.length})
      </summary>
      {itens.length === 0 ? (
        <p className="text-sm text-zinc-400 mt-1">—</p>
      ) : (
        <ul className="space-y-1 mt-1">
          {itens.map((item) => (
            <li key={item.id} className="text-sm flex items-center justify-between gap-2">
              <Link href={`/alunos/${item.id}`} className="hover:underline">
                {item.texto}
              </Link>
              {acao === "alerta" && (
                <Link href={`/alunos/${item.id}/alerta-email`} className="text-xs text-orange-700 underline shrink-0">
                  avisar
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
