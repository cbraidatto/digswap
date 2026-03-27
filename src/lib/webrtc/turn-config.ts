export interface IceServerConfig {
	urls: string | string[];
	username?: string;
	credential?: string;
}

export const DEFAULT_STUN: IceServerConfig = {
	urls: "stun:stun.l.google.com:19302",
};
