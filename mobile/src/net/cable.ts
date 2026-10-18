/**
 * Cliente mínimo do protocolo ActionCable (actioncable-v1-json) sobre WebSocket.
 * Sem dependências: o React Native já tem WebSocket.
 */

type Listener = (msg: Record<string, unknown>) => void;

export interface CableSubscription {
  identifier: string;
  perform(action: string, data?: Record<string, unknown>): void;
  unsubscribe(): void;
}

export class CableClient {
  private ws: WebSocket | null = null;
  private subs = new Map<string, { onMessage: Listener; onConfirm?: () => void; onReject?: () => void }>();
  private pending: string[] = [];
  private open = false;
  onClose: ((reason: string) => void) | null = null;

  constructor(private readonly url: string) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url, ["actioncable-v1-json", "actioncable-unsupported"]);
      this.ws = ws;
      let welcomed = false;
      ws.onmessage = (ev) => {
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(String(ev.data));
        } catch {
          return;
        }
        switch (msg.type) {
          case "welcome":
            welcomed = true;
            this.open = true;
            this.pending.forEach((p) => ws.send(p));
            this.pending = [];
            resolve();
            return;
          case "ping":
            return;
          case "disconnect":
            this.onClose?.(String(msg.reason ?? "disconnect"));
            return;
          case "confirm_subscription":
            this.subs.get(String(msg.identifier))?.onConfirm?.();
            return;
          case "reject_subscription":
            this.subs.get(String(msg.identifier))?.onReject?.();
            return;
          default:
            if (msg.identifier && msg.message) {
              this.subs.get(String(msg.identifier))?.onMessage(msg.message as Record<string, unknown>);
            }
        }
      };
      ws.onerror = () => {
        if (!welcomed) reject(new Error("Não foi possível conectar ao servidor online."));
      };
      ws.onclose = () => {
        this.open = false;
        if (!welcomed) reject(new Error("Conexão recusada (login expirado?)."));
        else this.onClose?.("closed");
      };
    });
  }

  private send(payload: Record<string, unknown>): void {
    const text = JSON.stringify(payload);
    if (this.open && this.ws) this.ws.send(text);
    else this.pending.push(text);
  }

  subscribe(
    params: Record<string, unknown>,
    handlers: { onMessage: Listener; onConfirm?: () => void; onReject?: () => void },
  ): CableSubscription {
    const identifier = JSON.stringify(params);
    this.subs.set(identifier, handlers);
    this.send({ command: "subscribe", identifier });
    return {
      identifier,
      perform: (action, data = {}) =>
        this.send({ command: "message", identifier, data: JSON.stringify({ action, ...data }) }),
      unsubscribe: () => {
        this.subs.delete(identifier);
        this.send({ command: "unsubscribe", identifier });
      },
    };
  }

  close(): void {
    this.onClose = null;
    this.ws?.close();
    this.ws = null;
    this.open = false;
  }
}
