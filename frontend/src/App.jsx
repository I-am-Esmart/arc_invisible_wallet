import { useState } from "react"
// import { Routes, Route, Link } from "react-router-dom"
import { Link, Routes, Route } from "react-router-dom"
import Send from "./pages/Send"
import Transactions from "./pages/Transactions"
import Dashboard from "./pages/Dashboard"
import Receive from "./pages/Receive"
import Login from "./pages/Login"
import Restore from "./pages/Restore"
import { createWallet as createWalletRequest, signMessage } from "./lib/api"

// Move the main wallet logic into a separate Home component
function Home() {
  const [address, setAddress] = useState("")
  const [arcKeyId, setArcKeyId] = useState("")
  const [message, setMessage] = useState("")
  const [signature, setSignature] = useState("")
  const [signedBy, setSignedBy] = useState("")

  const createWallet = async () => {
    try {
      const data = await createWalletRequest()
      setAddress(data.address)
      setArcKeyId(data.arcKeyId)
      setSignature("")
      setSignedBy("")
    } catch (err) {
      console.log(err)
      alert("Error creating wallet")
    }
  }

  const signMsg = async () => {
    try {
      const data = await signMessage({
        message,
        arcKeyId,
      })

      if (data.error) {
        alert(data.error)
        return
      }

      setSignature(data.signature)
      setSignedBy(data.signedBy)
    } catch (err) {
      console.log(err)
      alert("Error signing message")
    }
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Invisible Wallet (Demo)</h1>

      <button style={styles.button} onClick={createWallet}>
        Create Invisible Wallet
      </button>

      {address && (
        <div style={styles.box}>
          <p>
            <b>Address:</b> {address}
          </p>
          <p>
            <b>arcKeyId:</b> {arcKeyId}
          </p>
        </div>
      )}

      {arcKeyId && (
        <>
          <textarea
            style={styles.input}
            placeholder="Enter message to sign..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <button style={styles.button} onClick={signMsg}>
            Sign Message
          </button>
        </>
      )}

      {signature && (
        <div style={styles.box}>
          <p>
            <b>Signature:</b> {signature}
          </p>
          <p>
            <b>Signed by:</b> {signedBy}
          </p>
        </div>
      )}

      <div style={{ marginTop: "30px" }}>
        <Link to="/send" style={styles.link}>
          Go to Send Page
        </Link>
      </div>
    </div>
  )
}

// Main App component handling the Router
export default function App() {
  return (
    // <BrowserRouter>
    <Routes>
      {/* <Route path="/home" element={<Home />} /> */}
      <Route path="/send" element={<Send />} />
      <Route path="/transactions" element={<Transactions />} />
      <Route path="/" element={<Login />} />
      <Route path="/restore" element={<Restore />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/receive" element={<Receive />} />
    </Routes>
    // </BrowserRouter>
  )
}

const styles = {
  container: {
    width: "460px",
    margin: "40px auto",
    fontFamily: "Arial, sans-serif",
    textAlign: "center",
  },
  title: {
    fontSize: "26px",
    marginBottom: "20px",
  },
  button: {
    padding: "12px 20px",
    fontSize: "16px",
    marginTop: "15px",
    background: "black",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    display: "block",
    width: "100%",
  },
  box: {
    border: "1px solid #ddd",
    padding: "15px",
    marginTop: "20px",
    borderRadius: "6px",
    textAlign: "left",
    wordBreak: "break-word",
  },
  input: {
    width: "100%",
    height: "90px",
    padding: "10px",
    marginTop: "20px",
    borderRadius: "6px",
    border: "1px solid #ccc",
    fontSize: "15px",
    boxSizing: "border-box",
  },
  link: {
    display: "inline-block",
    background: "#2563eb",
    color: "white",
    padding: "10px 20px",
    borderRadius: "8px",
    textDecoration: "none",
  },
}
