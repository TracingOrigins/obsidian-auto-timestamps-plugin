/**
 * i18n国际化模块
 * 负责管理插件的多语言支持，提供自动语言检测和翻译文本访问功能
 * 通过此模块可以根据Obsidian的界面语言设置自动切换插件的显示语言
 */

import {en} from "./locales/en"; // 导入英文语言包
import {zh} from "./locales/zh"; // 导入中文语言包

/**
 * 消息类型接口
 * 定义了所有需要国际化的文本内容
 * 所有语言包必须实现这个接口中定义的所有字段
 */
export type Message = {
    // 设置面板标题
    settingsTitle: string;
    // 创建时间选项名称
    enableCreatedTimeName: string;
    // 创建时间选项描述
    enableCreatedTimeDesc: string;
    // 修改时间选项名称
    enableModifiedTimeName: string;
    // 修改时间选项描述
    enableModifiedTimeDesc: string;
    // 修改间隔选项名称
    modifyIntervalName: string;
    // 修改间隔选项描述
    modifyIntervalDesc: string;
    // 插件描述，显示在插件列表中
    pluginDescription: string;
}

/**
 * 获取当前Obsidian的语言设置
 * Obsidian会将用户的语言设置保存在localStorage中的"language"键下
 * 返回值例如："zh"表示中文，"en"表示英文
 */
const lang = window.localStorage.getItem("language");

/**
 * 导出当前语言的消息
 * 如果检测到中文("zh")则使用中文语言包，否则默认使用英文语言包
 * 这是插件中获取翻译文本的主要入口点
 */
export const messages = lang === "zh" ? zh : en;
