# 🎯 Immersive Memorize

<div align="center">

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)
![Netflix](https://img.shields.io/badge/Netflix-Compatible-E50914?style=for-the-badge&logo=netflix&logoColor=white)
![Japanese](https://img.shields.io/badge/Language-Japanese-FF6B6B?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-00D9FF?style=for-the-badge)

**专为 Netflix 日语内容设计的沉浸式学习扩展**

通过智能词汇识别和顺序学习模式，让您在观看日语内容时轻松学习 JLPT 词汇

</div>

---

## 📋 目录

- [✨ 功能特性](#-功能特性)
- [🚀 安装](#-安装)
- [📖 使用教程](#-使用教程)
- [🔧 开发](#-开发)
- [📅 开发计划](#-TODOs)

---

## ✨ 功能特性

### 🎯 **顺序学习模式**

- **专注学习**: 每次只高亮显示一个生词，避免视觉干扰
- **有序进行**: 学完当前词汇自动显示下一个
- **智能记忆**: 已学词汇永久记录，不再重复显示

### ⚡ **即按即学**

- **无需悬停**: 摒弃传统鼠标悬停模式
- **一键学习**: 直接按快捷键捕获当前高亮词汇
- **自定义快捷键**: 支持设置任意字母键作为学习快捷键

### 🎨 **视觉增强**

- **脉冲高亮**: 橙色高亮 + 脉冲动画突出目标词汇
- **实时反馈**: 成功/警告/错误通知系统
- **清晰界面**: 简洁现代的选项和弹窗界面

### 📚 **智能卡片系统**

- **可选的自动截图**: 您可以在设置中自由选择是否在学习时捕获视频帧，生成图文并茂的闪卡。
- **丰富的上下文信息**: 每张卡片都包含高亮词汇、所在完整句子、时间戳，以及详细的影视来源（剧名、季数和集数）。
- **灵活的 Anki 导出**: 支持多种 CSV 导出格式（包括为 Anki 优化的 HTML 格式），方便您将学习数据无缝集成到间隔重复系统中。
- **全面的卡片管理**: 在独立的“已学词汇”页面中，您可以方便地查看、管理、删除所有学习记录。

### 🛠️ **个性化配置**

- **词汇库管理**: 自由选择并开启您希望学习的 JLPT 等级（N1-N5）。
- **导出格式选择**: 根据您的需求，选择最适合的 CSV 导出格式。
- **调试模式**: 为高级用户提供详细的控制台日志输出。

---

## 🚀 安装

### 方法一：从 Release 下载（推荐）

1. 前往 [Releases 页面](https://github.com/your-username/immersive-memorize/releases)
2. 下载最新版本的 `immersive-memorize-v*.zip` 文件
3. 解压到本地文件夹

### 方法二：克隆源码

```bash
git clone https://github.com/your-username/immersive-memorize.git
cd immersive-memorize
```

### 安装到 Chrome

1. 打开 Chrome 浏览器
2. 访问 `chrome://extensions/`
3. 开启右上角的"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择扩展文件夹
6. 确认安装成功

![安装步骤](https://via.placeholder.com/600x300/4285F4/FFFFFF?text=Installation+Steps)

---

## 📖 使用教程

### 第一步：配置词汇表

1. **打开选项页面**
   - 右键点击扩展图标 → 选择"选项"
   - 或在扩展管理页面点击"扩展程序选项"

2. **添加 JLPT 词汇**

   ```
   解析
   理解
   勉強
   学習
   映画
   音楽
   特権
   ```

3. **自定义快捷键**（可选）
   - 点击快捷键输入框
   - 按下任意字母键设置（默认: S）

4. **保存设置**

### 第二步：开始学习

1. **访问 Netflix**
   - 打开 `netflix.com`
   - 播放任何日语内容
   - 确保开启日语字幕

2. **学习流程**

   ```
   看到橙色高亮词汇 → 按快捷键 → 自动保存卡片 → 显示下一个生词
   ```

3. **学习提示**
   - ✓ 成功学习：显示绿色"✓ 词汇 已学习"
   - ⚠ 重复词汇：显示橙色"⚠ 词汇 已存在"
   - ℹ 无生词：显示蓝色"ℹ 当前无生词可学习"

### 第三步：导出到 Anki

1. **查看学习记录**
   - 点击扩展图标打开弹窗
   - 在弹出的窗口中，您可以查看最近的学习卡片，或点击按钮进入功能更全面的“已学词汇”管理页面。

2. **导出 CSV**
   - 在“已学词汇”页面中，点击“导出 Anki CSV”按钮。
   - 您可以在设置页面预先选择最适合您的导出格式。

3. **导入 Anki**
   - 在 Anki 中选择"文件" → "导入"
   - 选择下载的 CSV 文件
   - 确认字段映射并导入

---

## 🔧 开发

### 开发环境

```bash
# 克隆项目
git clone https://github.com/your-username/immersive-memorize.git
cd immersive-memorize

# 本地开发
# 1. 在 Chrome 中加载解压的扩展程序
# 2. 修改代码后点击刷新按钮重新加载
# 3. 在 Netflix 页面测试功能
```

### 构建和测试

GitHub Actions 会自动进行以下检查：

- ✅ `manifest.json` 验证
- ✅ 文件结构检查
- ✅ JavaScript 语法检查
- ✅ 自动构建打包

---

## 📅 未来蓝图

本扩展正在积极开发中，我们致力于让它变得更强大、更智能。以下是我们正在努力实现的目标：

- **🎯 更精准的词汇匹配**
  - 优化分词算法，以更智能地处理动词变位和复合词，减少如 `行ってくる` 被错误识别为 `行う` 的情况。
  - 提升匹配精度，避免假名错误地匹配到发音相同的汉字词（例如 `は` -> `葉`）。

- **🚀 更流畅的学习体验**
  - 为“已学词汇”页面引入懒加载技术，即使有数千张卡片也能实现秒级加载。
  - 为每个学习卡片增加“跳转到视频”功能，点击即可直接在 Netflix 中打开并播放对应的片段。

- **🌐 更广泛的平台支持**
  - **我们的愿景不止于此！** 虽然目前专注于 Netflix 和日语，但我们计划在未来将 Immersive Memorize 扩展到更多流媒体网站，并支持更多语言的学习。

- **🧠 更智能的辅助功能**
  - 集成大型语言模型（LLM），提供如“一键翻译例句”、“智能修正单词释义”等实验性功能。

我们欢迎您通过 [GitHub Issues](https://github.com/your-username/immersive-memorize/issues) 分享您的想法和建议，共同塑造 Immersive Memorize 的未来！

---

## 🙏 致谢

本项目的日语分词功能依赖 [kuromoji.js](https://github.com/patdx/kuromoji.js)

<div align="center">

**⭐ 如果这个项目对您有帮助，请给我们一个 Star！**

Made with ❤️ for Japanese learners

[🔝 回到顶部](#-immersive-memorize)

</div>
