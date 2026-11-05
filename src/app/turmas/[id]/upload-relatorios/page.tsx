import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireTurmaResponsavel } from "@/lib/authz";
import UploadRelatoriosForm from "./UploadRelatoriosForm";

export default async function UploadRelatoriosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireTurmaResponsavel(id);

  const totalAlunos = await prisma.aluno.count({ where: { turmaId: id } });

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <Link href={`/turmas/${id}`} className="text-sm text-zinc-500 hover:underline">
        ← voltar
      </Link>
      <h1 className="text-xl font-semibold">Upload de relatórios semanais</h1>
      <p className="text-sm text-zinc-500">
        Exporte as respostas do Google Forms como .xlsx e envie aqui. O matching é por nome do
        aluno (normalizado); um envio repetido do mesmo número de relatório substitui o conteúdo
        anterior, sem duplicar.
      </p>

      {totalAlunos === 0 && (
        <p className="text-sm text-amber-800 border border-amber-300 bg-amber-50 rounded p-3">
          Esta turma ainda não tem nenhum aluno cadastrado. Faça primeiro o{" "}
          <Link href={`/turmas/${id}/upload-roster`} className="underline font-medium">
            upload de alunos e orientadores
          </Link>{" "}
          — sem isso, nenhum relatório vai encontrar correspondência.
        </p>
      )}

      <UploadRelatoriosForm turmaId={id} />
    </div>
  );
}
