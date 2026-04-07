export const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:4000").replace(/\/$/, "")

function handleResponse(res) {
  return res.text().then((text) => {
    if (!text) throw new Error("Empty response")
    let data
    try {
      data = JSON.parse(text)
    } catch {
      throw new Error("Backend did not return JSON")
    }

    if (!res.ok || data.error) {
      throw new Error(data.error || "Request failed")
    }

    return data
  })
}

export async function sendTransaction({ to, amount, email, arcKeyId, token }) {
  const res = await fetch(`${API_BASE}/send-transaction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to, amount, email, arcKeyId, token }),
  })
  return handleResponse(res)
}

export async function fetchTxHistory(address) {
  const query = address ? `?address=${encodeURIComponent(address)}` : ""
  const res = await fetch(`${API_BASE}/txs${query}`)
  return handleResponse(res)
}

export async function fetchBalance(address) {
  const query = address ? `?address=${encodeURIComponent(address)}` : ""
  const res = await fetch(`${API_BASE}/balance${query}`)
  return handleResponse(res)
}

export async function fetchBalances(address) {
  const query = address ? `?address=${encodeURIComponent(address)}` : ""
  const res = await fetch(`${API_BASE}/balances${query}`)
  return handleResponse(res)
}

export async function login(email) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  })
  return handleResponse(res)
}

export async function createWallet() {
  const res = await fetch(`${API_BASE}/create-wallet`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  })
  return handleResponse(res)
}

export async function checkHealth() {
  const res = await fetch(`${API_BASE}/health`)
  return handleResponse(res)
}

export async function getBalance(address) {
  const res = await fetch(`${API_BASE}/get-balance`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address }),
  })
  return handleResponse(res)
}

export async function signMessage({ message, arcKeyId }) {
  const res = await fetch(`${API_BASE}/sign-message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, arcKeyId }),
  })
  return handleResponse(res)
}
