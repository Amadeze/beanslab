"use client";

import { useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { FlaskConical, Plus, Loader2, Copy, Archive, Edit3, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/ui/glass-panel";
import { StandardDrawer } from "@/components/StandardDrawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { toastSafe } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CompactHeader } from "@/components/layout/CompactHeader";
import { WorkspaceNav } from "@/components/layout/WorkspaceNav";
import {
  createRoastProfile,
  updateRoastProfile,
  duplicateRoastProfile,
  archiveRoastProfile,
  createTenantRoastLevel,
  deleteTenantRoastLevel,
  getMachineOptions,
} from "../../actions";
import type {
  ReusableRoastProfileRow,
  TenantRoastLevelRow,
  MachineOption,
} from "../../actions";

function FieldGroup({ children }: { children: React.ReactNode }) {
  return <div className="space-y-1.5">{children}</div>;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-red-500">{message}</p>;
}

const glassInput = "bg-white/40 border-white/60 backdrop-blur-md transition-all focus:bg-white/60 focus:border-white/80";
const glassCard = "rounded-[1.25rem] border border-white/60 bg-white/30 backdrop-blur-xl p-4 shadow-sm";

interface RoastProfileClientProps {
  profiles: ReusableRoastProfileRow[];
  customLevels: TenantRoastLevelRow[];
  machines: MachineOption[];
}

type FormMode = "create" | "edit" | "level";

export function RoastProfileClient({
  profiles,
  customLevels,
  machines,
}: RoastProfileClientProps) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mode, setMode] = useState<FormMode>("create");
  const [editingProfile, setEditingProfile] = useState<ReusableRoastProfileRow | null>(null);
  const [levelDrawerOpen, setLevelDrawerOpen] = useState(false);
  const [isLevelSubmitting, setIsLevelSubmitting] = useState(false);

  const activeProfiles = useMemo(
    () => profiles.filter((p) => p.isActive),
    [profiles],
  );

  const archivedProfiles = useMemo(
    () => profiles.filter((p) => !p.isActive),
    [profiles],
  );

  const headerSignal = useMemo(() => {
    return activeProfiles.length > 0
      ? { label: "Profil", value: `${activeProfiles.length} aktif`, tone: "ready" as const }
      : { label: "Profil", value: "Belum ada profil", tone: "critical" as const };
  }, [activeProfiles.length]);

  const headerMetrics = useMemo(() => {
    return [
      { label: "Aktif", value: `${activeProfiles.length}` },
      { label: "Arsip", value: `${archivedProfiles.length}` },
      { label: "Level", value: `${customLevels.length}` },
    ];
  }, [activeProfiles.length, archivedProfiles.length, customLevels.length]);

  const openCreate = () => {
    setMode("create");
    setEditingProfile(null);
    setDrawerOpen(true);
  };

  const openEdit = (profile: ReusableRoastProfileRow) => {
    setMode("edit");
    setEditingProfile(profile);
    setDrawerOpen(true);
  };

  const handleDuplicate = async (profileId: string) => {
    setIsSubmitting(true);
    try {
      const data = await duplicateRoastProfile(profileId);
      if (!data.success) throw new Error(data.error);
      toast.success("Profil berhasil diduplikasi");
      router.refresh();
    } catch (err) {
      toastSafe.error(err instanceof Error ? err.message : "Gagal menduplikasi profil");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchive = async (profileId: string) => {
    setIsSubmitting(true);
    try {
      const data = await archiveRoastProfile(profileId);
      if (!data.success) throw new Error(data.error);
      toast.success("Profil berhasil diarsipkan");
      router.refresh();
    } catch (err) {
      toastSafe.error(err instanceof Error ? err.message : "Gagal mengarsipkan profil");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteLevel = async (levelId: string) => {
    setIsSubmitting(true);
    try {
      const data = await deleteTenantRoastLevel(levelId);
      if (!data.success) throw new Error(data.error);
      toast.success("Level roasting berhasil dihapus");
      router.refresh();
    } catch (err) {
      toastSafe.error(err instanceof Error ? err.message : "Gagal menghapus level");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col">
        <CompactHeader
          title="Profil Roasting"
          description="Konfigurasi target roasting yang dapat dipakai berulang kali."
          stage="roasting"
          signal={headerSignal}
          metrics={headerMetrics}
          next={{ label: "Lanjut ke Roasting", href: "/roasting" }}
          actions={
            <div className="flex gap-2">
              <Button
                size="default"
                variant="outline"
                className="gap-2 px-4 border-white/60 bg-white/40 hover:bg-white/60"
                onClick={() => setLevelDrawerOpen(true)}
              >
                <Edit3 size={16} />
                Level
              </Button>
              <Button
                size="default"
                variant="default"
                className="gap-2 px-5"
                onClick={openCreate}
              >
                <Plus size={16} />
                Profil Baru
              </Button>
            </div>
          }
          mobileActions={
            <Button
              size="sm"
              variant="default"
              className="gap-1.5 px-3"
              onClick={openCreate}
            >
              <Plus size={14} />
              Profil Baru
            </Button>
          }
        />

        <div className="custom-scrollbar flex-1 overflow-auto">
          <WorkspaceNav kind="roastery" />

          <div className="mx-auto max-w-[1600px] px-4 md:px-6 lg:px-8 pb-8 space-y-6">
            <GlassPanel padding="md">
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4">
                Level Roasting ({customLevels.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {customLevels.map((level) => (
                  <span
                    key={level.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/60 bg-white/40 px-3 py-1.5 text-xs font-semibold text-slate-700 backdrop-blur-md"
                  >
                    {level.label}
                    <button
                      type="button"
                      onClick={() => handleDeleteLevel(level.id)}
                      className="text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
                {customLevels.length === 0 && (
                  <p className="text-xs text-slate-400">Belum ada level custom. Klik tombol Level untuk menambahkan.</p>
                )}
              </div>
            </GlassPanel>

            <GlassPanel padding="md">
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4">
                Profil Aktif ({activeProfiles.length})
              </h3>
              {activeProfiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FlaskConical size={32} className="text-zinc-300 mb-2" />
                  <p className="text-sm font-medium text-zinc-500">Belum ada profil roasting</p>
                  <p className="text-xs text-zinc-400 mt-1">Klik "Profil Baru" untuk membuat target roasting pertama.</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {activeProfiles.map((profile) => (
                    <div
                      key={profile.id}
                      className={cn(glassCard, "space-y-2")}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-bold text-slate-900">{profile.name}</p>
                          <p className="text-xs text-slate-500">{profile.roastLevel}</p>
                        </div>
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                          Aktif
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600">
                        {profile.machineName && (
                          <span className="col-span-2">Mesin: {profile.machineName}</span>
                        )}
                        {profile.beanOrigin && (
                          <span className="col-span-2">Asal: {profile.beanOrigin}</span>
                        )}
                        {profile.chargeTemp && (
                          <span>Charge: {profile.chargeTemp}°C</span>
                        )}
                        {profile.dropTemp && (
                          <span>Drop: {profile.dropTemp}°C</span>
                        )}
                        {profile.targetFirstCrackStart !== null && (
                          <span>FC Start: {profile.targetFirstCrackStart}s</span>
                        )}
                        {profile.targetFirstCrackEnd !== null && (
                          <span>FC End: {profile.targetFirstCrackEnd}s</span>
                        )}
                        {profile.developmentTarget !== null && (
                          <span>Dev: {profile.developmentTarget}%</span>
                        )}
                      </div>
                      {profile.notes && (
                        <p className="text-xs text-slate-500 line-clamp-2">{profile.notes}</p>
                      )}
                      <div className="flex gap-1 pt-2 border-t border-white/40">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={() => openEdit(profile)}
                        >
                          <Edit3 size={12} className="mr-1" /> Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={() => handleDuplicate(profile.id)}
                        >
                          <Copy size={12} className="mr-1" /> Salin
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs text-red-600 hover:bg-red-50"
                          onClick={() => handleArchive(profile.id)}
                        >
                          <Archive size={12} className="mr-1" /> Arsip
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </GlassPanel>

            {archivedProfiles.length > 0 && (
              <GlassPanel padding="md">
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4">
                  Arsip ({archivedProfiles.length})
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {archivedProfiles.map((profile) => (
                    <div
                      key={profile.id}
                      className={cn(glassCard, "space-y-2 opacity-70")}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-bold text-slate-900">{profile.name}</p>
                          <p className="text-xs text-slate-500">{profile.roastLevel}</p>
                        </div>
                        <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-600 border border-zinc-200">
                          Arsip
                        </span>
                      </div>
                      <div className="flex gap-1 pt-2 border-t border-white/40">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={() => openEdit(profile)}
                        >
                          <Edit3 size={12} className="mr-1" /> Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={() => handleArchive(profile.id)}
                        >
                          <Archive size={12} className="mr-1" /> Aktifkan
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </GlassPanel>
            )}
          </div>
        </div>
      </div>

      <StandardDrawer
        open={drawerOpen}
        onOpenChange={(open) => {
          if (!isSubmitting) setDrawerOpen(open);
        }}
        title={mode === "create" ? "Profil Roasting Baru" : "Edit Profil Roasting"}
        description={mode === "create" ? "Buat target roasting baru untuk dipakai berulang kali." : "Perbarui parameter target roasting."}
        size="lg"
        submitButton={
          <Button
            type="submit"
            form="profile-form"
            size="sm"
            disabled={isSubmitting}
            className="gap-1.5 rounded-[8px] font-bold shadow-md disabled:opacity-60"
          >
            {isSubmitting && <Loader2 size={13} className="animate-spin" />}
            {isSubmitting ? "Menyimpan..." : mode === "create" ? "Buat Profil" : "Simpan Perubahan"}
          </Button>
        }
      >
        <ProfileForm
          id="profile-form"
          mode={mode}
          editingProfile={editingProfile}
          machines={machines}
          customLevels={customLevels}
          onSuccess={() => {
            setDrawerOpen(false);
            router.refresh();
          }}
          onPendingChange={setIsSubmitting}
        />
      </StandardDrawer>

      <StandardDrawer
        open={levelDrawerOpen}
        onOpenChange={(open) => {
          if (!isLevelSubmitting) setLevelDrawerOpen(open);
        }}
        title="Tambah Level Roasting"
        description="Buat label level roasting khusus untuk roastery ini."
        size="sm"
        submitButton={
          <Button
            type="submit"
            form="level-form"
            size="sm"
            disabled={isLevelSubmitting}
            className="gap-1.5 rounded-[8px] font-bold shadow-md disabled:opacity-60"
          >
            {isLevelSubmitting && <Loader2 size={13} className="animate-spin" />}
            {isLevelSubmitting ? "Menyimpan..." : "Tambah Level"}
          </Button>
        }
      >
        <LevelForm
          id="level-form"
          onSuccess={() => {
            setLevelDrawerOpen(false);
            router.refresh();
          }}
          onPendingChange={setIsLevelSubmitting}
        />
      </StandardDrawer>
    </>
  );
}

function ProfileForm({
  id,
  mode,
  editingProfile,
  machines,
  customLevels,
  onSuccess,
  onPendingChange,
}: {
  id: string;
  mode: FormMode;
  editingProfile: ReusableRoastProfileRow | null;
  machines: MachineOption[];
  customLevels: TenantRoastLevelRow[];
  onSuccess: () => void;
  onPendingChange: (pending: boolean) => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLockRef = useRef(false);

  const defaultLevels = useMemo(() => {
    const defaults = ["LIGHT", "MEDIUM", "MEDIUM_DARK", "DARK"];
    const custom = customLevels.map((l) => l.label);
    return [...new Set([...defaults, ...custom])];
  }, [customLevels]);

  const schema = z.object({
    name: z.string().min(2, "Nama profil minimal 2 karakter"),
    machineId: z.string().optional(),
    roastLevel: z.string().min(1, "Level roasting wajib diisi"),
    beanOrigin: z.string().optional(),
    chargeTemp: z.coerce.number().nonnegative().optional(),
    targetFirstCrackStart: z.coerce.number().nonnegative().optional(),
    targetFirstCrackEnd: z.coerce.number().nonnegative().optional(),
    developmentTarget: z.coerce.number().nonnegative().optional(),
    dropTemp: z.coerce.number().nonnegative().optional(),
    notes: z.string().optional(),
  });

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: editingProfile?.name ?? "",
      machineId: editingProfile?.machineName ? machines.find((m) => m.name === editingProfile.machineName)?.id : undefined,
      roastLevel: editingProfile?.roastLevel ?? "",
      beanOrigin: editingProfile?.beanOrigin ?? "",
      chargeTemp: editingProfile?.chargeTemp ?? undefined,
      targetFirstCrackStart: editingProfile?.targetFirstCrackStart ?? undefined,
      targetFirstCrackEnd: editingProfile?.targetFirstCrackEnd ?? undefined,
      developmentTarget: editingProfile?.developmentTarget ?? undefined,
      dropTemp: editingProfile?.dropTemp ?? undefined,
      notes: editingProfile?.notes ?? "",
    },
  });

  const onSubmit = async (values: any) => {
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    setIsSubmitting(true);
    onPendingChange(true);
    try {
      const data = mode === "create"
        ? await createRoastProfile(values)
        : await updateRoastProfile(editingProfile!.id, values);
      if (!data.success) throw new Error(data.error);
      toast.success(mode === "create" ? "Profil roasting berhasil dibuat" : "Profil roasting berhasil diperbarui");
      reset();
      onSuccess();
    } catch (err) {
      toastSafe.error(err instanceof Error ? err.message : "Gagal menyimpan profil");
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
      onPendingChange(false);
    }
  };

  const onSubmitWrapper = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    handleSubmit(onSubmit)(e);
  };

  return (
    <form id={id} onSubmit={onSubmitWrapper} className="space-y-5 relative">
      <FieldGroup>
        <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">
          Nama Profil <span className="text-red-500">*</span>
        </Label>
        <Input
          className={cn("h-9", glassInput)}
          placeholder="e.g. House Espresso, Omni Roast"
          {...register("name")}
        />
        <FieldError message={errors.name?.message} />
      </FieldGroup>

      <div className="grid grid-cols-2 gap-4">
        <FieldGroup>
          <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">
            Level Roasting <span className="text-red-500">*</span>
          </Label>
          <Controller
            control={control}
            name="roastLevel"
            render={({ field }) => (
              <Select value={field.value} onValueChange={(val) => field.onChange(val)}>
                <SelectTrigger className={cn("w-full h-9", glassInput)}>
                  <SelectValue placeholder="Pilih level..." />
                </SelectTrigger>
                <SelectContent>
                  {defaultLevels.map((level) => (
                    <SelectItem key={level} value={level}>{level}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <FieldError message={errors.roastLevel?.message} />
        </FieldGroup>

        <FieldGroup>
          <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">
            Mesin (Opsional)
          </Label>
          <Controller
            control={control}
            name="machineId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={(val) => field.onChange(val)}>
                <SelectTrigger className={cn("w-full h-9", glassInput)}>
                  <SelectValue placeholder="Pilih mesin..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Tanpa mesin</SelectItem>
                  {machines.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name} {m.capacityKg ? `(${m.capacityKg}kg)` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FieldGroup>
      </div>

      <FieldGroup>
        <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">
          Asal Biji (Opsional)
        </Label>
        <Input
          className={cn("h-9", glassInput)}
          placeholder="e.g. Gayo, Ethiopia"
          {...register("beanOrigin")}
        />
      </FieldGroup>

      <div className="grid grid-cols-2 gap-4">
        <FieldGroup>
          <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">
            Charge Temp (°C)
          </Label>
          <Input
            type="number"
            step="0.1"
            className={cn("h-9 tabular-nums", glassInput)}
            {...register("chargeTemp")}
          />
        </FieldGroup>
        <FieldGroup>
          <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">
            Drop Temp (°C)
          </Label>
          <Input
            type="number"
            step="0.1"
            className={cn("h-9 tabular-nums", glassInput)}
            {...register("dropTemp")}
          />
        </FieldGroup>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FieldGroup>
          <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">
            First Crack Start (detik)
          </Label>
          <Input
            type="number"
            step="1"
            className={cn("h-9 tabular-nums", glassInput)}
            {...register("targetFirstCrackStart")}
          />
        </FieldGroup>
        <FieldGroup>
          <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">
            First Crack End (detik)
          </Label>
          <Input
            type="number"
            step="1"
            className={cn("h-9 tabular-nums", glassInput)}
            {...register("targetFirstCrackEnd")}
          />
        </FieldGroup>
      </div>

      <FieldGroup>
        <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">
          Development Target (%)
        </Label>
        <Input
          type="number"
          step="0.1"
          className={cn("h-9 tabular-nums", glassInput)}
          {...register("developmentTarget")}
        />
      </FieldGroup>

      <FieldGroup>
        <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">Catatan (Opsional)</Label>
        <Textarea
          placeholder="Catatan profil, tips, dll."
          rows={3}
          className={cn("resize-none text-sm", glassInput)}
          {...register("notes")}
        />
      </FieldGroup>

      <button type="submit" className="hidden" aria-hidden disabled={isSubmitting} />
    </form>
  );
}

function LevelForm({
  id,
  onSuccess,
  onPendingChange,
}: {
  id: string;
  onSuccess: () => void;
  onPendingChange: (pending: boolean) => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLockRef = useRef(false);

  const schema = z.object({
    label: z.string().min(2, "Label minimal 2 karakter"),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { label: "" },
  });

  const onSubmit = async (values: { label: string }) => {
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    setIsSubmitting(true);
    onPendingChange(true);
    try {
      const data = await createTenantRoastLevel(values);
      if (!data.success) throw new Error(data.error);
      toast.success("Level roasting berhasil ditambahkan");
      reset();
      onSuccess();
    } catch (err) {
      toastSafe.error(err instanceof Error ? err.message : "Gagal menambahkan level");
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
      onPendingChange(false);
    }
  };

  const onSubmitWrapper = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    handleSubmit(onSubmit)(e);
  };

  return (
    <form id={id} onSubmit={onSubmitWrapper} className="space-y-5 relative">
      <FieldGroup>
        <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">
          Label Level <span className="text-red-500">*</span>
        </Label>
        <Input
          className={cn("h-9", glassInput)}
          placeholder="e.g. Omni, Filter, Nordic, City+"
          {...register("label")}
        />
        <FieldError message={errors.label?.message} />
      </FieldGroup>
      <button type="submit" className="hidden" aria-hidden disabled={isSubmitting} />
    </form>
  );
}
