# Immersive Memorize

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/hckblmpcigelkfeinckgflolbdbmdnai?label=Chrome%20Web%20Store)](https://chromewebstore.google.com/detail/immersive-memorize/hckblmpcigelkfeinckgflolbdbmdnai)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

看剧学日语。Immersive Memorize 会在 Netflix 字幕或你自己的字幕文件中，每次高亮一个 JLPT 生词。按下快捷键即可把它连同例句、读音、释义和可选的截图保存为记忆卡片，再导出到 Anki。

[English](README.md)

## 功能

- **一次一个生词**：高亮每行字幕中第一个属于你所选 JLPT 等级（N5–N1）且尚未保存的词。保存后，下一个生词随即高亮。
- **Netflix 与任意视频**：Netflix 字幕开箱即用；在其他网站可以加载 SRT、VTT、ASS 或 SSA 字幕文件，UTF-8、UTF-16 和 Shift_JIS 编码都能正确读取。
- **带上下文的卡片**：每张卡片包含带注音的例句、读音、英文或中文释义、时间戳、剧名和集数，还可以附带视频截图。
- **为 Anki 准备的导出**：CSV 导出会写入 Anki 的文件头，把注音转换为 Anki 的 `漢字[かんじ]` 格式，加粗所学生词并嵌入截图。也提供纯文本和 HTML 格式。
- **词汇浏览**：查看约 14,600 个 JLPT 词汇的学习进度，以及读音、释义、词性和音调。
- **隐私**：卡片和截图只保存在浏览器中，设置通过 Chrome 账号同步，卡片可以备份为文件。
- **中英文界面**，跟随浏览器语言。

## 安装

从 [Chrome 应用商店安装 Immersive Memorize](https://chromewebstore.google.com/detail/immersive-memorize/hckblmpcigelkfeinckgflolbdbmdnai)。

如需从源码构建，请参阅[开发](#开发)，然后在开启开发者模式的 `chrome://extensions` 中加载 `dist` 文件夹。

## 使用

### 在 Netflix 上

1. 播放日语作品并开启日语字幕。
2. 每行字幕中的第一个生词会以橙色高亮。
3. 按 **S**（可在设置中修改）保存，下一个生词随即高亮。

### 在其他网站

1. 打开视频页面，点击工具栏中的 Immersive Memorize 图标，切换到**字幕**标签页。
2. 点击**加载字幕文件**，如页面中有多个视频请先选择视频，然后选择字幕文件。日语字幕可以在 [Kitsunekko](https://kitsunekko.net/) 和 [learnjapanese.moe](https://learnjapanese.moe/kitsubackup.html#/ja) 等网站找到。
3. 如有需要，在弹窗中调整字号、位置、背景和时间偏移，然后像在 Netflix 上一样学习生词。

扩展会在 Netflix 上自动启用；在其他网站，点击图标即可启用，也可以在设置中添加自动启用的网站。

### 导出到 Anki

1. 打开**设置页 → 记忆卡片**，点击**导出 CSV**。
2. 在 Anki 中选择**文件 → 导入**并选择该文件。使用默认的 Anki 格式时，Anki 会从文件中读取分隔符、HTML 设置和字段名；将字段对应到你的笔记类型后导入即可。

## 权限

| 权限                          | 用途                                                                                                                   |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 访问 netflix.com              | 在 Netflix 上自动运行。                                                                                                |
| `activeTab`、`scripting`      | 点击图标时在当前标签页启用。                                                                                           |
| `tabs`                        | 识别需要自动启用的网站并更新图标。                                                                                     |
| `storage`、`unlimitedStorage` | 保存设置、卡片和截图。                                                                                                 |
| 其他网站（可选）              | 仅在需要时请求：用于你添加的自动启用网站、开启“在所有网站自动启用”时的所有网站、截图，以及嵌入自其他网站的视频播放器。 |

## 开发

需要 Node.js 22.13 或更高版本。

```bash
npm install
npm run dev      # 文件变化时重新构建 dist/
npm run build    # 生产构建，输出到 dist/
npm run check    # 类型检查、代码检查、格式检查和测试
npm run package  # 构建并打包 dist/，用于上传 Chrome 应用商店
```

重新构建后，在 `chrome://extensions` 中点击扩展的重新加载按钮。

代码按扩展运行环境划分：

- `src/background.ts` 和 `src/background/`：Service Worker，运行日语分词（kuromoji）、提供词表、保存卡片，并在标签页中启动内容脚本。
- `src/content-script/`：在网页中运行，读取 Netflix 或自定义字幕、高亮生词并保存卡片。
- `src/popup/` 和 `src/options/`：扩展的弹窗和设置页。
- `src/lib/`：共享代码，例如设置、存储、字幕解析和 CSV 导出。
- `_locales/`：界面文本。英文（`en`）为默认语言；其他语言必须包含相同的键，测试会进行检查。

发布时运行 `npm version minor`（或 `patch`），它会更新 `manifest.json` 和 `CHANGELOG.md`，并提交和打标签。推送标签后，GitHub Actions 会构建扩展并发布带有 zip 包的 Release。

## 致谢与许可

代码以 [MIT 许可证](LICENSE)发布。内置数据有各自的许可：

- `dict/jlpt.json`：来自 egg rolls 的 [anki-jlpt-decks](https://github.com/5mdld/anki-jlpt-decks) 的 JLPT 词表与中文释义，采用 [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) 许可。
- `dict/jmdict-en.json`：来自 [JMdict](https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project) 的英文释义，© Electronic Dictionary Research and Development Group，采用 [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) 许可。该文件由 `scripts/add-english-definitions.mjs` 生成，并以相同许可共享。
- 日语分词使用 [kuromoji.js](https://github.com/patdx/kuromoji.js) 及其词典，采用 Apache License 2.0 许可。
