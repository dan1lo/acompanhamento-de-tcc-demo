# Acompanhamento de TCC

Sistema web (Next.js + TypeScript + Tailwind + Prisma/SQLite) que substitui o fluxo antigo de
planilha Excel + Google Forms + preenchimento manual pro acompanhamento de orientandos de TCC.
Requisitos completos em [`requisitos.md`](requisitos.md); este documento cobre o que já está
implementado, como rodar localmente, e limitações conhecidas.

Em uso real com dados de duas turmas (TCC e Pré-Projeto de TCC, 2026.2).

## Rodando localmente

```bash
npm install
npx prisma db push   # só necessário se apagar data/tcc.db — schema aplicado direto, sem migrations
npm run dev
```

Abra http://localhost:3000. A tela de login aceita e-mail/senha; contas ainda sem senha
configurada aparecem numa lista de acesso direto ("Acesso sem senha") — ver seção
[Autenticação](#autenticação) abaixo.

Para popular dados de teste a partir de planilhas reais (fora da UI, mais rápido pra testar):

```bash
npx tsx scripts/import-real-files.ts <turmaId>
```

Para começar do zero: apague `data/tcc.db` (e os arquivos `.db-wal`/`.db-shm` ao lado, se
existirem) e rode `npx prisma db push` de novo.

Pra gerar uma cópia anonimizada do banco (nomes, e-mails, títulos de TCC e textos livres trocados
por fictícios, senha única de demonstração) pra subir num ambiente de teste sem expor dado real,
em conformidade com a LGPD — a base real local nunca é tocada, só uma cópia separada:

```bash
npx tsx scripts/gerar-dados-demo.ts
```

Gera `prisma/data/tcc-demo.db` (ignorado pelo git). Senha de todas as contas na cópia: `demo2026`.

Pra dar a quem for testar a MESMA visão de acesso do Danilo (admin + responsável/orientador nas
mesmas turmas, com a mesma restrição de grupo), depois de gerar a cópia acima:

```bash
npx tsx scripts/criar-usuario-demo.ts
```

Cria/atualiza a conta "Ivo" na cópia de demonstração — login `ivo@demo.com`, senha `ivo`.

## O que está implementado

Cobertura completa dos requisitos funcionais em `requisitos.md` — ver lá o detalhamento por RF.
Resumo por área:

- **Autenticação e papéis** — login por e-mail/senha (bcrypt); uma única conta pode acumular
  admin + responsável de turma + orientador + coordenador vinculado ao mesmo tempo; painel de
  admin pra criar/editar contas e alocar papéis (sem ganhar acesso a conteúdo por isso).
- **Gestão de turma** — criação, upload de roster e de agenda/calendário (define grupos, horários
  e os ciclos de acompanhamento), limiares de risco e peso de nota configuráveis por turma,
  restrição de visão por grupo pra responsáveis, liberação de lançamento de nota por período,
  arquivamento/restauração de turma, backup e restore do banco.
- **Envio semanal e cálculo de falta** — upload da planilha de respostas do Forms, matching por
  nome normalizado, regra de falta por ciclo (grupo + reunião prevista + entrega do relatório —
  ver detalhamento abaixo), nota automática + nota do orientador + nota final ponderada.
- **Painel da turma** — semáforo por aluno, painel de alertas colapsável (sem orientador, em
  vermelho, impedimento sem resposta, precisa de intervenção), seção própria de "faltou à
  reunião" com seletor de ciclo, painel de "relatórios pendentes da semana" (inclui o ciclo em
  andamento, não só os já vencidos) com seleção de quem avisar por e-mail em lote, visão
  comparativa por orientador, drill-down por aluno, exportação CSV/Excel.
- **Relatório em PDF** — por aluno (ficha individual) e por orientador (todos os orientandos dela,
  em nível resumo ou completo) — via impressão do navegador, sem biblioteca de PDF no servidor.
- **Aviso por e-mail** — individual ou em lote; o sistema nunca envia e-mail sozinho, sempre abre
  um rascunho no cliente de e-mail da própria pessoa (ou copia o texto), com tom de aviso/FYI, não
  de cobrança.
- **Busca global de aluno** — campo na navegação, disponível em qualquer tela, escopado ao mesmo
  acesso de quem busca.
- **Painel de saúde dos dados** — checagens automáticas por turma (número de relatório fora do
  esperado, aluno sem nenhum relatório, presença contradita por observação, duplicatas de
  conteúdo) — só relatório, não corrige nada sozinho.
- **Visão do coordenador** — turmas sob sua coordenação, criação de turma/vínculo de responsável,
  seção de turmas arquivadas com restauração.

## Achados de validação contra dados reais

