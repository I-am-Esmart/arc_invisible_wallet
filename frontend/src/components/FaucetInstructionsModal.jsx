export default function FaucetInstructionsModal({ open, onClose }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Get Arc Testnet Tokens</h2>
            <p className="mt-1 text-sm text-gray-600">
              Follow these steps to request faucet tokens for your wallet.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700"
            aria-label="Close"
          >
            x
          </button>
        </div>

        <ol className="mt-5 list-decimal space-y-3 pl-5 text-sm text-gray-700">
          <li>
            Visit{" "}
            <a
              href="https://faucet.circle.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-blue-600 underline"
            >
              https://faucet.circle.com/
            </a>
          </li>
          <li>Choose USDC or EURC.</li>
          <li>Choose Arc Testnet in the network tab.</li>
          <li>Submit the request for the token you want to test.</li>
        </ol>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-xl bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
