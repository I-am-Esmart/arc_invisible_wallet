function getBackendApiUrl() {
  if (typeof window !== "undefined") {
    return process.env.NEXT_PUBLIC_BACKEND_API_URL || process.env.BACKEND_API_URL;
  }

  return process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_BACKEND_API_URL;
}

export class BackendApiError extends Error {
  status: number;
  payload?: Record<string, unknown> | null;

  constructor(message: string, status: number, payload?: Record<string, unknown> | null) {
    super(message);
    this.name = "BackendApiError";
    this.status = status;
    this.payload = payload;
  }
}

function buildBackendUrl(path: string) {
  const backendApiUrl = getBackendApiUrl();

  if (!backendApiUrl) {
    throw new Error("VeloxPay backend URL is not configured.");
  }

  return `${backendApiUrl.replace(/\/$/, "")}${path}`;
}

function getWalletSessionHeader() {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const stored = JSON.parse(window.localStorage.getItem("veloxpay_wallet_user") || "null") as {
      sessionToken?: string;
    } | null;

    return stored?.sessionToken ? { "X-VeloxPay-Session": stored.sessionToken } : {};
  } catch {
    return {};
  }
}

export async function backendFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");

  for (const [key, value] of Object.entries(getWalletSessionHeader())) {
    headers.set(key, value);
  }

  const response = await fetch(buildBackendUrl(path), {
    ...init,
    headers,
    cache: "no-store",
  });

  const text = await response.text();
  let data: unknown = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new BackendApiError("Backend returned non-JSON response.", response.status);
    }
  }

  if (!response.ok) {
    throw new BackendApiError(
      (data as { error?: string } | null)?.error ||
        `Backend request failed with status ${response.status}`,
      response.status,
      (data as Record<string, unknown> | null) || null,
    );
  }

  return data as T;
}
