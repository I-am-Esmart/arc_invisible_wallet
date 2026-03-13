import { useState } from "react"
import { createWallet, getBalance } from "../lib/api"

export default function Home() {
  const [wallet, setWallet] = useState(null)
  const [balance, setBalance] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleCreateWallet = async () => {
    try {
      setLoading(true)
      const res = await createWallet()
      setWallet(res)
      const bal = await getBalance(res.address)
      setBalance(bal.balance)
      alert("Wallet created successfully!")
    } catch (err) {
      alert("Error creating wallet")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6">
      <button
        onClick={handleCreateWallet}
        className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
      >
        {loading ? "Creating wallet..." : "Create Wallet"}
      </button>

      {wallet && (
        <div className="mt-6 p-4 bg-gray-900 text-white rounded-xl">
          <p>Address: {wallet.address}</p>
          <p>Private Key: {wallet.privateKey}</p>
          <p className="mt-2 text-blue-400">Balance: {balance} ETH</p>
        </div>
      )}
    </div>
  )
}
