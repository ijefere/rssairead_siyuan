import { Plugin, fetchPost } from "siyuan";
import { getAllFeedBlocks, parseFeedBlock } from "./feed";
import { createFeedBlock, ensureCategoryDoc, deleteFeedBlock } from "./manager";

export class RssDock {
    private plugin: Plugin;
    element: HTMLElement;

    constructor(plugin: Plugin) {
        this.plugin = plugin;
        this.element = document.createElement("div");
        this.element.classList.add("rss-dock");
        this.render();
    }

    async render() {
        // Fetch data
        const feedBlocks = await getAllFeedBlocks();
        const feeds = await Promise.all(feedBlocks.map(async b => {
            const doc = await parseFeedBlock(b.block_id);
            return {
                id: b.block_id,
                url: doc.getAttr('feed'),
                category: doc.getAttr('category') || 'Uncategorized',
            };
        }));

        this.element.innerHTML = `
            <style>
                .rss-dock { 
                    padding: 10px; 
                    display: flex; 
                    flex-direction: column; 
                    gap: 10px; 
                    height: 100%; 
                    box-sizing: border-box; 
                    overflow-y: auto; 
                }
                .rss-dock-header { 
                    font-weight: bold; 
                    border-bottom: 1px solid var(--b3-theme-surface-lighter); 
                    padding-bottom: 5px; 
                    margin-bottom: 5px; 
                    font-size: 1.1em;
                }
                .rss-dock-item { 
                    padding: 10px; 
                    border: 1px solid var(--b3-theme-surface-lighter); 
                    border-radius: 4px; 
                    background: var(--b3-theme-surface); 
                    margin-bottom: 8px;
                }
                .rss-dock-url { 
                    font-weight: bold; 
                    word-break: break-all; 
                    font-size: 0.9em; 
                    margin-bottom: 4px;
                }
                .rss-dock-cat { 
                    font-size: 0.85em; 
                    color: var(--b3-theme-on-surface-light); 
                    background: var(--b3-theme-surface-lighter);
                    padding: 2px 6px;
                    border-radius: 3px;
                    display: inline-block;
                }
                .rss-dock-btn-group { 
                    display: flex; 
                    justify-content: flex-end; 
                    gap: 5px; 
                    margin-top: 8px; 
                }
                .rss-btn-small { 
                    padding: 4px 8px; 
                    font-size: 0.85em; 
                    cursor: pointer; 
                    border: 1px solid var(--b3-theme-surface-lighter); 
                    border-radius: 3px; 
                    background: var(--b3-theme-background); 
                }
                .rss-btn-small:hover {
                    background: var(--b3-theme-surface-lighter);
                }
                .rss-btn-primary { 
                    background: var(--b3-theme-primary); 
                    color: var(--b3-theme-on-primary); 
                    border: none; 
                    padding: 8px 12px; 
                    border-radius: 4px; 
                    cursor: pointer; 
                    width: 100%; 
                    font-weight: bold;
                }
                .rss-btn-primary:hover {
                    opacity: 0.9;
                }
                .rss-input { 
                    width: 100%; 
                    box-sizing: border-box; 
                    padding: 8px; 
                    margin-bottom: 8px; 
                    border: 1px solid var(--b3-theme-surface-lighter); 
                    border-radius: 4px; 
                    background: var(--b3-theme-background); 
                    color: var(--b3-theme-on-background); 
                }
                .rss-section { 
                    border: 1px solid var(--b3-theme-surface-lighter); 
                    padding: 12px; 
                    border-radius: 4px; 
                    background: var(--b3-theme-background-light); 
                }
                .rss-refresh-icon {
                    cursor: pointer;
                    float: right;
                }
            </style>
            
            <div class="rss-section">
                <div class="rss-dock-header">
                    操作 (Actions)
                    <span id="dock-refresh-btn" class="rss-refresh-icon" title="刷新">🔄</span>
                </div>
                <button id="dock-fetch-btn" class="rss-btn-primary" style="margin-bottom:8px;">🚀 拉取更新 (Fetch All)</button>
                <button id="dock-summary-btn" class="rss-btn-primary" style="background: var(--b3-theme-secondary); color: var(--b3-theme-on-secondary);">📝 生成 AI 摘要</button>
            </div>

            <div class="rss-section">
                <div class="rss-dock-header">快速订阅 (Quick Add)</div>
                <input id="dock-url" class="rss-input" placeholder="RSS URL (必填)">
                <input id="dock-cat" class="rss-input" placeholder="Category (分类, 可选)">
                <input id="dock-pid" class="rss-input" placeholder="Parent Doc ID (父文档ID, 必填)">
                <button id="dock-add-btn" class="rss-btn-primary">➕ 添加订阅</button>
            </div>

            <div>
                <div class="rss-dock-header">订阅列表 (${feeds.length})</div>
                <div id="dock-feed-list">
                    ${feeds.length === 0 ? '<div style="text-align:center; padding:20px; color:var(--b3-theme-on-surface-light);">暂无订阅</div>' : ''}
                    ${feeds.map(f => `
                        <div class="rss-dock-item" data-id="${f.id}">
                            <div class="rss-dock-url" title="${f.url}">${f.url}</div>
                            <div><span class="rss-dock-cat">${f.category}</span></div>
                            <div class="rss-dock-btn-group">
                                <button class="rss-btn-small dock-fetch-single-btn">📥 拉取</button>
                                <button class="rss-btn-small dock-del-btn" style="color:var(--b3-theme-error);">🗑️ 删除</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        // Bind events
        this.element.querySelector("#dock-refresh-btn")?.addEventListener("click", () => {
            fetchPost('/api/notification/pushMsg', { msg: "Refreshing list..." });
            this.render();
        });
        
        this.element.querySelector("#dock-fetch-btn")?.addEventListener("click", async () => {
             fetchPost('/api/notification/pushMsg', { msg: "Starting fetch all..." });
             try {
                 await (this.plugin as any).registerAllFeed();
                 (this.plugin as any)._feedFetch.forEach((f: any) => f());
             } catch(e) {
                 console.error(e);
             }
        });

        this.element.querySelector("#dock-summary-btn")?.addEventListener("click", () => {
             (this.plugin as any).generateAndSaveSummary();
        });

        this.element.querySelector("#dock-add-btn")?.addEventListener("click", async () => {
            const url = (this.element.querySelector("#dock-url") as HTMLInputElement).value;
            const cat = (this.element.querySelector("#dock-cat") as HTMLInputElement).value;
            const pid = (this.element.querySelector("#dock-pid") as HTMLInputElement).value;

            if (!url || !pid) {
                fetchPost('/api/notification/pushMsg', { msg: "URL and Parent ID required" });
                return;
            }
            try {
                fetchPost('/api/notification/pushMsg', { msg: "Adding feed..." });
                const catName = cat || "Uncategorized";
                const targetDocId = await ensureCategoryDoc(pid, catName);
                await createFeedBlock(targetDocId, url, catName);
                fetchPost('/api/notification/pushMsg', { msg: "Feed added successfully" });
                
                // Clear inputs
                (this.element.querySelector("#dock-url") as HTMLInputElement).value = "";
                
                this.render();
            } catch(e) {
                console.error(e);
                fetchPost('/api/notification/pushMsg', { msg: "Error adding feed: " + e });
            }
        });

        this.element.querySelectorAll(".dock-del-btn").forEach(btn => {
            btn.addEventListener("click", async (e) => {
                const item = (e.target as HTMLElement).closest(".rss-dock-item") as HTMLElement;
                const id = item.dataset.id;
                if (id && confirm("Are you sure you want to delete this feed?")) {
                    try {
                        await deleteFeedBlock(id);
                        fetchPost('/api/notification/pushMsg', { msg: "Feed deleted" });
                        this.render();
                    } catch(e) {
                        console.error(e);
                        fetchPost('/api/notification/pushMsg', { msg: "Error deleting feed: " + e });
                    }
                }
            });
        });

        this.element.querySelectorAll(".dock-fetch-single-btn").forEach(btn => {
            btn.addEventListener("click", async (e) => {
                const item = (e.target as HTMLElement).closest(".rss-dock-item") as HTMLElement;
                const id = item.dataset.id;
                if (id) {
                    fetchPost('/api/notification/pushMsg', { msg: "Fetching single feed..." });
                    try {
                        await (this.plugin as any).feedFetch(id);
                    } catch(e) {
                        console.error(e);
                        fetchPost('/api/notification/pushMsg', { msg: "Error fetching feed: " + e });
                    }
                }
            });
        });
    }
}
