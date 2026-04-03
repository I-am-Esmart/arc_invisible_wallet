const BACKEND_API_URL =
  process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_BACKEND_API_URL;

export class BackendApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "BackendApiError";
    this.status = status;
  }
}

function buildBackendUrl(path: string) {
  if (!BACKEND_API_URL) {
    throw new Error("BACKEND_API_URL is not configured.");
  }

  return `${BACKEND_API_URL.replace(/\/$/, "")}${path}`;
}

export async function backendFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(buildBackendUrl(path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
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
    );
  }

  return data as T;
}
