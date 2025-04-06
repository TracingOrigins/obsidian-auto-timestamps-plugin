/**
 * Obsidian Auto Timestamps Plugin
 * 
 * 功能说明：
 * 这个插件用于自动为 Markdown 文档添加和更新时间戳信息。
 * - 创建时间(created)：在新建文档时自动添加，对于已有文档会读取文件的实际创建时间
 * - 修改时间(modified)：在文档被修改时自动更新，新文件创建时也会添加初始修改时间
 * 
 * 主要特点：
 * 1. 只处理当前打开的活动文档，避免对未打开文档的不必要修改
 * 2. 支持自定义更新时间间隔，避免频繁更新
 * 3. 可分别启用/禁用创建时间和修改时间的自动添加功能
 * 4. 对于没有创建时间的已有文档，会自动添加文件的实际创建时间
 * 5. 对于没有修改时间的已有文档，会自动添加文件的实际修改时间
 * 6. 新文件创建后首次编辑会立即更新修改时间，无需等待间隔
 * 7. 采用防循环机制，确保插件的修改操作不会触发新的修改事件
 * 8. 重启Obsidian后不会影响已有文档的时间戳
 * 
 * 实现原理：
 * - 使用 isInitializing 标志避免在Obsidian启动时处理文件
 * - 使用 processingFile 标志防止修改操作导致的事件循环
 * - 监听文件打开事件(file-open)，只为当前活动文档添加缺失的时间戳
 * - 监听文件创建事件(create)，同时添加创建时间和初始修改时间
 * - 监听文件修改事件(modify)，根据设定的时间间隔更新修改时间
 * - 文件创建时重置 lastModifiedTime 为 0，确保首次编辑会立即更新修改时间
 * - 使用 frontmatter 格式(YAML)在文档顶部存储时间信息
 * - 精确识别当前活动文件，只处理用户正在操作的文档
 */

import { App, Plugin, PluginSettingTab, Setting, TFile, moment } from 'obsidian';

// 插件设置接口
interface AutoTimestampsPluginSettings {
    enableCreatedTime: boolean;    // 是否启用创建时间
    enableModifiedTime: boolean;   // 是否启用修改时间
    modifyInterval: number;        // 修改时间的更新间隔（秒）
}

// 默认设置
const DEFAULT_SETTINGS: AutoTimestampsPluginSettings = {
    enableCreatedTime: true,
    enableModifiedTime: true,
    modifyInterval: 10
}

export default class AutoTimestampsPlugin extends Plugin {
    settings: AutoTimestampsPluginSettings;
    private lastModifiedTime: number = 0;
    private activeFile: TFile | null = null;  // 追踪当前活动文件
    private processingFile: boolean = false;  // 防止事件循环的标志
    private isInitializing: boolean = true;   // 标记插件是否正在初始化

    async onload() {
        // 加载插件设置
        await this.loadSettings();

        // 添加设置选项卡
        this.addSettingTab(new AutoTimestampsSettingTab(this.app, this));

        // 初始化阶段不处理任何文件
        setTimeout(() => {
            this.isInitializing = false;
        }, 2000); // 给2秒时间让Obsidian完成启动

        // 注册事件监听器
        this.registerEvent(
            this.app.workspace.on('file-open', this.handleFileOpen.bind(this))
        );

        this.registerEvent(
            this.app.vault.on('create', this.handleFileCreate.bind(this))
        );

        this.registerEvent(
            this.app.vault.on('modify', this.handleFileModify.bind(this))
        );
    }

    // 处理文件打开事件
    async handleFileOpen(file: TFile) {
        // 如果插件正在初始化或不是 Markdown 文件，则退出
        if (this.isInitializing || !file || file.extension !== 'md') return;
        
        this.activeFile = file;
        
        try {
            this.processingFile = true;
            const content = await this.app.vault.read(file);
            let dataToAdd: Record<string, string> = {};
            let needsUpdate = false;
            
            // 检查文件是否有创建时间，如果没有则添加
            if (this.settings.enableCreatedTime && !this.hasTimeProperty(content, 'created')) {
                // 获取文件的实际创建时间
                dataToAdd.created = moment(file.stat.ctime).format("YYYY-MM-DD HH:mm:ss");
                needsUpdate = true;
            }
            
            // 检查文件是否有修改时间，如果没有则添加
            if (this.settings.enableModifiedTime && !this.hasTimeProperty(content, 'modified')) {
                // 获取文件的实际修改时间
                dataToAdd.modified = moment(file.stat.mtime).format("YYYY-MM-DD HH:mm:ss");
                needsUpdate = true;
            }
            
            // 如果需要更新，一次性添加所有缺失的时间属性
            if (needsUpdate) {
                const newContent = this.insertFrontMatter(content, dataToAdd);
                await this.app.vault.modify(file, newContent);
            }
        } catch (error) {
            console.error("处理文件打开事件时出错:", error);
        } finally {
            this.processingFile = false;
        }
    }

