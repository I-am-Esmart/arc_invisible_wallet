import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { login as backendLogin } from "../lib/api"
import RestoreInstructionsModal from "../components/RestoreInstructionsModal"

export default function Restore() {
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

  async function handleRestore() {
    setLoading(true)
    setError("")

    try {
      const data = await backendLogin(email)
      localStorage.setItem("user", JSON.stringify(data))
      navigate("/dashboard")
    } catch (err) {
      setError(err.message || "Restore failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-2xl shadow max-w-sm w-full">
        <h1 className="text-2xl font-bold text-center mb-6 text-blue-600">
          Restore Wallet
        </h1>

        <p className="text-sm text-gray-500 mb-4">
          Enter the email you used previously to restore your wallet on this device.
        </p>

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
          onClick={handleRestore}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium"
        >
          {loading ? "Restoring…" : "Restore Wallet"}
        </button>

        <div className="text-center mt-6 text-sm text-gray-500">
          Didn’t create a wallet yet?{' '}
          <Link to="/" className="text-blue-600 hover:underline">
            Create one now
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
