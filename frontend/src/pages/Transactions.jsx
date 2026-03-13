import { useEffect, useState } from "react"
import { fetchTxHistory } from "../lib/api"

export default function Transactions() {
  const [txs, setTxs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  async function loadTxs() {
    try {
      setLoading(true)
      setError("")
      const user = JSON.parse(localStorage.getItem("user"))
      const data = await fetchTxHistory(user?.address)
      setTxs(data.txs || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTxs()
    const interval = setInterval(loadTxs, 5000) // auto refresh
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="max-w-3xl mx-auto mt-10 p-6">
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
              <span className="font-mono text-sm text-gray-600">{tx.hash}</span>
              <span className="text-green-600 font-medium">{tx.status}</span>
            </div>

            <div className="text-sm space-y-1">
              <div>
                <strong>From:</strong> {tx.from}
              </div>
              <div>
                <strong>To:</strong> {tx.to}
              </div>
              <div>
                <strong>Amount:</strong> {tx.amount}
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
