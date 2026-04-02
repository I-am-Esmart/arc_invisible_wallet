import { useState } from "react"
import { sendTransaction } from "../lib/api"
import { useNavigate } from "react-router-dom"
import { DEFAULT_TOKEN, TOKEN_OPTIONS } from "../lib/tokens"

const ARC_EXPLORER_BASE = "https://testnet.arcscan.app/tx"

export default function Send() {
  const [to, setTo] = useState("")
  const [amount, setAmount] = useState("")
  const [token, setToken] = useState(DEFAULT_TOKEN)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState(null)
  const navigate = useNavigate()

  async function handleSend(e) {
    e.preventDefault()
    setError("")
    setResult(null)

    if (!to || !amount) {
      setError("Recipient and amount are required")
      return
    }

    const user = JSON.parse(localStorage.getItem("user"))

    try {
      setLoading(true)
      const res = await sendTransaction({
        to,
        amount,
        token,
        email: user?.email,
        arcKeyId: user?.arcKeyId,
      })
      setResult(res)

      const txRecord = {
        hash: res.hash,
        from: user?.address,
        to,
        amount,
        symbol: res.symbol || token,
        status: "confirmed",
        timestamp: Date.now(),
        explorer: res.explorer || `${ARC_EXPLORER_BASE}/${res.hash}`,
      }
      const existing = JSON.parse(localStorage.getItem("txs") || "[]")
      localStorage.setItem("txs", JSON.stringify([txRecord, ...existing]))

      setTo("")
      setAmount("")
    } catch (err) {
      setError(err.message || "Transaction failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto mt-10 bg-white p-6 rounded-2xl shadow">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-blue-600">Send Crypto</h1>
        <button
          onClick={() => navigate("/dashboard")}
          className="cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-800"
        >
          Back
        </button>
      </div>

      <form onSubmit={handleSend} className="space-y-4">
        <div>
          <label className="block mb-1 font-medium">Token</label>
          <select
            className="w-full border rounded-lg p-3 bg-white"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          >
            {TOKEN_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block mb-1 font-medium">Recipient Address</label>
          <input
            className="w-full border rounded-lg p-3"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="0x..."
          />
        </div>

        <div>
          <label className="block mb-1 font-medium">Amount ({token})</label>
          <input
            type="number"
            step="0.000001"
            className="w-full border rounded-lg p-3"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="1.0"
          />
        </div>

        <button
          disabled={loading}
          className="w-full cursor-pointer bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 transition disabled:opacity-50"
        >
          {loading ? "Sending..." : `Send ${token}`}
        </button>
      </form>

      {error && (
        <div className="mt-4 text-red-600 bg-red-50 p-3 rounded-lg">
          Error: {error}
        </div>
      )}

      {result?.hash && (
        <div className="mt-4 text-green-600 bg-green-50 p-3 rounded-lg">
          {result.symbol || token} transaction sent!
          <a
            href={result.explorer || `${ARC_EXPLORER_BASE}/${result.hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block mt-2 underline"
          >
            View on Arc Explorer
          </a>
        </div>
      )}
    </div>
  )
}
