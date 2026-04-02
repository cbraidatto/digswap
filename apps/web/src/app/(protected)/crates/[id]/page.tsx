import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCrateById, getCrateItems, getSetsForCrate } from "@/lib/crates/queries";
import { CrateItemRow } from "./_components/crate-item-row";
import { NewSetSection } from "./_components/new-set-section";
import { SetsSection } from "./_components/sets-section";

export const metadata: Metadata = {
	title: "Crate — DigSwap",
	description: "View and organize records in your crate for your next digging session.",
};

const SESSION_TYPE_CHIP: Record<string, { label: string; className: string }> = {
  digging_trip: {
    label: "[DIGGING_TRIP]",
    className: "text-primary border-primary/30",
  },
  event_prep: {
    label: "[EVENT_PREP]",
    className: "text-secondary border-secondary/30",
  },
  wish_list: {
    label: "[WISH_LIST]",
    className: "text-tertiary border-tertiary/30",
  },
  other: {
    label: "[OTHER]",
    className: "text-on-surface-variant border-outline-variant",
  },
};

interface CrateDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function CrateDetailPage({ params }: CrateDetailPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/signin");

  const { id } = await params;

  const crate = await getCrateById(id, user.id);
  if (!crate) notFound();

  const [items, sets] = await Promise.all([
    getCrateItems(id, user.id),
    getSetsForCrate(id, user.id),
  ]);

  const chip = crate.sessionType
    ? (SESSION_TYPE_CHIP[crate.sessionType] ?? SESSION_TYPE_CHIP.other)
    : SESSION_TYPE_CHIP.other;

  const displayDate = crate.date
    ? new Date(crate.date + "T00:00:00").toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 font-mono text-xs text-on-surface-variant mb-6">
        <span className="text-primary">[WORKSPACE]</span>
        <span>/</span>
        <Link href="/crates" className="hover:text-primary transition-colors">
          crates
        </Link>
        <span>/</span>
        <span className="text-on-surface truncate max-w-[200px]">{crate.name}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start gap-3 mb-8">
        <div className="flex-1 min-w-0">
          <h1 className="font-heading text-2xl font-bold text-on-surface">
            {crate.name}
          </h1>
          <div className="flex items-center gap-3 mt-1.5">
            <span
              className={`font-mono text-xs px-1.5 py-0.5 rounded border ${chip.className}`}
            >
              {chip.label}
            </span>
            {displayDate && (
              <span className="font-mono text-xs text-on-surface-variant">
                {displayDate}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Items list */}
      <section className="mb-8">
        <div className="font-mono text-xs text-on-surface-variant tracking-[0.15em] mb-3">
          [ITEMS] — {items.length}
        </div>

        {items.length === 0 ? (
          <p className="font-mono text-xs text-on-surface-variant/60">
            No items yet. Add records from any search result, radar card, or release page.
          </p>
        ) : (
          <div>
            {items.map((item) => (
              <CrateItemRow key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>

      {/* New set button / set builder panel */}
      <section className="mb-8">
        <NewSetSection crateId={id} items={items} />
      </section>

      {/* Existing sets */}
      <SetsSection sets={sets} />
    </div>
  );
}
