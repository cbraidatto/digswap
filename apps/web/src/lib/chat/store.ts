import { create } from "zustand";

interface ChatState {
	/** Whether the chat sidebar panel is open */
	isOpen: boolean;
	/** The friend currently being chatted with (null = conversation list) */
	activeFriendId: string | null;
	activeFriendUsername: string | null;
	activeFriendAvatarUrl: string | null;

	open: () => void;
	close: () => void;
	toggle: () => void;
	openConversation: (friendId: string, username: string | null, avatarUrl: string | null) => void;
	backToList: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
	isOpen: false,
	activeFriendId: null,
	activeFriendUsername: null,
	activeFriendAvatarUrl: null,

	open: () => set({ isOpen: true }),
	close: () =>
		set({
			isOpen: false,
			activeFriendId: null,
			activeFriendUsername: null,
			activeFriendAvatarUrl: null,
		}),
	toggle: () => set((s) => ({ isOpen: !s.isOpen })),
	openConversation: (friendId, username, avatarUrl) =>
		set({
			isOpen: true,
			activeFriendId: friendId,
			activeFriendUsername: username,
			activeFriendAvatarUrl: avatarUrl,
		}),
	backToList: () =>
		set({ activeFriendId: null, activeFriendUsername: null, activeFriendAvatarUrl: null }),
}));
