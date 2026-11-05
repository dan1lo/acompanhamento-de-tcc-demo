# Sistema de Acompanhamento de TCC — Requisitos

> Documento vivo: começou como o rascunho de v1 (seção 1-7 originais) e foi atualizado pra
> refletir o que está de fato implementado hoje. Onde o comportamento mudou em relação ao
> rascunho original, o texto atual prevalece — a seção 9 (Histórico de decisões) registra os
> pivôs mais importantes, pra quem quiser entender o "porquê" de uma mudança de rumo.

## 1. Objetivo

Substituir o fluxo antigo (planilha Excel + Google Forms + preenchimento manual/scriptado) por um
sistema web que centraliza turmas, orientadores e orientandos; recebe o envio semanal dos alunos
via upload da planilha de respostas do Forms; permite à pessoa orientadora registrar observações
de reunião; e gera, para quem é responsável pela disciplina, um relatório de acompanhamento
consolidado, substituindo a planilha que hoje mistura tudo numa aba só.

O sistema está implementado e em uso real com dados de duas turmas (TCC e Pré-Projeto de TCC,
2026.2).

## 2. Atores

| Ator | Quem é | Escopo de visão | Login |
|---|---|---|---|
| **Admin** | Quem administra o sistema como um todo | Aloca professores/coordenadores a turmas; **não** ganha acesso automático ao conteúdo (relatórios, faltas, observações) das turmas | Mesma conta de `Professor`, com `isAdmin = true` |
| **Coordenador** | Acima da pessoa responsável — visão institucional daquela(s) disciplina(s) | Todas as turmas em que é coordenador (`Turma.coordenadorId` ou vínculo em `TurmaCoordenador`) | Login próprio, ou vinculado a uma conta de Professor (ver seção 9) |
| **Professor responsável pela turma** | Ex.: Danilo, como responsável pela disciplina de TCC | Todos os alunos e todas as pessoas orientadoras da(s) turma(s) sob sua responsabilidade (pode ter a visão restrita a só alguns grupos, ver RF2.9) | Login de Professor |
| **Pessoa orientadora** | Cada orientador(a) com orientandos na turma | Apenas os alunos a ela alocados, agregando todas as turmas em que orienta | Login de Professor |
| **Aluno** | Orientando | Não acessa o sistema — sem login, sem tela própria | — |

Uma pessoa pode acumular **mais de um papel ao mesmo tempo sob uma única conta** — ver RF1 e a
seção 9 sobre a unificação Admin/Professor/Coordenador. Uma turma pode ter múltiplos
orientadores e mais de um coordenador acompanhando; cada aluno é alocado a um orientador dentro
da turma, reatribuível a qualquer momento.

## 3. Requisitos Funcionais

### RF1 — Autenticação e papéis

- RF1.1 Login por e-mail e senha (hash bcrypt), ou por "Entrar com Google" (botão presente na
  tela, desabilitado — reservado para uma integração futura, não funcional hoje).
- RF1.2 Contas ainda sem senha configurada aparecem numa lista "acesso sem senha" na tela de
  login (Professores e Coordenadores separadamente) — permite login por seleção direta até
  alguém (a própria pessoa ou o Admin) configurar uma senha; a partir daí a conta some dessa
  lista e passa a exigir e-mail/senha.
- RF1.3 **Uma única conta de Professor pode acumular todos os papéis**: orientador numa turma,
  responsável noutra, admin do sistema, e — opcionalmente — coordenador (via
  `Coordenador.professorId` apontando de volta pra ela). Não existem contas separadas por papel;
  o mesmo login abre tudo que a pessoa tem direito de ver, e a navegação (RF1.4) só mostra os
  links relevantes pros papéis que ela de fato tem.
- RF1.4 A barra de navegação mostra, condicionalmente: "Painel de admin" (se `isAdmin`),
  "Painel do coordenador" (se login de coordenador ou papel vinculado), "Minhas turmas" (se
  responsável por alguma turma), "Meus orientandos" (se orienta alguém em alguma turma).
- RF1.5 Um Coordenador "puro" (sem nenhum vínculo de Professor) continua podendo logar com conta
  totalmente própria, separada.
