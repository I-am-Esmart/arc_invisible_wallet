import { useEffect, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { checkHealth, login as backendLogin } from "../lib/api"
import RestoreInstructionsModal from "../components/RestoreInstructionsModal"

export default function Login() {
  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [backendError, setBackendError] = useState("")
  const [checkingBackend, setCheckingBackend] = useState(false)
  const [showInstructions, setShowInstructions] = useState(false)
  const navigate = useNavigate()
  const source = searchParams.get("source")
  const returnTo = searchParams.get("returnTo")

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"))
    if (user) {
      navigate("/dashboard")
    }
  }, [navigate])

  async function checkBackend() {
    setCheckingBackend(true)
    try {
      await checkHealth()
      setBackendError("")
      return true
    } catch (err) {
      setBackendError(err.message || "Failed to reach backend")
      return false
    } finally {
      setCheckingBackend(false)
    }
  }

  useEffect(() => {
    checkBackend()
  }, [])

  useEffect(() => {
    const emailFromLink = searchParams.get("email")
    const savedName = localStorage.getItem("walletDisplayName") || ""

    if (emailFromLink) {
      setEmail(emailFromLink)
    }

    if (savedName) {
      setDisplayName(savedName)
    }
  }, [searchParams])

  async function handleLogin() {
    setLoading(true)
    setError("")

    const healthy = await checkBackend()
    if (!healthy) {
      setLoading(false)
      return
    }

    try {
      const data = await backendLogin(email, displayName)
      localStorage.setItem("user", JSON.stringify(data))
      if (data?.displayName) {
        localStorage.setItem("walletDisplayName", data.displayName)
      }

      const target = returnTo
        ? `/dashboard?returnTo=${encodeURIComponent(returnTo)}`
        : "/dashboard"
      navigate(target)
    } catch (err) {
      setError(err.message || "Login failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-2xl shadow max-w-sm w-full">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-blue-600">Arc Wallet Login</h1>
        </div>

        {source === "veloxpay" && (
          <div className="mb-4 rounded-xl bg-blue-50 p-3 text-sm text-blue-700">
            Create your wallet to continue your VeloxPay payment. We&apos;ll use this
            email to restore your wallet any time you come back.
          </div>
        )}

        <input
          type="text"
          placeholder="Your name"
          className="w-full p-3 border rounded-xl mb-4"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />

        <input
          type="email"
          placeholder="you@email.com"
          className="w-full p-3 border rounded-xl mb-4"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        {error && (
          <div className="text-red-600 bg-red-50 p-3 rounded-xl mb-4">
            Error: {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium"
        >
          {loading ? "Creating wallet..." : "Create / Restore Wallet"}
        </button>

        <div className="text-center mt-6 text-sm text-gray-500">
          Already created a wallet?{" "}
          <Link to="/restore" className="text-blue-600 hover:underline">
            Restore it here
          </Link>
          {" | "}
          <button
            onClick={() => setShowInstructions(true)}
            className="cursor-pointer text-blue-600 hover:underline"
          >
            How it works
          </button>
        </div>

        {backendError && (
          <div className="mt-4 text-sm text-gray-600">
            <div className="mb-2 text-xs text-red-600">
              {backendError}
            </div>
            <button
              onClick={checkBackend}
              disabled={checkingBackend}
              className="cursor-pointer px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
            >
              {checkingBackend ? "Retrying..." : "Retry connection"}
            </button>
          </div>
        )}

        {returnTo && (
          <p className="mt-4 text-xs text-gray-500">
            After your wallet is ready, we&apos;ll take you back so you can complete your
            payment.
          </p>
        )}
      </div>

      <RestoreInstructionsModal
        open={showInstructions}
        onClose={() => setShowInstructions(false)}
      />
    </div>
  )
}
