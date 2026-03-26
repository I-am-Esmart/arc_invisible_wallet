import React from "react"

export default function RestoreInstructionsModal({ open, onClose }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6">
        <div className="flex items-start justify-between">
          <h2 className="text-xl font-bold">How to restore your wallet</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 space-y-3 text-sm text-gray-700">
          <p>
            Your wallet is linked to the email you use to log in. To restore the same
            wallet on another device, just use the same email.
          </p>
          
          <p>
            <strong>Steps:</strong>
          </p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Open the app in your browser.</li>
            <li>Choose "Restore Wallet" and enter the same email you used before.</li>
            <li>Your wallet address and transaction history will reappear.</li>
          </ol>
        </div>

        <div className="mt-6 text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
