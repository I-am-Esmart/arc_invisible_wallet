import { useState } from "react"
import { sendTransaction } from "../api/wallet"

export default function SendTransactionCard() {
  const [from, setFrom] = useState("")
  const [privateKey, setPrivateKey] = useState("")
  const [to, setTo] = useState("")
  const [amount, setAmount] = useState("")

  const handleSend = async () => {
    try {
      const res = await sendTransaction({ from, privateKey, to, amount })
      if (res.hash) alert("Transaction Sent! Hash: " + res.hash)
      else alert("Error sending transaction")
    } catch {
      alert("Transaction failed")
    }
  }

  return (
    <div className="p-4 bg-gray-900 text-white rounded-xl mt-6">
      <input
        className="w-full p-2 bg-gray-800 rounded mb-2"
        placeholder="Sender Address"
        value={from}
        onChange={(e) => setFrom(e.target.value)}
      />

      <input
        className="w-full p-2 bg-gray-800 rounded mb-2"
        placeholder="Private Key"
        value={privateKey}
        onChange={(e) => setPrivateKey(e.target.value)}
      />

      <input
        className="w-full p-2 bg-gray-800 rounded mb-2"
        placeholder="Recipient Address"
        value={to}
        onChange={(e) => setTo(e.target.value)}
      />

      <input
        className="w-full p-2 bg-gray-800 rounded mb-2"
        placeholder="Amount ETH"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />

      <button
        onClick={handleSend}
        className="px-4 py-2 bg-green-600 rounded hover:bg-green-700"
      >
        Send
      </button>
    </div>
  )
}
