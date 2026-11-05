"use client";

/**
 * Wrapper pra qualquer <form action={...}> cujo submit deveria confirmar antes — usado nos
 * vários botões "remover" espalhados pelo app (vínculo de orientador/coordenador, ciclo da
 * agenda, etc.), que antes disparavam a ação assim que clicados, sem chance de desfazer.
 */
export default function FormularioComConfirmacao({
  action,
  mensagem,
  className,
  children,
}: {
  action: (formData: FormData) => void | Promise<void>;
  mensagem: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(mensagem)) e.preventDefault();
      }}
      className={className}
    >
      {children}
    </form>
  );
}
