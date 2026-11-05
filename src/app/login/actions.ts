"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { setSession } from "@/lib/auth";
import { verificarSenha } from "@/lib/senha";

type LoginState = { erro: string } | null;

export async function loginAsCoordenador(formData: FormData) {
  const id = String(formData.get("id"));
  // Defesa em profundidade: a lista "sem senha" na tela já esconde quem tem senha configurada,
  // mas a action confere de novo — não confiar só no que a UI escolheu não mostrar.
  const c = await prisma.coordenador.findUnique({ where: { id } });
  if (!c || c.senhaHash) redirect("/login");
  await setSession({ kind: "coordenador", id });
  redirect("/coordenador");
}

export async function loginAsProfessor(formData: FormData) {
  const id = String(formData.get("id"));
  const p = await prisma.professor.findUnique({ where: { id } });
  if (!p || p.senhaHash) redirect("/login");
  await setSession({ kind: "professor", id });
  redirect("/");
}

/**
 * Login por e-mail + senha — forma alternativa a "escolha quem você é", pra contas que já
 * configuraram senha. Não existe conta separada de Admin: se `Professor.isAdmin` for true, o
 * link "Painel de admin" aparece no menu depois de entrar — mesmo login, poder a mais. Tenta
 * Professor primeiro, depois Coordenador "puro" (sem professor vinculado), pelo mesmo e-mail.
 */
export async function loginComSenha(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const senha = String(formData.get("senha") ?? "");
  if (!email || !senha) return { erro: "Informe e-mail e senha." };

  const professor = await prisma.professor.findUnique({ where: { email } });
  if (professor?.senhaHash && (await verificarSenha(senha, professor.senhaHash))) {
    await setSession({ kind: "professor", id: professor.id });
    redirect("/");
  }

  const coordenador = await prisma.coordenador.findUnique({ where: { email } });
  if (coordenador?.senhaHash && (await verificarSenha(senha, coordenador.senhaHash))) {
    await setSession({ kind: "coordenador", id: coordenador.id });
    redirect("/coordenador");
  }

  return { erro: "E-mail ou senha incorretos." };
}

export async function criarUsuario(formData: FormData) {
  const tipo = String(formData.get("tipo"));
  const nome = String(formData.get("nome") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();

  if (!nome || !email) return;

  if (tipo === "coordenador") {
    const c = await prisma.coordenador.create({ data: { nome, email } });
    await setSession({ kind: "coordenador", id: c.id });
    redirect("/coordenador");
  } else {
    const p = await prisma.professor.create({ data: { nome, email } });
    await setSession({ kind: "professor", id: p.id });
    redirect("/");
  }
}
