/**
 * 英文语言包
 * 包含插件所有UI元素的英文翻译
 * 实现Message接口定义的所有文本内容
 */
import {Message} from "../i18n";

/**
 * 英文语言包对象
 * 包含所有需要在UI中显示的英文文本
 */
export const en: Message = {
    // 设置面板的标题
    settingsTitle: 'Auto Timestamps Settings',
    // 创建时间开关的名称
    enableCreatedTimeName: 'Enable Created Time',
    // 创建时间开关的说明
    enableCreatedTimeDesc: 'Toggle adding creation time to documents',
    // 修改时间开关的名称
    enableModifiedTimeName: 'Enable Modified Time',
    // 修改时间开关的说明
    enableModifiedTimeDesc: 'Toggle adding modification time to updated documents',
    // 修改时间间隔设置的名称
    modifyIntervalName: 'Modification Interval (seconds)',
    // 修改时间间隔设置的说明
    modifyIntervalDesc: 'Set the interval (in seconds) to ignore updates after the last modification',
    // 插件在插件列表中的描述
    pluginDescription: 'An Obsidian plugin to automatically add creation and modification timestamps to documents',
}