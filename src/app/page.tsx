import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function Home() {
  const session = await getSession();
  if (!session) redirect("/login");

  if (session.kind === "coordenador") redirect("/coordenador");

  const professor = await prisma.professor.findUnique({
    where: { id: session.id },
    include: { vinculos: true },
  });

  if (professor?.vinculos.some((v) => v.papel === "RESPONSAVEL")) redirect("/turmas");
  if (professor?.vinculos.some((v) => v.papel === "ORIENTADOR")) redirect("/meus-alunos");

  return (
    <div className="max-w-lg mx-auto mt-16 text-center text-zinc-600">
      <p>
        {professor?.nome ?? "Este usuário"} ainda não está vinculado a nenhuma turma como
        responsável ou orientador.
      </p>
    </div>
  );
}
