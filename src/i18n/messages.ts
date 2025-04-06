import EnLocalMessage from "./enLocalMessage";
import ZhLocalMessage from "./zhLocalMessage";


export interface Message {
	settingsTitle: string;
	enableCreatedTimeName: string;
	enableCreatedTimeDesc: string;
	enableModifiedTimeName: string;
	enableModifiedTimeDesc: string;
	pluginDescription: string;
}

export function getLocal(): Message {
	const lang = window.localStorage.getItem("language");
	switch (lang) {
		case "zh":
			return new ZhLocalMessage();
		default:
			return new EnLocalMessage();
	}
}
