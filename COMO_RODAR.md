# Como rodar o sistema no seu computador

Guia pra quem nunca rodou um projeto desses — sem pressupor conhecimento técnico. Segue os
passos na ordem. Se travar em algum, para ali e chama o Danilo.

## O que você vai precisar

- O código do sistema (uma pasta que o Danilo te mandou, ou um link do GitHub).
- O arquivo do banco de dados (`tcc.db`) que o Danilo te mandou separadamente — é um arquivo só,
  contém os dados reais das turmas.
- Seu e-mail e senha de teste (o Danilo te passou por fora).

## Passo 1 — Instalar o Node.js

O sistema roda em cima de um programa chamado Node.js. Se você nunca instalou:

1. Vá em [nodejs.org](https://nodejs.org).
2. Baixe a versão **LTS** (é a recomendada, aparece em destaque).
3. Abra o instalador baixado e clique em "Próximo" até o fim (não precisa mudar nenhuma opção).

Pra confirmar que instalou certo, abra o **Terminal** (Mac: procure por "Terminal" no
Spotlight/Launchpad; Windows: procure por "Prompt de Comando" ou "PowerShell") e digite:

```bash
node -v
```

Se aparecer um número tipo `v20.x.x` ou `v22.x.x`, deu certo.

## Passo 2 — Abrir a pasta do projeto no Terminal

No Terminal, entre na pasta onde você colocou o código. Exemplo, se você salvou em
"Downloads/tcc-acompanhamento":

```bash
cd Downloads/tcc-acompanhamento
```

(Dica: no Mac, dá pra digitar `cd ` com um espaço no final e depois **arrastar a pasta** do
Finder pro Terminal — ele completa o caminho sozinho.)

## Passo 3 — Instalar as dependências

Ainda no Terminal, dentro da pasta do projeto, rode:

```bash
npm install
```

Isso baixa tudo que o sistema precisa pra funcionar. Demora alguns minutos na primeira vez —
normal aparecer bastante texto passando na tela.

## Passo 4 — Colocar o banco de dados no lugar certo

1. Dentro da pasta do projeto, entre em `prisma` e depois em `data` (se a pasta `data` não
   existir, crie ela).
2. Coloque o arquivo `tcc.db` que o Danilo te mandou dentro dessa pasta (`prisma/data/tcc.db`).
3. Se já existir um `tcc.db` ali (de um teste seu anterior), pode substituir sem problema — ele
   guarda só dados de teste.

## Passo 5 — Preparar o banco

Ainda no Terminal, na pasta do projeto:

```bash
npx prisma generate
```

Esse comando não mexe nos dados — só garante que o sistema "entende" o formato do banco que
você recebeu.

## Passo 6 — Ligar o sistema

```bash
npm run dev
```

Vai aparecer algo como:

```
- Local: http://localhost:3000
```

Deixe essa janela do Terminal aberta (é o "servidor" rodando) — se você fechar, o sistema para.

## Passo 7 — Abrir no navegador

Abra o Chrome (ou outro navegador) e digite na barra de endereço:

```
http://localhost:3000
```

Vai aparecer a tela de login. Entre com o e-mail e a senha que o Danilo te passou.

## Pra parar o sistema

Volte no Terminal onde ele está rodando e aperte `Ctrl + C`. Pra rodar de novo depois, é só
repetir o Passo 6 (`npm run dev`) — não precisa repetir os passos anteriores, a não ser que o
Danilo mande um banco novo.

## Problemas comuns

- **"comando não encontrado" ao rodar `npm` ou `npx`**: o Node.js não foi instalado direito —
  repita o Passo 1 e feche/abra o Terminal de novo.
- **A porta 3000 já está em uso**: feche outra janela do Terminal que esteja rodando o sistema, ou
  reinicie o computador.
- **Tela em branco ou erro estranho no navegador**: confirme que o arquivo `tcc.db` está mesmo em
  `prisma/data/tcc.db` (não em outro lugar), pare o sistema (`Ctrl + C`) e rode `npm run dev` de
  novo.
- **Esqueceu a senha de teste**: chama o Danilo — ele pode redefinir pelo painel de admin.
