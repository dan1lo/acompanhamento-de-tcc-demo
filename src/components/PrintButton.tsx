"use client";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded bg-orange-600 text-white px-4 py-2 text-sm hover:bg-orange-700"
    >
      Exportar / imprimir (PDF)
    </button>
  );
}
