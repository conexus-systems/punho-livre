import { Platform } from "react-native";
import * as AppIntegrity from "@expo/app-integrity";

import { config } from "@/src/config";
import { ensureLicense } from "@/src/services/license";
import { app, type Player } from "@/src/store";

jest.mock("@/src/services/auth", () => ({ accessToken: async () => "tok" }));
jest.mock("expo-crypto", () => ({
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
  digestStringAsync: async (_a: string, s: string) => `sha(${s})`,
}));

const NOW = Date.parse("2026-10-18T12:00:00Z");
const player = (p: Partial<Player>): Player => ({
  id: 1, conexus_user_id: "u", display_name: "Kaze", email: null, rating: 1500, wins: 0, losses: 0, premium: false, admin: false, ...p,
});

function json(status: number, body: unknown) {
  return { status, ok: status < 400, text: async () => JSON.stringify(body) } as unknown as Response;
}

describe("licença do jogo pago (Play Integrity)", () => {
  const fetchMock = jest.fn();
  beforeAll(() => {
    (global as any).fetch = fetchMock;
    Platform.OS = "android";
    (config as any).playCloudProject = "123456";
  });
  beforeEach(() => fetchMock.mockReset());

  it("não pede nada quando o servidor não exige, ou a licença ainda vale por mais de um dia", async () => {
    app.set({ player: player({ license_required: false }) });
    await ensureLicense(NOW);
    app.set({ player: player({ license_required: true, licensed_until: "2026-10-22T12:00:00Z" }) });
    await ensureLicense(NOW);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("desafio → veredito com SHA-256(nonce) → verificação no servidor → licença salva", async () => {
    const spy = jest.spyOn(AppIntegrity, "requestIntegrityCheckAsync");
    fetchMock.mockResolvedValueOnce(json(200, { nonce: "n1", required: true })).mockResolvedValueOnce(json(200, { licensed_until: "2026-10-25T12:00:00Z" }));
    app.set({ player: player({ license_required: true, licensed_until: null }) });

    await ensureLicense(NOW);

    expect(spy).toHaveBeenCalledWith("sha(n1)");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ nonce: "n1", token: "integrity-token" });
    expect(app.get().player?.licensed_until).toBe("2026-10-25T12:00:00Z");
  });

  it("cópia não comprada vira mensagem clara para o jogador", async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, { nonce: "n2", required: true }))
      .mockResolvedValueOnce(json(403, { error: "not_licensed", message: "license check failed" }));
    app.set({ player: player({ license_required: true, licensed_until: null }) });

    await expect(ensureLicense(NOW)).rejects.toThrow("comprou o jogo na Google Play");
  });
});
