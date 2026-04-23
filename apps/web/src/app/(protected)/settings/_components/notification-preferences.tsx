"use client";

import { useEffect, useState } from "react";
import { getPreferencesAction, updatePreferencesAction } from "@/actions/notifications";
import { cn } from "@/lib/utils";

interface PreferencesState {
	wantlistMatchInapp: boolean;
	wantlistMatchEmail: boolean;
	tradeRequestInapp: boolean;
	tradeRequestEmail: boolean;
	tradeCompletedInapp: boolean;
	rankingChangeInapp: boolean;
	newBadgeInapp: boolean;
	pushEnabled: boolean;
}

// Map from camelCase field names to snake_case DB column names
function _toSnakeCase(field: string): string {
	const map: Record<string, string> = {
		wantlistMatchInapp: "wantlist_match_inapp",
		wantlistMatchEmail: "wantlist_match_email",
		tradeRequestInapp: "trade_request_inapp",
		tradeRequestEmail: "trade_request_email",
		tradeCompletedInapp: "trade_completed_inapp",
		rankingChangeInapp: "ranking_change_inapp",
		newBadgeInapp: "new_badge_inapp",
		pushEnabled: "push_enabled",
	};
	return map[field] ?? field;
}

// Map from snake_case DB response to camelCase state
function fromDbRow(row: Record<string, unknown>): PreferencesState {
	return {
		wantlistMatchInapp: (row.wantlist_match_inapp ?? row.wantlistMatchInapp ?? true) as boolean,
		wantlistMatchEmail: (row.wantlist_match_email ?? row.wantlistMatchEmail ?? true) as boolean,
		tradeRequestInapp: (row.trade_request_inapp ?? row.tradeRequestInapp ?? true) as boolean,
		tradeRequestEmail: (row.trade_request_email ?? row.tradeRequestEmail ?? true) as boolean,
		tradeCompletedInapp: (row.trade_completed_inapp ?? row.tradeCompletedInapp ?? true) as boolean,
		rankingChangeInapp: (row.ranking_change_inapp ?? row.rankingChangeInapp ?? true) as boolean,
		newBadgeInapp: (row.new_badge_inapp ?? row.newBadgeInapp ?? true) as boolean,
		pushEnabled: (row.push_enabled ?? row.pushEnabled ?? false) as boolean,
	};
}

const PREFERENCE_GROUPS = [
	{
		key: "wantlistMatch",
		title: "Wantlist Match",
		description: "Get notified when someone has a record from your wantlist.",
		inappField: "wantlistMatchInapp" as const,
		emailField: "wantlistMatchEmail" as const,
		enabled: true,
		phaseBadge: null as string | null,
	},
	{
		key: "tradeRequest",
		title: "Trade Request",
		description: "Get notified when someone requests a trade.",
		inappField: "tradeRequestInapp" as const,
		emailField: "tradeRequestEmail" as const,
		enabled: false,
		phaseBadge: "PHASE_9",
	},
	{
		key: "rankingChange",
		title: "Ranking Change",
		description: "Get notified when your ranking changes.",
		inappField: "rankingChangeInapp" as const,
		emailField: null as null,
		enabled: false,
		phaseBadge: "PHASE_8",
	},
	{
		key: "newBadge",
		title: "New Badge Earned",
		description: "Get notified when you earn a new badge.",
		inappField: "newBadgeInapp" as const,
		emailField: null as null,
		enabled: false,
		phaseBadge: "PHASE_8",
	},
];

export function NotificationPreferences() {
	const [preferences, setPreferences] = useState<PreferencesState | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let mounted = true;
		async function load() {
			try {
				const prefs = await getPreferencesAction();
				if (mounted) {
					if (prefs) {
						setPreferences(fromDbRow(prefs as Record<string, unknown>));
					}
				}
			} catch {
				// Silently fail -- preferences will show loading state
				console.error("Failed to load notification preferences");
			} finally {
				if (mounted) setLoading(false);
			}
		}
		load();
		return () => {
			mounted = false;
		};
	}, []);

	async function handleToggle(field: keyof PreferencesState, value: boolean) {
		if (!preferences) return;

		const prevPrefs = { ...preferences };
		setPreferences((prev) => (prev ? { ...prev, [field]: value } : prev));

		try {
			await updatePreferencesAction({ [field]: value });
		} catch {
			setPreferences(prevPrefs);
			console.error("Failed to update preferences. Please try again.");
		}
	}

	if (loading) {
		return (
			<div className="space-y-4">
				<h2 className="font-heading text-xl font-semibold">Notification Preferences</h2>
				{[1, 2, 3, 4].map((i) => (
					<div key={i} className="space-y-2 animate-pulse">
						<div className="h-4 w-32 rounded bg-surface-container-high" />
						<div className="h-3 w-64 rounded bg-surface-container-high" />
						<div className="flex gap-4">
							<div className="h-4 w-20 rounded bg-surface-container-high" />
							<div className="h-4 w-16 rounded bg-surface-container-high" />
						</div>
						{i < 4 && <div className="border-t border-outline-variant/10 my-4" />}
					</div>
				))}
			</div>
		);
	}

	if (!preferences) {
		return (
			<div className="space-y-4">
				<h2 className="font-heading text-xl font-semibold">Notification Preferences</h2>
				<p className="font-mono text-xs text-on-surface-variant">
					Could not load preferences. Try refreshing the page.
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<h2 className="font-heading text-xl font-semibold">Notification Preferences</h2>

			{PREFERENCE_GROUPS.map((group, index) => (
				<div key={group.key}>
					<div className="space-y-2">
						<div className="flex items-center justify-between">
							<span className="text-sm font-semibold text-on-surface">{group.title}</span>
							{group.phaseBadge && (
								<span className="font-mono text-xs font-semibold uppercase bg-surface-container-high text-on-surface-variant px-2 py-1 rounded border border-outline-variant/20">
									[{group.phaseBadge}]
								</span>
							)}
						</div>
						<p className="text-sm text-on-surface-variant">{group.description}</p>
						<div className="flex items-center gap-4">
							<label
								className={cn(
									"flex items-center gap-2 cursor-pointer",
									!group.enabled && "opacity-50 cursor-not-allowed",
								)}
							>
								<input
									type="checkbox"
									className="accent-primary"
									checked={preferences[group.inappField]}
									disabled={!group.enabled}
									aria-disabled={!group.enabled}
									onChange={(e) => handleToggle(group.inappField, e.target.checked)}
								/>
								<span className="font-mono text-xs text-on-surface-variant">In-app</span>
							</label>
							{group.emailField &&
								(() => {
									const emailField = group.emailField;
									return (
										<label
											className={cn(
												"flex items-center gap-2 cursor-pointer",
												!group.enabled && "opacity-50 cursor-not-allowed",
											)}
										>
											<input
												type="checkbox"
												className="accent-primary"
												checked={preferences[emailField]}
												disabled={!group.enabled}
												aria-disabled={!group.enabled}
												onChange={(e) => handleToggle(emailField, e.target.checked)}
											/>
											<span className="font-mono text-xs text-on-surface-variant">Email</span>
										</label>
									);
								})()}
						</div>
					</div>
					{index < PREFERENCE_GROUPS.length - 1 && (
						<div className="border-t border-outline-variant/10 my-4" />
					)}
				</div>
			))}
		</div>
	);
}
