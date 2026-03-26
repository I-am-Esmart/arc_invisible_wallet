import { useState } from "react"
import { sendTransaction } from "../lib/api"

const ARC_EXPLORER_BASE = "https://testnet.arcscan.app/tx"

export default function SendTransactionCard() {
  const [to, setTo] = useState("")
  const [amount, setAmount] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState(null)

  const handleSend = async () => {
    try {
      setError("")
      setResult(null)
      setLoading(true)

      const user = JSON.parse(localStorage.getItem("user"))
      if (!user) {
        setError("Not logged in")
        return
      }

      const res = await sendTransaction({ 
        to, 
        amount, 
        email: user.email,
        arcKeyId: user.arcKeyId
      })
      
      setResult(res)
      setTo("")
      setAmount("")
      
      // Store transaction in localStorage
      const txRecord = {
        hash: res.hash,
        from: user.address,
        to,
        amount,
        status: "confirmed",
        timestamp: Date.now(),
        explorer: res.explorer || `${ARC_EXPLORER_BASE}/${res.hash}`,
      }
      const existing = JSON.parse(localStorage.getItem("txs") || "[]")
      localStorage.setItem("txs", JSON.stringify([txRecord, ...existing]))
      
    } catch (err) {
      setError(err.message || "Transaction failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 bg-gray-50 rounded-xl mt-6 border border-gray-200">
      <h3 className="font-semibold mb-4 text-gray-800">Send USDC</h3>
      
      <div className="space-y-3">
        <input
          className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Recipient Address (0x...)"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />

        <input
          className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Amount (USDC)"
          type="number"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />

        {error && (
          <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">
            ❌ {error}
          </div>
        )}

        {result && (
          <div className="p-3 bg-green-50 text-green-600 rounded-lg text-sm">
            ✓ Transaction sent! 
            <a
              href={result.explorer || `${ARC_EXPLORER_BASE}/${result.hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-blue-600 hover:underline font-mono text-xs mt-1"
            >
              View on Arc Explorer →
            </a>
          </div>
        )}

        <button
          onClick={handleSend}
          disabled={loading}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {loading ? "Sending..." : "Send USDC"}
        </button>
      </div>
    </div>
  )
}
