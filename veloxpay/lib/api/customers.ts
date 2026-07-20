import { backendFetch } from "./backend";
import type { SavedCustomer } from "@/lib/types/customer";

export async function listSavedCustomers(ownerEmail?: string) {
  const params = new URLSearchParams();

  if (ownerEmail) {
    params.set("ownerEmail", ownerEmail);
  }

  return backendFetch<SavedCustomer[]>(`/customers${params.toString() ? `?${params.toString()}` : ""}`);
}
