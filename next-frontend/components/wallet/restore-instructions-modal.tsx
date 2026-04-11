"use client";

type RestoreInstructionsModalProps = {
  open: boolean;
  onClose: () => void;
};

export function RestoreInstructionsModal({
  open,
  onClose,
}: RestoreInstructionsModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4">
      <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">
              How wallet restore works
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Your wallet is tied to the email you use in VeloxPay. Use that same email again and the same wallet comes back.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            ×
          </button>
        </div>

        <ol className="mt-6 list-decimal space-y-3 pl-5 text-sm leading-6 text-slate-700 dark:text-slate-300">
          <li>Open VeloxPay in your browser.</li>
          <li>Enter the same email you used before.</li>
          <li>Your wallet address, balances, and activity will load again.</li>
        </ol>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-2xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
