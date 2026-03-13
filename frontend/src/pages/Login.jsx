import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { login as backendLogin } from "../lib/api"
import RestoreInstructionsModal from "../components/RestoreInstructionsModal"

export default function Login() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [showInstructions, setShowInstructions] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"))
    if (user) {
      navigate("/dashboard")
    }
  }, [navigate])

  async function handleLogin() {
    setLoading(true)
    setError("")

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
        <h1 className="text-2xl font-bold text-center mb-6 text-blue-600">
          Invisible Wallet Login
        </h1>

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
      </div>

      <RestoreInstructionsModal
        open={showInstructions}
        onClose={() => setShowInstructions(false)}
      />
    </div>
  )
}
