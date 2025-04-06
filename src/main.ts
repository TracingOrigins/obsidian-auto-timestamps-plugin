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
 * 9. 支持多语言，根据Obsidian界面语言自动切换中英文
 */

import {App, Plugin, PluginSettingTab, Setting, TFile, moment} from 'obsidian';
import {messages} from "./i18n/i18n";

/**
 * 插件设置接口
 * 定义了用户可配置的所有设置项及其类型
 * 这些设置会存储在data.json中，并在插件启动时加载
 */
interface AutoTimestampsPluginSettings {
	enableCreatedTime: boolean;    // 是否启用创建时间，为true时会为新文档添加创建时间
	enableModifiedTime: boolean;   // 是否启用修改时间，为true时会在文档修改后更新修改时间
	modifyInterval: number;        // 修改时间的更新间隔（秒），避免频繁更新导致的性能问题
}

/**
 * 默认设置
 * 当用户首次安装插件或settings.json不存在时使用的初始设置
 */
const DEFAULT_SETTINGS: AutoTimestampsPluginSettings = {
	enableCreatedTime: true,       // 默认启用创建时间
	enableModifiedTime: true,      // 默认启用修改时间
	modifyInterval: 10             // 默认10秒更新间隔，避免过于频繁的更新
}

/**
 * 自动时间戳插件主类
 * 实现了插件的所有核心功能
 */
export default class AutoTimestampsPlugin extends Plugin {
	// 插件设置，包含用户的配置选项
	settings: AutoTimestampsPluginSettings;
	
	// 记录上次更新修改时间的时间戳，用于控制更新频率
	private lastModifiedTime: number = 0;
	
	// 当前打开的活动文件引用，确保只处理用户正在编辑的文件
	private activeFile: TFile | null = null;
	
	// 标记是否正在处理文件，防止修改操作触发新的modify事件导致无限循环
	private processingFile: boolean = false;
	
	// 标记插件是否正在初始化，避免在Obsidian启动过程中处理文件
	private isInitializing: boolean = true;
	
	// 设置面板实例，用于在语言变化时刷新界面
	private settingTab: AutoTimestampsSettingTab;

	/**
	 * 插件加载函数
	 * 当Obsidian加载插件时调用，用于初始化插件功能和注册事件监听器
	 */
	async onload() {
		// 加载用户设置，如果没有保存的设置则使用默认值
		await this.loadSettings();

		// 创建设置面板，供用户配置插件选项
		this.settingTab = new AutoTimestampsSettingTab(this.app, this);
		this.addSettingTab(this.settingTab);

		// 根据当前语言设置更新插件在插件列表中的描述
		this.updatePluginDescription();

		// 等待Obsidian布局加载完成后注册事件监听器
		this.app.workspace.onLayoutReady(() => {
			// 监听Obsidian语言设置变化，在语言切换时刷新UI
			this.registerEvent(
				(this.app.workspace as any).on('change:locale', () => {
					// 当Obsidian语言变化时刷新设置面板和插件描述
					this.refreshSettingsPane();
					this.updatePluginDescription();
				})
			);
		});

		// 延迟初始化完成标记，让Obsidian有足够时间完全加载
		setTimeout(() => {
			this.isInitializing = false;
		}, 2000); // 2秒延迟，避免在Obsidian启动时处理文件

		// 注册文件打开事件监听器，处理已存在文件的时间戳
		this.registerEvent(
			this.app.workspace.on('file-open', this.handleFileOpen.bind(this))
		);

		// 注册文件创建事件监听器，为新建文件添加初始时间戳
		this.registerEvent(
			this.app.vault.on('create', this.handleFileCreate.bind(this))
		);

		// 注册文件修改事件监听器，更新文件的修改时间
		this.registerEvent(
			this.app.vault.on('modify', this.handleFileModify.bind(this))
		);
	}

	/**
	 * 刷新设置面板
	 * 当语言设置变化时重新绘制设置界面，更新所有文本为当前语言
	 */
	refreshSettingsPane() {
		// 检查设置面板是否已加载并可见
		if (this.settingTab && this.settingTab.containerEl.parentElement) {
			// 重新绘制设置面板UI
			this.settingTab.display();
		}
	}

	/**
	 * 处理文件打开事件
	 * 当用户打开一个Markdown文件时，检查并添加缺失的时间戳
	 * 只为没有时间戳的文件添加，不会修改已有的时间戳
	 * 
	 * @param file 打开的文件对象
	 */
	async handleFileOpen(file: TFile) {
		// 如果插件正在初始化或文件不是Markdown文件，则不处理
		if (this.isInitializing || !file || file.extension !== 'md') return;

		// 更新当前活动文件引用
		this.activeFile = file;

		try {
			// 设置处理标志，防止触发新的modify事件
			this.processingFile = true;
			
			// 读取文件内容
			const content = await this.app.vault.read(file);
			const dataToAdd: Record<string, string> = {};
			let needsUpdate = false;

			// 检查文件是否有创建时间，如果设置启用且文件没有创建时间，则添加
			if (this.settings.enableCreatedTime && !this.hasTimeProperty(content, 'created')) {
				// 使用文件的实际创建时间作为创建时间
				dataToAdd.created = moment(file.stat.ctime).format("YYYY-MM-DD HH:mm:ss");
				needsUpdate = true;
			}

			// 检查文件是否有修改时间，如果设置启用且文件没有修改时间，则添加
			if (this.settings.enableModifiedTime && !this.hasTimeProperty(content, 'modified')) {
				// 使用文件的实际修改时间作为修改时间
				dataToAdd.modified = moment(file.stat.mtime).format("YYYY-MM-DD HH:mm:ss");
				needsUpdate = true;
			}

			// 如果需要添加时间戳，则更新文件内容
			if (needsUpdate) {
				const newContent = this.insertFrontMatter(content, dataToAdd);
				await this.app.vault.modify(file, newContent);
			}
		} catch (error) {
			// 记录错误，但不中断插件运行
			console.error("处理文件打开事件时出错:", error);
		} finally {
			// 重置处理标志，允许后续处理
			this.processingFile = false;
		}
	}

