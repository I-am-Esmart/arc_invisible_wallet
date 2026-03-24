import { useEffect, useState } from "react"
import { QRCodeCanvas } from "qrcode.react"
import { useNavigate } from "react-router-dom"

export default function Receive() {
  const [address, setAddress] = useState("")
  const [copied, setCopied] = useState(false)

  const [error, setError] = useState("")
  const navigate = useNavigate()

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"))
    if (user?.address) {
      setAddress(user.address)
      return
    }

    async function loadAddress() {
      try {
        setError("")
        const res = await fetch("http://localhost:4000/balance")
        const data = await res.json()
        setAddress(data.address)
      } catch (err) {
        setError("Unable to load address")
      }
    }

    loadAddress()
  }, [])


  function copyAddress() {
    navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="max-w-md mx-auto mt-12 p-6 text-center">
      <button
        onClick={() => navigate("/dashboard")}
        className="mb-4 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
      >
       ← Back
      </button>
      <h1 className="text-2xl font-bold text-blue-600 mb-6">Receive Crypto</h1>

      {/* QR Code */}
      <div className="bg-white p-6 rounded-2xl shadow mb-6 flex justify-center">
        {address && (
          <QRCodeCanvas
            value={address}
            size={220}
            bgColor="#ffffff"
            fgColor="#000000"
            level="H"
          />
        )}
      </div>

      {/* Address */}
      <div className="bg-gray-100 p-4 rounded-xl mb-4">
        <div className="text-xs text-gray-500 mb-1">Your wallet address</div>
        <div className="font-mono text-sm break-all">
          {address || "Loading…"}
        </div>
      </div>

      {/* Copy */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg">
          ❌ {error}
        </div>
      )}

      <button
        onClick={copyAddress}
        className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 mb-3"
      >
        {copied ? "Copied!" : "Copy Address"}
      </button>

      
    </div>
  )
}
