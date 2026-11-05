/**
 * Script único de verificação: importa as duas planilhas REAIS do Danilo (em ~/Downloads) para
 * uma turma já criada no protótipo, replicando a mesma lógica de upsert das server actions
 * (uploadRoster/uploadRelatorios em src/app/turmas/[id]/actions.ts), só que sem depender do
 * contexto de request do Next (cookies/sessão) — por isso não é o caminho de produção, é só
 * para provar que os parsers batem com os arquivos reais antes de testar a UI de upload no
 * navegador.
 *
 * Uso: npx tsx scripts/import-real-files.ts <turmaId>
 */
import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { parseRosterXlsx } from "../src/lib/parseRoster";
import { parseRelatoriosXlsx } from "../src/lib/parseRelatorios";

const ROSTER_PATH = "/Users/dmr/Downloads/Acompanhamento - Pré-Projeto de TCC - 2026.2.xlsx";
const RESPOSTAS_PATH = "/Users/dmr/Downloads/CESAR School - Acompanhamento de TCC 2026.2 (respostas).xlsx";

const prisma = new PrismaClient();

async function main() {
  const turmaId = process.argv[2];
  if (!turmaId) {
    console.error("Uso: npx tsx scripts/import-real-files.ts <turmaId>");
    process.exit(1);
  }

  const turma = await prisma.turma.findUnique({ where: { id: turmaId } });
  if (!turma) {
    console.error("Turma não encontrada:", turmaId);
    process.exit(1);
  }

  // --- Roster (RF2.2/RF2.3/RF2.4) ---
  const rosterBuffer = await readFile(ROSTER_PATH);
  const roster = await parseRosterXlsx(rosterBuffer);
  console.log(`\n[roster] ${roster.rows.length} linha(s) lida(s), ${roster.ignoradas} ignorada(s).`);

  let criados = 0;
  let atualizados = 0;
  const orientadoresCriados: string[] = [];
  const semOrientador: string[] = [];

  for (const row of roster.rows) {
    let orientadorId: string | null = null;
    if (row.orientadorNome) {
      let orientador = await prisma.professor.findFirst({ where: { nome: row.orientadorNome } });
      if (!orientador) {
        orientador = await prisma.professor.create({ data: { nome: row.orientadorNome } });
        orientadoresCriados.push(row.orientadorNome);
      }
      await prisma.turmaProfessor.upsert({
        where: { turmaId_professorId_papel: { turmaId, professorId: orientador.id, papel: "ORIENTADOR" } },
        create: { turmaId, professorId: orientador.id, papel: "ORIENTADOR" },
        update: {},
      });
      orientadorId = orientador.id;
    } else {
      semOrientador.push(row.nome);
    }

    const existente = await prisma.aluno.findFirst({ where: { turmaId, nomeNormalizado: row.nomeNormalizado } });
    if (existente) {
      await prisma.aluno.update({
        where: { id: existente.id },
        data: {
          nome: row.nome,
          email: row.email ?? existente.email,
          tituloTcc: row.tituloTcc ?? existente.tituloTcc,
          orientadorId: orientadorId ?? existente.orientadorId,
        },
      });
      atualizados += 1;
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
      criados += 1;
    }
  }

  console.log(`[roster] criados=${criados} atualizados=${atualizados}`);
  console.log(`[roster] orientadores novos criados automaticamente (${orientadoresCriados.length}):`, orientadoresCriados);
  console.log(`[roster] alunos sem orientador na planilha (${semOrientador.length}):`, semOrientador.slice(0, 10));

  // --- Relatórios semanais (RF3.1/RF3.2/RF3.4/RF3.5) ---
  const respostasBuffer = await readFile(RESPOSTAS_PATH);
  const relatorios = await parseRelatoriosXlsx(respostasBuffer);
  console.log(`\n[relatorios] ${relatorios.rows.length} linha(s) lida(s), ${relatorios.ignoradas} ignorada(s).`);

  const alunos = await prisma.aluno.findMany({ where: { turmaId } });
  const porNome = new Map(alunos.map((a) => [a.nomeNormalizado, a]));

  let processados = 0;
  const semCorrespondencia: string[] = [];

  for (const row of relatorios.rows) {
    const aluno = porNome.get(row.alunoNomeNormalizado);
    if (!aluno || row.numeroRelatorio === null) {
      semCorrespondencia.push(row.alunoNome);
      continue;
    }
    await prisma.relatorioSemanal.upsert({
      where: { alunoId_numeroRelatorio: { alunoId: aluno.id, numeroRelatorio: row.numeroRelatorio } },
      create: {
        alunoId: aluno.id,
        numeroRelatorio: row.numeroRelatorio,
        timestampEnvio: row.timestampEnvio,
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
    processados += 1;
  }

  console.log(`[relatorios] processados=${processados}`);
  console.log(`[relatorios] sem correspondência (${semCorrespondencia.length}):`, semCorrespondencia.slice(0, 10));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
