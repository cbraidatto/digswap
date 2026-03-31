"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";
import { createCrateSchema } from "@/lib/validations/crates";
import { createCrate } from "@/actions/crates";

type CreateCrateFormValues = z.infer<typeof createCrateSchema>;

type SessionTypeValue = CreateCrateFormValues["sessionType"];

const SESSION_TYPE_OPTIONS: {
  value: SessionTypeValue;
  label: string;
  activeClass: string;
  inactiveClass: string;
}[] = [
  {
    value: "digging_trip",
    label: "[DIGGING_TRIP]",
    activeClass: "bg-primary/10 text-primary border-primary/40",
    inactiveClass: "text-on-surface-variant border-outline-variant/30 hover:border-primary/20",
  },
  {
    value: "event_prep",
    label: "[EVENT_PREP]",
    activeClass: "bg-secondary/10 text-secondary border-secondary/40",
    inactiveClass: "text-on-surface-variant border-outline-variant/30 hover:border-secondary/20",
  },
  {
    value: "wish_list",
    label: "[WISH_LIST]",
    activeClass: "bg-tertiary/10 text-tertiary border-tertiary/40",
    inactiveClass: "text-on-surface-variant border-outline-variant/30 hover:border-tertiary/20",
  },
  {
    value: "other",
    label: "[OTHER]",
    activeClass: "bg-surface-container-high text-on-surface border-outline-variant",
    inactiveClass: "text-on-surface-variant border-outline-variant/30 hover:border-outline-variant/60",
  },
];

interface CreateCrateFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function CreateCrateForm({ onSuccess, onCancel }: CreateCrateFormProps) {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateCrateFormValues>({
    resolver: zodResolver(createCrateSchema),
    defaultValues: {
      name: "",
      date: new Date().toISOString().split("T")[0],
      sessionType: "digging_trip",
    },
  });

  const sessionType = watch("sessionType");

  const onSubmit = async (data: CreateCrateFormValues) => {
    const result = await createCrate(data);
    if (result.success) {
      toast.success("Crate created");
      router.refresh();
      onSuccess?.();
    } else {
      toast.error(result.error ?? "Failed to create crate");
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="bg-surface-container rounded-lg border border-outline-variant/20 p-4 space-y-4"
    >
      <div className="font-mono text-[10px] text-primary tracking-[0.15em] mb-1">
        [NEW_CRATE]
      </div>

      {/* Name */}
      <div>
        <input
          {...register("name")}
          placeholder="Name this crate..."
          className="w-full bg-surface-container-high rounded border border-outline-variant/20 px-3 py-2 font-mono text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary/40"
        />
        {errors.name && (
          <p className="font-mono text-[10px] text-destructive mt-1">
            {errors.name.message}
          </p>
        )}
      </div>

      {/* Date */}
      <div>
        <input
          {...register("date")}
          type="date"
          className="bg-surface-container-high rounded border border-outline-variant/20 px-3 py-2 font-mono text-sm text-on-surface focus:outline-none focus:border-primary/40"
        />
        {errors.date && (
          <p className="font-mono text-[10px] text-destructive mt-1">
            {errors.date.message}
          </p>
        )}
      </div>

      {/* Session type toggle group */}
      <div className="flex flex-wrap gap-2">
        {SESSION_TYPE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setValue("sessionType", opt.value)}
            className={`font-mono text-[10px] px-2 py-1 rounded border transition-colors ${
              sessionType === opt.value ? opt.activeClass : opt.inactiveClass
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={isSubmitting}
          className="font-mono text-[10px] px-3 py-1.5 rounded border border-primary/40 text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
        >
          {isSubmitting ? "[SAVING...]" : "[CREATE]"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="font-mono text-[10px] px-3 py-1.5 rounded border border-outline-variant/20 text-on-surface-variant hover:bg-surface-container-high transition-colors"
          >
            [CANCEL]
          </button>
        )}
      </div>
    </form>
  );
}