Este sistema foi validado desde o início contra as planilhas reais da disciplina (não só dados
inventados), o que pegou uma série de bugs que só apareceriam com dado real:

1. **Fórmulas do Excel**: a aba "Aluno e Orientador" da planilha de roster usa células que são
   fórmulas apontando pra outra aba (ex.: `=ALUNOS!B3`), não texto direto — corrigido em
   `src/lib/parseRoster.ts` pra resolver `cell.formula`/`cell.result`.
2. **"Sem orientador" como texto literal**: algumas linhas têm o texto "sem orientador" na coluna
   ORIENTADOR — tratado como `null` em vez de virar um Professor de verdade com esse nome.
3. **Célula de cabeçalho mesclada na agenda**: a célula "GRUPOS" é mesclada em duas colunas e o
   ExcelJS repete o valor mesclado, sobrescrevendo a coluna certa — corrigido em
   `src/lib/parseAgenda.ts`, junto com uma linha de nota interna dos professores que era lida como
   se fosse aluno.
4. **Datas do calendário um dia adiantadas/atrasadas**: `dataPrevista` é meia-noite UTC; em fusos
   negativos, `toLocaleDateString` comum exibia o dia anterior. Corrigido com
   `formatDiaCalendario` em `src/lib/format.ts`, que lê os componentes UTC da data.
5. **`teveReuniao` confundido com `presencaReuniaoDisciplina`**: uma migração de dados inicial
   tratou os dois conceitos como um só, gerando faltas erradas pra vários alunos de uma vez
   quando um ciclo teve `semEncontro` alterado depois — são campos independentes hoje (ver
   comentário no schema).
6. **Nomes duplicados/variados na planilha**: a mesma pessoa orientadora aparece escrita de formas
   diferentes em linhas diferentes (ex.: "Carlos Diego", "Carlos Diego Cavalcanti Pereira",
   "CARLOS DIEGO CAVALCANTI PEREIRA"). O sistema cria um `Professor` por variação em vez de
   adivinhar que é a mesma pessoa (adivinhar errado juntaria duas pessoas diferentes) — o painel
   de admin permite vincular/corrigir manualmente quando identificado.

**Limitação conhecida**: o matching de nomes nos uploads (roster, agenda, relatórios) é só por
nome normalizado exato (sem acento, caixa, sufixo tipo "[Ativo]") — não tenta aproximação. Alunos
cuja agenda usa apelido/nome curto em vez do nome completo do roster ficam com `grupo: null`
("grupo desconhecido" no status) até corrigir manualmente. Um matching mais tolerante (ex.: por
primeiro+último nome) traria risco de casar duas pessoas diferentes por engano — decisão
deliberada de não implementar isso sem supervisão humana.

## Regra de faltas

Os atendimentos são quinzenais e por **grupo** (Grupo 01/02/03/04, dois "trilhos" intercalados);
o relatório é **semanal** pra todo mundo, independente de ter reunião marcada naquela semana.
`numeroRelatorio` corresponde ao enésimo ciclo que **conta** (exclui os marcados "sem encontro"),
não ao número bruto do ciclo — ver `indiceDoCicloMap` em `src/lib/ciclos.ts`.

Por ciclo já vencido (exceto "sem encontro", onde o relatório não é exigido de ninguém):

- Sem reunião prevista pro grupo do aluno + não mandou relatório → **3 faltas**.
- Com reunião prevista + mandou relatório + foi à reunião → **0 faltas**.
- Com reunião prevista + só um dos dois (mandou relatório OU foi à reunião, não os dois) →
  **2 faltas**.
