import { accessToken } from "./auth";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function requestJson<T>(
  url: string,
  init: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json", ...(init.headers as Record<string, string>) };
  if (init.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
  if (init.auth) {
    const token = await accessToken();
    if (!token) throw new HttpError(401, "not_logged_in", "Faça login para continuar.");
    headers.Authorization = `Bearer ${token}`;
  }
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers });
  } catch {
    throw new HttpError(0, "network", "Sem conexão com o servidor. Verifique a internet e tente de novo.");
  }
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!res.ok) {
    const b = (body ?? {}) as { error?: string; message?: string };
    throw new HttpError(res.status, b.error ?? `http_${res.status}`, b.message ?? `Erro ${res.status}`);
  }
  return body as T;
}
