/**
 * Gera uma CÓPIA do banco com nomes, e-mails, títulos de TCC e textos livres trocados por dados
 * fictícios — pra poder subir num ambiente de teste (ex.: Netlify) sem expor dado real de aluno,
 * em conformidade com a LGPD. A base real local (prisma/data/tcc.db) NUNCA é tocada: o script
 * trabalha numa cópia à parte (prisma/data/tcc-demo.db).
 *
 * O que muda: nome/e-mail de Professor, Coordenador e Aluno; título de TCC; texto livre de
 * relatório (o que fez / o que pretende / impedimento) e de observação; link de cronograma;
 * senha de todo mundo vira uma senha de demonstração única e conhecida.
 *
 * O que NÃO muda (não é dado pessoal, e preservar mantém o comportamento do sistema realista pra
 * quem for testar): datas, números de relatório, status de entrega/presença, faltas, notas,
 * estrutura de turma/ciclo/grupo.
 *
 * Uso: npx tsx scripts/gerar-dados-demo.ts
 */
import { PrismaClient } from "@prisma/client";
import { hashSenha } from "../src/lib/senha";
import { normalizeName } from "../src/lib/normalize";
import fs from "fs";
import path from "path";

const ORIGEM = path.join(__dirname, "..", "prisma", "data", "tcc.db");
const DESTINO = path.join(__dirname, "..", "prisma", "data", "tcc-demo.db");
const SENHA_DEMO = "demo2026";

const PRIMEIROS_NOMES = [
  "Ana", "Bruno", "Carla", "Diego", "Elisa", "Fábio", "Gabriela", "Hugo", "Isabela", "João",
  "Karina", "Lucas", "Marina", "Nelson", "Olívia", "Pedro", "Quésia", "Rafael", "Sabrina", "Tiago",
  "Úrsula", "Vinícius", "Wesley", "Yasmin", "Zélia", "André", "Beatriz", "Caio", "Débora", "Eduardo",
  "Fernanda", "Gustavo", "Helena", "Igor", "Juliana", "Kléber", "Larissa", "Marcelo", "Natália", "Otávio",
  "Paula", "Rodrigo", "Simone", "Thiago", "Valéria", "William", "Ximena", "Yago", "Zeca", "Alice",
];
const SOBRENOMES = [
  "Albuquerque", "Barros", "Cavalcanti", "Duarte", "Esteves", "Ferreira", "Gouveia", "Holanda",
  "Inácio", "Junqueira", "Klein", "Lacerda", "Medeiros", "Nascimento", "Oliveira", "Pimentel",
  "Queiroz", "Ribeiro", "Siqueira", "Tavares", "Uchôa", "Vasconcelos", "Wanderley", "Ximenes",
  "Zambrano", "Andrade", "Bezerra", "Carvalho", "Diniz", "Espíndola",
];

const TEMAS_TCC = [
  "Aplicação de aprendizado de máquina em diagnóstico por imagem",
  "Sistema de recomendação para plataformas de e-commerce",
  "Análise de sentimentos em redes sociais com processamento de linguagem natural",
  "Otimização de rotas logísticas com algoritmos genéticos",
  "Framework de testes automatizados para aplicações móveis",
  "Detecção de anomalias em redes com aprendizado não supervisionado",
  "Plataforma de gestão para pequenos negócios",
  "Visualização de dados para indicadores de saúde pública",
  "Arquitetura de microsserviços para sistemas de alta disponibilidade",
  "Jogo educacional para ensino de lógica de programação",
  "Chatbot de atendimento com processamento de linguagem natural",
  "Sistema de reconhecimento facial para controle de acesso",
  "Aplicativo de acessibilidade para pessoas com deficiência visual",
  "Modelo preditivo de evasão escolar",
  "Automação de processos com RPA em ambiente corporativo",
];

const O_QUE_FEZ = [
  "Revisei a literatura relacionada ao tema e ajustei o escopo do trabalho.",
  "Avancei na implementação do módulo principal e corrigi alguns bugs encontrados.",
  "Me reuni com a pessoa orientadora e redefinimos as próximas prioridades.",
  "Escrevi a seção de metodologia e organizei os próximos experimentos.",
  "Finalizei a coleta de dados e iniciei a etapa de análise.",
  "Fiz ajustes no cronograma e retomei o desenvolvimento do protótipo.",
  "Testei a solução com um conjunto reduzido de dados e documentei os resultados.",
  "Participei de uma reunião de alinhamento e atualizei a documentação do projeto.",
];
const O_QUE_PRETENDE = [
  "Continuar o desenvolvimento do protótipo e marcar uma nova reunião de acompanhamento.",
  "Finalizar a escrita do capítulo atual e avançar pros testes.",
  "Revisar os resultados obtidos até aqui com a pessoa orientadora.",
  "Ajustar o cronograma e iniciar a próxima etapa prevista.",
  "Resolver os pontos pendentes levantados na última reunião.",
  "Consolidar a análise dos dados coletados essa semana.",
];
const IMPEDIMENTOS = [
  "Aguardando retorno da pessoa orientadora pra seguir com a próxima etapa.",
  "Tive um imprevisto pessoal essa semana e não consegui avançar como planejado.",
  "Dependência de acesso a uma ferramenta/base de dados externa ainda em andamento.",
];
const OBSERVACOES = [
  "Conversamos sobre o andamento do projeto; segue dentro do esperado.",
  "Reunião realizada conforme previsto, sem pontos de atenção.",
  "Combinamos ajustes no cronograma pras próximas semanas.",
  "Aluno(a) relatou dificuldade pontual, já encaminhada.",
];

