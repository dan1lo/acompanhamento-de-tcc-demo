import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Nav from "@/components/Nav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Acompanhamento de TCC",
  description: "Protótipo — acompanhamento de orientandos de TCC/Pré-Projeto",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const session = await getSession();

  let label: string | null = null;
  let papeis: { turmaId: string; turmaNome: string; papel: string }[] = [];
  let isAdmin = false;
  let ehTambemCoordenador = false;

  if (session?.kind === "coordenador") {
    const c = await prisma.coordenador.findUnique({ where: { id: session.id } });
    label = c ? `${c.nome} (coordenador)` : null;
  } else if (session?.kind === "professor") {
    const p = await prisma.professor.findUnique({
      where: { id: session.id },
      include: { vinculos: { include: { turma: true } }, coordenadorVinculado: true },
    });
    label = p ? p.nome : null;
    papeis =
      p?.vinculos.map((v) => ({ turmaId: v.turmaId, turmaNome: v.turma.nome, papel: v.papel })) ?? [];
    isAdmin = p?.isAdmin ?? false;
    ehTambemCoordenador = !!p?.coordenadorVinculado;
  }

  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900">
        <Nav session={session} label={label} papeis={papeis} isAdmin={isAdmin} ehTambemCoordenador={ehTambemCoordenador} />
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
