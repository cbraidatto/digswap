import Image from "next/image";
import type { ProposalWithItems } from "@/lib/trades/proposal-queries";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(date: Date): string {
	const diff = Date.now() - date.getTime();
	const mins = Math.floor(diff / 60_000);
	if (mins < 1) return "just now";
	if (mins < 60) return `${mins}m ago`;
	const hrs = Math.floor(mins / 60);
	if (hrs < 24) return `${hrs}h ago`;
	return `${Math.floor(hrs / 24)}d ago`;
}

function truncate(str: string, max: number): string {
	if (str.length <= max) return str;
	return `${str.slice(0, max)}...`;
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<
	string,
	{ className: string; label: string } | null
> = {
	pending: {
		className:
			"bg-primary/10 text-primary border border-primary/30 text-xs px-1.5 py-0.5 rounded font-mono",
		label: "Pending",
	},
	accepted: {
		className:
			"bg-tertiary/10 text-tertiary border border-tertiary/30 text-xs px-1.5 py-0.5 rounded font-mono",
		label: "Accepted",
	},
	rejected: {
		className:
			"bg-muted-foreground/10 text-muted-foreground border border-muted-foreground/30 text-xs px-1.5 py-0.5 rounded font-mono",
		label: "Declined",
	},
	superseded: null, // handled inline
};

function StatusBadge({ status }: { status: string }) {
	if (status === "superseded") {
		return (
			<span className="opacity-40 text-muted-foreground/60 text-xs font-mono italic">
				Superseded
			</span>
		);
	}
	const style = STATUS_STYLES[status] ?? STATUS_STYLES.pending;
	if (!style) return null;
	return <span className={style.className}>{style.label}</span>;
}

// ---------------------------------------------------------------------------
// Avatar helper
// ---------------------------------------------------------------------------

function ProposerAvatar({
	avatarUrl,
	username,
}: {
	avatarUrl: string | null;
	username: string;
}) {
	if (avatarUrl) {
		return (
			<Image
				src={avatarUrl}
				alt=""
				width={24}
				height={24}
				unoptimized
				className="w-6 h-6 rounded-full border border-outline-variant flex-shrink-0"
			/>
		);
	}
	return (
		<div className="w-6 h-6 rounded-full bg-surface-container-low border border-outline-variant flex items-center justify-center flex-shrink-0">
			<span className="text-muted-foreground text-[10px] font-mono">
				{(username[0] ?? "?").toUpperCase()}
			</span>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Item pill
// ---------------------------------------------------------------------------

function ItemPill({
	title,
	coverImageUrl,
	declaredQuality,
}: {
	title: string | null;
	coverImageUrl: string | null;
	declaredQuality: string | null;
}) {
	return (
		<span className="inline-flex items-center gap-1.5 bg-surface-container-low border border-outline-variant rounded px-2 py-1">
			{coverImageUrl ? (
				<Image
					src={coverImageUrl}
					alt=""
					width={24}
					height={24}
					unoptimized
					className="w-6 h-6 rounded object-cover flex-shrink-0"
				/>
			) : (
				<span className="w-6 h-6 rounded bg-surface-container flex-shrink-0 flex items-center justify-center">
					<span className="material-symbols-outlined text-muted-foreground text-xs">
						album
					</span>
				</span>
			)}
			<span className="font-mono text-xs text-foreground truncate max-w-[120px]">
				{title ? truncate(title, 20) : "Unknown"}
			</span>
			{declaredQuality && (
				<span className="font-mono text-[10px] text-muted-foreground bg-surface-container px-1 py-0.5 rounded">
					{declaredQuality}
				</span>
			)}
		</span>
	);
}

// ---------------------------------------------------------------------------
// ProposalCard
// ---------------------------------------------------------------------------

function ProposalCard({
	proposal,
	proposerUsername,
	proposerAvatarUrl,
}: {
	proposal: ProposalWithItems;
	proposerUsername: string;
	proposerAvatarUrl: string | null;
}) {
	const isPending = proposal.status === "pending";
	const isSuperseded = proposal.status === "superseded";

	const offerItems = proposal.items.filter((i) => i.side === "offer");
	const wantItems = proposal.items.filter((i) => i.side === "want");

	const cardClasses = [
		"bg-surface-container-lowest border border-outline-variant rounded p-4 mb-2",
		isPending ? "border-l-4 border-l-primary" : "",
		isSuperseded ? "opacity-50" : "",
	]
		.filter(Boolean)
		.join(" ");

	return (
		<div
			className={cardClasses}
			aria-label={`Proposal round ${proposal.sequenceNumber}, status: ${proposal.status}`}
		>
			{/* Header row */}
			<div className="flex items-center gap-2 flex-wrap mb-3">
				<ProposerAvatar
					avatarUrl={proposerAvatarUrl}
					username={proposerUsername}
				/>
				<span className="font-mono text-xs text-foreground font-medium">
					{proposerUsername}
				</span>
				<span className="font-mono text-xs text-muted-foreground">
					Round {proposal.sequenceNumber}
				</span>
				<span className="font-mono text-[10px] text-muted-foreground/60">
					{formatRelativeTime(proposal.createdAt)}
				</span>
				<StatusBadge status={proposal.status} />
			</div>

			{/* Offer / Want columns */}
			<div className="grid grid-cols-2 gap-3 mb-2">
				<div>
					<p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-1.5">
						Offering
					</p>
					<div className="flex flex-wrap gap-1.5">
						{offerItems.map((item) => (
							<ItemPill
								key={item.id}
								title={item.title}
								coverImageUrl={item.coverImageUrl}
								declaredQuality={item.declaredQuality}
							/>
						))}
						{offerItems.length === 0 && (
							<span className="font-mono text-xs text-muted-foreground/50 italic">
								No items
							</span>
						)}
					</div>
				</div>
				<div>
					<p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-1.5">
						Wanting
					</p>
					<div className="flex flex-wrap gap-1.5">
						{wantItems.map((item) => (
							<ItemPill
								key={item.id}
								title={item.title}
								coverImageUrl={item.coverImageUrl}
								declaredQuality={item.declaredQuality}
							/>
						))}
						{wantItems.length === 0 && (
							<span className="font-mono text-xs text-muted-foreground/50 italic">
								No items
							</span>
						)}
					</div>
				</div>
			</div>

			{/* Optional message */}
			{proposal.message && (
				<div className="border-l-2 border-outline-variant pl-3 mt-2">
					<p className="font-mono text-sm text-muted-foreground italic">
						{proposal.message}
					</p>
				</div>
			)}
		</div>
	);
}

// ---------------------------------------------------------------------------
// ProposalHistoryThread (main export)
// ---------------------------------------------------------------------------

interface ProposalHistoryThreadProps {
	proposals: ProposalWithItems[];
	currentUserId: string;
	counterpartyUsername: string;
	counterpartyAvatarUrl: string | null;
	currentUserUsername: string;
	currentUserAvatarUrl: string | null;
}

export function ProposalHistoryThread({
	proposals,
	currentUserId,
	counterpartyUsername,
	counterpartyAvatarUrl,
	currentUserUsername,
	currentUserAvatarUrl,
}: ProposalHistoryThreadProps) {
	if (proposals.length === 0) return null;

	return (
		<section aria-label="Proposal History">
			{/* Section header */}
			<div className="flex items-center gap-2 mb-3">
				<h2 className="font-mono text-sm font-bold text-foreground uppercase tracking-widest">
					Proposal History
				</h2>
				<span className="bg-surface-container-low border border-outline-variant text-muted-foreground font-mono text-[10px] px-1.5 py-0.5 rounded">
					{proposals.length}
				</span>
			</div>

			{/* Thread cards */}
			<div className="space-y-0">
				{proposals.map((proposal) => {
					const isCurrentUser = proposal.proposerId === currentUserId;
					return (
						<ProposalCard
							key={proposal.id}
							proposal={proposal}
							proposerUsername={
								isCurrentUser ? currentUserUsername : counterpartyUsername
							}
							proposerAvatarUrl={
								isCurrentUser ? currentUserAvatarUrl : counterpartyAvatarUrl
							}
						/>
					);
				})}
			</div>
		</section>
	);
}
