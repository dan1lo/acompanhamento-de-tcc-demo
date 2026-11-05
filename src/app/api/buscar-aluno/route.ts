import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { buscarAlunosAcessiveis } from "@/lib/buscaGlobal";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ resultados: [] }, { status: 401 });

  const query = request.nextUrl.searchParams.get("q") ?? "";
  const resultados = await buscarAlunosAcessiveis(query, session);
  return NextResponse.json({ resultados });
}
