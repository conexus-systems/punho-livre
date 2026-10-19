import { act, create, type ReactTestRenderer } from "react-test-renderer";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { __queueForTests, __resetTelemetryForTests, setTelemetryConsent } from "../telemetry";

function Boom(): never {
  throw new Error("tela quebrou");
}

afterAll(() => __resetTelemetryForTests());

it("error boundary mostra o painel de saída e registra a falha (com consentimento)", async () => {
  __resetTelemetryForTests();
  setTelemetryConsent(true);
  const onReset = jest.fn();
  const spy = jest.spyOn(console, "error").mockImplementation(() => undefined);
  let r!: ReactTestRenderer;
  await act(async () => {
    r = create(
      <ErrorBoundary onReset={onReset}>
        <Boom />
      </ErrorBoundary>,
    );
  });
  expect(JSON.stringify(r.toJSON())).toContain("algo deu errado");
  const crash = __queueForTests().find((e) => e.name === "crash");
  expect(crash?.props).toMatchObject({ source: "boundary", fatal: false });
  expect(String(crash?.props.message)).toContain("tela quebrou");
  const button = r.root.findAll((n) => n.props.accessibilityLabel === "Voltar ao menu" && typeof n.props.onPress === "function")[0];
  await act(async () => button.props.onPress());
  expect(onReset).toHaveBeenCalled();
  await act(async () => r.unmount());
  spy.mockRestore();
});
