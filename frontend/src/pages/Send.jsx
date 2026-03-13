import { useState } from "react"
import { sendTransaction } from "../lib/api"

export default function Send() {
  const [to, setTo] = useState("")
  const [amount, setAmount] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState(null)

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
        fromAddress: user?.address,
        arcKeyId: user?.arcKeyId,
      })
      setResult(res)
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
      <h1 className="text-2xl font-bold mb-6 text-blue-600">
        Send Crypto
      </h1>

      <form onSubmit={handleSend} className="space-y-4">
        <div>
          <label className="block mb-1 font-medium">
            Recipient Address
          </label>
          <input
            className="w-full border rounded-lg p-3"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="0x..."
          />
        </div>

        <div>
          <label className="block mb-1 font-medium">
            Amount (ETH)
          </label>
          <input
            className="w-full border rounded-lg p-3"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.01"
          />
        </div>

        <button
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 transition disabled:opacity-50"
        >
          {loading ? "Sending..." : "Send"}
        </button>
      </form>

      {error && (
        <div className="mt-4 text-red-600 bg-red-50 p-3 rounded-lg">
          ❌ {error}
        </div>
      )}

      {result?.hash && (
        <div className="mt-4 text-green-600 bg-green-50 p-3 rounded-lg">
          ✅ Transaction sent!

          <a
            href={`https://sepolia.etherscan.io/tx/${result.hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block mt-2 underline"
          >
            View on Etherscan
          </a>
        </div>
      )}
    </div>
  )
}