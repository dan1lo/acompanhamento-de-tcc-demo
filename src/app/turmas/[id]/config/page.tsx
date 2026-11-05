import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTurmaResponsavel } from "@/lib/authz";
import { formatDiaCalendario } from "@/lib/format";
import { getGruposDisponiveis } from "@/lib/turmaData";
import { updateConfig, updateGruposResponsavel, updateDadosTurma, removerResponsavel, removerCoordenador, arquivarTurma } from "../configActions";
import AdicionarResponsavelForm from "./AdicionarResponsavelForm";
import AdicionarCoordenadorForm from "./AdicionarCoordenadorForm";
import LiberarNotasToggle from "./LiberarNotasToggle";
import FormularioComConfirmacao from "@/components/FormularioComConfirmacao";
import RestaurarBackupForm from "../backup/RestaurarBackupForm";
import ArquivarTurmaForm from "./ArquivarTurmaForm";

export default async function ConfigPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireTurmaResponsavel(id);
  const turma = await prisma.turma.findUnique({ where: { id }, include: { ciclos: { orderBy: { numeroCiclo: "asc" } } } });
  if (!turma) notFound();

  const coordenadores = await prisma.coordenador.findMany({ orderBy: { nome: "asc" } });
  const dadosAction = updateDadosTurma.bind(null, turma.id);
  const action = updateConfig.bind(null, turma.id);

  const coordenadoresVinculados = await prisma.turmaCoordenador.findMany({
    where: { turmaId: id },
    include: { coordenador: true },
  });

  const responsaveis = await prisma.turmaProfessor.findMany({
    where: { turmaId: id, papel: "RESPONSAVEL" },
    include: { professor: true },
  });
  const gruposDisponiveis = await getGruposDisponiveis(id);

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <Link href={`/turmas/${turma.id}`} className="text-sm text-zinc-500 hover:underline">
        ← voltar
      </Link>
      <h1 className="text-xl font-semibold">Configurações da turma</h1>
      <p className="text-sm text-zinc-500">
        Vermelho é reprovação de verdade: bateu o limite de faltas da disciplina. Amarelo é
        alerta, não reprovação — perto do limite, ou um padrão de faltas seguidas mesmo estando
        longe do limite ainda. Ajuste por turma, sem depender de mudança no sistema.
      </p>

      <div>
        <h2 className="text-lg font-medium">Dados da turma</h2>
      </div>
      <form action={dadosAction} className="space-y-4 border rounded p-4 bg-white">
        <div>
          <label className="block text-sm text-zinc-600 mb-1">Nome da turma</label>
          <input name="nome" required defaultValue={turma.nome} className="w-full rounded border px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm text-zinc-600 mb-1">Disciplina</label>
          <input name="disciplina" required defaultValue={turma.disciplina} className="w-full rounded border px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm text-zinc-600 mb-1">Período letivo</label>
          <input name="periodoLetivo" required defaultValue={turma.periodoLetivo} className="w-full rounded border px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm text-zinc-600 mb-1">Coordenador</label>
          <select name="coordenadorId" defaultValue={turma.coordenadorId ?? ""} className="w-full rounded border px-3 py-2 text-sm">
            <option value="">— nenhum —</option>
            {coordenadores.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
        <button className="rounded bg-orange-600 text-white px-4 py-2 text-sm hover:bg-orange-700">
          Salvar
        </button>
      </form>

      <div>
        <h2 className="text-lg font-medium">Limiares de faltas e nota</h2>
      </div>
      <form action={action} className="space-y-4 border rounded p-4 bg-white">
        <Field
          label="Limite de faltas da disciplina (vermelho = reprovado ao atingir)"
          name="limiteFaltas"
          type="number"
          defaultValue={turma.limiteFaltas}
        />
        <Field
          label="Faltas de folga antes do limite pra entrar em alerta (amarelo)"
          name="bufferAmarelo"
          type="number"
          defaultValue={turma.bufferAmarelo}
        />
        <Field
          label="Nº de ciclos seguidos com falta pra entrar em alerta (amarelo)"
          name="faltasConsecutivasAlerta"
          type="number"
          defaultValue={turma.faltasConsecutivasAlerta}
        />
        <Field
          label="Peso da nota da pessoa orientadora (resto vai para a nota automática de presença)"
          name="pesoNotaAutomatica"
          type="number"
          defaultValue={Math.round(turma.pesoNotaAutomatica * 100)}
          suffix="%"
        />
        <div>
          <label className="block text-sm text-zinc-600 mb-1">
            Último ciclo que conta pra nota automática da SR1
          </label>
          <select name="cicloCorteSR1" defaultValue={turma.cicloCorteSR1 ?? ""} className="w-full rounded border px-3 py-2 text-sm">
            <option value="">— ainda não definido —</option>
            {turma.ciclos.map((c) => (
              <option key={c.id} value={c.numeroCiclo}>
                Ciclo {c.numeroCiclo} — {formatDiaCalendario(c.dataPrevista)}
              </option>
            ))}
          </select>
          <p className="text-xs text-zinc-400 mt-1">
            As faltas voltam a contar do zero a partir do ciclo seguinte, pra nota da SR2.
          </p>
        </div>
        <button className="rounded bg-orange-600 text-white px-4 py-2 text-sm hover:bg-orange-700">
          Salvar
        </button>
      </form>

      <div>
        <h2 className="text-lg font-medium">Liberação de notas</h2>
        <p className="text-sm text-zinc-500">
          Enquanto travado, a pessoa orientadora não consegue lançar nem editar a nota dela nesse
          período — só o responsável pela disciplina libera.
        </p>
      </div>
      <div className="border rounded bg-white p-4 space-y-2">
        <LiberarNotasToggle turmaId={turma.id} periodo="SR1" liberadoAtualmente={turma.notasSR1Liberadas} />
        <LiberarNotasToggle turmaId={turma.id} periodo="SR2" liberadoAtualmente={turma.notasSR2Liberadas} />
      </div>

      <div>
        <h2 className="text-lg font-medium">Pessoas responsáveis pela disciplina</h2>
        <p className="text-sm text-zinc-500">
          Quem vê o dashboard da turma inteira, faz upload, cria observações e reuniões — não é o
          mesmo que a pessoa orientadora de um aluno específico, que só enxerga os próprios
          orientandos.
        </p>
      </div>
      <div className="border rounded bg-white overflow-hidden">
        <ul className="divide-y">
          {responsaveis.map((v) => {
            const removerAction = removerResponsavel.bind(null, turma.id, v.id);
            return (
              <li key={v.id} className="flex items-center justify-between px-4 py-2 text-sm">
                <span>{v.professor.nome}</span>
                {responsaveis.length > 1 && (
                  <FormularioComConfirmacao
                    action={removerAction}
                    mensagem={`Remover ${v.professor.nome} como responsável dessa turma?`}
                  >
                    <button className="text-xs text-red-700 hover:underline">remover</button>
                  </FormularioComConfirmacao>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      <AdicionarResponsavelForm turmaId={turma.id} />

      <div>
        <h2 className="text-lg font-medium">Coordenação</h2>
        <p className="text-sm text-zinc-500">
          Pode ter mais de um coordenador acompanhando a mesma turma — além do coordenador
          principal escolhido em &quot;Dados da turma&quot;, todos aqui também têm acesso total, inclusive
          a impedimentos/observações escondidos da pessoa orientadora.
        </p>
      </div>
      {coordenadoresVinculados.length > 0 && (
        <div className="border rounded bg-white overflow-hidden">
          <ul className="divide-y">
            {coordenadoresVinculados.map((v) => {
              const removerAction = removerCoordenador.bind(null, turma.id, v.id);
              return (
                <li key={v.id} className="flex items-center justify-between px-4 py-2 text-sm">
                  <span>{v.coordenador.nome}</span>
                  <FormularioComConfirmacao
                    action={removerAction}
                    mensagem={`Remover ${v.coordenador.nome} da coordenação dessa turma?`}
                  >
                    <button className="text-xs text-red-700 hover:underline">remover</button>
                  </FormularioComConfirmacao>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <AdicionarCoordenadorForm turmaId={turma.id} />

      {gruposDisponiveis.length > 0 && responsaveis.length > 0 && (
        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-medium">Acesso por grupo (pessoas responsáveis)</h2>
            <p className="text-sm text-zinc-500">
              Restrinja o que cada pessoa responsável vê no dashboard da turma. Sem nenhum grupo
              marcado, ela vê todo mundo (comportamento padrão).
            </p>
          </div>
          {responsaveis.map((v) => {
            const atuais: string[] = v.gruposResponsavel ? JSON.parse(v.gruposResponsavel) : [];
            const acao = updateGruposResponsavel.bind(null, turma.id, v.id);
            return (
              <form key={v.id} action={acao} className="border rounded p-4 bg-white space-y-2">
                <p className="text-sm font-medium">{v.professor.nome}</p>
                <div className="flex flex-wrap gap-3">
                  {gruposDisponiveis.map((g) => (
                    <label key={g} className="inline-flex items-center gap-1.5 text-sm text-zinc-600">
                      <input type="checkbox" name="grupos" value={g} defaultChecked={atuais.includes(g)} />
                      {g}
                    </label>
                  ))}
                </div>
                <button className="rounded border border-orange-300 text-orange-700 px-3 py-1.5 text-sm hover:bg-orange-50">Salvar</button>
              </form>
            );
          })}
        </div>
      )}

      <div>
        <h2 className="text-lg font-medium">Backup</h2>
        <p className="text-sm text-zinc-500">
          O banco de dados é o sistema todo (todas as turmas, alunos, relatórios, observações
          etc.) — não é só desta turma.
        </p>
      </div>
      <a href={`/turmas/${turma.id}/backup`} className="inline-block rounded border border-orange-300 text-orange-700 px-4 py-2 text-sm hover:bg-orange-50">
        Baixar backup do banco
      </a>
      <RestaurarBackupForm turmaId={turma.id} />

      <div>
        <h2 className="text-lg font-medium">Arquivar</h2>
        <p className="text-sm text-zinc-500">
          Some da lista de quem é responsável ou orientador nessa turma — só a coordenação
          continua vendo, e só ela consegue restaurar. Não apaga nenhum dado.
        </p>
      </div>
      <ArquivarTurmaForm action={arquivarTurma.bind(null, turma.id)} />
    </div>
  );
}

function Field({
  label,
  name,
  type,
  defaultValue,
  suffix,
}: {
  label: string;
  name: string;
  type: string;
  defaultValue: number;
  suffix?: string;
}) {
  return (
    <div>
      <label className="block text-sm text-zinc-600 mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          name={name}
          type={type}
          step="any"
          defaultValue={defaultValue}
          required
          className="w-32 rounded border px-3 py-2 text-sm"
        />
        {suffix && <span className="text-sm text-zinc-500">{suffix}</span>}
      </div>
    </div>
  );
}
