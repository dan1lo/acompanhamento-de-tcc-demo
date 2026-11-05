"use client";

export default function ArquivarTurmaForm({ action }: { action: () => Promise<void> }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (
          !confirm(
            "Arquivar esta turma? Ela some da sua lista e da de outros responsáveis/orientadores — só a coordenação consegue restaurar depois. Nenhum dado é apagado."
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <button className="rounded border border-red-300 text-red-700 px-4 py-2 text-sm hover:bg-red-50">
        Arquivar turma
      </button>
    </form>
  );
}
