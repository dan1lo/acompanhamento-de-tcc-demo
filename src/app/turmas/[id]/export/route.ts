import { NextResponse } from "next/server";
import { getTurmaCompleta, statusesPorTurma } from "@/lib/turmaData";
import { requireTurmaResponsavel, getGruposResponsavel } from "@/lib/authz";

function csvEscape(value: string): string {
  if (/[";\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

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

  const header = [
    "Aluno",
    "Pessoa orientadora",
    "Status",
    "Relatórios não entregues",
    "Ciclos considerados",
    "Faltas em reuniões",
    "Falta total",
    "Limite de faltas",
    "Faltas consecutivas",
    "Último envio",
    "Impedimento aberto",
  ];

  const linhas = statuses.map((s) => [
    s.aluno.nome,
    s.aluno.orientador?.nome ?? "",
    s.status,
    String(s.relatoriosNaoEntregues),
    String(s.ciclosConsiderados),
    String(s.faltasReuniao),
    String(s.totalFaltas),
    String(turma.limiteFaltas),
    String(s.faltasConsecutivas),
    s.ultimoEnvio ? new Date(s.ultimoEnvio).toLocaleDateString("pt-BR") : "",
    s.impedimentoAberto ? "Sim" : "Não",
  ]);

  const csv = [header, ...linhas].map((row) => row.map((v) => csvEscape(String(v))).join(";")).join("\n");
  const bom = "﻿"; // Excel abre corretamente acentos com BOM.

  return new NextResponse(bom + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="relatorio-${turma.nome.replace(/\s+/g, "-")}.csv"`,
    },
  });
}
