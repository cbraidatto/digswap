import { beforeEach, describe, expect, test } from "vitest";
import { usePlayerStore } from "@/lib/player/store";

// Reset store between tests
beforeEach(() => {
	usePlayerStore.setState({
		currentTrack: null,
		queue: [],
		isPlaying: false,
		currentTime: 0,
		duration: 0,
		embedError: false,
	});
});

const trackA = { videoId: "yt-aaa", title: "Kind of Blue", artist: "Miles Davis", coverUrl: null };
const trackB = {
	videoId: "yt-bbb",
	title: "A Love Supreme",
	artist: "John Coltrane",
	coverUrl: null,
};
const trackC = { videoId: "yt-ccc", title: "Blue Train", artist: "John Coltrane", coverUrl: null };

describe("usePlayerStore — play/pause/resume", () => {
	test("play sets currentTrack and isPlaying=true", () => {
		usePlayerStore.getState().play(trackA);
		const s = usePlayerStore.getState();
		expect(s.currentTrack).toEqual(trackA);
		expect(s.isPlaying).toBe(true);
		expect(s.embedError).toBe(false);
		expect(s.currentTime).toBe(0);
	});

	test("pause sets isPlaying=false", () => {
		usePlayerStore.getState().play(trackA);
		usePlayerStore.getState().pause();
		expect(usePlayerStore.getState().isPlaying).toBe(false);
	});

	test("resume sets isPlaying=true when there is a currentTrack", () => {
		usePlayerStore.getState().play(trackA);
		usePlayerStore.getState().pause();
		usePlayerStore.getState().resume();
		expect(usePlayerStore.getState().isPlaying).toBe(true);
	});

	test("resume does nothing when currentTrack is null", () => {
		usePlayerStore.getState().resume();
		expect(usePlayerStore.getState().isPlaying).toBe(false);
	});

	test("playing a new track resets currentTime and clears embedError", () => {
		usePlayerStore.setState({ currentTime: 42, embedError: true });
		usePlayerStore.getState().play(trackB);
		const s = usePlayerStore.getState();
		expect(s.currentTrack?.videoId).toBe("yt-bbb");
		expect(s.currentTime).toBe(0);
		expect(s.embedError).toBe(false);
	});
});

describe("usePlayerStore — queue management", () => {
	test("addToQueue adds track to queue", () => {
		usePlayerStore.getState().addToQueue(trackA);
		expect(usePlayerStore.getState().queue).toHaveLength(1);
		expect(usePlayerStore.getState().queue[0]).toEqual(trackA);
	});

	test("addToQueue does not add duplicate (same videoId)", () => {
		usePlayerStore.getState().addToQueue(trackA);
		usePlayerStore.getState().addToQueue(trackA);
		expect(usePlayerStore.getState().queue).toHaveLength(1);
	});

	test("addToQueue does not add currently playing track", () => {
		usePlayerStore.getState().play(trackA);
		usePlayerStore.getState().addToQueue(trackA);
		expect(usePlayerStore.getState().queue).toHaveLength(0);
	});

	test("addToQueue allows different tracks", () => {
		usePlayerStore.getState().addToQueue(trackA);
		usePlayerStore.getState().addToQueue(trackB);
		usePlayerStore.getState().addToQueue(trackC);
		expect(usePlayerStore.getState().queue).toHaveLength(3);
	});

	test("removeFromQueue removes by videoId", () => {
		usePlayerStore.getState().addToQueue(trackA);
		usePlayerStore.getState().addToQueue(trackB);
		usePlayerStore.getState().removeFromQueue("yt-aaa");
		const q = usePlayerStore.getState().queue;
		expect(q).toHaveLength(1);
		expect(q[0].videoId).toBe("yt-bbb");
	});

	test("clearQueue empties the queue", () => {
		usePlayerStore.getState().addToQueue(trackA);
		usePlayerStore.getState().addToQueue(trackB);
		usePlayerStore.getState().clearQueue();
		expect(usePlayerStore.getState().queue).toHaveLength(0);
	});
});

describe("usePlayerStore — next/previous", () => {
	test("next advances to first item in queue", () => {
		usePlayerStore.getState().play(trackA);
		usePlayerStore.getState().addToQueue(trackB);
		usePlayerStore.getState().next();
		const s = usePlayerStore.getState();
		expect(s.currentTrack?.videoId).toBe("yt-bbb");
		expect(s.queue).toHaveLength(0);
		expect(s.isPlaying).toBe(true);
		expect(s.currentTime).toBe(0);
	});

	test("next stops playback when queue is empty", () => {
		usePlayerStore.getState().play(trackA);
		usePlayerStore.getState().next();
		expect(usePlayerStore.getState().isPlaying).toBe(false);
	});

	test("previous resets currentTime to 0", () => {
		usePlayerStore.setState({ currentTime: 55 });
		usePlayerStore.getState().previous();
		expect(usePlayerStore.getState().currentTime).toBe(0);
	});
});

describe("usePlayerStore — embed error", () => {
	test("setEmbedError sets embedError flag", () => {
		usePlayerStore.getState().setEmbedError(true);
		expect(usePlayerStore.getState().embedError).toBe(true);
	});

	test("playing a new track clears embedError", () => {
		usePlayerStore.getState().setEmbedError(true);
		usePlayerStore.getState().play(trackA);
		expect(usePlayerStore.getState().embedError).toBe(false);
	});
});
