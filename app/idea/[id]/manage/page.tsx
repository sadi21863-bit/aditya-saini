import { redirect } from "next/navigation";

// Manage functionality moved into the Dashboard
export default function ManagePage() {
  redirect("/dashboard");
}