- RF1.6 Painel de admin permite criar/editar Professores e Coordenadores, vincular/desvincular o
  papel extra de coordenador a uma conta de Professor, e ligar/desligar `isAdmin`. **O admin não
  ganha, só por isso, acesso ao conteúdo das turmas** — quem decide isso é `authz.ts`, baseado em
  vínculo real (`TurmaProfessor`, `orientadorId`, `Turma.coordenadorId`/`TurmaCoordenador`), nunca
  em `isAdmin`.

### RF2 — Gestão de Turmas

- RF2.1 Coordenador ou pessoa responsável cria uma turma (nome, período letivo, disciplina).
- RF2.2 Upload da lista de alunos via planilha (nome, e-mail, orientador declarado) — relatório
  na própria tela de quem foi casado com sucesso e quem ficou sem correspondência.
- RF2.3 Upload da planilha de agenda/calendário quinzenal — atribui grupo, horário de
  atendimento e ordem do dia a cada aluno, e gera os `CicloData` da turma (datas previstas,
  quais ciclos são "sem encontro", e quais grupos têm reunião prevista em cada ciclo).
  Reprocessar a agenda **não apaga** relatórios, observações ou notas já lançados — só atualiza
  grupo/horário/calendário.
- RF2.4 Alocação aluno → orientador dentro da turma, em lote (coluna do upload) e/ou individual
  pela ficha do aluno ("Reatribuir").
- RF2.5 Reatribuição de orientador preserva o histórico de relatórios já enviados sob o
  orientador anterior (`AlocacaoHistorico` nunca é apagado, só fechado com data de fim).
- RF2.6 Calendário por turma (RF2.3) determina os ciclos usados no cálculo de falta (RF5) e na
  numeração dos relatórios — `numeroRelatorio` corresponde ao enésimo ciclo que **conta** (exclui
  os marcados "sem encontro"), não ao número bruto do ciclo.
- RF2.7 Limite de faltas, buffer de alerta (amarelo) e nº de faltas consecutivas de alerta são
  configuráveis por turma (Configurações), não fixos no código.
- RF2.8 Peso da nota automática vs. nota da pessoa orientadora, e o ciclo de corte entre SR1/SR2,
  configuráveis por turma (ver RF7).
- RF2.9 Uma pessoa RESPONSAVEL pode ter sua visão restrita a só alguns grupos da turma (ex.:
  Danilo vê Grupo 01/02, outra pessoa responsável vê Grupo 03/04) — restrição configurável por
  vínculo, com opção de "ver tudo" temporariamente sem precisar reconfigurar.
- RF2.10 Liberação de lançamento de nota por período (SR1/SR2) é controlada só por quem é
  RESPONSAVEL — enquanto travada, a pessoa orientadora não consegue lançar/editar a própria nota
  daquele período.
- RF2.11 **Arquivamento de turma**: qualquer RESPONSAVEL ou coordenador pode arquivar uma
  disciplina. Arquivada, ela some da lista de quem é responsável/orientador e o acesso direto por
  link é bloqueado pra essas pessoas; só a coordenação **daquela turma especificamente** continua
  vendo (numa seção própria, colapsada) e só ela consegue restaurar. Nenhum dado é apagado.
- RF2.12 Backup/restore do banco inteiro (não só da turma): download do arquivo `.db` via
  `VACUUM INTO`, e upload de um arquivo `.db` pra substituir o banco atual — com validação do
  cabeçalho SQLite e um backup de segurança automático do estado anterior antes de sobrescrever.

### RF3 — Envio semanal do aluno

- RF3.1 Upload manual, pela pessoa responsável, da planilha de respostas do Google Forms.
  Integração direta com a API do Forms/Sheets continua fora de escopo desta versão (RF3.1.1
  permanece evolução futura).
- RF3.2 *Matching* automático aluno → linha da planilha por nome normalizado (remove acento,
  caixa, sufixo tipo "[Ativo]"); relatório de quem foi casado e quem ficou sem correspondência.
- RF3.3 O aluno nunca acessa o sistema — o Google Forms é o único ponto de contato dele; o upload
  em lote é a única via de entrada.
- RF3.4 Campos do envio semanal: número do relatório (auto-relatado pelo aluno, sujeito a erro de
  digitação — ver RF10.1), cronograma em dia, teve reunião com a pessoa orientadora (evento
  independente da presença na reunião da disciplina, nunca confundido no cálculo de falta),
  data da última reunião, impedimento (+ descrição), o que fez, o que pretende fazer, link do
  cronograma, orientador declarado (usado só pra validação cruzada, não decide o vínculo real).
