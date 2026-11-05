import Link from "next/link";
import { requireTurmaResponsavel } from "@/lib/authz";

export default async function UploadsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireTurmaResponsavel(id);

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <Link href={`/turmas/${id}`} className="text-sm text-zinc-500 hover:underline">
        ← voltar
      </Link>
      <h1 className="text-xl font-semibold">Uploads</h1>

      <Link href={`/turmas/${id}/upload-roster`} className="block border rounded p-4 bg-white hover:bg-zinc-50">
        <p className="font-medium">Alunos e pessoas orientadoras</p>
        <p className="text-sm text-zinc-500">
          Primeiro upload a fazer numa turma nova — cria os alunos e as pessoas orientadoras.
        </p>
      </Link>

      <Link href={`/turmas/${id}/upload-relatorios`} className="block border rounded p-4 bg-white hover:bg-zinc-50">
        <p className="font-medium">Relatórios semanais</p>
        <p className="text-sm text-zinc-500">
          Respostas do formulário semanal (o que fez, o que pretende fazer, impedimento).
        </p>
      </Link>

      <Link href={`/turmas/${id}/upload-agenda`} className="block border rounded p-4 bg-white hover:bg-zinc-50">
        <p className="font-medium">Agenda de reuniões</p>
        <p className="text-sm text-zinc-500">
          Horário e grupo de cada reunião prevista por ciclo.
        </p>
      </Link>
    </div>
  );
}
