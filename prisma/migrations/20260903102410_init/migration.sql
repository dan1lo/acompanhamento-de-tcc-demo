-- CreateTable
CREATE TABLE "Coordenador" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Professor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "email" TEXT
);

-- CreateTable
CREATE TABLE "Turma" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "periodoLetivo" TEXT NOT NULL,
    "disciplina" TEXT NOT NULL,
    "coordenadorId" TEXT,
    "limiteFaltas" INTEGER NOT NULL DEFAULT 14,
    "pctFaltasVermelho" REAL NOT NULL DEFAULT 0.70,
    "faltasConsecutivasVermelho" INTEGER NOT NULL DEFAULT 2,
    "pctEntregaAmarelo" REAL NOT NULL DEFAULT 0.75,
    "faltasAmarelo" INTEGER NOT NULL DEFAULT 1,
    "pesoNotaAutomatica" REAL NOT NULL DEFAULT 0.60,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Turma_coordenadorId_fkey" FOREIGN KEY ("coordenadorId") REFERENCES "Coordenador" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TurmaProfessor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "turmaId" TEXT NOT NULL,
    "professorId" TEXT NOT NULL,
    "papel" TEXT NOT NULL,
    CONSTRAINT "TurmaProfessor_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TurmaProfessor_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "Professor" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CicloData" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "turmaId" TEXT NOT NULL,
    "numeroCiclo" INTEGER NOT NULL,
    "dataPrevista" DATETIME NOT NULL,
    CONSTRAINT "CicloData_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Aluno" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "nomeNormalizado" TEXT NOT NULL,
    "email" TEXT,
    "turmaId" TEXT NOT NULL,
    "orientadorId" TEXT,
    "tituloTcc" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Aluno_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Aluno_orientadorId_fkey" FOREIGN KEY ("orientadorId") REFERENCES "Professor" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlocacaoHistorico" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "alunoId" TEXT NOT NULL,
    "orientadorId" TEXT,
    "inicio" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fim" DATETIME,
    CONSTRAINT "AlocacaoHistorico_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "Aluno" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AlocacaoHistorico_orientadorId_fkey" FOREIGN KEY ("orientadorId") REFERENCES "Professor" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RelatorioSemanal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "alunoId" TEXT NOT NULL,
    "numeroRelatorio" REAL NOT NULL,
    "timestampEnvio" DATETIME NOT NULL,
    "cronogramaEmDia" BOOLEAN,
    "teveReuniao" BOOLEAN,
    "dataUltimaReuniao" DATETIME,
    "impedimento" BOOLEAN NOT NULL DEFAULT false,
    "impedimentoDesc" TEXT,
    "oQueFez" TEXT,
    "oQuePretende" TEXT,
    "linkCronograma" TEXT,
    "orientadorDeclarado" TEXT,
    CONSTRAINT "RelatorioSemanal_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "Aluno" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Observacao" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "alunoId" TEXT NOT NULL,
    "professorId" TEXT NOT NULL,
    "data" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "texto" TEXT NOT NULL,
    CONSTRAINT "Observacao_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "Aluno" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Observacao_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "Professor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Nota" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "alunoId" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "notaAutomatica" REAL,
    "notaOrientador" REAL,
    "notaFinal" REAL,
    "comentario" TEXT,
    CONSTRAINT "Nota_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "Aluno" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UploadLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "turmaId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "nomeArquivo" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "registrosAfetados" INTEGER NOT NULL DEFAULT 0,
    "professorId" TEXT,
    "resumoJson" TEXT,
    CONSTRAINT "UploadLog_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UploadLog_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "Professor" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Coordenador_email_key" ON "Coordenador"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Professor_email_key" ON "Professor"("email");

-- CreateIndex
CREATE UNIQUE INDEX "TurmaProfessor_turmaId_professorId_papel_key" ON "TurmaProfessor"("turmaId", "professorId", "papel");

-- CreateIndex
CREATE UNIQUE INDEX "CicloData_turmaId_numeroCiclo_key" ON "CicloData"("turmaId", "numeroCiclo");

-- CreateIndex
CREATE INDEX "Aluno_turmaId_nomeNormalizado_idx" ON "Aluno"("turmaId", "nomeNormalizado");

-- CreateIndex
CREATE UNIQUE INDEX "RelatorioSemanal_alunoId_numeroRelatorio_key" ON "RelatorioSemanal"("alunoId", "numeroRelatorio");

-- CreateIndex
CREATE UNIQUE INDEX "Nota_alunoId_periodo_key" ON "Nota"("alunoId", "periodo");
