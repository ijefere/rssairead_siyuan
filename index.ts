import { fetchPost, Dialog, Plugin } from 'siyuan';
import { removeAllCronJob, scheduleCronJob } from './libs/cron';
import { getAllFeedBlocks, parseFeedBlock, parseFeed, linkFilter } from './libs/feed';
import { DEFAULT_CRON } from './libs/const';
import { insertBlock, getBlockByID, prependBlock } from './libs/siyuan_api';
import { DEFAULT_CONFIG, IPluginConfig } from './libs/settings';
import { generateSummary } from './libs/llm';
import { playText } from './libs/tts';
import { createFeedBlock, ensureCategoryDoc, deleteFeedBlock } from './libs/manager';
import { parseOpml, flattenOpml } from './libs/opml';

// 引入这个变量后 vite 会自动注入 hot
import.meta.hot;

export default class RssAiReadPlugin extends Plugin {
  /** 拉取feed链接并进行解析的函数 */
  _feedFetch: (() => void)[] = [];
  config: IPluginConfig = DEFAULT_CONFIG;
  // Cache for feeds list in settings
  currentFeeds: any[] = [];

  async onload() {
    // Load config
    const loadedData = await this.loadData("config.json");
    if (loadedData) {
        this.config = {
            llm: { ...DEFAULT_CONFIG.llm, ...(loadedData.llm || {}) },
            tts: { ...DEFAULT_CONFIG.tts, ...(loadedData.tts || {}) },
            summary: { ...DEFAULT_CONFIG.summary, ...(loadedData.summary || {}) }
        };
    }

    this.addCommand({
      hotkey: '',
      langKey: '_feedFetch',
      langText: '立刻对所有feed进行一次拉取',
      callback: async () => {
        await this.registerAllFeed();
        this._feedFetch.forEach((feedFetch) => feedFetch());
      },
    });

    this.addCommand({
        langKey: 'generateSummary',
        langText: '生成今日摘要 (Generate Summary)',
        callback: async () => {
            await this.generateAndSaveSummary();
        }
    });

    this.registerAllFeed();
  }

