import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTurmaResponsavel } from "@/lib/authz";
import { formatDiaCalendario } from "@/lib/format";
import { indiceDoCicloMap, parseGruposComReuniao } from "@/lib/ciclos";

export default async function ReunioesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireTurmaResponsavel(id);

  const turma = await prisma.turma.findUnique({
    where: { id },
    include: {
      ciclos: { orderBy: { numeroCiclo: "asc" } },
      alunos: { where: { ativo: true }, select: { grupo: true, relatorios: { select: { numeroRelatorio: true, presencaReuniaoDisciplina: true } } } },
    },
  });
  if (!turma) notFound();

  const turmaId = turma.id;
  const ciclos = turma.ciclos;
  const alunos = turma.alunos;

  const agora = new Date();
  const indiceDoCiclo = indiceDoCicloMap(ciclos);

  // "Anterior" = o último ciclo COM ENCONTRO que já venceu (a reunião mais recente que já
  // aconteceu); "atual" = o próximo ciclo COM ENCONTRO ainda não vencido (a que vem por aí) — são
  // os dois únicos que valem destacar. Precisa ignorar ciclo `semEncontro` nessa escolha — senão,
  // numa semana sem reunião pra ninguém (ex.: 09/10, entre os encontros de 02/10 e 16/10), o
  // destaque mostraria esse dia vazio como se fosse "a próxima reunião", só por ser o próximo na
  // data — quando na real reunião nenhuma acontece nele. O "anteriores"/"próximos" ao redor do
  // destaque, porém, usa a lista COMPLETA (com os `semEncontro`), pra não sumir nenhum ciclo dali.
  const ciclosComEncontro = ciclos.filter((c) => !c.semEncontro);
  let indiceAnteriorComEncontro = -1;
  for (let i = 0; i < ciclosComEncontro.length; i++) {
    if (ciclosComEncontro[i].dataPrevista <= agora) indiceAnteriorComEncontro = i;
  }
  const indiceAtualComEncontro = ciclosComEncontro.findIndex((c) => c.dataPrevista > agora);
  const cicloAnterior = indiceAnteriorComEncontro >= 0 ? ciclosComEncontro[indiceAnteriorComEncontro] : null;
  const cicloAtual = indiceAtualComEncontro >= 0 ? ciclosComEncontro[indiceAtualComEncontro] : null;

  const indiceAnterior = cicloAnterior ? ciclos.findIndex((c) => c.id === cicloAnterior.id) : -1;
  const indiceAtual = cicloAtual ? ciclos.findIndex((c) => c.id === cicloAtual.id) : -1;

  function progresso(ciclo: (typeof ciclos)[number]): { total: number; preenchidos: number } | null {
    if (ciclo.semEncontro) return null;
    const numeroRelatorio = indiceDoCiclo.get(ciclo.numeroCiclo);
    if (numeroRelatorio === undefined) return null;

    const grupos = parseGruposComReuniao(ciclo.gruposComReuniao);
    const todos = grupos.includes("TODOS");
    const alunosDoDia = todos ? alunos : alunos.filter((a) => a.grupo && grupos.includes(a.grupo));

    const preenchidos = alunosDoDia.filter((a) =>
      a.relatorios.some((r) => r.numeroRelatorio === numeroRelatorio && r.presencaReuniaoDisciplina !== null)
    ).length;

    return { total: alunosDoDia.length, preenchidos };
  }

  const anteriores = indiceAnterior > 0 ? ciclos.slice(0, indiceAnterior) : [];
  const destaque = [cicloAnterior, cicloAtual].filter((c): c is (typeof ciclos)[number] => c !== null);
  // Sem próximo ciclo com encontro (ex.: fim do período letivo) — o que sobra depois do destaque
  // ainda precisa aparecer em algum lugar, então cai pra depois do "anterior" em vez de sumir.
  const inicioProximos = indiceAtual >= 0 ? indiceAtual + 1 : indiceAnterior >= 0 ? indiceAnterior + 1 : 0;
  const proximos = ciclos.slice(inicioProximos);

  function ItemCiclo({ ciclo }: { ciclo: (typeof ciclos)[number] }) {
    const grupos = parseGruposComReuniao(ciclo.gruposComReuniao);
    const descricao = ciclo.semEncontro
      ? "Sem encontro"
      : grupos.includes("TODOS")
        ? "Todo mundo"
        : grupos.length > 0
          ? grupos.join(", ")
          : "—";
    const prog = progresso(ciclo);
    // "Última" é a reunião que JÁ aconteceu — é nela que sobra trabalho de registrar presença
    // logo depois, por isso ganha o destaque forte (laranja). "Próxima" ainda nem aconteceu, é só
    // um aviso do que vem — não tem nada pra fazer nela ainda, por isso fica discreta. Antes as
    // duas se chamavam "semana anterior"/"semana atual" e o destaque era o oposto (a que viria
    // por aí ficava laranja) — só que "atual" pra uma reunião que ainda nem ocorreu confundia, e
    // quem estava com trabalho pendente (a que já passou) não chamava atenção nenhuma.
    const ehProxima = cicloAtual?.id === ciclo.id;
    const ehUltima = cicloAnterior?.id === ciclo.id;

    return (
      <li key={ciclo.id}>
        <Link
          href={`/turmas/${turmaId}/reunioes/${ciclo.numeroCiclo}`}
          className={`flex items-center justify-between px-4 py-3 text-sm hover:bg-zinc-50 ${
            ehUltima ? "bg-orange-50" : ehProxima ? "bg-zinc-100" : ""
          }`}
        >
          <span>
            Ciclo {ciclo.numeroCiclo} — {formatDiaCalendario(ciclo.dataPrevista)}
            {ehUltima && <span className="ml-2 text-xs text-orange-700 font-medium">última reunião</span>}
            {ehProxima && <span className="ml-2 text-xs text-zinc-500 font-medium">próxima reunião</span>}
          </span>
          <span className="flex items-center gap-2">
            <span className="text-zinc-400">{descricao}</span>
            {prog && prog.total > 0 && (
              <span
                className={`text-xs rounded-full px-2 py-0.5 ${
                  prog.preenchidos === prog.total
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-amber-50 text-amber-800 border border-amber-200"
                }`}
              >
                {prog.preenchidos} de {prog.total}
              </span>
            )}
          </span>
        </Link>
      </li>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <Link href={`/turmas/${turmaId}`} className="text-sm text-zinc-500 hover:underline">
        ← voltar
      </Link>
      <div>
        <h1 className="text-xl font-semibold">Reuniões</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Escolha o dia pra abrir a lista de atendimento — os alunos daquele dia aparecem
          automaticamente, na ordem do horário da agenda.
        </p>
      </div>

      {ciclos.length === 0 && (
        <p className="text-sm text-zinc-400">
          Nenhum ciclo cadastrado ainda —{" "}
          <Link href={`/turmas/${turmaId}/upload-agenda`} className="underline">
            faça o upload da agenda
          </Link>{" "}
          primeiro.
        </p>
      )}

      {anteriores.length > 0 && (
        <details className="border rounded bg-white">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm text-zinc-500">
            Ciclos anteriores ({anteriores.length})
          </summary>
          <ul className="divide-y border-t">
            {anteriores.map((c) => (
              <ItemCiclo key={c.id} ciclo={c} />
            ))}
          </ul>
        </details>
      )}

      {destaque.length > 0 && (
        <ul className="divide-y border rounded bg-white">
          {destaque.map((c) => (
            <ItemCiclo key={c.id} ciclo={c} />
          ))}
        </ul>
      )}

      {proximos.length > 0 && (
        <details className="border rounded bg-white">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm text-zinc-500">
            Próximos ciclos ({proximos.length})
          </summary>
          <ul className="divide-y border-t">
            {proximos.map((c) => (
              <ItemCiclo key={c.id} ciclo={c} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
