/**
 * Cliente mínimo do protocolo ActionCable (actioncable-v1-json) sobre WebSocket.
 * Sem dependências: o React Native já tem WebSocket.
 *
 * Vigia a conexão: o servidor manda `ping` a cada 3 s; sem nenhuma mensagem
 * por `staleAfterMs` a conexão é dada como morta (rede caiu sem fechar o
 * socket, comum no celular) e `onClose("stale")` dispara para quem estiver
 * usando reconectar (ver online.ts).
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
  private lastMessageAt = 0;
  private watchdog: ReturnType<typeof setInterval> | null = null;
  onClose: ((reason: string) => void) | null = null;
  /** Sem mensagens por este tempo durante uma partida = conexão morta. */
  staleAfterMs = 6000;

  constructor(private readonly url: string) {}

  get connected(): boolean {
    return this.open;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url, ["actioncable-v1-json", "actioncable-unsupported"]);
      this.ws = ws;
      let welcomed = false;
      ws.onmessage = (ev) => {
        this.lastMessageAt = Date.now();
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
            this.startWatchdog();
            resolve();
            return;
          case "ping":
            return;
          case "disconnect":
            this.drop(String(msg.reason ?? "disconnect"));
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
        if (!welcomed) reject(new Error("Conexão recusada (login expirado?)."));
        else this.drop("closed");
      };
    });
  }

  private startWatchdog(): void {
    this.stopWatchdog();
    this.watchdog = setInterval(() => {
      if (this.open && Date.now() - this.lastMessageAt > this.staleAfterMs) this.drop("stale");
    }, 1000);
  }

  private stopWatchdog(): void {
    if (this.watchdog) clearInterval(this.watchdog);
    this.watchdog = null;
  }

  /** Conexão perdida (fechou, servidor mandou `disconnect` ou ficou muda). */
  private drop(reason: string): void {
    if (!this.open) return;
    this.open = false;
    this.stopWatchdog();
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      ws.onclose = null;
      ws.onmessage = null;
      try {
        ws.close();
      } catch {
        // já fechado
      }
    }
    this.onClose?.(reason);
  }

  private send(payload: Record<string, unknown>): void {
    const text = JSON.stringify(payload);
    if (this.open && this.ws) this.ws.send(text);
    else if (this.ws) this.pending.push(text);
    // sem socket (conexão perdida): descarta; a reconexão reenvia o que importa
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
    this.stopWatchdog();
    this.ws?.close();
    this.ws = null;
    this.open = false;
  }
}
