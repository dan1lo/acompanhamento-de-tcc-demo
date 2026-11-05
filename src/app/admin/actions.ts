"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { hashSenha, verificarSenha } from "@/lib/senha";

type State = { ok: true } | { erro: string } | null;

export async function criarProfessor(_prevState: State, formData: FormData): Promise<State> {
  await requireAdmin();
  const nome = String(formData.get("nome") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  const senha = String(formData.get("senha") ?? "");
  if (!nome) return { erro: "Informe o nome." };
  if (senha && senha.length < 6) return { erro: "Senha precisa ter pelo menos 6 caracteres." };
  if (senha && !email) return { erro: "Pra definir senha, o e-mail é obrigatório (é o login)." };

  await prisma.professor.create({
    data: { nome, email, senhaHash: senha ? await hashSenha(senha) : null },
  });
  revalidatePath("/admin/professores");
  return { ok: true as const };
}

export async function editarProfessor(professorId: string, _prevState: State, formData: FormData): Promise<State> {
  await requireAdmin();
  const nome = String(formData.get("nome") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  const novaSenha = String(formData.get("novaSenha") ?? "");
  const isAdmin = formData.get("isAdmin") === "on";
  if (!nome) return { erro: "Informe o nome." };
  if (novaSenha && novaSenha.length < 6) return { erro: "Senha precisa ter pelo menos 6 caracteres." };
  if (novaSenha && !email) return { erro: "Pra definir senha, o e-mail é obrigatório (é o login)." };
  if (isAdmin && !email) return { erro: "Pra virar admin, o e-mail é obrigatório (é o login)." };

  await prisma.professor.update({
    where: { id: professorId },
    data: {
      nome,
      email,
      isAdmin,
      ...(novaSenha ? { senhaHash: await hashSenha(novaSenha) } : {}),
    },
  });
  revalidatePath("/admin/professores");
  revalidatePath(`/admin/professores/${professorId}`);
  return { ok: true as const };
}

export async function removerSenhaProfessor(professorId: string) {
  await requireAdmin();
  await prisma.professor.update({ where: { id: professorId }, data: { senhaHash: null } });
  revalidatePath("/admin/professores");
  revalidatePath(`/admin/professores/${professorId}`);
}

/**
 * Vincula esse Professor a uma conta de Coordenador (cria uma nova, ou reaproveita uma já
 * existente com o mesmo e-mail) — a partir daqui ele entra com a MESMA senha de professor e
 * também tem acesso de coordenador. Precisa de e-mail: é a chave que casa as duas contas.
 */
export async function tornarCoordenador(professorId: string) {
  await requireAdmin();
  const professor = await prisma.professor.findUniqueOrThrow({ where: { id: professorId } });
  if (!professor.email) return;

  await prisma.coordenador.upsert({
    where: { email: professor.email },
    create: { nome: professor.nome, email: professor.email, professorId },
    update: { professorId },
  });
  revalidatePath(`/admin/professores/${professorId}`);
}

/** Desfaz o vínculo — a conta de Coordenador continua existindo, só volta a ser independente. */
export async function removerVinculoCoordenador(professorId: string) {
  await requireAdmin();
  await prisma.coordenador.updateMany({ where: { professorId }, data: { professorId: null } });
  revalidatePath(`/admin/professores/${professorId}`);
}

export async function criarCoordenador(_prevState: State, formData: FormData): Promise<State> {
  await requireAdmin();
  const nome = String(formData.get("nome") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const senha = String(formData.get("senha") ?? "");
  if (!nome || !email) return { erro: "Informe nome e e-mail." };
  if (senha && senha.length < 6) return { erro: "Senha precisa ter pelo menos 6 caracteres." };

  const existente = await prisma.coordenador.findUnique({ where: { email } });
  if (existente) return { erro: "Já existe um coordenador com esse e-mail." };

  await prisma.coordenador.create({
    data: { nome, email, senhaHash: senha ? await hashSenha(senha) : null },
  });
  revalidatePath("/admin/coordenadores");
  return { ok: true as const };
}

export async function editarCoordenador(coordenadorId: string, _prevState: State, formData: FormData): Promise<State> {
  await requireAdmin();
  const nome = String(formData.get("nome") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const novaSenha = String(formData.get("novaSenha") ?? "");
  if (!nome || !email) return { erro: "Informe nome e e-mail." };
  if (novaSenha && novaSenha.length < 6) return { erro: "Senha precisa ter pelo menos 6 caracteres." };

  await prisma.coordenador.update({
    where: { id: coordenadorId },
    data: {
      nome,
      email,
      ...(novaSenha ? { senhaHash: await hashSenha(novaSenha) } : {}),
    },
  });
  revalidatePath("/admin/coordenadores");
  revalidatePath(`/admin/coordenadores/${coordenadorId}`);
  return { ok: true as const };
}

export async function removerSenhaCoordenador(coordenadorId: string) {
  await requireAdmin();
  await prisma.coordenador.update({ where: { id: coordenadorId }, data: { senhaHash: null } });
  revalidatePath("/admin/coordenadores");
  revalidatePath(`/admin/coordenadores/${coordenadorId}`);
}

/** Troca a senha da PRÓPRIA conta de professor (a que também é admin) — não é uma senha separada. */
export async function trocarSenhaPropria(_prevState: State, formData: FormData): Promise<State> {
  const { professor } = await requireAdmin();
  const senhaAtual = String(formData.get("senhaAtual") ?? "");
  const novaSenha = String(formData.get("novaSenha") ?? "");
  if (novaSenha.length < 6) return { erro: "Nova senha precisa ter pelo menos 6 caracteres." };

  if (!professor.senhaHash || !(await verificarSenha(senhaAtual, professor.senhaHash))) {
    return { erro: "Senha atual incorreta." };
  }

  await prisma.professor.update({ where: { id: professor.id }, data: { senhaHash: await hashSenha(novaSenha) } });
  return { ok: true as const };
}
