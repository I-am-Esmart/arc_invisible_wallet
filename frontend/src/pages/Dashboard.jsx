import { useEffect, useState } from "react"
import { fetchBalance } from "../lib/api"
import { Link, useNavigate } from "react-router-dom"

export default function Dashboard() {
  const navigate = useNavigate()
  const [wallet, setWallet] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  function handleLogout() {
    localStorage.removeItem("user")
    navigate("/")
  }

  const user = JSON.parse(localStorage.getItem("user"))

  // AUTH GUARD
  useEffect(() => {
    if (!user) {
      navigate("/")
    }
  }, [user, navigate])

  // LOAD WALLET
  useEffect(() => {
    async function load() {
      if (!user) return
      try {
        setError("")
        const data = await fetchBalance(user.address)
        setWallet(data)
      } catch (err) {
        setError(err.message || "Failed to load balance")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  if (!user || loading) {
    return <div className="p-6 text-gray-500">Loading wallet…</div>
  }

  if (error) {
    return (
      <div className="p-6 text-red-600">
        <h2 className="text-xl font-bold mb-2">Error</h2>
        <p>{error}</p>
        <p className="mt-4 text-sm text-gray-500">
          Make sure the backend is running and reachable at
          <code className="block mt-1 bg-gray-100 p-2 rounded">http://localhost:4000</code>.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto mt-10 p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-blue-600">Wallet Dashboard</h1>
        <button
          onClick={handleLogout}
          className="text-sm font-semibold text-red-600 hover:text-red-800 cursor-pointer"
        >
          Logout
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow p-6 mb-6">
        <p className="text-sm text-gray-500">Wallet</p>
        <div className="font-mono text-sm break-all mb-4">
          {user.address}
        </div>
        

        <div className="text-sm text-gray-500 mb-1 mt-4">Balance</div>
        <div className="text-3xl font-bold">
          {wallet.balance} {wallet.symbol || 'USDC'}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Link
          to="/send"
          className="bg-blue-600 text-white text-center py-4 rounded-xl font-medium hover:bg-blue-700"
        >
          Send
        </Link>

        <Link
          to="/receive"
          className="bg-gray-100 text-center py-4 rounded-xl font-medium hover:bg-gray-200"
        >
          Receive
        </Link>

        <Link
          to="/transactions"
          className="bg-gray-100 text-center py-4 rounded-xl font-medium hover:bg-gray-200"
        >
          History
        </Link>
      </div>
    </div>
  )
}