  async openSetting() {
      // Fetch current feeds for the list
      const feedBlocks = await getAllFeedBlocks();
      this.currentFeeds = await Promise.all(feedBlocks.map(async b => {
          const doc = await parseFeedBlock(b.block_id);
          return {
              id: b.block_id,
              url: doc.getAttr('feed'),
              category: doc.getAttr('category') || 'Uncategorized',
              cron: doc.getAttr('cron')
          };
      }));

      const dialog = new Dialog({
          title: "RSS AI Plugin Settings",
          content: `
            <style>
              .rss-settings-container {
                padding: 20px;
                display: flex;
                flex-direction: column;
                gap: 20px;
                max-height: 70vh;
                overflow-y: auto;
              }
              .rss-setting-group {
                border: 1px solid var(--b3-theme-surface-lighter);
                border-radius: 4px;
                padding: 15px;
                background: var(--b3-theme-surface);
              }
              .rss-setting-header {
                font-weight: bold;
                margin-bottom: 15px;
                font-size: 1.1em;
                border-bottom: 1px solid var(--b3-theme-surface-lighter);
                padding-bottom: 5px;
                display: flex;
                align-items: center;
                gap: 8px;
              }
              .rss-setting-item {
                margin-bottom: 15px;
              }
              .rss-setting-label {
                display: block;
                margin-bottom: 5px;
                font-weight: 500;
              }
              .rss-setting-desc {
                font-size: 0.85em;
                color: var(--b3-theme-on-surface-light);
                margin-bottom: 5px;
              }
              .rss-input, .rss-textarea, .rss-select {
                width: 100%;
                padding: 8px;
                border: 1px solid var(--b3-theme-surface-lighter);
                border-radius: 4px;
                background: var(--b3-theme-background);
                color: var(--b3-theme-on-background);
                box-sizing: border-box;
              }
              .rss-textarea {
                resize: vertical;
              }
              .rss-checkbox {
                margin-right: 8px;
                transform: scale(1.2);
              }
              .rss-checkbox-label {
                cursor: pointer;
                display: flex;
                align-items: center;
              }
              .rss-btn {
                padding: 10px 20px;
                background: var(--b3-theme-primary);
                color: var(--b3-theme-on-primary);
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-weight: bold;
                align-self: flex-end;
              }
              .rss-btn:hover {
                opacity: 0.9;
              }
              .rss-feed-list {
                  max-height: 200px;
                  overflow-y: auto;
                  border: 1px solid var(--b3-theme-surface-lighter);
                  border-radius: 4px;
                  margin-top: 10px;
              }
              .rss-feed-item {
                  padding: 8px;
                  border-bottom: 1px solid var(--b3-theme-surface-lighter);
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
              }
              .rss-feed-item:last-child {
                  border-bottom: none;
              }
              .rss-feed-info {
                  font-size: 0.9em;
              }
              .rss-feed-url {
                  font-weight: bold;
              }
              .rss-feed-cat {
                  color: var(--b3-theme-on-surface-light);
                  font-size: 0.85em;
              }
              .rss-delete-btn {
                  color: var(--b3-theme-error);
                  cursor: pointer;
                  padding: 4px 8px;
                  font-size: 0.9em;
              }
              .rss-tabs {
                  display: flex;
                  border-bottom: 1px solid var(--b3-theme-surface-lighter);
                  margin-bottom: 15px;
              }
              .rss-tab {
                  padding: 10px 20px;
                  cursor: pointer;
                  border-bottom: 2px solid transparent;
              }
              .rss-tab.active {
                  border-bottom-color: var(--b3-theme-primary);
                  font-weight: bold;
              }
              .rss-tab-content {
                  display: none;
              }
              .rss-tab-content.active {
                  display: block;
              }
            </style>
            <div class="rss-settings-container">
               <div class="rss-tabs">
                   <div class="rss-tab active" data-tab="config">配置 (Config)</div>
                   <div class="rss-tab" data-tab="feeds">订阅管理 (Feeds)</div>
               </div>

               <div id="tab-config" class="rss-tab-content active">
                   <!-- LLM Section -->
                   <div class="rss-setting-group">
                      <div class="rss-setting-header">🤖 AI 摘要服务 (LLM)</div>
                      <div class="rss-setting-item">
                          <label class="rss-checkbox-label">
                            <input type="checkbox" id="llm-enable" class="rss-checkbox" ${this.config.llm.enable ? "checked" : ""}> 
                            启用 AI 摘要功能
                          </label>
                      </div>
                      <div class="rss-setting-item">
                          <label class="rss-setting-label">API Key</label>
                          <input id="llm-apikey" class="rss-input" type="password" placeholder="sk-..." value="${this.config.llm.apiKey || ""}">
                      </div>
                      <div class="rss-setting-item">
                          <label class="rss-setting-label">Base URL</label>
                          <div class="rss-setting-desc">OpenAI 兼容接口地址 (例如: https://api.openai.com/v1)</div>
                          <input id="llm-baseurl" class="rss-input" placeholder="https://api.openai.com/v1" value="${this.config.llm.baseUrl}">
                      </div>
                      <div class="rss-setting-item">
                          <label class="rss-setting-label">模型名称 (Model)</label>
                          <input id="llm-model" class="rss-input" placeholder="gpt-3.5-turbo" value="${this.config.llm.model}">
                      </div>
                      <div class="rss-setting-item">
                          <label class="rss-setting-label">系统提示词 (Prompt)</label>
                          <textarea id="llm-prompt" class="rss-textarea" rows="4">${this.config.llm.prompt}</textarea>
                      </div>
                   </div>

                   <!-- Summary & Cron -->
                   <div class="rss-setting-group">
                      <div class="rss-setting-header">📅 定时任务与存储</div>
                      <div class="rss-setting-item">
                          <label class="rss-checkbox-label">
                            <input type="checkbox" id="summary-enable" class="rss-checkbox" ${this.config.summary.enable ? "checked" : ""}> 
                            启用每日自动生成
                          </label>
                      </div>
                      <div class="rss-setting-item">
                          <label class="rss-setting-label">Cron 表达式</label>
                          <div class="rss-setting-desc">设置自动运行的时间 (例如: 0 8 * * * 表示每天早上8点)</div>
                          <input id="summary-cron" class="rss-input" placeholder="0 8 * * *" value="${this.config.summary.cron}">
                      </div>
                      <div class="rss-setting-item">
                          <label class="rss-setting-label">目标文档 ID (摘要存储)</label>
                          <div class="rss-setting-desc">摘要将写入此文档 (右键文档 -> 复制 ID)</div>
                          <input id="summary-target" class="rss-input" placeholder="2023..." value="${this.config.summary.targetDocId || ""}">
                      </div>
                   </div>

                   <!-- TTS Section -->
                   <div class="rss-setting-group">
                      <div class="rss-setting-header">🔊 语音播报 (TTS)</div>
                      <div class="rss-setting-item">
                          <label class="rss-checkbox-label">
                            <input type="checkbox" id="tts-enable" class="rss-checkbox" ${this.config.tts.enable ? "checked" : ""}> 
                            启用语音播报
                          </label>
                      </div>
                      <div class="rss-setting-item">
                          <label class="rss-setting-label">服务提供商</label>
                          <select id="tts-provider" class="rss-select">
                              <option value="browser" ${this.config.tts.provider === "browser" ? "selected" : ""}>浏览器原生 (免费)</option>
                              <option value="openai" ${this.config.tts.provider === "openai" ? "selected" : ""}>OpenAI (高质量)</option>
                          </select>
                      </div>
                      <div class="rss-setting-item">
                          <label class="rss-setting-label">语音 (Voice)</label>
                          <div class="rss-setting-desc">浏览器: 输入 voiceURI; OpenAI: alloy, echo, fable, onyx, nova, shimmer</div>
                          <input id="tts-voice" class="rss-input" placeholder="alloy" value="${this.config.tts.voice || ""}">
                      </div>
                      <div class="rss-setting-item">
                          <label class="rss-setting-label">语速 (Speed)</label>
                          <input type="number" id="tts-speed" class="rss-input" placeholder="1.0" value="${this.config.tts.speed || 1.0}" step="0.1" min="0.25" max="4.0">
                      </div>
                   </div>
                   
                   <button id="save-config-btn" class="rss-btn">💾 保存配置</button>
               </div>

               <div id="tab-feeds" class="rss-tab-content">
                   <div class="rss-setting-group">
                       <div class="rss-setting-header">➕ 添加订阅 (Add Feed)</div>
                       <div class="rss-setting-item">
                           <label class="rss-setting-label">RSS URL</label>
                           <input id="new-feed-url" class="rss-input" placeholder="https://...">
                       </div>
                       <div class="rss-setting-item">
                           <label class="rss-setting-label">分类 (Category)</label>
                           <input id="new-feed-cat" class="rss-input" placeholder="Tech, News...">
                       </div>
                       <div class="rss-setting-item">
                           <label class="rss-setting-label">父文档 ID (Parent Doc ID)</label>
                           <div class="rss-setting-desc">将在该文档下按分类创建子文档存放 RSS</div>
                           <input id="new-feed-parent-id" class="rss-input" placeholder="必填 (右键文档->复制ID)">
                       </div>
                       <button id="add-feed-btn" class="rss-btn">添加订阅</button>
                   </div>

                   <div class="rss-setting-group">
                       <div class="rss-setting-header">📂 导入 OPML</div>
                       <div class="rss-setting-item">
                           <label class="rss-setting-label">OPML 内容</label>
                           <textarea id="opml-content" class="rss-textarea" rows="5" placeholder="粘贴 OPML 内容..."></textarea>
                       </div>
                       <div class="rss-setting-item">
                           <label class="rss-setting-label">父文档 ID (Parent Doc ID)</label>
                           <input id="opml-parent-id" class="rss-input" placeholder="必填">
                       </div>
                       <button id="import-opml-btn" class="rss-btn">导入 OPML</button>
                   </div>

                   <div class="rss-setting-group">
                       <div class="rss-setting-header">📋 现有订阅 (${this.currentFeeds.length})</div>
                       <div class="rss-feed-list">
                           ${this.currentFeeds.map(f => `
                               <div class="rss-feed-item" data-id="${f.id}">
                                   <div class="rss-feed-info">
                                       <div class="rss-feed-url">${f.url}</div>
                                       <div class="rss-feed-cat">Category: ${f.category}</div>
                                   </div>
                                   <div class="rss-delete-btn">删除</div>
                               </div>
                           `).join('')}
                       </div>
                   </div>
               </div>
            </div>
          `,
          width: "700px"
      });

      // Tabs Logic
      const tabs = dialog.element.querySelectorAll('.rss-tab');
      const contents = dialog.element.querySelectorAll('.rss-tab-content');
      tabs.forEach(tab => {
          tab.addEventListener('click', () => {
              tabs.forEach(t => t.classList.remove('active'));
              contents.forEach(c => c.classList.remove('active'));
              tab.classList.add('active');
              dialog.element.querySelector(`#tab-${(tab as HTMLElement).dataset.tab}`)?.classList.add('active');
          });
      });

      // Save Config
      const saveBtn = dialog.element.querySelector("#save-config-btn");
      if (saveBtn) {
          saveBtn.addEventListener("click", () => {
              this.config.llm.enable = (dialog.element.querySelector("#llm-enable") as HTMLInputElement).checked;
              this.config.llm.apiKey = (dialog.element.querySelector("#llm-apikey") as HTMLInputElement).value;
              this.config.llm.baseUrl = (dialog.element.querySelector("#llm-baseurl") as HTMLInputElement).value;
              this.config.llm.model = (dialog.element.querySelector("#llm-model") as HTMLInputElement).value;
              this.config.llm.prompt = (dialog.element.querySelector("#llm-prompt") as HTMLInputElement).value;

              this.config.summary.enable = (dialog.element.querySelector("#summary-enable") as HTMLInputElement).checked;
              this.config.summary.cron = (dialog.element.querySelector("#summary-cron") as HTMLInputElement).value;
              this.config.summary.targetDocId = (dialog.element.querySelector("#summary-target") as HTMLInputElement).value;

              this.config.tts.enable = (dialog.element.querySelector("#tts-enable") as HTMLInputElement).checked;
              this.config.tts.provider = (dialog.element.querySelector("#tts-provider") as HTMLInputElement).value as any;
              this.config.tts.voice = (dialog.element.querySelector("#tts-voice") as HTMLInputElement).value;
              this.config.tts.speed = parseFloat((dialog.element.querySelector("#tts-speed") as HTMLInputElement).value) || 1.0;

              this.saveData("config.json", this.config);
              dialog.destroy();
              this.registerAllFeed();
          });
      }

      // Add Feed Logic
      const addFeedBtn = dialog.element.querySelector("#add-feed-btn");
      addFeedBtn?.addEventListener('click', async () => {
          const url = (dialog.element.querySelector("#new-feed-url") as HTMLInputElement).value;
          const cat = (dialog.element.querySelector("#new-feed-cat") as HTMLInputElement).value;
          const parentId = (dialog.element.querySelector("#new-feed-parent-id") as HTMLInputElement).value;

          if (!url || !parentId) {
              fetchPost('/api/notification/pushMsg', { msg: "URL 和 父文档 ID 必填" });
              return;
          }

          try {
              fetchPost('/api/notification/pushMsg', { msg: "Adding feed..." });
              // 1. Ensure category doc exists
              const catName = cat || "Uncategorized";
              const targetDocId = await ensureCategoryDoc(parentId, catName);
              
              // 2. Create block
              await createFeedBlock(targetDocId, url, catName);
              
              fetchPost('/api/notification/pushMsg', { msg: "Feed added successfully!" });
              dialog.destroy();
              this.registerAllFeed();
          } catch (e) {
              console.error(e);
              fetchPost('/api/notification/pushMsg', { msg: "Error adding feed: " + e });
          }
      });

      // Import OPML Logic
      const importOpmlBtn = dialog.element.querySelector("#import-opml-btn");
      importOpmlBtn?.addEventListener('click', async () => {
          const content = (dialog.element.querySelector("#opml-content") as HTMLTextAreaElement).value;
          const parentId = (dialog.element.querySelector("#opml-parent-id") as HTMLInputElement).value;

          if (!content || !parentId) {
              fetchPost('/api/notification/pushMsg', { msg: "OPML 内容 和 父文档 ID 必填" });
              return;
          }

          try {
              fetchPost('/api/notification/pushMsg', { msg: "Parsing OPML..." });
              const outlines = parseOpml(content);
              const flatFeeds = flattenOpml(outlines);
              
              fetchPost('/api/notification/pushMsg', { msg: `Found ${flatFeeds.length} feeds. Importing...` });

              for (const feed of flatFeeds) {
                  const catName = feed.category || "Uncategorized";
                  const targetDocId = await ensureCategoryDoc(parentId, catName);
                  await createFeedBlock(targetDocId, feed.url, catName);
              }

              fetchPost('/api/notification/pushMsg', { msg: "OPML Import complete!" });
              dialog.destroy();
              this.registerAllFeed();
          } catch (e) {
              console.error(e);
              fetchPost('/api/notification/pushMsg', { msg: "Error importing OPML: " + e });
          }
      });

      // Delete Logic
      dialog.element.querySelectorAll('.rss-delete-btn').forEach(btn => {
          btn.addEventListener('click', async (e) => {
              const item = (e.target as HTMLElement).closest('.rss-feed-item') as HTMLElement;
              const id = item.dataset.id;
              if (id) {
                  if (confirm("Confirm delete this feed block?")) {
                      await deleteFeedBlock(id);
                      item.remove();
                      fetchPost('/api/notification/pushMsg', { msg: "Feed deleted" });
                      // Note: We don't re-register immediately to avoid blocking UI, but ideally we should.
                  }
              }
          });
      });
  }

