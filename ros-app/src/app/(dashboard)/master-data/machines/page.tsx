import { redirect } from "next/navigation";

export default function LegacyMachinesPage() {
  redirect("/settings/machines");
}