    // 检查文件内容是否包含指定的时间属性
    hasTimeProperty(content: string, property: string): boolean {
        const frontMatterRegex = /^---\n([\s\S]*?)\n---/;
        const frontMatter = content.match(frontMatterRegex)?.[1] || '';
        const propertyRegex = new RegExp(`^${property}:.*$`, 'm');
        return propertyRegex.test(frontMatter);
    }

    // 处理文件创建事件
    async handleFileCreate(file: TFile) {
        // 如果插件正在初始化或不是 Markdown 文件，则退出
        if (this.isInitializing || file.extension !== 'md') return;

        try {
            this.processingFile = true;
            const currentTime = moment().format("YYYY-MM-DD HH:mm:ss");
            const content = await this.app.vault.read(file);
            let data: Record<string, string> = {};
            
            // 添加创建时间和修改时间（根据设置）
            if (this.settings.enableCreatedTime) {
                data.created = currentTime;
            }
            
            if (this.settings.enableModifiedTime) {
                data.modified = currentTime;
            }
            
            // 添加时间戳到文档
            if (Object.keys(data).length > 0) {
                const newContent = this.insertFrontMatter(content, data);
                await this.app.vault.modify(file, newContent);
                
                // 如果是当前活动文件，重置最后修改时间
                if (file === this.activeFile && this.settings.enableModifiedTime) {
                    this.lastModifiedTime = 0;
                }
            }
        } catch (error) {
            console.error("处理新文件时出错:", error);
        } finally {
            this.processingFile = false;
        }
    }

    // 处理文件修改事件
    async handleFileModify(file: TFile) {
        // 如果插件正在初始化、正在处理文件、不是活动文件或不是 Markdown 文件，则退出
        if (this.isInitializing || this.processingFile || file.extension !== 'md' || file !== this.activeFile) return;

        const currentTime = Date.now();
        const interval = this.settings.modifyInterval * 1000;

        // 检查是否需要更新修改时间
        if (this.settings.enableModifiedTime && (currentTime - this.lastModifiedTime > interval)) {
            try {
                this.processingFile = true;
                const content = await this.app.vault.read(file);
                const modifiedTime = moment().format("YYYY-MM-DD HH:mm:ss");
                const newContent = this.insertFrontMatter(content, { modified: modifiedTime });
                await this.app.vault.modify(file, newContent);
                this.lastModifiedTime = currentTime;
            } catch (error) {
                console.error("更新修改时间时出错:", error);
            } finally {
                this.processingFile = false;
            }
        }
    }

    // 在文档中插入或更新 frontmatter
    insertFrontMatter(content: string, data: Record<string, string>): string {
        const frontMatterRegex = /^---\n([\s\S]*?)\n---/;
        let frontMatter = content.match(frontMatterRegex)?.[1] || '';
        let newFrontMatter = frontMatter;

        // 更新或添加时间戳
        for (const key in data) {
            const value = data[key];
            const regex = new RegExp(`^${key}:.*$`, 'm');
            if (regex.test(frontMatter)) {
                newFrontMatter = newFrontMatter.replace(regex, `${key}: ${value}`);
            } else {
                newFrontMatter += `\n${key}: ${value}`;
            }
        }

        // 返回更新后的内容
        if (frontMatter) {
            return content.replace(frontMatterRegex, `---\n${newFrontMatter.trim()}\n---`);
        } else {
            return `---\n${newFrontMatter.trim()}\n---\n\n${content}`;
        }
    }

    // 插件卸载时的清理工作
    onunload() {
        console.log('卸载时间戳插件');
    }

    // 加载插件设置
    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    // 保存插件设置
    async saveSettings() {
        await this.saveData(this.settings);
    }
}

// 设置面板类
class AutoTimestampsSettingTab extends PluginSettingTab {
    plugin: AutoTimestampsPlugin;

    constructor(app: App, plugin: AutoTimestampsPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: '时间戳插件设置' });

        // 创建时间设置
        new Setting(containerEl)
            .setName('启用创建时间')
            .setDesc('开启或关闭为文档添加创建时间')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableCreatedTime)
                .onChange(async (value) => {
                    this.plugin.settings.enableCreatedTime = value;
                    await this.plugin.saveSettings();
                }));

        // 修改时间设置
        new Setting(containerEl)
            .setName('启用修改时间')
            .setDesc('开启或关闭为修改的文档添加更新时间')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableModifiedTime)
                .onChange(async (value) => {
                    this.plugin.settings.enableModifiedTime = value;
                    await this.plugin.saveSettings();
                }));

        // 时间间隔设置
        new Setting(containerEl)
            .setName('修改时间间隔（秒）')
            .setDesc('设置忽略最后一次修改后的时间间隔（秒）')
            .addText(text => text
                .setValue(this.plugin.settings.modifyInterval.toString())
                .onChange(async (value) => {
                    this.plugin.settings.modifyInterval = parseInt(value) || 0;
                    await this.plugin.saveSettings();
                }));
    }
}