  async registerAllFeed() {
    this._feedFetch = [];
    removeAllCronJob();

    // Register Summary Cron
    if (this.config.summary.enable && this.config.summary.cron) {
        console.log(`Registering Summary Cron: ${this.config.summary.cron}`);
        scheduleCronJob(this.config.summary.cron, async () => {
            console.log("Auto-generating summary...");
            await this.generateAndSaveSummary();
        });
    }

    /** 解析并注册定时任务 */
    const feedBlocks = await getAllFeedBlocks();
    return Promise.all(
      feedBlocks.map(async (block) => {
        const feedDoc = await parseFeedBlock(block.block_id);
        if (feedDoc.getAttr('feed')) {
          const cron = feedDoc.getAttr('cron') || DEFAULT_CRON;
          console.log(`注册 cron job 表达式:${cron} by ${feedDoc.getAttr('feed')}`, feedDoc);
          const feedFetch = async () => {
            this.feedFetch(block.block_id);
          };
          scheduleCronJob(cron, feedFetch);
          this._feedFetch.push(feedFetch);
        } else {
          console.log(feedDoc, '没有读取到 feed 属性，请对照文档进行设定 feed');
        }
      }),
    );
  }

  async feedFetch(feedId: string) {
    const feedDoc = await parseFeedBlock(feedId);
    const feed = await parseFeed(feedDoc);
    if (feed instanceof Error) {
      throw feed;
    }
    const insertEntry = feed.entryList
      .sort((a, b) => {
        return Number(b.updated) - Number(a.updated);
      })
      /** 没有链接的不要 TODO 是否该给出提示 */
      .filter((el) => el.link)
      .filter((el) => {
        /** 既然本地已经存在了，就不再插入，所以过滤掉  */
        const s = !feedDoc.entryBlock.find(
          /** 如果entryBlock 的第一行存在当前 entry 的链接就当他俩是同一个 entry
           * TODO 如果有更新的话应该也要再次处理
           */
          (entryBlock) =>
            el.link && entryBlock.content.split('\n')[0].includes(linkFilter(el.link)),
        );
        return s;
      });
    const msg = `feed:${feedDoc.getAttr('feed')} 共 ${feed.entryList.length} 条，新增 ${
      insertEntry.length
    } 条`;
    console.log(msg);
    fetchPost('/api/notification/pushMsg', {
      msg,
    });

    const feedBlockId = feedDoc.attrBlock?.id ?? feedId;

    const block = await getBlockByID(feedBlockId);
    insertEntry.forEach(async (entry) => {
      let data = `* [ ] ###### [${entry.title ?? entry.link}](${entry.link})\n`;
      if (entry.published) data += `    - published:${entry.published}\n`;
      if (entry.updated) data += `    - updated:${entry.updated}\n`;
      if (entry.summary) data += `    > ${entry.summary}\n`;
      data += `  `;
      insertBlock({
        dataType: 'markdown',
        ...(block.type === 'd'
          ? {
              parentID: feedBlockId,
            }
          : {
              previousID: feedBlockId,
            }),

        data,
      });
    });
  }

