const API_URL = "http://localhost:4000"

export async function createWallet() {
  const res = await fetch(`${API_URL}/create-wallet`, {
    method: "POST",
  })
  return res.json()
}

export async function getBalance(address) {
  const res = await fetch(`${API_URL}/get-balance`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address }),
  })
  return res.json()
}

export async function sendTransaction(data) {
  const res = await fetch(`${API_URL}/send-transaction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  return res.json()
}
