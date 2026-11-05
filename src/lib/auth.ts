/**
 * Duas formas de entrar convivem por enquanto: a lista "escolha quem você é" (sem senha, só pra
 * contas de Professor/Coordenador que ainda não têm senha configurada) e o login de verdade por
 * e-mail + senha (bcrypt, ver lib/senha.ts). Assim que alguém configura uma senha pra uma conta,
 * ela some da lista sem senha (ver login/page.tsx) e passa a exigir a senha.
 *
 * Não existe conta separada de "admin": é o MESMO login de Professor, só que com
 * `Professor.isAdmin = true` — uma pessoa pode ser responsável, orientadora, admin e até
 * coordenadora (via Coordenador.professorId) tudo com um login só. Um Coordenador "puro" (sem
 * vínculo de Professor nenhum) continua podendo logar com sua própria conta separada — daí o
 * `kind: "coordenador"` ainda existir.
 *
 * O que já é resolvido corretamente por baixo: a permissão de cada Professor é derivada de
 * TurmaProfessor.papel por turma, não de uma conta separada — um mesmo Professor pode aparecer
 * como RESPONSAVEL numa turma e ORIENTADOR noutra.
 */
import { cookies } from "next/headers";

const COOKIE_NAME = "tcc_session";

export type Session =
  | { kind: "coordenador"; id: string }
  | { kind: "professor"; id: string };

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export async function setSession(session: Session): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, JSON.stringify(session), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
