import {Message} from "./messages";

export default class EnLocalMessage implements Message {
	settingsTitle = 'Auto Timestamps Settings';
	enableCreatedTimeName = 'Enable Created Time';
	enableCreatedTimeDesc = 'Toggle adding creation time to documents';
	enableModifiedTimeName = 'Enable Modified Time';
	enableModifiedTimeDesc = 'Toggle adding modification time to updated documents';
	pluginDescription = 'An Obsidian plugin to au;tomatically add creation and modification timestamps to documents';

}