- Com reunião prevista + nenhum dos dois ("faltou tudo") → **3 faltas** (mesmo teto do caso "sem
  reunião prevista" acima — não soma nem multiplica as duas faltas isoladas).

Faltas consecutivas = sequência de ciclos considerados, do mais recente pra trás, em que o aluno
teve alguma falta acima. % de entrega = relatórios recebidos ÷ ciclos considerados (exclui os
"sem encontro" e os ciclos em que o aluno tem `grupo` desconhecido).

Implementado em `src/lib/semaforo.ts`. Quem sabe quais grupos têm reunião em cada ciclo, e qual o
grupo de cada aluno, vem do upload da agenda (`/turmas/[id]/upload-agenda`).

## Autenticação

- Login por e-mail/senha, hash bcrypt (`src/lib/senha.ts`), sessão em cookie httpOnly
  (`src/lib/auth.ts`).
- Contas sem senha configurada aparecem numa lista de acesso direto na tela de login (separada
  por Professor/Coordenador) — assim que alguém configura uma senha (a própria pessoa, ou o
  admin via painel), a conta some dessa lista.
- Uma única conta de Professor pode acumular todos os papéis ao mesmo tempo: admin
  (`Professor.isAdmin`), responsável de uma turma, orientador de outra, e opcionalmente
  coordenador (`Coordenador.professorId` apontando de volta pra ela) — não existem contas
  separadas por papel. Ver `src/lib/authz.ts` pra como cada papel resolve acesso a conteúdo, e a
  seção "Histórico de decisões" em `requisitos.md` pro porquê dessa unificação.
- "Entrar com Google" aparece na tela mas está desabilitado — reservado pra uma integração
  futura, não autentica ninguém hoje.

## Modelo de dados

`prisma/schema.prisma` é a fonte de verdade — segue a seção 4 de `requisitos.md`, com comentário
por campo não óbvio. Sem migrations versionadas: mudanças de schema são aplicadas direto com
`npx prisma db push --accept-data-loss` (ver convenção em uso na seção seguinte).

## Convenções do projeto

- **Schema**: mudanças vão direto com `npx prisma db push --accept-data-loss` (nunca
  `migrate dev`/`reset`) — projeto sem histórico de migrations versionado, mudança de schema é
  sempre a mais recente. Depois de um `db push`, o processo `next dev` precisa ser reiniciado
  (mata a porta 3000 e sobe de novo) pra pegar o client do Prisma regenerado.
- **Autorização centralizada em `src/lib/authz.ts`** — toda página/action que precisa checar
  acesso chama uma das funções exportadas de lá (`requireTurmaResponsavel`,
  `requireAlunoAccess`, `requireCoordenadorAccess`, `requireAdmin`, etc.), nunca reimplementa a
  checagem de permissão inline. Acesso a conteúdo é sempre resolvido por vínculo real
  (`TurmaProfessor`, `orientadorId`, coordenação) — `Professor.isAdmin` nunca entra nessa conta.
- **Server actions** ficam em arquivos `actions.ts`/`configActions.ts` ao lado da página que os
  usa (`"use server"` no topo do arquivo), chamados via `.bind(null, id)` quando precisam de um
  id que não vem do form — nunca em rotas de API separadas, exceto quando o cliente precisa de
  uma resposta JSON simples fora do ciclo de formulário (ex.: `src/app/api/buscar-aluno/route.ts`
  pra a busca global).
- **E-mail nunca é disparado pelo servidor** — toda tela de aviso monta um link `mailto:` com
  destinatários/assunto/corpo pré-preenchidos (componente `ComposeEmail`) e deixa a pessoa
  revisar e enviar pelo próprio cliente.
- **Deduplicação de lógica repetida em `src/lib/*.ts`** — sempre que a mesma checagem ou parsing
  aparece em duas telas, vira uma função exportada em vez de repetir (ex.: `parseGruposComReuniao`
  em `ciclos.ts`, `orientadoresDaTurma`/`responsavelIdsDaTurma` em `vinculos.ts`,
  `encontrarOuCriarProfessor` em `professores.ts`). Ver a seção de manutenção mais abaixo pra
  auditoria de aderência a esse padrão.
- **Verificação antes de cada commit**: `npx tsc --noEmit` → `npx eslint src/` → `npm run build` →
  reiniciar o dev server → testar ao vivo no navegador antes de considerar uma mudança pronta.

## Risco de segurança conhecido (aceito)

`npm audit` acusa `mysql2` (via ferramenta de CLI do Prisma, não usado em runtime — só
conectamos SQLite) e `uuid` antigo (via `exceljs`) como dependências com CVEs conhecidos. Ambos
exigem uma condição que este app nunca cria (conectar a um servidor MySQL malicioso; buffer
controlado por atacante pro `uuid`), e corrigir via `npm audit fix --force` rebaixaria
Prisma/exceljs pra versões mais antigas — pior custo-benefício que aceitar o risco. Revisitar
antes de expor isso além de uso local/institucional controlado.

## O que falta (conhecido, de propósito)

Ver seções "Fora de escopo" e "Pontos em aberto" em `requisitos.md` pro detalhamento — resumo:

- Envio de e-mail e integração com API do Google Forms/Sheets continuam manuais por decisão de
  produto, não por limitação técnica.
- Tela de merge de orientadores duplicados (achado #6 acima) — hoje corrigido manualmente via
  painel de admin quando identificado.
- Matching mais tolerante de nomes no upload da agenda (achado de limitação acima).
- Dark mode declarado no CSS mas não implementado de fato na maioria dos componentes.
- Testes automatizados — validação até aqui foi manual, contra planilhas reais e ao vivo no
  navegador a cada mudança; não há suíte de testes.
