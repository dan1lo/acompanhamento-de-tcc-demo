"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();
  return (
    <button
      className="text-orange-100 hover:text-white underline"
      onClick={async () => {
        await fetch("/login/sair", { method: "POST" });
        router.push("/login");
        router.refresh();
      }}
    >
      sair
    </button>
  );
}
