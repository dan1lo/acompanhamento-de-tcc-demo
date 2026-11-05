import Link from "next/link";
import { requireTurmaResponsavel } from "@/lib/authz";
import UploadRosterForm from "./UploadRosterForm";

export default async function UploadRosterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireTurmaResponsavel(id);

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <Link href={`/turmas/${id}`} className="text-sm text-zinc-500 hover:underline">
        ← voltar
      </Link>
      <h1 className="text-xl font-semibold">Upload de alunos e pessoas orientadoras</h1>
      <p className="text-sm text-zinc-500">
        Este é o <strong>primeiro upload</strong> a fazer numa turma nova — sem ele, o upload de
        relatórios semanais não vai encontrar nenhum aluno para casar. Planilha no formato da aba{" "}
        <strong>&quot;Aluno e Orientador&quot;</strong>: colunas <code>ALUNO</code>,{" "}
        <code>ORIENTADOR</code>, <code>TÍTULO DO TCC</code>, <code>E-mail</code> — não é a
        planilha de respostas do formulário semanal (essa vai na tela de{" "}
        <em>upload de relatórios</em>). Alunos são casados por nome (normalizado); pessoas
        orientadoras citadas que ainda não existem no sistema são criadas automaticamente sem
        e-mail.
      </p>
      <UploadRosterForm turmaId={id} />
    </div>
  );
}
