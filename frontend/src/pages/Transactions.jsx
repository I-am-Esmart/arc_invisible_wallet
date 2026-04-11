import { useEffect, useState } from "react"
import { fetchTxHistory } from "../lib/api"
import { useNavigate } from "react-router-dom"
import { getStoredTxsForUser } from "../lib/txStorage"

const ARC_EXPLORER_BASE = "https://testnet.arcscan.app/tx"

function mergeTxLists(primaryTxs, secondaryTxs) {
  const seen = new Set()
  const merged = []

  for (const tx of [...primaryTxs, ...secondaryTxs]) {
    if (!tx) {
      continue
    }

    const key = tx.hash || `${tx.from}-${tx.to}-${tx.timestamp}`
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    merged.push(tx)
  }

  return merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
}

function getExplorerUrl(tx) {
  if (typeof tx.hash === "string" && tx.hash.startsWith("0x")) {
    return `${ARC_EXPLORER_BASE}/${tx.hash}`
  }

  return tx.explorer
}

export default function Transactions() {
  const [txs, setTxs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const navigate = useNavigate()

  async function loadTxs({ silent = false } = {}) {
    try {
      if (!silent) {
        setLoading(true)
      }
      setError("")

      // Show locally stored txs immediately (useful when backend cannot persist state)
      const user = JSON.parse(localStorage.getItem("user"))
      const localTxs = getStoredTxsForUser(user)
      if (localTxs.length) {
        setTxs(localTxs)
      }

      const data = await fetchTxHistory(user?.address)
      const nextTxs = Array.isArray(data.txs)
        ? mergeTxLists(data.txs, localTxs)
        : localTxs
      setTxs(nextTxs)
    } catch (err) {
      setError(err.message)
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    loadTxs()
    const interval = setInterval(() => {
      loadTxs({ silent: true })
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="max-w-3xl mx-auto mt-10 p-6">
      <button
        onClick={() => navigate("/dashboard")}
        className="mb-4 cursor-pointer px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
      >
         ← Back
      </button>
      <h1 className="text-2xl font-bold mb-6 text-blue-600">
        Transaction History
      </h1>

      {loading && <p className="text-gray-500">Loading transactions…</p>}

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4">
          ❌ {error}
        </div>
      )}

      {!loading && txs.length === 0 && (
        <p className="text-gray-500">No transactions yet.</p>
      )}

      <div className="space-y-4">
        {txs.map((tx) => (
          <div
            key={tx.hash}
            className="bg-white border rounded-xl p-4 shadow-sm"
          >
            <div className="flex justify-between items-center mb-2">
              {getExplorerUrl(tx) ? (
                <a
                  href={getExplorerUrl(tx)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-sm text-blue-600 hover:underline"
                >
                  {tx.hash.slice(0, 10)}...{tx.hash.slice(-8)}
                </a>
              ) : (
                <span className="font-mono text-sm text-gray-500">
                  {tx.hash.slice(0, 10)}...{tx.hash.slice(-8)}
                </span>
              )}
              <span className="text-green-600 font-medium">{tx.status}</span>
            </div>

            <div className="text-sm space-y-1">
              <div>
                <strong>From:</strong> {tx.from?.slice(0, 10)}...{tx.from?.slice(-8)}
              </div>
              <div>
                <strong>To:</strong> {tx.to?.slice(0, 10)}...{tx.to?.slice(-8)}
              </div>
              <div>
                <strong>Amount:</strong> {tx.amount} {tx.symbol || tx.token || "USDC"}
              </div>
              <div className="text-xs text-gray-400">
                {new Date(tx.timestamp).toLocaleString()}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// const Transactions = () => {
//   return <div>Transactions</div>
// }

// export default Transactions

// import React, { useEffect, useState } from 'react';

// const API_URL = 'http://localhost:4000';

// export default function Transactions() {
//   const [txs, setTxs] = useState([])
//   const [loading, setLoading] = useState(false)
//   const [query, setQuery] = useState("")

//   async function fetchTxs() {
//     try {
//       setLoading(true)
//       const res = await fetch(`${API_URL}/txs`)
//       const data = await res.json()
//       setTxs(data.txs || [])
//     } catch (err) {
//       console.error("failed to fetch txs", err)
//     } finally {
//       setLoading(false)
//     }
//   }

//   useEffect(() => {
//     fetchTxs()
//     const id = setInterval(fetchTxs, 10000) // refresh every 10s
//     return () => clearInterval(id)
//   }, [])

//   const filtered = txs.filter(
//     (tx) =>
//       !query ||
//       tx.hash.toLowerCase().includes(query.toLowerCase()) ||
//       tx.from.toLowerCase().includes(query.toLowerCase()) ||
//       tx.to.toLowerCase().includes(query.toLowerCase())
//   )

//   return (
//     <div className="max-w-3xl mx-auto p-6">
//       <h2 className="text-2xl font-semibold mb-4">Transaction Activity</h2>

//       <div className="flex gap-2 mb-4">
//         <input
//           value={query}
//           onChange={(e) => setQuery(e.target.value)}
//           placeholder="Search by hash / from / to"
//           className="flex-1 p-2 border rounded"
//         />
//         <button
//           onClick={fetchTxs}
//           className="px-4 py-2 bg-slate-800 text-white rounded"
//         >
//           Refresh
//         </button>
//       </div>

//       {loading && <div className="text-sm text-gray-500 mb-3">Loading…</div>}

//       {filtered.length === 0 ? (
//         <div className="text-center text-gray-500 py-12">
//           No transactions yet.
//         </div>
//       ) : (
//         <ul className="space-y-3">
//           {filtered.map((tx) => (
//             <li
//               key={tx.hash}
//               className="p-4 bg-white/5 rounded-lg border border-white/5"
//             >
//               <div className="flex items-start justify-between gap-4">
//                 <div className="flex-1 min-w-0">
//                   <div className="text-sm text-slate-400">
//                     {new Date(tx.timestamp).toLocaleString()}
//                   </div>
//                   <div className="mt-1 text-sm">
//                     <span className="font-mono text-xs text-slate-300">
//                       {tx.hash}
//                     </span>
//                   </div>

//                   <div className="mt-3 text-sm text-slate-200">
//                     <div>
//                       <strong>From:</strong>{" "}
//                       <span className="font-mono">{tx.from}</span>
//                     </div>
//                     <div className="mt-1">
//                       <strong>To:</strong>{" "}
//                       <span className="font-mono">{tx.to}</span>
//                     </div>
//                     <div className="mt-1">
//                       <strong>Amount:</strong> {tx.amount}
//                     </div>
//                   </div>
//                 </div>

//                 <div className="text-right">
//                   <div
//                     className={`px-3 py-1 rounded-full text-xs font-medium ${
//                       tx.status === "confirmed"
//                         ? "bg-green-600/20 text-green-300"
//                         : "bg-yellow-600/20 text-yellow-300"
//                     }`}
//                   >
//                     {tx.status}
//                   </div>
//                   <a
//                     href={`https://explorer.arc.network/tx/${tx.hash}`}
//                     target="_blank"
//                     rel="noreferrer"
//                     className="block mt-3 text-xs text-blue-400"
//                   >
//                     View on explorer
//                   </a>
//                 </div>
//               </div>
//             </li>
//           ))}
//         </ul>
//       )}
//     </div>
//   )
// }
