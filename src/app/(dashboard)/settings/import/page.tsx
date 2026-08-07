import { PageHeader } from "@/components/layout/PageHeader";
import { SettingsNav } from "../_components/SettingsNav";
import { LegacyImportWizard } from "./LegacyImportWizard";
import { requireRole, getCurrentTenantId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ImportDataLamaPage() {
  const user = await requireRole("OWNER", "MANAGER");
  await getCurrentTenantId();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Import Data Lama"
        eyebrow="Pengaturan"
        description="Impor stok awal dari file CSV atau Excel ke dalam sistem persediaan."
      />
      <SettingsNav userRole={user.role} />
      <div className="custom-scrollbar flex-1 overflow-auto">
        <div className="mx-auto max-w-5xl p-4 md:p-6 lg:p-8">
          <LegacyImportWizard />
        </div>
      </div>
    </div>
  );
}
