# RSS AI Read for SiYuan Note

[![GitHub release](https://img.shields.io/github/release/ijefere/rssairead_siyuan.svg?style=flat)](https://github.com/ijefere/rssairead_siyuan)
[![MIT License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

**RSS AI Read** 是一款专为 [SiYuan Note](https://b3log.org/siyuan/) 打造的智能 RSS 阅读插件。它不仅支持基础的订阅与更新功能，更集成了 **AI 自动摘要** 和 **TTS 语音播报**，并提供可视化的 **Feed 管理面板** 和 **OPML 批量导入** 功能，助你高效获取和管理信息。

## ✨ 核心特性 (Features)

### 1. 🤖 AI 智能摘要 (AI Summary)

告别信息过载！插件能自动阅读你订阅的所有 RSS 文章，并按**领域 (Category)** 生成每日简报。

* **多模型支持**: 完美兼容 OpenAI (GPT-3.5/4) 及任何兼容 OpenAI 接口的大模型（如 DeepSeek, 通义千问等）。
* **结构化输出**: 自动提炼核心观点，按重要性排序，生成清晰的 Markdown 日报。
* **自动归档**: 摘要会自动写入你指定的思源笔记文档中，方便后续回顾。

### 2. 🔊 沉浸式听读 (TTS)

让眼睛休息一下，用耳朵获取资讯。

* **双引擎支持**:
  * **浏览器原生 (Browser)**: 免费、离线，利用系统自带语音。
  * **OpenAI TTS**: 付费、高清，提供 Alloy, Echo 等多种逼真的人声体验。
* **自动播报**: 生成摘要后可自动开始朗读。

### 3. 📰 强大的订阅管理 (Feed Manager)

无需手动编辑属性，全新的可视化管理面板让订阅变得简单。

* **可视化添加**: 在设置面板中直接输入 URL、分类和目标父文档，插件会自动创建对应的订阅文档。
* **OPML 导入**: 支持一键导入 OPML 文件，自动解析文件夹结构并映射为**领域分类**，批量创建订阅。
* **订阅列表**: 查看当前所有订阅源，支持一键删除。

### 4. 📂 领域分组 (Categories)

采用“**一个领域一个文档**”的管理哲学。

* 你可以将 Feed 归类为 `Tech` (科技), `Finance` (财经), `Design` (设计) 等。
* 插件会自动在父文档下创建名为 `Tech.sy`, `Finance.sy` 的子文档。
* 同一领域的 RSS 更新会被聚合到同一个文档中，生成的 AI 摘要也会按领域分组。

### 6. 📌 侧边栏停靠 (Dock)
插件提供了一个常驻侧边栏的面板，支持**钉住**，方便随时进行操作。
*   **快速操作**: 提供“一键拉取所有更新”和“生成 AI 摘要”的快捷入口。
*   **快速订阅**: 直接在侧边栏输入 URL 订阅新源。
*   **订阅列表**: 实时查看和管理已添加的 RSS 源。

---

## 🚀 使用指南 (Usage Guide)

### 第一步：安装插件

1. 打开思源笔记 `设置` -> `集市` -> `插件`。
2. 搜索 `rssairead_siyuan` 或 `RSS AI Read` 并安装。
3. 启用插件。

### 第二步：配置 AI 与 TTS

点击顶部工具栏的插件图标 📶，进入 **配置 (Config)** 标签页：

1. **AI 摘要服务**:
   * 勾选 `启用 AI 摘要功能`。
   * **API Key**: 填入你的大模型 API 密钥。
   * **Base URL**: 如果使用非 OpenAI 官方服务（如国内大模型），请填入对应的接口地址（例如 `https://api.deepseek.com/v1`）。
   * **Model**: 填入模型名称（如 `deepseek-chat` 或 `gpt-3.5-turbo`）。
2. **定时任务**:
   * **Cron 表达式**: 默认为 `0 8 * * *` (每天上午8点)。
   * **目标文档 ID**: **[必填]** 右键点击你希望存放摘要的文档，选择 `复制 ID` 并填入。
3. **语音播报**: 按需配置 TTS 服务商和语速。

### 第三步：添加订阅 (三种方式)

#### 方式 A: 使用管理面板 (推荐)

进入插件设置的 **订阅管理 (Feeds)** 标签页：

1. **单个添加**:
   * 输入 **RSS URL**。
   * 输入 **分类** (如 `Tech`)。
   * 输入 **父文档 ID** (右键点击你希望存放这些订阅的文件夹/文档，复制 ID)。
   * 点击 `添加订阅`。插件会自动在该父文档下创建/查找名为 `Tech` 的文档，并添加订阅块。
2. **OPML 导入**:
   * 将 OPML 文件内容粘贴到文本框。
   * 输入 **父文档 ID**。
   * 点击 `导入 OPML`。插件会根据 OPML 中的文件夹自动进行分类创建。

#### 方式 B: 手动添加属性 (极客方式)

在任意文档块上（建议是标题块）：

1. 右键 -> `属性`。
2. 添加属性 `feed`，值为 RSS 地址。
3. (可选) 添加属性 `category`，值为分类名称。
4. (可选) 添加属性 `cron`，值为自定义拉取频率。

### 第四步：日常使用

* **自动运行**: 插件会根据设定的 Cron 时间自动拉取更新并生成摘要。
* **手动拉取**: `Cmd/Ctrl + P` -> 输入 `立刻对所有feed进行一次拉取`。
* **手动生成摘要**: `Cmd/Ctrl + P` -> 输入 `生成今日摘要`。

---

## ❓ 常见问题 (FAQ)

**Q: 为什么 AI 摘要生成失败？**
A: 请检查 API Key 是否正确，账户余额是否充足，以及 Base URL 是否填写正确（特别是使用国内大模型时）。

**Q: 如何获取文档 ID？**
A: 在思源笔记的文件树中，右键点击任意文档，选择菜单中的 `复制 ID`。

**Q: 支持哪些 TTS 语音？**
A: 浏览器原生语音取决于你的操作系统（Windows/macOS）安装的语音包。OpenAI TTS 支持 `alloy`, `echo`, `fable`, `onyx`, `nova`, `shimmer`。

---

## 🤝 贡献与反馈

如果你发现了 Bug 或有新功能建议，欢迎联系我！

* **GitHub**: [https://github.com/ijefere/rssairead_siyuan](https://github.com/ijefere/rssairead_siyuan)
* **联系方式**: 2550792838@qq.com

## 📄 许可证

本项目采用 [MIT License](LICENSE) 许可证。
