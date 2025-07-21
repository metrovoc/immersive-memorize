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
- [🏗️ 项目结构](#️-项目结构)
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

- **自动截图**: 捕获当前视频帧作为学习卡片
- **完整信息**: 记录词汇、句子、时间戳、来源等
- **Anki 导出**: 一键导出 CSV 格式，直接导入 Anki
- **批量管理**: 查看、删除、批量操作学习记录

### 🛠️ **个性化配置**

- **词汇表管理**: 自定义 JLPT 词汇列表
- **调试模式**: 详细的控制台日志输出
- **数据同步**: 基于 Chrome 存储的本地数据管理

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
   - 查看已保存的卡片列表

2. **导出 CSV**

   - 点击"导出 Anki CSV"按钮
   - 下载 CSV 文件

3. **导入 Anki**
   - 在 Anki 中选择"文件" → "导入"
   - 选择下载的 CSV 文件
   - 确认字段映射并导入

---

## 🏗️ 项目结构

```
immersive-memorize/
├── 📁 .github/workflows/     # GitHub Actions 工作流
│   ├── build.yml            # 构建和测试
│   └── release.yml           # 自动发布
├── 📁 icons/                # 扩展图标
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── 📁 popup/                # 弹窗界面
│   ├── popup.html           # 弹窗 HTML
│   ├── popup.css            # 弹窗样式
│   └── popup.js             # 弹窗逻辑
├── 📁 options/              # 选项页面
│   ├── options.html         # 选项 HTML
│   ├── options.css          # 选项样式
│   └── options.js           # 选项逻辑
├── 📄 manifest.json         # 扩展清单文件
├── 📄 content_script.js     # 核心内容脚本
├── 📄 README.md            # 项目文档
└── 📄 LICENSE              # 开源许可证
```

### 核心文件说明

| 文件                | 功能     | 描述                         |
| ------------------- | -------- | ---------------------------- |
| `manifest.json`     | 扩展配置 | Manifest V3 配置文件         |
| `content_script.js` | 核心逻辑 | 字幕监控、词汇识别、学习捕获 |
| `popup/`            | 弹窗界面 | 学习记录展示、数据导出       |
| `options/`          | 选项页面 | 词汇表配置、快捷键设置       |
| `icons/`            | 图标资源 | 16px、48px、128px 图标       |

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

## 📅 TODOs

- [ ] **🔍 单词模糊识别**
  - [ ] **词形变化识别**: 支持动词变位、形容词活用等
  - [ ] **部分匹配**: 识别复合词中的组成部分
  - [ ] **智能分词**: 自动识别词汇边界
- [ ] **💬 悬停查看释义**
  - [ ] **即时翻译**: 鼠标悬停显示词汇释义
  - [ ] **多词典支持**: 集成 JMdict、EDICT 等词典
  - [ ] **发音播放**: TTS 语音播放功能

<div align="center">

**⭐ 如果这个项目对您有帮助，请给我们一个 Star！**

Made with ❤️ for Japanese learners

[🔝 回到顶部](#-immersive-memorize)

</div>
