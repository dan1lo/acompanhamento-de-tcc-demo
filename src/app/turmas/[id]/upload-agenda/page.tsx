import Link from "next/link";
import { requireTurmaResponsavel } from "@/lib/authz";
import UploadAgendaForm from "./UploadAgendaForm";

export default async function UploadAgendaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireTurmaResponsavel(id);

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <Link href={`/turmas/${id}`} className="text-sm text-zinc-500 hover:underline">
        ← voltar
      </Link>
      <h1 className="text-xl font-semibold">Upload da agenda</h1>
      <p className="text-sm text-zinc-500">
        Planilha de agenda com as colunas <code>DATA</code>/<code>GRUPOS</code> (o que acontece
        em cada semana: um grupo específico, todo mundo, ou sem encontro) e as colunas{" "}
        <code>Grupo NN (...)</code> listando os alunos de cada grupo. Normalmente muda pouco no
        semestre — reenviar não tem problema, atualiza o calendário e os grupos sem duplicar
        nada. O número do relatório semanal é sempre igual ao número do ciclo aqui.
      </p>
      <UploadAgendaForm turmaId={id} />
    </div>
  );
}
