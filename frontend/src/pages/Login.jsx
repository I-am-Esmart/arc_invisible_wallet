import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { checkHealth, login as backendLogin } from "../lib/api"
import RestoreInstructionsModal from "../components/RestoreInstructionsModal"

export default function Login() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [backendHealthy, setBackendHealthy] = useState(null)
  const [backendError, setBackendError] = useState("")
  const [checkingBackend, setCheckingBackend] = useState(false)
  const [showInstructions, setShowInstructions] = useState(false)
  const navigate = useNavigate()

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
      setBackendHealthy(true)
      setBackendError("")
      return true
    } catch (err) {
      setBackendHealthy(false)
      setBackendError(err.message || "Failed to reach backend")
      return false
    } finally {
      setCheckingBackend(false)
    }
  }

  useEffect(() => {
    checkBackend()
  }, [])

  async function handleLogin() {
    setLoading(true)
    setError("")

    const healthy = await checkBackend()
    if (!healthy) {
      setLoading(false)
      return
    }

    try {
      const data = await backendLogin(email)
      localStorage.setItem("user", JSON.stringify(data))
      navigate("/dashboard")
    } catch (err) {
      setError(err.message || "Login failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-2xl shadow max-w-sm w-full">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-blue-600">Arc Wallet Login</h1>
          {backendHealthy === true && (
            <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">
              Backend online
            </span>
          )}
          {backendHealthy === false && (
            <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700">
              Backend offline
            </span>
          )}
          {backendError && (
            <div className="mt-2 text-xs text-red-600">
              {backendError}
            </div>
          )}
          {backendHealthy === false && (
            <button
              onClick={checkBackend}
              disabled={checkingBackend}
              className="mt-2 text-xs px-3 py-1 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200"
            >
              {checkingBackend ? "Retrying…" : "Retry connection"}
            </button>
          )}
        </div>

        <input
          type="email"
          placeholder="you@email.com"
          className="w-full p-3 border rounded-xl mb-4"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        {error && (
          <div className="text-red-600 bg-red-50 p-3 rounded-xl mb-4">
            ❌ {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium"
        >
          {loading ? "Creating wallet…" : "Create / Restore Wallet"}
        </button>

        <div className="text-center mt-6 text-sm text-gray-500">
          Already created a wallet?{' '}
          <Link to="/restore" className="text-blue-600 hover:underline">
            Restore it here
          </Link>
          {' | '}
          <button
            onClick={() => setShowInstructions(true)}
            className="text-blue-600 hover:underline"
          >
            How it works
          </button>
        </div>

        {backendHealthy === false && (
          <div className="mt-4 text-sm text-gray-600">
            <button
              onClick={checkBackend}
              className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
            >
              Retry connection
            </button>
          </div>
        )}
      </div>

      <RestoreInstructionsModal
        open={showInstructions}
        onClose={() => setShowInstructions(false)}
      />
    </div>
  )
}
