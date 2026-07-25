import { redirect } from "next/navigation";

export default function LegacyRoastProfilesPage() {
  redirect("/roasting?tab=profiles");
}
