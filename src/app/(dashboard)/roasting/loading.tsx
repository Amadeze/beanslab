import { StandardPageLayout } from "@/components/StandardPageLayout";
import { Button } from "@/components/ui/button";
import { Flame } from "lucide-react";

export default function RoastingLoading() {
  return (
    <StandardPageLayout
      title="Roasting"
      description="Memuat histori roasting..."
      stage="roasting"
      actionButton={
        <Button size="sm" disabled className="gap-1.5 bg-zinc-900 text-white opacity-50">
          <Flame size={14} />
          Mulai Roasting
        </Button>
      }
      isLoading
    >
      <></>
    </StandardPageLayout>
  );
}
