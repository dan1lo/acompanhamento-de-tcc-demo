import Link from "next/link";
import { requireProfessor } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { computeStatus } from "@/lib/semaforo";
import SemaforoBadge from "@/components/SemaforoBadge";

export default async function MeusAlunosPage() {
  const session = await requireProfessor();

  const alunos = await prisma.aluno.findMany({
    where: { orientadorId: session.id, turma: { arquivadaEm: null } },
    include: {
      turma: { include: { ciclos: true } },
      relatorios: true,
      observacoes: true,
    },
    orderBy: [{ turma: { nome: "asc" } }, { nome: "asc" }],
  });

  const porTurma = new Map<string, typeof alunos>();
  for (const a of alunos) {
    if (!porTurma.has(a.turmaId)) porTurma.set(a.turmaId, []);
    porTurma.get(a.turmaId)!.push(a);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Meus orientandos</h1>
        <p className="text-sm text-zinc-500">Agrega todas as turmas em que você orienta.</p>
      </div>

      {alunos.length === 0 && <p className="text-sm text-zinc-500">Nenhum orientando alocado a você ainda.</p>}

      {[...porTurma.entries()].map(([turmaId, seus]) => (
        <section key={turmaId} className="border rounded bg-white overflow-hidden">
          <div className="px-4 py-2 bg-zinc-100 font-medium text-sm flex items-center justify-between gap-2">
            {seus[0].turma.nome}
            <Link
              href={`/turmas/${turmaId}/orientadores/${session.id}/relatorio`}
              className="text-xs text-orange-600 hover:text-orange-700 underline font-normal"
            >
              gerar relatório PDF
            </Link>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-zinc-500 border-b">
              <tr>
                <th className="px-4 py-2">Aluno</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Relatórios não entregues</th>
                <th className="px-4 py-2">Faltas em reuniões</th>
                <th className="px-4 py-2">Falta total</th>
                <th className="px-4 py-2">Último envio</th>
                <th className="px-4 py-2">Impedimento</th>
              </tr>
            </thead>
            <tbody>
              {seus.map((aluno) => {
                const status = computeStatus(aluno, aluno.turma, aluno.turma.ciclos, aluno.relatorios, aluno.observacoes);
                return (
                  <tr key={aluno.id} className="border-b last:border-0">
                    <td className="px-4 py-2">
                      <Link href={`/alunos/${aluno.id}`} className="hover:underline">
                        {aluno.nome}
                      </Link>
                    </td>
                    <td className="px-4 py-2">
                      <SemaforoBadge status={status.status} />
                    </td>
                    <td className="px-4 py-2">
                      {status.relatoriosNaoEntregues} de {status.ciclosConsiderados}
                    </td>
                    <td className="px-4 py-2">{status.faltasReuniao}</td>
                    <td className="px-4 py-2 font-medium">
                      {status.totalFaltas} de {aluno.turma.limiteFaltas}
                    </td>
                    <td className="px-4 py-2 text-zinc-500">
                      {status.ultimoEnvio ? new Date(status.ultimoEnvio).toLocaleDateString("pt-BR") : "—"}
                    </td>
                    <td className="px-4 py-2">{status.impedimentoAberto ? "Sim" : "Não"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </section>
      ))}
    </div>
  );
}