- RF3.5 Um novo envio do mesmo `numeroRelatorio` substitui o conteúdo da linha existente (mesmo
  aluno + mesmo número é único) em vez de duplicar.

### RF4 — Observações e situação

- RF4.1 Quem é orientador(a) ou responsável pode adicionar observação de texto livre a um aluno a
  qualquer momento, com autor e timestamp automáticos; histórico cumulativo, nunca sobrescrito.
- RF4.2 Duas tags de "situação" **independentes**, cada uma só considerando observações do
  próprio autor correspondente — não se misturam numa "situação única": "Situação com a pessoa
  orientadora" (só a pessoa orientadora atual registra) e "Situação com o responsável pela
  disciplina" (só quem é RESPONSAVEL registra). Valores: Tudo indo bem / Precisa de atenção /
  Precisa de intervenção.
- RF4.3 Observação pode ser marcada como "oculta da pessoa orientadora" por quem é RESPONSAVEL
  (ex.: o aluno relatou algo sensível sobre a própria pessoa orientadora) — RESPONSAVEL e
  coordenação sempre veem tudo; a pessoa orientadora-alvo não vê o item, nem sabe que existe.
  Mesma regra vale pra descrição de impedimento (o badge "tem impedimento" continua visível pra
  todo mundo; só o texto pode ficar oculto).

### RF5 — Painel da turma (visão de quem é responsável/coordenador)

- RF5.1 **Tabela principal** — por aluno: pessoa orientadora, status em semáforo, relatórios não
  entregues, faltas em reuniões, falta total (X de limite configurado), último envio,
  impedimento em aberto. Duas visões alternáveis: lista alfabética única, ou agrupada por pessoa
  orientadora.
- RF5.1.1 Semáforo (vermelho/amarelo/verde/impedimento) calculado a partir dos limiares
  configuráveis por turma (RF2.7) — nunca de números fixos no código. Regra de falta por ciclo:
  sem reunião prevista + relatório não entregue = 3 faltas; com reunião prevista, mandou
  relatório e foi à reunião = 0; só um dos dois = 2; nenhum dos dois ("faltou tudo") = 3, mesmo
  teto do caso sem reunião prevista — não soma nem multiplica as duas faltas isoladas.
- RF5.2 **Painel de alertas** (categorias colapsáveis, clique pra abrir): sem pessoa orientadora,
  em vermelho, impedimento sem resposta, precisa de intervenção (orientador), precisa de
  intervenção (disciplina).
- RF5.3 **Faltou à reunião** — seção própria com seletor de ciclo (só ciclos já vencidos, já que
  reunião é evento pontual): lista de quem tinha reunião prevista no grupo dela naquele ciclo mas
  não esteve presente, independente de ter entregue o relatório ou não.
- RF5.4 **Relatórios pendentes da semana** — seletor de ciclo que inclui o ciclo **em andamento**
  (o próximo ainda não vencido, prazo ainda aberto) além dos já vencidos; por padrão mostra o
  ciclo em andamento, pra acompanhar quem já entregou desde o dia em que o ciclo anterior fechou,
  sem esperar o prazo vencer. Lista com checkbox por aluno (todos marcados por padrão) pra
  escolher quem avisar.
- RF5.5 **Aviso por e-mail em lote** — a partir da seleção do RF5.4 ou de qualquer categoria do
  RF5.2, gera um rascunho de e-mail (destinatários agregados: aluno(s), pessoa(s) orientadora(s)
  únicas, coordenação da turma) que abre no cliente de e-mail da própria pessoa — **o sistema
  nunca dispara e-mail sozinho**, em nenhuma hipótese; o texto vem pré-preenchido mas é sempre
  revisável antes de enviar. Tom é de **aviso/informação**, não de cobrança.
- RF5.6 **Visão por pessoa orientadora** — tabela comparando todas as pessoas orientadoras da
  turma (nº de orientandos, entrega média, quantos em vermelho/amarelo), com link pra abrir a
  lista filtrada de cada uma e pra gerar o relatório em PDF dela (RF5.7).
- RF5.7 **Relatório de orientandos em PDF** (por pessoa orientadora): quem é RESPONSAVEL ou
  coordenador pode gerar de qualquer pessoa orientadora da turma; a própria pessoa orientadora só
  gera o dela. Dois níveis — Resumo (tabela agregada de faltas/entregas) e Completo (histórico
  detalhado de cada orientando, um por página ao imprimir). Exportação via impressão do
  navegador, sem biblioteca de geração de PDF no servidor.
