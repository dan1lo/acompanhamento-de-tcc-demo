import bcrypt from "bcryptjs";

/** 10 rounds é o padrão recomendado pela própria lib — equilíbrio custo/segurança pra um app deste porte. */
const SALT_ROUNDS = 10;

export async function hashSenha(senha: string): Promise<string> {
  return bcrypt.hash(senha, SALT_ROUNDS);
}

export async function verificarSenha(senha: string, hash: string): Promise<boolean> {
  return bcrypt.compare(senha, hash);
}
