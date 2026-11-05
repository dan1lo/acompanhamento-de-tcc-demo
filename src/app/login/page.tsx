import { prisma } from "@/lib/prisma";
import { loginAsCoordenador, loginAsProfessor, criarUsuario } from "./actions";
import LoginComSenhaForm from "./LoginComSenhaForm";

export default async function LoginPage() {
  // Só entram na lista "sem senha" quem ainda não teve uma senha configurada — depois disso, a
  // conta passa a exigir e-mail + senha (ver LoginComSenhaForm), não continua acessível pela
  // lista mesmo que a UI de quem tem senha "esqueça" de esconder.
  const [coordenadores, professores] = await Promise.all([
    prisma.coordenador.findMany({ where: { senhaHash: null }, orderBy: { nome: "asc" } }),
    prisma.professor.findMany({ where: { senhaHash: null }, orderBy: { nome: "asc" } }),
  ]);

  return (
    <div className="max-w-xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Entrar</h1>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-zinc-700">E-mail e senha</h2>
        <LoginComSenhaForm />
        <button
          type="button"
          disabled
          title="Em breve"
          className="w-full rounded border px-3 py-2 text-sm text-zinc-400 cursor-not-allowed flex items-center justify-center gap-2"
        >
          Entrar com Google
        </button>
      </section>

      {(coordenadores.length > 0 || professores.length > 0) && (
        <div>
          <h2 className="text-sm font-medium text-zinc-700 mb-1">Acesso sem senha (contas ainda não migradas)</h2>
          <p className="text-xs text-zinc-400 mb-2">
            Só aparece aqui quem ainda não tem senha configurada — assim que alguém configurar
            uma, a conta some dessa lista e passa a entrar só por e-mail e senha.
          </p>
        </div>
      )}

      {coordenadores.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-zinc-700 mb-2">Coordenadores</h2>
          <ul className="space-y-1">
            {coordenadores.map((c) => (
              <li key={c.id}>
                <form action={loginAsCoordenador}>
                  <input type="hidden" name="id" value={c.id} />
                  <button className="w-full text-left rounded border px-3 py-2 hover:bg-zinc-100">
                    {c.nome} <span className="text-zinc-400 text-xs">({c.email})</span>
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      {professores.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-zinc-700 mb-2">Professores</h2>
          <ul className="space-y-1">
            {professores.map((p) => (
              <li key={p.id}>
                <form action={loginAsProfessor}>
                  <input type="hidden" name="id" value={p.id} />
                  <button className="w-full text-left rounded border px-3 py-2 hover:bg-zinc-100">
                    {p.nome} <span className="text-zinc-400 text-xs">({p.email ?? "sem e-mail"})</span>
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="text-sm font-medium text-zinc-700 mb-2">Criar novo cadastro</h2>
        <form action={criarUsuario} className="space-y-3 border rounded p-4">
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-1.5">
              <input type="radio" name="tipo" value="professor" defaultChecked /> Professor
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" name="tipo" value="coordenador" /> Coordenador
            </label>
          </div>
          <input
            name="nome"
            placeholder="Nome"
            required
            className="w-full rounded border px-3 py-2 text-sm"
          />
          <input
            name="email"
            type="email"
            placeholder="E-mail institucional"
            required
            className="w-full rounded border px-3 py-2 text-sm"
          />
          <button className="rounded bg-orange-600 text-white px-4 py-2 text-sm hover:bg-orange-700">
            Criar e entrar
          </button>
        </form>
      </section>
    </div>
  );
}
