"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Session } from "@/lib/auth";
import LogoutButton from "./LogoutButton";
import BuscaGlobal from "./BuscaGlobal";
import PainelDropdown from "./PainelDropdown";

type Papel = { turmaId: string; turmaNome: string; papel: string };

function NavLink({ href, exact = false, children }: { href: string; exact?: boolean; children: React.ReactNode }) {
  const pathname = usePathname();
  const ativo = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={
        ativo
          ? "bg-white text-orange-700 rounded-full px-3 py-1 font-medium"
          : "text-orange-50 hover:text-white px-3 py-1"
      }
    >
      {children}
    </Link>
  );
}

export default function Nav({
  session,
  label,
  papeis,
  isAdmin,
  ehTambemCoordenador,
}: {
  session: Session | null;
  label: string | null;
  papeis: Papel[];
  isAdmin: boolean;
  ehTambemCoordenador: boolean;
}) {
  const turmasResponsavel = papeis.filter((p) => p.papel === "RESPONSAVEL");
  const temOrientacao = papeis.some((p) => p.papel === "ORIENTADOR");

  const outrosPaineis = [
    isAdmin && { href: "/admin", label: "Painel de admin" },
    (session?.kind === "coordenador" || ehTambemCoordenador) && { href: "/coordenador", label: "Painel do coordenador" },
    temOrientacao && { href: "/meus-alunos", label: "Meus orientandos" },
  ].filter((i): i is { href: string; label: string } => Boolean(i));

  return (
    <header className="border-b border-orange-900/10 bg-orange-600 text-white shadow-sm">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
        <Link href="/" className="font-semibold tracking-tight text-white">
          Acompanhamento de TCC
        </Link>

        {session && (
          <nav className="flex items-center gap-1 text-sm flex-wrap">
            {turmasResponsavel.length > 0 && <NavLink href="/turmas">Minhas turmas</NavLink>}
            <PainelDropdown itens={outrosPaineis} />
          </nav>
        )}

        <div className="flex items-center gap-3 text-sm">
          {session && <BuscaGlobal />}
          {label ? (
            <>
              <span className="text-orange-50 whitespace-nowrap">{label}</span>
              <LogoutButton />
            </>
          ) : (
            <Link href="/login" className="text-orange-50 hover:text-white">
              Entrar
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
