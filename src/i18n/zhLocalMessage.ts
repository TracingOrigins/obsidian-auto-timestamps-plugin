import {Message} from "./messages";

export default class ZhLocalMessage implements Message {
	settingsTitle = '时间戳插件设置';
	enableCreatedTimeName = '启用创建时间';
	enableCreatedTimeDesc = '开启或关闭为文档添加创建时间';
	enableModifiedTimeName = '启用修改时间';
	enableModifiedTimeDesc = '开启或关闭为修改的文档添加更新时间';
	pluginDescription = '自动为文档添加创建时间和修改时间的时间戳';
}