  async generateAndSaveSummary() {
      if (!this.config.llm.enable) {
          fetchPost('/api/notification/pushMsg', { msg: "LLM not enabled. Cannot generate summary." });
          return;
      }

      // 1. Gather all feeds
      const feedBlocks = await getAllFeedBlocks();
      const groupedFeeds: Record<string, any[]> = {};

      for (const block of feedBlocks) {
          const feedDoc = await parseFeedBlock(block.block_id);
          const category = feedDoc.getAttr('category') || "Uncategorized";
          const feed = await parseFeed(feedDoc);
          
          if (feed instanceof Error) continue;
          
          // Filter entries from last 24 hours (or configurable)
          // For simplicity, take top 5 entries per feed.
          const recentEntries = feed.entryList.slice(0, 5); 

          if (!groupedFeeds[category]) groupedFeeds[category] = [];
          groupedFeeds[category].push({
              source: feed.title,
              entries: recentEntries
          });
      }

      // 2. Generate Summary per Category
      for (const [category, sources] of Object.entries(groupedFeeds)) {
          if (sources.length === 0) continue;

          let promptText = `Category: ${category}\n\n`;
          sources.forEach(src => {
              promptText += `Source: ${src.source}\n`;
              src.entries.forEach((e: any) => {
                  promptText += `- ${e.title}: ${e.summary || "No summary"}\n`;
              });
              promptText += "\n";
          });

          try {
              fetchPost('/api/notification/pushMsg', { msg: `Generating summary for ${category}...` });
              const summary = await generateSummary(promptText, this.config.llm);
              
              // 3. Save to SiYuan
              const targetId = this.config.summary.targetDocId;
              if (targetId) {
                  const content = `## ${category} Summary (${new Date().toLocaleDateString()})\n\n${summary}\n\n`;
                  await prependBlock({
                      parentID: targetId,
                      dataType: "markdown",
                      data: content
                  });
              } else {
                   fetchPost('/api/notification/pushMsg', { msg: `Summary generated for ${category} but no target doc ID set.` });
              }

              // 4. TTS
              if (this.config.tts.enable) {
                  // If we use OpenAI TTS, we might need the key. 
                  // Assuming LLM key is shared or user provides it elsewhere. 
                  // But our playText now supports passing key if needed. 
                  // Let's pass config.llm.apiKey as fallback if tts key is missing in future structure.
                  await playText(summary, this.config, this.config.llm.apiKey);
              }

          } catch (e) {
              console.error(e);
              fetchPost('/api/notification/pushMsg', { msg: `Error generating summary for ${category}` });
          }
      }
      
      fetchPost('/api/notification/pushMsg', { msg: "Summary generation complete." });
  }

  async onunload() {
    /** 取消注册的定时任务 */
    removeAllCronJob();
    // this.commands = [];
  }
}
