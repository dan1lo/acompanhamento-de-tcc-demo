import { NextResponse } from "next/server";
import { getTurmaCompleta, statusesPorTurma } from "@/lib/turmaData";
import { requireTurmaResponsavel, getGruposResponsavel } from "@/lib/authz";
import { formatDiaCalendario } from "@/lib/format";
import { SITUACAO_LABEL } from "@/lib/situacao";

function csvEscape(value: string): string {
  if (/[";\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/**
 * Relatório detalhado por ciclo: presença, entrega e o que o aluno reportou (o que fez / o que
 * pretende fazer) ciclo a ciclo — mesma fonte de verdade que a ficha do aluno,
 * `detalhePorCiclo`, então nunca herda de outro ciclo — mais os comentários (observações)
 * escritos pela própria pessoa que está exportando, não os de outros professores. Respeita a
 * mesma restrição por grupo do export resumido.
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

  const header = [
    "Aluno",
    "Grupo",
    "Pessoa orientadora",
    "Ciclo",
    "Data",
    "Reunião prevista",
    "Relatório entregue",
    "Compareceu à reunião",
    "Faltas no ciclo",
    "O que fez",
    "O que pretende fazer",
    "Comentário",
  ];

  const linhas: string[][] = [];

  for (const s of statuses) {
    const base = [s.aluno.nome, s.aluno.grupo ?? "", s.aluno.orientador?.nome ?? ""];

    for (const ciclo of s.detalhePorCiclo) {
      linhas.push([
        ...base,
        String(ciclo.numeroCiclo),
        formatDiaCalendario(ciclo.dataPrevista),
        ciclo.reuniaoPrevista ? "Sim" : "Não",
        ciclo.relatorioEntregue ? "Sim" : "Não",
        ciclo.foiAReuniao === null ? "" : ciclo.foiAReuniao ? "Sim" : "Não",
        String(ciclo.faltas),
        ciclo.oQueFez ?? "",
        ciclo.oQuePretende ?? "",
        "",
      ]);
    }

    const meusComentarios =
      session.kind === "professor"
        ? s.aluno.observacoes.filter((o) => o.professorId === session.id)
        : s.aluno.observacoes;

    for (const obs of [...meusComentarios].sort((a, b) => a.data.getTime() - b.data.getTime())) {
      const prefixo = obs.situacao ? `[${SITUACAO_LABEL[obs.situacao]}] ` : "";
      linhas.push([...base, "", formatDiaCalendario(obs.data), "", "", "", "", "", "", `${prefixo}${obs.texto}`]);
    }
  }

  const csv = [header, ...linhas].map((row) => row.map((v) => csvEscape(String(v))).join(";")).join("\n");
  const bom = "﻿"; // Excel abre corretamente acentos com BOM.

  return new NextResponse(bom + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="relatorio-detalhado-${turma.nome.replace(/\s+/g, "-")}.csv"`,
    },
  });
}