- RF5.8 **Drill-down por aluno** — linha do tempo cronológica intercalando relatórios semanais e
  observações; indicadores (falta total, relatórios não entregues, faltas em reunião, faltas
  consecutivas, impedimento em aberto); exportação do relatório individual (mesmo mecanismo de
  impressão do RF5.7).
- RF5.9 Filtros: por pessoa orientadora, por status (semáforo), por busca de nome.
- RF5.10 Exportação da turma (Excel/CSV) para levar a reuniões de colegiado.

### RF6 — Visão da pessoa orientadora

- RF6.1 "Meus orientandos" agrega todos os alunos alocados a ela, em qualquer turma (não
  restrito a uma turma só), com indicadores por aluno e link pra gerar o próprio relatório PDF
  (RF5.7).
- RF6.2 Mesmo drill-down do RF5.8 pros seus orientandos.
- RF6.3 Pode adicionar observação e registrar a "situação com a pessoa orientadora" (RF4.2) — não
  pode registrar a situação com o responsável, nem ver conteúdo marcado como oculto dela.

### RF7 — Módulo de Notas

- RF7.1 Nota automática calculada por período (SR1/SR2, com corte configurável por ciclo) a
  partir de entrega de relatórios e frequência em reunião — mesma base do RF5.1.1.
- RF7.2 A pessoa orientadora lança manualmente a nota do orientando pro mesmo período, com
  comentário opcional — só a pessoa orientadora atual daquele aluno edita, e só quando o período
  está liberado por quem é RESPONSAVEL (RF2.10).
- RF7.3 Nota final do período combina as duas com peso configurável por turma (RF2.8, default
  60% orientador / 40% automática).
- RF7.4 Notas aparecem no drill-down do aluno (RF5.8/RF6.2).

### RF8 — Visão do coordenador

- RF8.1 Vê só as turmas que coordena (`Turma.coordenadorId` ou vínculo em `TurmaCoordenador`) —
  sem visão cruzada de turmas de outros coordenadores. Pode ter mais de um coordenador
  acompanhando a mesma turma.
- RF8.2 Painel comparando as turmas sob sua coordenação (entrega média, % em vermelho).
- RF8.3 Cria turma com uma pessoa responsável, ou vincula outra pessoa responsável a uma turma
  já existente.
- RF8.4 Seção "Turmas arquivadas" (colapsada), com botão de restaurar (RF2.11) — única pessoa com
  esse poder além de reverter uma decisão sua própria.
- RF8.5 Acesso total ao conteúdo das turmas que coordena, inclusive impedimentos/observações
  marcados como ocultos da pessoa orientadora.

### RF9 — Utilidades transversais

- RF9.1 **Busca global de aluno**: campo de busca sempre visível na navegação, disponível em
  qualquer tela — digita o nome, resultado aparece em dropdown, clique leva direto à ficha.
  Resultados respeitam o mesmo escopo de acesso de quem está buscando (pessoa orientadora só
  encontra os próprios orientandos; RESPONSAVEL e coordenação encontram toda a turma sob sua
  responsabilidade; `isAdmin` não amplia esse escopo).
- RF9.2 **Indicador "Carregado às HH:MM:SS"** nas telas mais sensíveis a dado desatualizado
  (painel da turma, ficha do aluno) — distingue "o dado mudou de verdade" de "essa aba só não foi
  recarregada".
- RF9.3 Identidade visual: laranja (cor institucional CESAR) como cor de ação primária em todo o
  sistema (botões, links de ação, cabeçalho); vermelho reservado só pro status real de reprovação
  por faltas, sem sobrepor outros significados.

### RF10 — Saúde dos dados

Painel por turma (`/turmas/[id]/saude-dados`), acessível a quem é responsável ou coordenador,
com checagens automáticas que não alteram nada sozinhas — só apontam o que vale a pena olhar:

- RF10.1 Relatório com `numeroRelatorio` fora do intervalo esperado pela turma (indício de erro
  de digitação do próprio aluno no campo auto-relatado do Forms).
- RF10.2 Aluno ativo sem nenhum relatório registrado (indício de entrada tardia na turma, ou de
  nunca ter respondido o Forms).
