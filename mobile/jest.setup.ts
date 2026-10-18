/* Mocks de módulos nativos para os testes de renderização das telas. */
import mockAsyncStorage from "@react-native-async-storage/async-storage/jest/async-storage-mock";

jest.mock("@react-native-async-storage/async-storage", () => mockAsyncStorage);

jest.mock("@shopify/react-native-skia", () => {
  const React = require("react");
  const { View } = require("react-native");
  const recorder = () => ({
    beginRecording: () => new Proxy({}, { get: () => () => undefined }),
    finishRecordingAsPicture: () => ({}),
  });
  const paint = () => new Proxy({}, { get: () => () => undefined });
  return {
    Canvas: ({ children }: { children?: unknown }) => React.createElement(View, { testID: "skia-canvas" }, children),
    Picture: () => null,
    Skia: {
      PictureRecorder: recorder,
      XYWHRect: (x: number, y: number, w: number, h: number) => ({ x, y, width: w, height: h }),
      RRectXY: (r: unknown) => r,
      Paint: paint,
      Color: (c: string) => c,
      Data: { fromURI: async () => ({}), fromBase64: () => ({}) },
      Image: { MakeImageFromEncoded: () => null },
      Shader: { MakeLinearGradient: () => ({}), MakeRadialGradient: () => ({}) },
    },
    matchFont: () => ({ measureText: () => ({ width: 10 }), getSize: () => 12 }),
    TileMode: { Clamp: 0 },
    PaintStyle: { Fill: 0, Stroke: 1 },
    BlendMode: { Plus: 12 },
  };
});

jest.mock("expo-router", () => {
  const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
  return { router, useLocalSearchParams: () => ({}), Stack: () => null, Redirect: () => null };
});

jest.mock("expo-auth-session", () => ({
  useAuthRequest: () => [null, null, jest.fn()],
  ResponseType: { Code: "code" },
  TokenTypeHint: { RefreshToken: "refresh_token" },
  exchangeCodeAsync: jest.fn(),
  refreshAsync: jest.fn(),
  revokeAsync: jest.fn(),
}));

jest.mock("expo-file-system", () => {
  class Node {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = parts.map(String).join("/");
    }
    get exists() {
      return false;
    }
    create() {}
    write() {}
    delete() {}
    textSync() {
      return "{}";
    }
  }
  return { File: Node, Directory: Node, Paths: { document: "doc", cache: "cache" } };
});

jest.mock("expo-crypto", () => ({
  CryptoDigestAlgorithm: { SHA256: "SHA256" },
  digestStringAsync: async (_a: string, text: string) => `sha-${text.length}`,
}));

jest.mock("expo-haptics", () => ({ impactAsync: async () => undefined, ImpactFeedbackStyle: { Light: "l", Medium: "m" } }));
jest.mock("expo-secure-store", () => ({ getItemAsync: async () => null, setItemAsync: async () => undefined, deleteItemAsync: async () => undefined }));

jest.mock("@expo/app-integrity", () => ({
  prepareIntegrityTokenProviderAsync: async () => undefined,
  requestIntegrityCheckAsync: async () => "integrity-token",
}));