	/**
	 * 检查文件内容是否包含指定的时间属性
	 * 用于判断文件是否已经有了特定的时间戳（如created或modified）
	 * 
	 * @param content 文件内容
	 * @param property 要检查的属性名称
	 * @returns 如果文件包含指定属性则返回true，否则返回false
	 */
	hasTimeProperty(content: string, property: string): boolean {
		// 匹配YAML frontmatter部分（---之间的内容）
		const frontMatterRegex = /^---\n([\s\S]*?)\n---/;
		const frontMatter = content.match(frontMatterRegex)?.[1] || '';
		
		// 创建正则表达式来查找指定属性
		const propertyRegex = new RegExp(`^${property}:.*$`, 'm');
		
		// 测试frontmatter是否包含该属性
		return propertyRegex.test(frontMatter);
	}

	/**
	 * 处理文件创建事件
	 * 当创建新文件时，自动添加创建时间和修改时间
	 * @param file 创建的文件
	 */
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

				// 如果是当前活动文件，重置最后修改时间，确保首次编辑会立即更新
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

	/**
	 * 处理文件修改事件
	 * 当文件内容变化时，根据设置的时间间隔更新修改时间
	 * @param file 修改的文件
	 */
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
				const newContent = this.insertFrontMatter(content, {modified: modifiedTime});
				await this.app.vault.modify(file, newContent);
				this.lastModifiedTime = currentTime;
			} catch (error) {
				console.error("更新修改时间时出错:", error);
			} finally {
				this.processingFile = false;
			}
		}
	}

	/**
	 * 在文档中插入或更新 frontmatter
	 * @param content 原始文件内容
	 * @param data 要插入的数据
	 * @returns 更新后的文件内容
	 */
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

	/**
	 * 插件卸载时的清理工作
	 */
	onunload() {
		console.log('卸载时间戳插件');
	}

	/**
	 * 加载插件设置
	 */
	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	/**
	 * 保存插件设置
	 */
	async saveSettings() {
		await this.saveData(this.settings);
	}

	/**
	 * 更新插件描述
	 * 根据当前语言设置更新插件在设置面板中的描述
	 */
	updatePluginDescription() {
		try {
			// 获取本地化描述
			const localizedDescription = messages.pluginDescription;

			// 更新插件清单中的描述
			if (this.manifest) {
				this.manifest.description = localizedDescription;
			}

			// 尝试直接修改DOM
			setTimeout(() => {
				try {
					// 查找插件设置面板中的描述元素
					const pluginElements = document.querySelectorAll('.community-plugin-item');

					for (let i = 0; i < pluginElements.length; i++) {
						const element = pluginElements[i] as HTMLElement;
						const idElement = element.querySelector('.community-plugin-name');

						if (idElement && idElement.textContent && idElement.textContent.includes('Auto Timestamps')) {
							// 找到描述元素
							const descElement = element.querySelector('.community-plugin-desc');
							if (descElement) {
								descElement.textContent = localizedDescription;
							}
						}
					}
				} catch (error) {
					// 忽略错误
				}
			}, 100);
		} catch (error) {
			console.error("更新插件描述时出错:", error);
		}
	}
}

/**
 * 设置面板类
 * 用于提供插件设置界面
 */
class AutoTimestampsSettingTab extends PluginSettingTab {
	plugin: AutoTimestampsPlugin;

	constructor(app: App, plugin: AutoTimestampsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	/**
	 * 显示设置面板
	 * 创建UI元素并绑定事件
	 */
	display(): void {
		const {containerEl} = this;
		containerEl.empty();
		
		// 创建标题
		containerEl.createEl('h2', {text: messages.settingsTitle});

		// 创建时间设置
		new Setting(containerEl)
			.setName(messages.enableCreatedTimeName)
			.setDesc(messages.enableCreatedTimeDesc)
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableCreatedTime)
				.onChange(async (value) => {
					this.plugin.settings.enableCreatedTime = value;
					await this.plugin.saveSettings();
				}));

		// 修改时间设置
		new Setting(containerEl)
			.setName(messages.enableModifiedTimeName)
			.setDesc(messages.enableModifiedTimeDesc)
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableModifiedTime)
				.onChange(async (value) => {
					this.plugin.settings.enableModifiedTime = value;
					await this.plugin.saveSettings();
				}));

		// 时间间隔设置
		new Setting(containerEl)
			.setName(messages.modifyIntervalName)
			.setDesc(messages.modifyIntervalDesc)
			.addText(text => text
				.setValue(this.plugin.settings.modifyInterval.toString())
				.onChange(async (value) => {
					this.plugin.settings.modifyInterval = parseInt(value) || 0;
					await this.plugin.saveSettings();
				}));
	}
}
