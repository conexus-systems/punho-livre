import { act, create, type ReactTestRenderer } from "react-test-renderer";

import { MetroButton, MetroDialog, MetroPivot, MetroToggle } from "@/components/metro";
import { app } from "@/src/store";
import { setTheme } from "@/src/ui/theme";

import Paywall from "@/app/paywall";
import Profile from "@/app/profile";
import RosterScreen from "@/app/roster";
import Select from "@/app/select";
import Settings from "@/app/settings";
import Start from "@/app/index";

global.fetch = jest.fn(async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ characters: [], players: [], matches: [] }) })) as unknown as typeof fetch;

function texts(r: ReactTestRenderer): string {
  const out: string[] = [];
  const walk = (node: unknown): void => {
    if (typeof node === "string") out.push(node);
    else if (Array.isArray(node)) node.forEach(walk);
    else if (node && typeof node === "object" && "children" in node) walk((node as { children: unknown }).children);
  };
  walk(r.toJSON());
  return out.join(" ");
}

async function render(el: React.ReactElement): Promise<ReactTestRenderer> {
  let r!: ReactTestRenderer;
  await act(async () => {
    r = create(el);
  });
  await act(async () => {
    await new Promise((res) => setTimeout(res, 0));
  });
  return r;
}

afterEach(() => jest.useRealTimers());

describe("telas W10M montam sem erro", () => {
  it("Iniciar mostra os Live Tiles", async () => {
    const r = await render(<Start />);
    const all = texts(r);
    for (const t of ["Iniciar", "Arcade", "Online", "Versus CPU", "Personagens"]) expect(all).toContain(t);
    // blocos pequenos mostram só o ícone; o nome fica no rótulo de acessibilidade
    const labels = r.root.findAll((n) => n.props.accessibilityRole === "button").map((n) => n.props.accessibilityLabel);
    for (const t of ["Treino", "Ajustes", "Ranking", "Premium"]) expect(labels).toContain(t);
    r.unmount();
  });

  it("Seleção lista o elenco nativo", async () => {
    const r = await render(<Select />);
    const all = texts(r);
    for (const n of ["Kaze", "Brasa", "Titã", "Yuki", "Volt", "Sombra"]) expect(all).toContain(n);
    r.unmount();
  });

  it("Personagens, Perfil, Ajustes e Premium", async () => {
    for (const [el, expected] of [
      [<RosterScreen key="r" />, "Nenhum personagem extra publicado ainda"],
      [<Profile key="p" />, "Entre com sua conta CONEXUS"],
      [<Settings key="s" />, "Especiais em um toque"],
      [<Paywall key="w" />, "Sem anúncios"],
    ] as const) {
      const r = await render(el);
      expect(texts(r)).toContain(expected);
      r.unmount();
    }
  });

  it("tema claro e cor personalizada aplicam sem quebrar", async () => {
    setTheme({ mode: "light", accent: "#1BA1E2" });
    const r = await render(<Settings />);
    const tab = r.root.findAll((n) => n.props.accessibilityLabel === "Personalização, aba 2 de 3")[0];
    await act(async () => tab.props.onPress());
    expect(texts(r)).toContain("Cor de destaque · Ciano");
    r.unmount();
    setTheme({ mode: "dark", accent: "#E51400" });
  });
});

describe("componentes metro", () => {
  it("pivô troca de seção e anuncia a aba", async () => {
    const onChange = jest.fn();
    const r = await render(
      <MetroPivot sections={["Conta", "Ranking"]} index={0} onChange={onChange}>
        <MetroToggle label="Vibração" value onChange={() => undefined} />
      </MetroPivot>,
    );
    const tab = r.root.findAll((n) => n.props.accessibilityLabel === "Ranking, aba 2 de 2")[0];
    await act(async () => tab.props.onPress());
    expect(onChange).toHaveBeenCalledWith(1);
    expect(texts(r)).toContain("Ativado");
  });

  it("botão destrutivo vira perigo e diálogo ordena os botões", async () => {
    const r = await render(
      <MetroDialog visible title="Remover?" positive="Remover" negative="Cancelar" onPositive={() => undefined} onNegative={() => undefined}>
        <MetroButton label="Baixar" onPress={() => undefined} />
      </MetroDialog>,
    );
    const labels = r.root.findAll((n) => n.props.accessibilityRole === "button" && typeof n.props.accessibilityLabel === "string").map((n) => n.props.accessibilityLabel);
    expect(labels.indexOf("Remover")).toBeLessThan(labels.indexOf("Cancelar"));
  });

  it("perfil logado mostra rating formatado", async () => {
    app.set({
      session: { accessToken: "a", refreshToken: null, expiresAt: Date.now() + 1e6, sub: "u", email: "a@b.c", name: "Ryo" },
      player: { id: 1, conexus_user_id: "u", display_name: "Ryo", email: "a@b.c", rating: 1234, wins: 1, losses: 0, premium: false, admin: false },
    });
    const r = await render(<Profile />);
    const all = texts(r);
    expect(all).toContain("1.234");
    expect(all).toContain("1 vitória");
    r.unmount();
    app.set({ session: null, player: null });
  });
});
