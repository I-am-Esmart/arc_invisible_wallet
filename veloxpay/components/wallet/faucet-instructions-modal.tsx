"use client";

type FaucetInstructionsModalProps = {
  open: boolean;
  onClose: () => void;
};

export function FaucetInstructionsModal({ open, onClose }: FaucetInstructionsModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-line">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-ink-heading">Get Arc testnet tokens</h2>
            <p className="mt-1 text-sm text-ink-body">
              Use the faucet to add test funds before trying wallet transfers or payment links.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            x
          </button>
        </div>

        <ol className="mt-6 list-decimal space-y-3 pl-5 text-sm leading-6 text-ink-body">
          <li>
            Visit{" "}
            <a
              href="https://faucet.circle.com/"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-brand-600 underline"
            >
              faucet.circle.com
            </a>
          </li>
          <li>Choose USDC or EURC.</li>
          <li>Choose Arc Testnet in the network tab.</li>
          <li>Submit the request for the token you want to test.</li>
        </ol>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-button transition hover:bg-brand-hover"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
