import Link from "next/link";
import { CreateLinkForm } from "@/components/dashboard/create-link-form";
import { Button } from "@/components/ui/button";

export default function CreatePage() {
  return (
    <main className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-brand-600">
            Create payment link
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">
            Generate a shareable link in minutes
          </h1>
        </div>
        <Button asChild variant="secondary">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>

      <CreateLinkForm />
    </main>
  );
}