- RF10.3 Relatório com presença marcada como sim, mas uma observação de até 2 dias de distância
  cujo texto menciona "falt" (possível contradição entre o que foi marcado na tela de Reuniões e
  o que foi de fato anotado).
- RF10.4 Possíveis duplicatas: dois relatórios do mesmo aluno com o texto de "o que fez"
  idêntico (indício de linha de teste/duplicada, não entrega real).

## 4. Modelo de dados

Reflete `prisma/schema.prisma` no estado atual (SQLite). Only campos estruturalmente relevantes
estão listados; ver o schema para comentários linha a linha.

```
Coordenador   (id, nome, email, senhaHash?, professorId? [vínculo opcional c/ Professor])
Professor     (id, nome, email?, senhaHash?, isAdmin)
Turma         (id, nome, periodoLetivo, disciplina, coordenadorId?,
               limiteFaltas, bufferAmarelo, faltasConsecutivasAlerta,
               pesoNotaAutomatica, cicloCorteSR1?,
               notasSR1Liberadas, notasSR2Liberadas,
               arquivadaEm?, createdAt)
TurmaCoordenador (turmaId, coordenadorId)                — coordenadores extras de uma turma
TurmaProfessor   (turmaId, professorId, papel: RESPONSAVEL|ORIENTADOR, gruposResponsavel?)
CicloData     (id, turmaId, numeroCiclo, dataPrevista, semEncontro, gruposComReuniao)
Aluno         (id, nome, nomeNormalizado, email?, turmaId, orientadorId?, tituloTcc?, ativo,
               grupo?, horarioReuniao?, ordemSlot?)
AlocacaoHistorico (id, alunoId, orientadorId?, inicio, fim?)   — histórico de reatribuição
RelatorioSemanal  (id, alunoId, numeroRelatorio, timestampEnvio, relatorioEntregue,
                   cronogramaEmDia?, teveReuniao?, dataUltimaReuniao?,
                   presencaReuniaoDisciplina?, impedimento, impedimentoDesc?,
                   impedimentoOcultoDoOrientador, oQueFez?, oQuePretende?,
                   linkCronograma?, orientadorDeclarado?)
Observacao    (id, alunoId, professorId, data, texto, situacao?: OK|ATENCAO|INTERVENCAO,
               ocultoDoOrientador)
Nota          (id, alunoId, periodo, notaAutomatica?, notaOrientador?, notaFinal?, comentario?)
UploadLog     (id, turmaId, tipo, nomeArquivo, timestamp, registrosAfetados, professorId?,
               resumoJson?)
```

Diferenças relevantes em relação ao rascunho original (seção 9 detalha o porquê):

- Não existe mais uma tabela `Admin` separada — virou `Professor.isAdmin`.
- `Coordenador.professorId` permite uma pessoa ser Professor **e** Coordenador sob o mesmo login.
- `teveReuniao` (reunião com a pessoa orientadora) e `presencaReuniaoDisciplina` (presença na
  reunião quinzenal da disciplina) são campos **independentes** — o rascunho original só previa
  um conceito de "teve reunião".
- `Turma.arquivadaEm` não existia no rascunho original.
- `RelatorioSemanal.relatorioEntregue` distingue um envio real do Forms de uma linha criada só
  pra marcar presença na tela de Reuniões sem o aluno ter enviado nada.

## 5. Requisitos não funcionais

- RNF1 Upload de planilha relata, na própria tela, quem foi casado com sucesso e quem ficou sem
  correspondência.
- RNF2 Histórico nunca é sobrescrito por um novo upload — cada envio de um mesmo
  `numeroRelatorio` atualiza aquela linha específica, mas o relatório é sempre calculado sobre o
  histórico completo, nunca sobre um "estado" mutável solto.
- RNF3 Multiusuário concorrente sem lock de arquivo.
- RNF4 Auditoria mínima de upload (`UploadLog`): quem, quando, quantos registros afetou.
- RNF5 Toda ação de e-mail é manual — o sistema nunca dispara e-mail em nome de ninguém, em
  nenhuma tela (alerta individual ou em lote); o máximo que faz é abrir o cliente de e-mail da
  própria pessoa com um rascunho pré-preenchido, ou copiar o texto pra área de transferência.
- RNF6 Ações potencialmente destrutivas (restaurar backup, arquivar turma) exigem confirmação
  explícita antes de executar, e — no caso de restaurar backup — um backup de segurança
  automático do estado anterior é feito antes de sobrescrever.
