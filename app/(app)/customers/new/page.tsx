import type { Metadata } from "next";
import CustomerForm from "@/components/forms/CustomerForm";

export const metadata: Metadata = { title: "New Customer" };

export default function NewCustomerPage() {
  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-charcoal">New Customer</h1>
        <p className="text-sm text-muted mt-1">Add a new customer to your database.</p>
      </div>
      <CustomerForm />
    </div>
  );
}
