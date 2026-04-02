import { create } from "zustand";

export interface PlayerTrack {
	videoId: string;
	title: string;
	artist: string;
	coverUrl: string | null;
}

interface PlayerState {
	currentTrack: PlayerTrack | null;
	queue: PlayerTrack[];
	isPlaying: boolean;
	currentTime: number;
	duration: number;
	embedError: boolean;

	// Actions
	play: (track: PlayerTrack) => void;
	pause: () => void;
	resume: () => void;
	next: () => void;
	previous: () => void;
	addToQueue: (track: PlayerTrack) => void;
	removeFromQueue: (videoId: string) => void;
	clearQueue: () => void;
	setIsPlaying: (playing: boolean) => void;
	setCurrentTime: (time: number) => void;
	setDuration: (duration: number) => void;
	setEmbedError: (error: boolean) => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
	currentTrack: null,
	queue: [],
	isPlaying: false,
	currentTime: 0,
	duration: 0,
	embedError: false,

	play: (track) => {
		set({ currentTrack: track, isPlaying: true, embedError: false, currentTime: 0 });
	},

	pause: () => set({ isPlaying: false }),

	resume: () => {
		if (get().currentTrack) set({ isPlaying: true });
	},

	next: () => {
		const { queue } = get();
		if (queue.length === 0) {
			set({ isPlaying: false });
			return;
		}
		const [next, ...rest] = queue;
		set({ currentTrack: next, queue: rest, isPlaying: true, embedError: false, currentTime: 0 });
	},

	previous: () => {
		// Restart current track (no history tracking for now)
		set({ currentTime: 0 });
	},

	addToQueue: (track) => {
		const { queue, currentTrack } = get();
		// Don't add if already in queue or currently playing
		const alreadyQueued = queue.some((t) => t.videoId === track.videoId);
		const isCurrent = currentTrack?.videoId === track.videoId;
		if (!alreadyQueued && !isCurrent) {
			set({ queue: [...queue, track] });
		}
	},

	removeFromQueue: (videoId) => {
		set((state) => ({ queue: state.queue.filter((t) => t.videoId !== videoId) }));
	},

	clearQueue: () => set({ queue: [] }),

	setIsPlaying: (playing) => set({ isPlaying: playing }),
	setCurrentTime: (time) => set({ currentTime: time }),
	setDuration: (duration) => set({ duration }),
	setEmbedError: (error) => set({ embedError: error }),
}));
