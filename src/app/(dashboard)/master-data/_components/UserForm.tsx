"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { toastSafe } from "@/lib/toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createUser, updateUser } from "../actions";
import type { UserRow } from "../actions";

const USER_ROLES = [
  { value: "OWNER", label: "Owner" },
  { value: "MANAGER", label: "Manager" },
  { value: "OPERATOR", label: "Operator" },
  { value: "CASHIER", label: "Cashier" },
] as const;

const baseSchema = z.object({
  name:     z.string().min(1, "Nama wajib diisi"),
  email:    z.string().email("Email tidak valid"),
  role:     z.enum(["OWNER", "MANAGER", "OPERATOR", "CASHIER"]),
  password: z.string().optional(),
  isActive: z.boolean(),
});

const passwordSchema = z.string()
  .min(8, "Password minimal 8 karakter")
  .regex(/[A-Z]/, "Password harus mengandung huruf kapital")
  .regex(/[0-9]/, "Password harus mengandung angka");

const createSchema = baseSchema.extend({
  password: passwordSchema,
});

const editSchema = baseSchema.extend({
  password: z.union([z.literal(""), passwordSchema]).optional(),
});

type FormValues = z.infer<typeof baseSchema>;

interface UserFormProps {
  id: string;
  onSuccess: () => void;
  onPendingChange?: (isPending: boolean) => void;
  initialData?: UserRow;
}

export function UserForm({ id, onSuccess, onPendingChange, initialData }: UserFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditMode = !!initialData;

  const { register, handleSubmit, control, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(isEditMode ? editSchema : createSchema),
    defaultValues: initialData
      ? {
          name: initialData.name,
          email: initialData.email,
          role: initialData.role,
          password: "",
          isActive: initialData.isActive,
        }
      : {
          name: "",
          email: "",
          role: "OPERATOR",
          password: "",
          isActive: true,
        },
  });

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    try {
      const result = isEditMode
        ? await updateUser({
            id: initialData!.id,
            name: values.name,
            email: values.email,
            role: values.role,
            isActive: values.isActive,
            password: values.password || undefined,
          })
        : await createUser({
            name: values.name,
            email: values.email,
            role: values.role,
            password: values.password ?? "",
          });

      if (!result.success) { toastSafe.error(result.error); return; }
      toast.success(isEditMode ? `${result.code} berhasil diperbarui` : `Pengguna ${result.code} berhasil ditambahkan`);
      onSuccess();
    } catch (err) {
      console.error("[UserForm]", err);
      toast.error("Terjadi kesalahan sistem.");
    } finally {
      setIsSubmitting(false);
      onPendingChange?.(false);
    }
  };

  return (
    <form id={id} onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-zinc-700">
          Nama <span className="text-red-500">*</span>
        </Label>
        <Input placeholder="Nama pengguna" className="h-9" {...register("name")} />
        {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-zinc-700">
          Email <span className="text-red-500">*</span>
        </Label>
        <Input type="email" placeholder="nama@contoh.com" className="h-9" {...register("email")} />
        {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-zinc-700">
          Role <span className="text-red-500">*</span>
        </Label>
        <Controller
          control={control}
          name="role"
          render={({ field }) => (
            <Select value={field.value} onValueChange={(v) => v && field.onChange(v)}>
              <SelectTrigger className="h-9 w-full text-sm">
                <SelectValue placeholder="Pilih role...">
                  {field.value ? USER_ROLES.find((r) => r.value === field.value)?.label : null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {USER_ROLES.map((role) => (
                  <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.role && <p className="text-xs text-red-500">{errors.role.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-zinc-700">
          Password {!isEditMode && <span className="text-red-500">*</span>}
        </Label>
        <Input
          type="password"
          placeholder={isEditMode ? "Kosongkan jika tidak diubah" : "Masukkan password"}
          className="h-9"
          {...register("password")}
        />
        {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
      </div>

      {isEditMode && (
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-zinc-700">Status Aktif</Label>
          <Controller
            control={control}
            name="isActive"
            render={({ field }) => (
              <label className="flex items-start gap-3 rounded-lg border border-zinc-200 bg-white px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={field.value}
                  onChange={(e) => field.onChange(e.target.checked)}
                  className="mt-0.5 size-4 rounded border-zinc-300 text-zinc-900 accent-zinc-900"
                />
                <div>
                  <p className="text-xs font-medium text-zinc-700">Pengguna aktif</p>
                  <p className="text-[11px] text-zinc-400">Nonaktifkan jika akun tidak boleh login.</p>
                </div>
              </label>
            )}
          />
        </div>
      )}

      <button type="submit" className="hidden" disabled={isSubmitting} />
    </form>
  );
}
