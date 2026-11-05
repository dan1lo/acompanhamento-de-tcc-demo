import { NextResponse } from "next/server";
import { getTurmaCompleta, statusesPorTurma } from "@/lib/turmaData";
import { requireTurmaResponsavel, getGruposResponsavel } from "@/lib/authz";
import { formatDiaCalendario } from "@/lib/format";
import { montarPivotDeFaltas } from "@/lib/faltasPivot";

function csvEscape(value: string): string {
  if (/[";\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/**
 * Relatório de faltas em formato de planilha (uma coluna por dia/ciclo) — cada célula mostra o
 * que faltou naquele dia (entrega, reunião ou os dois) e a quantidade de faltas, em branco
 * quando o aluno não faltou. Mesmo pivô da tabela em tela (`turmas/[id]/faltas-por-dia`) — ver
 * `montarPivotDeFaltas`.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireTurmaResponsavel(id);
  const verTodos = new URL(req.url).searchParams.get("todos") === "1";
  const gruposResponsavel = verTodos ? null : await getGruposResponsavel(id, session);
  const turma = await getTurmaCompleta(id);
  if (!turma) return new NextResponse("Turma não encontrada", { status: 404 });

  const todasStatuses = statusesPorTurma(turma);
  const statuses = gruposResponsavel
    ? todasStatuses.filter((s) => s.aluno.grupo && gruposResponsavel.includes(s.aluno.grupo))
    : todasStatuses;

  const { dias, linhas: linhasPivot } = montarPivotDeFaltas(statuses);
  const header = ["Aluno", ...dias.map((d) => formatDiaCalendario(d.dataPrevista))];

  const linhas = linhasPivot.map((l) => [
    l.alunoNome,
    ...l.celulas.map((c) => (c.faltou ? `${c.motivo} (${c.faltas})` : "")),
  ]);

  const csv = [header, ...linhas].map((row) => row.map((v) => csvEscape(String(v))).join(";")).join("\n");
  const bom = "﻿"; // Excel abre corretamente acentos com BOM.

  return new NextResponse(bom + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="relatorio-faltas-${turma.nome.replace(/\s+/g, "-")}.csv"`,
    },
  });
}