- RNF7 Nenhuma ação de administração de contas (`isAdmin`, alocação de papéis) amplia, por si só,
  o acesso ao conteúdo (notas, faltas, observações) de uma turma — acesso a conteúdo é sempre
  resolvido por vínculo real (`TurmaProfessor`, `orientadorId`, coordenação), nunca por papel de
  administração.

## 6. Fora de escopo (nesta versão)

- Login do aluno / formulário nativo — o aluno nunca acessa o sistema, só o Google Forms.
- Integração automática com a API do Google Forms/Sheets — upload manual continua sendo a única
  via de entrada dos relatórios semanais.
- Envio automático de e-mail — toda comunicação por e-mail é manual por decisão de produto (não
  só ainda-não-implementada), ver RNF5.
- Login "Entrar com Google" — botão existe na tela por antecipação de uma integração futura, mas
  está desabilitado; não autentica ninguém hoje.

## 7. Pontos em aberto

- Painel-resumo no topo do painel da turma (poucos números grandes, tipo "5 vermelhos · 3
  impedimentos · 12 pendentes essa semana") — discutido, ainda não implementado; decisão pendente
  se vira um collapse na própria página ou uma página separada.
- Dark mode: tokens de cor declarados em `globals.css` pra `prefers-color-scheme: dark`, mas a
  maioria dos componentes usa classes Tailwind fixas (`bg-white`, `text-zinc-500` etc.) que não
  respeitam esse tema — ou implementa de verdade, ou remove a declaração solta.
- Padronização de estilo de ação (link sublinhado vs. botão) para o mesmo peso de ação em telas
  diferentes — parcialmente resolvido (RF9.3), não auditado tela a tela.
- Suporte a um formato de acompanhamento agregado (percentual por período, sem granularidade
  semanal) para turmas que não usam o formulário semanal do Forms — caso real identificado (turma
  Pré-Projeto), sem solução implementada; a turma nesse formato hoje só tem o roster importado e é
  acompanhada manualmente por fora do sistema.

## 8. Histórico de decisões

Registro dos pivôs mais importantes em relação ao rascunho original de v1, pra quem só olhar o
código e estranhar uma escolha:

- **Autenticação real em vez de trocador de papel sem senha.** A v1 original previa (e o
  `README.md`, hoje desatualizado nesse ponto, ainda descreve) um login "escolha um professor
  existente, sem senha". Isso evoluiu pra autenticação de verdade com bcrypt, mantendo uma lista
  de acesso sem senha só como transição pra quem ainda não configurou uma.
- **Unificação Admin/Professor/Coordenador.** A primeira versão do sistema de admin criou uma
  tabela `Admin` separada. Na prática isso gerou contas duplicadas pra uma mesma pessoa (mesmo
  e-mail em `Professor` e `Admin`/`Coordenador` sem vínculo) — confusão real que o próprio Danilo
  bateu de frente ("entrando com o email cadastrado eu não consigo ver minha turma"). A correção
  foi eliminar a tabela `Admin` (virou `Professor.isAdmin`) e permitir um vínculo opcional
  `Coordenador.professorId` — uma pessoa, um login, quantos papéis ela realmente tiver.
- **`presencaReuniaoDisciplina` separado de `teveReuniao`.** Também descoberto na prática: os dois
  conceitos foram inicialmente confundidos numa migração de dados, gerando faltas calculadas
  incorretamente pra vários alunos ao mesmo tempo quando um ciclo teve seu `semEncontro`
  alterado.
- **Arquivamento em vez de exclusão.** Pedido explícito pra permitir tirar uma disciplina de
  circulação sem perder o histórico — modelo de "soft delete" com controle de quem pode
  reverter (só a coordenação daquela turma), diferente de quem pode arquivar (qualquer
  responsável ou coordenador).
- **Tom dos avisos por e-mail: informar, não cobrar.** A primeira versão do e-mail em lote pedia
  explicitamente "regularizem e cobrem os orientandos" — ajustado pra um tom de aviso/FYI, sem
  soar como cobrança.

---
*Última atualização: refletindo o estado do sistema descrito nas sessões de desenvolvimento até
o momento — cobre autenticação/papéis, gestão e arquivamento de turma, relatórios em PDF por
orientador, aviso em lote por e-mail, busca global, painel de saúde dos dados e identidade visual.*