function escolha<T>(lista: T[], seed: number): T {
  return lista[seed % lista.length];
}

function gerarNomeFalso(seed: number): string {
  const primeiro = escolha(PRIMEIROS_NOMES, seed);
  const sobrenome1 = escolha(SOBRENOMES, seed * 7 + 3);
  const sobrenome2 = escolha(SOBRENOMES, seed * 13 + 11);
  return sobrenome1 === sobrenome2 ? `${primeiro} ${sobrenome1}` : `${primeiro} ${sobrenome1} ${sobrenome2}`;
}

function emailFalso(nome: string, dominio: string, seed: number): string {
  const slug = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(" ")
    .join(".");
  return `${slug}.${seed}@${dominio}`;
}

async function main() {
  if (!fs.existsSync(ORIGEM)) {
    console.error("Banco real não encontrado em", ORIGEM);
    process.exit(1);
  }

  fs.copyFileSync(ORIGEM, DESTINO);
  // Sidecars de WAL/SHM, se existirem, não devem ir junto — a cópia abre como um banco fechado.
  for (const sufixo of ["-wal", "-shm"]) {
    const sidecar = DESTINO + sufixo;
    if (fs.existsSync(sidecar)) fs.unlinkSync(sidecar);
  }
  console.log("Cópia criada em", DESTINO);

  const prisma = new PrismaClient({ datasources: { db: { url: `file:${DESTINO}` } } });
  const senhaHashDemo = await hashSenha(SENHA_DEMO);

  try {
    const professores = await prisma.professor.findMany();
    let seed = 0;
    for (const p of professores) {
      seed++;
      const nomeFalso = gerarNomeFalso(seed);
      await prisma.professor.update({
        where: { id: p.id },
        data: {
          nome: nomeFalso,
          email: p.email ? emailFalso(nomeFalso, "exemplo-demo.com", seed) : null,
          senhaHash: senhaHashDemo,
        },
      });
    }
    console.log(`Professores anonimizados: ${professores.length}`);

    const coordenadores = await prisma.coordenador.findMany();
    for (const c of coordenadores) {
      seed++;
      const nomeFalso = gerarNomeFalso(seed);
      await prisma.coordenador.update({
        where: { id: c.id },
        data: {
          nome: nomeFalso,
          email: emailFalso(nomeFalso, "exemplo-demo.com", seed),
          senhaHash: senhaHashDemo,
        },
      });
    }
    console.log(`Coordenadores anonimizados: ${coordenadores.length}`);

    const alunos = await prisma.aluno.findMany();
    for (const a of alunos) {
      seed++;
      const nomeFalso = gerarNomeFalso(seed);
      await prisma.aluno.update({
        where: { id: a.id },
        data: {
          nome: nomeFalso,
          nomeNormalizado: normalizeName(nomeFalso),
          email: a.email ? emailFalso(nomeFalso, "aluno-demo.com", seed) : null,
          tituloTcc: a.tituloTcc ? escolha(TEMAS_TCC, seed) : null,
        },
      });
    }
    console.log(`Alunos anonimizados: ${alunos.length}`);

    const relatorios = await prisma.relatorioSemanal.findMany();
    for (const r of relatorios) {
      seed++;
      await prisma.relatorioSemanal.update({
        where: { id: r.id },
        data: {
          oQueFez: r.oQueFez ? escolha(O_QUE_FEZ, seed) : null,
          oQuePretende: r.oQuePretende ? escolha(O_QUE_PRETENDE, seed + 1) : null,
          impedimentoDesc: r.impedimentoDesc ? escolha(IMPEDIMENTOS, seed + 2) : null,
          linkCronograma: r.linkCronograma ? "https://exemplo-demo.com/cronograma" : null,
          orientadorDeclarado: null,
        },
      });
    }
    console.log(`Relatórios anonimizados: ${relatorios.length}`);

    const observacoes = await prisma.observacao.findMany();
    for (const o of observacoes) {
      seed++;
      await prisma.observacao.update({
        where: { id: o.id },
        data: { texto: escolha(OBSERVACOES, seed) },
      });
    }
    console.log(`Observações anonimizadas: ${observacoes.length}`);

    console.log("\nPronto. Banco de demonstração em:", DESTINO);
    console.log(`Senha de todas as contas: "${SENHA_DEMO}"`);
  } finally {
    await prisma.$disconnect();
  }
}

main();
