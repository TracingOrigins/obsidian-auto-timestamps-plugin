/**
 * 中文语言包
 * 包含插件所有UI元素的中文翻译
 * 实现Message接口定义的所有文本内容
 */
import {Message} from "../i18n";

/**
 * 中文语言包对象
 * 包含所有需要在UI中显示的中文文本
 */
export const zh: Message = {
    // 设置面板的标题
    settingsTitle: '时间戳插件设置',
    // 创建时间开关的名称
    enableCreatedTimeName: '启用创建时间',
    // 创建时间开关的说明
    enableCreatedTimeDesc: '开启或关闭为文档添加创建时间',
    // 修改时间开关的名称
    enableModifiedTimeName: '启用修改时间',
    // 修改时间开关的说明
    enableModifiedTimeDesc: '开启或关闭为修改的文档添加更新时间',
    // 修改时间间隔设置的名称
    modifyIntervalName: '修改时间间隔（秒）',
    // 修改时间间隔设置的说明
    modifyIntervalDesc: '设置忽略最后一次修改后的时间间隔（秒）',
    // 插件在插件列表中的描述
    pluginDescription: '自动为文档添加创建时间和修改时间的时间戳',
}