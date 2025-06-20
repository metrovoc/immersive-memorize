# 📦 Immersive Memorize 安装教程

## 🚀 快速安装

### 方法一：从 Release 下载（推荐）

1. **下载扩展包**
   - 访问 [Releases 页面](https://github.com/your-username/immersive-memorize/releases)
   - 下载最新版本的 `immersive-memorize-v*.zip` 文件
   - 保存到本地并记住位置

2. **解压文件**
   ```
   右键 → 解压到当前文件夹
   或
   双击文件 → 全部提取
   ```

### 方法二：克隆源码

```bash
# 使用 Git 克隆
git clone https://github.com/your-username/immersive-memorize.git

# 进入项目目录
cd immersive-memorize
```

## 🌐 安装到 Chrome 浏览器

### 步骤 1：打开扩展管理页面

**方式一：地址栏输入**
```
chrome://extensions/
```

**方式二：菜单导航**
```
Chrome 菜单 → 更多工具 → 扩展程序
```

### 步骤 2：启用开发者模式

1. 在扩展管理页面右上角
2. 找到"开发者模式"开关
3. 点击开启（蓝色状态）

![开发者模式](https://via.placeholder.com/400x200/4285F4/FFFFFF?text=Developer+Mode+ON)

### 步骤 3：加载扩展

1. 点击"加载已解压的扩展程序"按钮
2. 选择解压后的扩展文件夹
3. 点击"选择文件夹"

![加载扩展](https://via.placeholder.com/500x300/34A853/FFFFFF?text=Load+Unpacked+Extension)

### 步骤 4：确认安装

安装成功后您会看到：
- ✅ 扩展卡片出现在列表中
- ✅ 浏览器工具栏出现扩展图标
- ✅ 状态显示为"已启用"

## ⚙️ 初始配置

### 配置词汇表

1. **打开选项页面**
   ```
   右键扩展图标 → 选项
   ```

2. **添加词汇**
   ```
   解析
   理解
   勉強
   学習
   映画
   音楽
   特権
   会話
   ```

3. **保存设置**
   - 点击"保存设置"按钮
   - 看到成功提示

### 设置快捷键（可选）

1. 点击快捷键输入框
2. 按下想要的字母键（如 S、L、K 等）
3. 自动保存设置

### 启用调试模式（可选）

- 勾选"启用调试模式"
- 在控制台查看详细日志
- 便于排查问题

## 🧪 测试安装

### 基本功能测试

1. **访问 Netflix**
   ```
   打开 netflix.com
   登录账户
   ```

2. **播放日语内容**
   ```
   选择任意日语电影/剧集
   开启日语字幕
   ```

3. **验证功能**
   - ✅ 看到橙色高亮词汇
   - ✅ 按快捷键能够学习
   - ✅ 出现成功通知

### 控制台检查

1. **打开开发者工具**
   ```
   F12 或 右键 → 检查
   ```

2. **查看控制台**
   ```
   切换到 Console 标签
   寻找 [Immersive Memorize] 日志
   ```

3. **预期日志**
   ```
   [Immersive Memorize] 已加载 8 个词汇
   [Immersive Memorize] 已学 0 个词汇  
   [Immersive Memorize] 捕获快捷键: S
   [Immersive Memorize] 顺序学习模式：每次仅显示一个生词
   ```

## 🔧 故障排除

### 扩展无法加载

**问题**: 点击"加载已解压的扩展程序"后报错

**解决方案**:
1. 确保选择的是包含 `manifest.json` 的文件夹
2. 检查文件夹权限
3. 重新下载并解压扩展包

### 没有词汇高亮

**问题**: Netflix 页面没有看到橙色高亮

**解决方案**:
1. 确认已配置词汇表
2. 检查是否播放日语内容
3. 确认开启了日语字幕
4. 刷新页面重试

### 快捷键无响应

**问题**: 按快捷键没有反应

**解决方案**:
1. 确保当前有高亮词汇
2. 检查快捷键设置
3. 开启调试模式查看日志
4. 尝试重新加载扩展

### 数据无法保存

**问题**: 学习记录没有保存

**解决方案**:
1. 检查 Chrome 存储权限
2. 清除扩展数据后重试
3. 重新安装扩展

## 🔄 更新扩展

### 自动更新（推荐）

当新版本发布时：
1. 下载新的扩展包
2. 删除旧版本文件夹
3. 解压新版本
4. 在扩展管理页面点击"重新加载"

### 保留数据更新

```javascript
// 导出数据（在扩展弹窗中）
1. 点击"导出 Anki CSV"保存学习记录
2. 截图保存词汇表配置

// 更新后恢复
1. 重新配置词汇表
2. 如需要可重新导入数据
```

## 📱 多设备同步

### Chrome 同步设置

1. **开启 Chrome 同步**
   ```
   设置 → 同步和 Google 服务 → 管理同步功能
   ```

2. **同步扩展**
   ```
   确保"扩展程序"同步已开启
   ```

3. **数据同步**
   ```
   扩展数据会自动在已登录的设备间同步
   ```

## 🆘 获取帮助

### 官方渠道

- **GitHub Issues**: [提交问题](https://github.com/your-username/immersive-memorize/issues)
- **文档**: [README.md](README.md)
- **发布页**: [Releases](https://github.com/your-username/immersive-memorize/releases)

### 常用链接

- [Chrome 扩展开发者文档](https://developer.chrome.com/docs/extensions/)
- [Netflix 帮助中心](https://help.netflix.com/)
- [JLPT 官网](https://www.jlpt.jp/)

---

<div align="center">

**🎉 安装完成！开始您的沉浸式日语学习之旅吧！**

[🔙 返回主页](README.md) | [📖 使用教程](README.md#-使用教程)

</div>