/**
 * Cria, na cópia de demonstração (prisma/data/tcc-demo.db), uma conta de teste "Ivo" com os
 * MESMOS vínculos/papéis do Danilo (dmr@cesar.org.br) na base real — mesmo isAdmin, mesmas turmas
 * como RESPONSAVEL/ORIENTADOR e a mesma restrição de grupo, quando houver. Assim quem testar pela
 * conta "Ivo" enxerga exatamente as mesmas telas/dados que o Danilo vê na base real.
 *
 * Só funciona depois de rodar `npx tsx scripts/gerar-dados-demo.ts` pelo menos uma vez (precisa
 * da cópia já existir, com as mesmas turmas/ids da base real). Rodar de novo é seguro — atualiza a
 * conta "Ivo" já criada em vez de duplicar.
 *
 * Uso: npx tsx scripts/criar-usuario-demo.ts
 */
import { PrismaClient } from "@prisma/client";
import { hashSenha } from "../src/lib/senha";
import path from "path";
import fs from "fs";

const REAL = path.join(__dirname, "..", "prisma", "data", "tcc.db");
const DEMO = path.join(__dirname, "..", "prisma", "data", "tcc-demo.db");
const EMAIL_PESSOA_REAL = "dmr@cesar.org.br";
const NOME_DEMO = "Ivo";
const EMAIL_DEMO = "ivo@demo.com";
const SENHA_DEMO = "ivo";

async function main() {
  if (!fs.existsSync(DEMO)) {
    console.error(`Base de demonstração não encontrada em ${DEMO}. Rode antes: npx tsx scripts/gerar-dados-demo.ts`);
    process.exit(1);
  }

  const real = new PrismaClient({ datasources: { db: { url: `file:${REAL}` } } });
  const demo = new PrismaClient({ datasources: { db: { url: `file:${DEMO}` } } });

  try {
    const pessoaReal = await real.professor.findFirst({
      where: { email: EMAIL_PESSOA_REAL },
      include: { vinculos: true },
    });
    if (!pessoaReal) {
      console.error(`Não encontrei ${EMAIL_PESSOA_REAL} na base real.`);
      process.exit(1);
    }

    const senhaHash = await hashSenha(SENHA_DEMO);
    const existente = await demo.professor.findFirst({ where: { email: EMAIL_DEMO } });

    const ivo = existente
      ? await demo.professor.update({
          where: { id: existente.id },
          data: { nome: NOME_DEMO, senhaHash, isAdmin: pessoaReal.isAdmin },
        })
      : await demo.professor.create({
          data: { nome: NOME_DEMO, email: EMAIL_DEMO, senhaHash, isAdmin: pessoaReal.isAdmin },
        });

    // Os ids de turma são os MESMOS entre base real e demo (a demo é uma cópia byte a byte antes
    // de anonimizar) — por isso dá pra reaproveitar turmaId direto, sem precisar mapear nada.
    for (const v of pessoaReal.vinculos) {
      await demo.turmaProfessor.upsert({
        where: { turmaId_professorId_papel: { turmaId: v.turmaId, professorId: ivo.id, papel: v.papel } },
        create: { turmaId: v.turmaId, professorId: ivo.id, papel: v.papel, gruposResponsavel: v.gruposResponsavel },
        update: { gruposResponsavel: v.gruposResponsavel },
      });
    }

    console.log(`Conta "${NOME_DEMO}" pronta na base de demonstração.`);
    console.log(`E-mail: ${EMAIL_DEMO}  ·  Senha: ${SENHA_DEMO}`);
    console.log(`Vínculos copiados: ${pessoaReal.vinculos.length}`);
  } finally {
    await real.$disconnect();
    await demo.$disconnect();
  }
}

main();
