# 🤝 贡献指南

感谢您对 Immersive Memorize 项目的关注！我们欢迎所有形式的贡献。

## 📋 贡献方式

### 🐛 报告 Bug

**在提交 Bug 报告前，请：**
1. 搜索现有的 [Issues](https://github.com/your-username/immersive-memorize/issues) 确认问题未被报告
2. 确保您使用的是最新版本
3. 在多个环境中复现问题

**Bug 报告应包含：**
- **明确的标题**: 简洁描述问题
- **环境信息**: Chrome 版本、操作系统、扩展版本
- **复现步骤**: 详细的操作步骤
- **预期行为**: 您期望发生什么
- **实际行为**: 实际发生了什么
- **截图/日志**: 如果有的话
- **其他信息**: 任何可能相关的信息

### 💡 功能建议

**提交功能建议时，请：**
1. 确保建议符合项目目标
2. 提供详细的用例说明
3. 考虑实现的复杂性

**功能建议应包含：**
- **功能描述**: 详细说明建议的功能
- **使用场景**: 什么情况下会用到这个功能
- **预期效果**: 这个功能将如何改善用户体验
- **替代方案**: 是否考虑过其他解决方案

### 🔧 代码贡献

#### 开发环境设置

```bash
# 1. Fork 项目到您的 GitHub 账户
# 2. 克隆您的 fork
git clone https://github.com/YOUR-USERNAME/immersive-memorize.git
cd immersive-memorize

# 3. 添加上游仓库
git remote add upstream https://github.com/your-username/immersive-memorize.git

# 4. 创建开发分支
git checkout -b feature/your-feature-name
```

#### 代码规范

**JavaScript 规范：**
```javascript
// 使用 const/let，避免 var
const wordlist = [];
let currentWord = null;

// 函数命名使用驼峰命名法
function highlightWord(element) {
    // 代码逻辑
}

// 添加必要的注释
/**
 * 高亮显示指定的词汇
 * @param {HTMLElement} element - 要高亮的元素
 * @param {string} word - 词汇内容
 */
function highlightSingleWord(element, word) {
    // 实现代码
}
```

**HTML/CSS 规范：**
```html
<!-- 使用语义化标签 -->
<main class="container">
    <section class="wordlist-section">
        <h2>词汇设置</h2>
    </section>
</main>
```

```css
/* 使用 BEM 命名规范 */
.wordlist-section {
    margin-bottom: 20px;
}

.wordlist-section__input {
    width: 100%;
    padding: 10px;
}

.wordlist-section__input--focused {
    border-color: #4caf50;
}
```

#### 提交规范

**Commit 消息格式：**
```
<type>(<scope>): <subject>

<body>

<footer>
```

**类型说明：**
- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式化
- `refactor`: 代码重构
- `test`: 添加测试
- `chore`: 构建过程或辅助工具的变动

**示例：**
```bash
feat(content): add fuzzy word matching algorithm

- Implement morphological analysis for Japanese verbs
- Add compound word detection
- Improve word boundary recognition

Closes #123
```

#### Pull Request 流程

1. **确保代码质量**
   ```bash
   # 运行语法检查
   node -c content_script.js
   node -c popup/popup.js
   node -c options/options.js
   
   # 测试扩展功能
   # 在 Netflix 上验证所有功能正常
   ```

2. **提交 Pull Request**
   - 提供清晰的 PR 标题和描述
   - 引用相关的 Issue
   - 添加截图或 GIF 展示变更
   - 确保 CI 检查通过

3. **代码审查**
   - 响应审查意见
   - 及时修复问题
   - 保持友好的讨论

## 🧪 测试指南

### 手动测试清单

**基本功能测试：**
- [ ] 扩展能够正确安装和加载
- [ ] 词汇表配置功能正常
- [ ] 快捷键设置功能正常
- [ ] 在 Netflix 上能够识别和高亮词汇
- [ ] 按快捷键能够保存学习卡片
- [ ] 弹窗界面显示正常
- [ ] CSV 导出功能正常

**边界情况测试：**
- [ ] 空词汇表时的行为
- [ ] 非日语内容时的行为
- [ ] 网络中断时的行为
- [ ] 大量数据时的性能

**浏览器兼容性：**
- [ ] Chrome 最新版本
- [ ] Chrome 旧版本（如果支持）
- [ ] 不同操作系统（Windows, macOS, Linux）

### 自动化测试

项目使用 GitHub Actions 进行自动化测试：

```yaml
# .github/workflows/build.yml
- 文件结构验证
- JavaScript 语法检查
- 构建测试
```

## 📚 文档贡献

### 文档类型

- **用户文档**: README.md, INSTALLATION.md
- **开发文档**: CONTRIBUTING.md, API 文档
- **代码注释**: 内联注释、JSDoc

### 文档规范

**Markdown 格式：**
```markdown
# 一级标题
## 二级标题
### 三级标题

- 列表项 1
- 列表项 2

`代码片段`

```javascript
// 代码块
function example() {
    return true;
}
```

[链接文本](URL)
![图片描述](图片URL)
```

## 🎨 设计贡献

### UI/UX 改进

- 界面设计优化建议
- 用户体验改进方案
- 图标和视觉元素设计

### 设计资源

- 使用一致的配色方案
- 遵循 Material Design 原则
- 确保无障碍访问性

## 🌐 国际化贡献

### 支持的语言

- 中文（简体）- 主要
- 英文 - 计划中
- 日文 - 计划中

### 翻译指南

1. 保持术语一致性
2. 考虑文化差异
3. 测试界面布局

## 📞 联系方式

**讨论和问题：**
- GitHub Issues: 技术问题和 Bug 报告
- GitHub Discussions: 功能讨论和想法交流

**代码相关：**
- Pull Requests: 代码贡献
- Code Review: 代码审查和建议

## 🏆 贡献者认可

所有贡献者将会：
- 在 README.md 中被提及
- 在 Release Notes 中被感谢
- 获得贡献者徽章

### 当前贡献者

<!-- 这部分将在有贡献者后更新 -->
感谢以下贡献者的付出：

- [@your-username](https://github.com/your-username) - 项目创建者和主要维护者

## 📋 Issue 和 PR 模板

### Bug 报告模板

```markdown
## Bug 描述
简洁清晰地描述 bug

## 复现步骤
1. 转到 '...'
2. 点击 '....'
3. 滚动到 '....'
4. 看到错误

## 预期行为
描述您期望发生的情况

## 截图
如果适用，添加截图以帮助解释您的问题

## 环境信息
- OS: [例如 Windows 10]
- 浏览器: [例如 Chrome 120]
- 扩展版本: [例如 v0.2.0]

## 其他信息
添加任何其他相关信息
```

### 功能请求模板

```markdown
## 功能描述
清晰简洁地描述您想要的功能

## 使用场景
描述这个功能的使用场景和原因

## 详细说明
详细描述您希望功能如何工作

## 替代方案
描述您考虑过的任何替代解决方案或功能

## 其他信息
添加任何其他相关信息或截图
```

---

<div align="center">

**🎉 再次感谢您的贡献！**

每一个贡献都让 Immersive Memorize 变得更好！

[🔙 返回主页](README.md)

</div>