import Link from "next/link";
import { requireAdmin } from "@/lib/authz";
import TrocarSenhaForm from "./TrocarSenhaForm";

export default async function AdminSenhaPage() {
  await requireAdmin();

  return (
    <div className="max-w-md mx-auto space-y-4">
      <Link href="/admin" className="text-sm text-zinc-500 hover:underline">
        ← voltar
      </Link>
      <h1 className="text-xl font-semibold">Trocar minha senha</h1>
      <TrocarSenhaForm />
    </div>
  );
}
