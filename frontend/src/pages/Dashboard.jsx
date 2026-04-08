import { useEffect, useState } from "react"
import { API_BASE, fetchBalances } from "../lib/api"
import { Link, useLocation, useNavigate } from "react-router-dom"
import FaucetInstructionsModal from "../components/FaucetInstructionsModal"
import { TOKEN_OPTIONS } from "../lib/tokens"

function formatTokenBalance(balance) {
  const numericBalance = Number(balance)

  if (!Number.isFinite(numericBalance)) {
    return balance
  }

  return numericBalance.toFixed(2)
}

export default function Dashboard() {
  const navigate = useNavigate()
  const location = useLocation()
  const [wallet, setWallet] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [showFaucetModal, setShowFaucetModal] = useState(false)

  function handleLogout() {
    localStorage.removeItem("user")
    navigate("/")
  }

  const user = JSON.parse(localStorage.getItem("user"))
  const returnTo = new URLSearchParams(location.search).get("returnTo")

  useEffect(() => {
    if (!user) {
      navigate("/")
    }
  }, [user, navigate])

  useEffect(() => {
    async function load() {
      if (!user) return

      try {
        setError("")
        const data = await fetchBalances(user.address)
        setWallet(data)
      } catch (err) {
        setError(err.message || "Failed to load balances")
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [user])

  if (!user || loading) {
    return <div className="p-6 text-gray-500">Loading wallet...</div>
  }

  if (error) {
    return (
      <div className="p-6 text-red-600">
        <h2 className="text-xl font-bold mb-2">Error</h2>
        <p>{error}</p>
        <p className="mt-4 text-sm text-gray-500">
          Make sure the backend is running and reachable at
          <code className="block mt-1 bg-gray-100 p-2 rounded">{API_BASE}</code>.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto mt-10 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-blue-600">Wallet Dashboard</h1>
          {user?.displayName && (
            <p className="mt-1 text-sm text-gray-500">Welcome back, {user.displayName}</p>
          )}
        </div>
        <button
          onClick={handleLogout}
          className="text-sm font-semibold text-red-600 hover:text-red-800 cursor-pointer"
        >
          Logout
        </button>
      </div>

      {returnTo && (
        <div className="mb-6 rounded-2xl bg-blue-50 p-4 text-sm text-blue-700">
          Your wallet is ready. Add faucet funds if needed, then continue back to VeloxPay
          to finish the payment.
          <a
            href={returnTo}
            className="ml-2 font-semibold underline"
          >
            Return to VeloxPay
          </a>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow p-6 mb-6">
        <p className="text-sm text-gray-500">Wallet</p>
        <div className="font-mono text-sm break-all mb-4">
          {user.address}
        </div>

        <div className="text-sm text-gray-500 mb-3 mt-4">Balances</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {TOKEN_OPTIONS.map((token) => {
            const tokenBalance = wallet?.balances?.[token.value]?.balance || "0"

            return (
              <div
                key={token.value}
                className="rounded-xl border border-gray-200 bg-gray-50 p-4"
              >
                <div className="text-sm text-gray-500">{token.label}</div>
                <div className="mt-1 text-2xl font-bold">
                  {formatTokenBalance(tokenBalance)} {token.label}
                </div>
              </div>
            )
          })}
        </div>

        <button
          type="button"
          onClick={() => setShowFaucetModal(true)}
          className="mt-4 cursor-pointer text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
        >
          Get faucet
        </button>
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

      <FaucetInstructionsModal
        open={showFaucetModal}
        onClose={() => setShowFaucetModal(false)}
      />
    </div>
  )
}
