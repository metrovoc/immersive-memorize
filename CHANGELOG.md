# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [v0.11.0](https://github.com/metrovoc/immersive-memorize/compare/v0.10.0...v0.11.0)

### Fixed

- feat: rebuild the extension around English as the default language [`#5`](https://github.com/metrovoc/immersive-memorize/issues/5) [`#12`](https://github.com/metrovoc/immersive-memorize/issues/12) [`#13`](https://github.com/metrovoc/immersive-memorize/issues/13) [`#19`](https://github.com/metrovoc/immersive-memorize/issues/19) [`#20`](https://github.com/metrovoc/immersive-memorize/issues/20)

### Commits

- feat: add English definitions from JMdict [`3073bc9`](https://github.com/metrovoc/immersive-memorize/commit/3073bc9847aab6c06581484e5340d465f20aebdf)
- build: upgrade the toolchain and drop unused dependencies [`454ff8a`](https://github.com/metrovoc/immersive-memorize/commit/454ff8a65a9aeb10202a72657c37ceb3acc3abdc)
- docs: rewrite the README in English and add contributor notes [`5025322`](https://github.com/metrovoc/immersive-memorize/commit/50253226d32df6246d09409223e009169ff36903)
- ci: keep changelog subsections in release notes [`edfccff`](https://github.com/metrovoc/immersive-memorize/commit/edfccff5ae524e9c098a1a14067197c9c3f8ca89)

## [v0.10.0](https://github.com/metrovoc/immersive-memorize/compare/v0.9.0...v0.10.0) - 2025-07-29

### Commits

- feat: 重构存储管理逻辑，支持数据迁移和IndexedDB集成 [`01c1db3`](https://github.com/metrovoc/immersive-memorize/commit/01c1db36d9555744083b72f27fcd416c9563827a)
- feat: 添加插件启动行为设置界面和逻辑 [`9ead2c9`](https://github.com/metrovoc/immersive-memorize/commit/9ead2c9c6568fab1318f5e565247a0c059e3e35c)
- feat: 添加截图渲染工具类及相关功能 [`64ce9a6`](https://github.com/metrovoc/immersive-memorize/commit/64ce9a690f63ccd88fc6c497c026c80ac737f1b1)
- feat: 增强截图请求处理逻辑 [`d761f11`](https://github.com/metrovoc/immersive-memorize/commit/d761f1178520dcfae2a21fcfaae56d4abe10aee0)
- feat: 更新权限管理和URL检查逻辑 [`a06d3d0`](https://github.com/metrovoc/immersive-memorize/commit/a06d3d08e9de9280d22fb74b8bc88e7f42b13ba3)
- refactor: 去除不需要的报错，调低截图质量 [`f73016a`](https://github.com/metrovoc/immersive-memorize/commit/f73016a24d9c1373945f20141c1c3675af19d954)

## [v0.9.0](https://github.com/metrovoc/immersive-memorize/compare/v0.8.10...v0.9.0) - 2025-07-28

### Merged

- Centralization [`#22`](https://github.com/metrovoc/immersive-memorize/pull/22)

### Commits

- feat: 添加中央化词库服务和缓存管理 [`3deed4b`](https://github.com/metrovoc/immersive-memorize/commit/3deed4b500957feb355a0c800ec3f1221d13797d)
- feat: 添加中央化日语分析服务和条件分析器 [`b9520be`](https://github.com/metrovoc/immersive-memorize/commit/b9520beae5269de7c67e20b4b46c76c2e999aa09)
- chore: 更新依赖和配置，删除未使用的组件 [`72f1805`](https://github.com/metrovoc/immersive-memorize/commit/72f18054dd3523b1ae65c7dbd8a1afe34db5f384)
- fix: 修复自定义字幕样式不能加载储存的样式设置 [`22ffbae`](https://github.com/metrovoc/immersive-memorize/commit/22ffbae326d958c115d6db3fa78f058a5549ed50)
- feat: 增强字幕处理逻辑和分析状态管理 [`0b1394d`](https://github.com/metrovoc/immersive-memorize/commit/0b1394da4c024241751873f344237ec1e11b093f)
- feat: 优化词库和字幕处理逻辑 [`397bc08`](https://github.com/metrovoc/immersive-memorize/commit/397bc08132966f605d31b05e23acf3c64a840344)
- feat: 增强背景服务预热逻辑和心跳机制 [`23ead84`](https://github.com/metrovoc/immersive-memorize/commit/23ead84b1beeab08136e345455b26537011f6aec)
- feat: 增强字幕处理逻辑，添加学习状态快照管理 [`11017f2`](https://github.com/metrovoc/immersive-memorize/commit/11017f24bf1308bb7888e2acbeb168688df3ca01)
- fix: 尝试在content script中清除页面上下文观察器来缓解过度资源占用 [`1c3270f`](https://github.com/metrovoc/immersive-memorize/commit/1c3270f29730b0f619d4de5e621788311ba61b1c)
- fix: 添加高亮状态检查，修复netflix字幕高亮消失问题 [`88091bd`](https://github.com/metrovoc/immersive-memorize/commit/88091bdc0e72b3fb372234179ed6421fac6034ab)
- refactor: 更新日语分析器导入路径并导出类型 [`7121709`](https://github.com/metrovoc/immersive-memorize/commit/712170906fa9bce57ddd89b551301754075d3f52)
- feat: 增强调试日志输出，包含帧上下文信息 [`3f75700`](https://github.com/metrovoc/immersive-memorize/commit/3f757003984a9e69c4f1aed222b1f34e9ca12ddd)
- chore: issue template config update [`a6f0901`](https://github.com/metrovoc/immersive-memorize/commit/a6f09014323051141f50e5026d55c6b3525922fc)
- doc : update acknowledgements [`a4f6c47`](https://github.com/metrovoc/immersive-memorize/commit/a4f6c47f43944f0df8bbd3c4bf4f9a4f3ffd81e9)

## [v0.8.10](https://github.com/metrovoc/immersive-memorize/compare/v0.8.9...v0.8.10) - 2025-07-27

### Commits

- fix: 优化字幕定位后备方案 [`a523860`](https://github.com/metrovoc/immersive-memorize/commit/a5238606d33d8918a775b963231237ca38e3b733)
- feat: 添加强制全屏字幕模式功能 [`ec610bd`](https://github.com/metrovoc/immersive-memorize/commit/ec610bd28ac73ffdcd19993c145050b921f6a521)

## [v0.8.9](https://github.com/metrovoc/immersive-memorize/compare/v0.8.8...v0.8.9) - 2025-07-27

### Commits

- fix : 去除多余选择器 [`5b48eab`](https://github.com/metrovoc/immersive-memorize/commit/5b48eab64df4c3e9fda7d20ce1392c8bb1166dbf)
- hotfix: 修复自定义字幕源的定位逻辑 [`d2e89d7`](https://github.com/metrovoc/immersive-memorize/commit/d2e89d7d46471eb44796adb6b3a7e3eeeb24a766)
- doc : update [`92415ef`](https://github.com/metrovoc/immersive-memorize/commit/92415ef99c1531689f59a6e4d3d0ab74d7cd5f2c)

## [v0.8.8](https://github.com/metrovoc/immersive-memorize/compare/v0.8.7...v0.8.8) - 2025-07-27

### Commits

- doc: 新增错误报告和功能请求模板 [`0fa8bdd`](https://github.com/metrovoc/immersive-memorize/commit/0fa8bddd1b6bfb12c2bed589d770863b259ed915)
- doc : update issue templates [`b2f53cf`](https://github.com/metrovoc/immersive-memorize/commit/b2f53cfb03553b49e3ad6ca3ba3d5a3ce45832c6)
- hotfix: 优化重型资源加载逻辑 [`06ce6ef`](https://github.com/metrovoc/immersive-memorize/commit/06ce6ef531034d71ca5af7034dd1baa9e3b99af8)
- docs: 更新 README.md，优化功能描述和结构 [`72c1c3a`](https://github.com/metrovoc/immersive-memorize/commit/72c1c3aa74aeb01db1dae6010aab9c9dde031ffd)
- doc:update [`04d0fb4`](https://github.com/metrovoc/immersive-memorize/commit/04d0fb498ae71e0319670158240d298bbf93bb58)

## [v0.8.7](https://github.com/metrovoc/immersive-memorize/compare/v0.8.6...v0.8.7) - 2025-07-26

### Commits

- fix: 修复发布说明中的链接格式问题 [`e91268f`](https://github.com/metrovoc/immersive-memorize/commit/e91268f0fbc1deecb5c4c6ecd23574d0a5e89704)

## [v0.8.6](https://github.com/metrovoc/immersive-memorize/compare/v0.8.5...v0.8.6) - 2025-07-26

### Commits

- feat: 添加发布说明模板和自动生成逻辑 [`e3fd3a0`](https://github.com/metrovoc/immersive-memorize/commit/e3fd3a03e01d995370c5e25068a6e2d1c9bb9f6d)

## [v0.8.5](https://github.com/metrovoc/immersive-memorize/compare/v0.8.4...v0.8.5) - 2025-07-26

### Commits

- feat: improve GitHub Release with changelog integration [`4b14f96`](https://github.com/metrovoc/immersive-memorize/commit/4b14f9626b5540b55cbfe9e61e2fe4f8d2c46bf0)

## [v0.8.4](https://github.com/metrovoc/immersive-memorize/compare/v0.8.3...v0.8.4) - 2025-07-26

### Commits

- feat: integrate auto-changelog for automated changelog generation [`da7359e`](https://github.com/metrovoc/immersive-memorize/commit/da7359ed5ca3c765f2690c34c0e88a5b77a3fa47)

## [v0.8.3](https://github.com/metrovoc/immersive-memorize/compare/v0.8.2...v0.8.3) - 2025-07-26

### Commits

- 添加字幕样式更新功能，重构弹出窗口UI以支持新的标签系统和样式设置，优化字幕样式的加载和保存逻辑 [`6cec961`](https://github.com/metrovoc/immersive-memorize/commit/6cec961d1ab954bd965a365b4db0e50a891c0bf0)
- fix:自定义字幕加载过一次之后二次加载无法生效 [`f39622c`](https://github.com/metrovoc/immersive-memorize/commit/f39622ca693e076bccf82e41cf9faa43d1d957f9)
- 添加高亮词汇支持，增加跳转高亮效果及清除逻辑 [`dc7b0eb`](https://github.com/metrovoc/immersive-memorize/commit/dc7b0eb0373ad49121052dbe3a7fd405965836c4)
- feat: 添加时间偏移功能，更新字幕样式设置和弹出窗口UI [`57fb795`](https://github.com/metrovoc/immersive-memorize/commit/57fb79531b1a8b26239a924e7fd771fa4ad8d2cf)

## [v0.8.2](https://github.com/metrovoc/immersive-memorize/compare/v0.8.1...v0.8.2) - 2025-07-26

### Commits

- Add automatic version sync between package.json and manifest.json [`a0321d8`](https://github.com/metrovoc/immersive-memorize/commit/a0321d83cfbe850eb06892a2f07eb933d67b477d)
- 优化弹出窗口UI，移除旧的自定义字幕按钮并添加新的自定义字幕加载按钮 [`2d1428c`](https://github.com/metrovoc/immersive-memorize/commit/2d1428ca7638542cc9e8d21e2bc97b50ad830f5a)

## [v0.8.1](https://github.com/metrovoc/immersive-memorize/compare/v0.8.0...v0.8.1) - 2025-07-26

### Commits

- hotfix:添加快捷键监听器的启用和禁用功能，优化字幕处理逻辑以确保有效字幕时启用快捷键 [`e94c722`](https://github.com/metrovoc/immersive-memorize/commit/e94c7228be71743822ecbb60c54d8c3f745e88df)

## [v0.8.0](https://github.com/metrovoc/immersive-memorize/compare/v0.7.1...v0.8.0) - 2025-07-26

### Commits

- dataset reforge [`bc4ee40`](https://github.com/metrovoc/immersive-memorize/commit/bc4ee40a520228df089c001db780ba7fbb7b5ef3)
- attempt@claude#1 [`7a77101`](https://github.com/metrovoc/immersive-memorize/commit/7a771010f39194e8c785297b5610c617a8f6a793)
- 添加视频选择功能，优化消息处理逻辑，移除字幕控制面板UI组件 [`760163f`](https://github.com/metrovoc/immersive-memorize/commit/760163f787df1a554535be49b4fdf31982d1b9f0)
- attempt@gemini#2 [`1194ca8`](https://github.com/metrovoc/immersive-memorize/commit/1194ca839de582851f348ad46311608e7ce046cb)
- updates [`592741d`](https://github.com/metrovoc/immersive-memorize/commit/592741d4382e789d2e793c08f894c6c8eaef9c48)
- 重构字幕处理逻辑，添加SubtitleTextParser以提取Furigana映射，优化CSV导出功能，支持多种格式 [`2fb55f5`](https://github.com/metrovoc/immersive-memorize/commit/2fb55f5d41098d77ec03f60e94ff448916d9c144)
- kuromoji gemini#1 [`86dfa60`](https://github.com/metrovoc/immersive-memorize/commit/86dfa604730a86fb5d475522b61b311f6aabac11)
- gemini attempt#2 [`14748d7`](https://github.com/metrovoc/immersive-memorize/commit/14748d74e03a159b6c1d7a738558e11bb85c3783)
- 添加NetflixExtractor以提取详细页面信息，并更新FlashCard接口以包含Netflix相关数据 [`3adcce0`](https://github.com/metrovoc/immersive-memorize/commit/3adcce06c4e834d61df719bb088341e5456e5cfd)
- 删除旧的构建和测试工作流，更新发布工作流以支持新的构建步骤和打包格式 [`e1409b1`](https://github.com/metrovoc/immersive-memorize/commit/e1409b183eb361055cfa2c43a31b868e3287ecfe)
- attempt with multiple API [`7bf616a`](https://github.com/metrovoc/immersive-memorize/commit/7bf616ae0427a3554fd9fdca53ffd497521f3d71)
- fix:highlight not preserved:重构SubtitleTextParser类，优化解析逻辑，分离分析和显示HTML的处理，简化Furigana映射提取过程 [`7a23862`](https://github.com/metrovoc/immersive-memorize/commit/7a23862e18b1c94c43cfade5f3151f25c2ef2c3f)
- 优化代码格式，简化事件监听器设置，调整选项页面DOM操作逻辑 [`6c51658`](https://github.com/metrovoc/immersive-memorize/commit/6c516586fc2e54cd9ad24219dc6e92716e52adb2)
- 重构词汇库管理，更新学习进度逻辑，优化记忆卡片处理，调整选项页面渲染 [`6859935`](https://github.com/metrovoc/immersive-memorize/commit/6859935cbdcbb28d331f965367abe6adb66d76eb)
- fix n1 checkbox [`c99aa26`](https://github.com/metrovoc/immersive-memorize/commit/c99aa2621a7c19a922977a1e7d8e6e02b3be9da3)
- 添加背景脚本以支持截图功能，更新manifest和webpack配置，优化视频帧捕获逻辑 [`6e84d45`](https://github.com/metrovoc/immersive-memorize/commit/6e84d45d0cac8f08a8568727e92356eb9af72a17)
- 添加CSV导出格式设置选项，重构相关逻辑以支持多种导出格式，优化选项页面 [`5660c2e`](https://github.com/metrovoc/immersive-memorize/commit/5660c2edfd12bb8c9d15a3444bb6d59f14af119d)
- 优化CSV格式信息提示 [`40fbf90`](https://github.com/metrovoc/immersive-memorize/commit/40fbf908ee2643df0582082cc37c5cb455d413e5)
- updates [`c166872`](https://github.com/metrovoc/immersive-memorize/commit/c1668723e34ab4e57c653695f33230706d76089e)
- fix double highlighting [`703c5b5`](https://github.com/metrovoc/immersive-memorize/commit/703c5b514934e01de17c1950a0ed7e69773a1a95)
- 重构ImmersiveMemorize类，添加主frame和iframe的初始化功能 [`de3e185`](https://github.com/metrovoc/immersive-memorize/commit/de3e1853d1d8b9ab588ecd393fcea59bea327ba4)
- gemini fixes#3 [`19b4b3a`](https://github.com/metrovoc/immersive-memorize/commit/19b4b3a1e1cfcc2087f9b125aa10e2f76b120361)
- 重构refreshCurrentSubtitles方法，统一处理字幕容器，优化高亮逻辑，避免竞态问题 [`c41406f`](https://github.com/metrovoc/immersive-memorize/commit/c41406f153fa8dbd008b1fcc005914c5468c24b7)
- gemini fix dict-zlib unzip#4 [`2d50ece`](https://github.com/metrovoc/immersive-memorize/commit/2d50eceef147ece048a90735d54c35eb44292023)
- 为卡片添加删除功能，优化事件监听器设置，移除全局deleteCard声明 [`c2f5a7d`](https://github.com/metrovoc/immersive-memorize/commit/c2f5a7d63f6e6cb0b4083d4e9066753566ac0f64)
- fix [`4713245`](https://github.com/metrovoc/immersive-memorize/commit/47132459c0f911f7e5493a3afa574b80a724d37f)
- font css [`bb2707a`](https://github.com/metrovoc/immersive-memorize/commit/bb2707a89aa625fef37ac2c289476ad24be3c3ee)
- update README [`2b7e8f1`](https://github.com/metrovoc/immersive-memorize/commit/2b7e8f13299b406f82b6c41fc04b7fc90ca35af9)
- 更新manifest以允许在所有框架中运行内容脚本，增强视频元素调试信息，临时移除视频过滤条件 [`bee2351`](https://github.com/metrovoc/immersive-memorize/commit/bee23519b82299d3ab22e1e2178f23885c3487df)
- 优化字幕选择器，简化代码逻辑 [`3ef91d5`](https://github.com/metrovoc/immersive-memorize/commit/3ef91d5a298b3ef0b0a99faf8d088fed2d1618bc)
- updates [`ffec511`](https://github.com/metrovoc/immersive-memorize/commit/ffec51130af1ce5f44d6bc172d1decf28854d501)
- update options page [`8328944`](https://github.com/metrovoc/immersive-memorize/commit/8328944b3411c933c22869028153c5c155847e3a)
- 解决notification不显示 [`6f1e2bc`](https://github.com/metrovoc/immersive-memorize/commit/6f1e2bcc5b8af6700d02deccd710a82b241f2222)
- fix [`475503a`](https://github.com/metrovoc/immersive-memorize/commit/475503a3a3614d57c4cb8198a5bb1fc6bee0ebc7)
- 优化调试信息，移除启动通知 [`bbb4bfc`](https://github.com/metrovoc/immersive-memorize/commit/bbb4bfc8e22c9a84b47505e041799fce1947fa70)
- hotfix [`969e715`](https://github.com/metrovoc/immersive-memorize/commit/969e71540da0d452e9387f562df69ea0c815bd6c)
- update github workflow [`d382ad4`](https://github.com/metrovoc/immersive-memorize/commit/d382ad47df65cbe184644384fe32d453d6dbccbc)
- 更新版本号至0.7.0，修改截图功能为使用高质量JPEG格式 [`a6b594e`](https://github.com/metrovoc/immersive-memorize/commit/a6b594e5c03d77a63bc8f18df4c7c95d21e50563)
- fixes [`7559e18`](https://github.com/metrovoc/immersive-memorize/commit/7559e18ad8383e3b929e0ef3b5828a6905879aac)
- update README [`68c5cdd`](https://github.com/metrovoc/immersive-memorize/commit/68c5cdde6cffa39adc7d63708dcbdfc7c42a392a)
- 调整Furigana位置和样式，修改字体大小和行高以优化显示效果 [`8157636`](https://github.com/metrovoc/immersive-memorize/commit/81576366ae1a0ce24cd664deb8905c3e4b93db87)
- update version number [`c2fe5ed`](https://github.com/metrovoc/immersive-memorize/commit/c2fe5ed8354140000ac65d38e1525bf227f70656)
- innerHTML [`a8c8262`](https://github.com/metrovoc/immersive-memorize/commit/a8c826232d410d135d9bfc90ae730a07a0606314)
- allow all urls for background script to work [`226c06a`](https://github.com/metrovoc/immersive-memorize/commit/226c06a4a26e0f3893ec1d421881582a6c5c2cdd)

## [v0.7.1](https://github.com/metrovoc/immersive-memorize/compare/v0.7.0...v0.7.1) - 2025-07-24

### Commits

- updates [`bea4ceb`](https://github.com/metrovoc/immersive-memorize/commit/bea4ceb8eba931f228a7c747c817bde2a89b4598)

## [v0.7.0](https://github.com/metrovoc/immersive-memorize/compare/v0.6.0...v0.7.0) - 2025-07-24

### Commits

- 重构字幕处理逻辑，添加SubtitleTextParser以提取Furigana映射，优化CSV导出功能，支持多种格式 [`1ea21cf`](https://github.com/metrovoc/immersive-memorize/commit/1ea21cf2a8146aaa4ba60071288608d7383f1c29)
- attempt with multiple API [`a7e87c1`](https://github.com/metrovoc/immersive-memorize/commit/a7e87c1bbdf0a6cf6c8a7e6c5e8aeea600b9a660)
- fix:highlight not preserved:重构SubtitleTextParser类，优化解析逻辑，分离分析和显示HTML的处理，简化Furigana映射提取过程 [`1638355`](https://github.com/metrovoc/immersive-memorize/commit/1638355fe7721e9cebc2fba336592e70afa6340d)
- 添加背景脚本以支持截图功能，更新manifest和webpack配置，优化视频帧捕获逻辑 [`ab78212`](https://github.com/metrovoc/immersive-memorize/commit/ab78212d71eb8602a6bcf980da4b9df0ac81f59c)
- 添加CSV导出格式设置选项，重构相关逻辑以支持多种导出格式，优化选项页面 [`43aff3e`](https://github.com/metrovoc/immersive-memorize/commit/43aff3ea89882ca2a105aeed6a669a4063cfe462)
- 优化CSV格式信息提示 [`32756b7`](https://github.com/metrovoc/immersive-memorize/commit/32756b7f5b564a445150122008168b8aa56bb2d5)
- 为卡片添加删除功能，优化事件监听器设置，移除全局deleteCard声明 [`d88ce86`](https://github.com/metrovoc/immersive-memorize/commit/d88ce861bdf22a843cbea31667b27145b7960c4a)
- 更新版本号至0.7.0，修改截图功能为使用高质量JPEG格式 [`b370328`](https://github.com/metrovoc/immersive-memorize/commit/b3703281abe719bb35748d30e10d93e80ec1bf64)
- 调整Furigana位置和样式，修改字体大小和行高以优化显示效果 [`2d1ec4f`](https://github.com/metrovoc/immersive-memorize/commit/2d1ec4fd9041840c847cc7b5dd23a89d5993ad03)
- allow all urls for background script to work [`dcc0598`](https://github.com/metrovoc/immersive-memorize/commit/dcc0598076c5362b9883bb23969d452fb0086a3e)

## [v0.6.0](https://github.com/metrovoc/immersive-memorize/compare/v0.2.0...v0.6.0) - 2025-07-24

### Commits

- dataset reforge [`7217503`](https://github.com/metrovoc/immersive-memorize/commit/72175033be9629f6267e81393b5d1581868d05d6)
- large refactor [`45d2d0b`](https://github.com/metrovoc/immersive-memorize/commit/45d2d0ba1965d8cf5a174de83ec3c16bf2ed9432)
- rm [`e08fecb`](https://github.com/metrovoc/immersive-memorize/commit/e08fecb6648db5c4077ee2dbbb17041078cb492c)
- updates [`f827c18`](https://github.com/metrovoc/immersive-memorize/commit/f827c183cef642e5da13c0ded31ae245808a65ac)
- update [`572fb0a`](https://github.com/metrovoc/immersive-memorize/commit/572fb0aa6d59ce263d7f471bddd637d3300eb746)
- kuromoji gemini#1 [`0ab5925`](https://github.com/metrovoc/immersive-memorize/commit/0ab59253cbe1f0eea46b71a17f93552dca328ae1)
- gemini attempt#2 [`dd460af`](https://github.com/metrovoc/immersive-memorize/commit/dd460afffeb44a23a0661442771cfa00b1c245ca)
- 添加NetflixExtractor以提取详细页面信息，并更新FlashCard接口以包含Netflix相关数据 [`622a9ed`](https://github.com/metrovoc/immersive-memorize/commit/622a9edb6befa5978826a715d59d06ffcd87a110)
- 删除旧的构建和测试工作流，更新发布工作流以支持新的构建步骤和打包格式 [`dd87adc`](https://github.com/metrovoc/immersive-memorize/commit/dd87adc2cc832644f33ae34515f26d891478e4d2)
- 优化代码格式，简化事件监听器设置，调整选项页面DOM操作逻辑 [`37d45fc`](https://github.com/metrovoc/immersive-memorize/commit/37d45fcf7fb388f144f2dbdeeb57eab69c2268dc)
- 重构词汇库管理，更新学习进度逻辑，优化记忆卡片处理，调整选项页面渲染 [`94f69c5`](https://github.com/metrovoc/immersive-memorize/commit/94f69c54ab481f9debf50d2e29bc74e1be4f9987)
- fix n1 checkbox [`864e81d`](https://github.com/metrovoc/immersive-memorize/commit/864e81d42861f31506c2514b0a0e12c441aba6d9)
- updated readme [`edc2a95`](https://github.com/metrovoc/immersive-memorize/commit/edc2a956fc19e7b8f0100cc377a7cc2a25ba6351)
- fix double highlighting [`af94df4`](https://github.com/metrovoc/immersive-memorize/commit/af94df4a502d9bff7db14ecc6f540febdb40f3e5)
- gemini fixes#3 [`643edd4`](https://github.com/metrovoc/immersive-memorize/commit/643edd47fb7c3aa9b66090b4f5fcec9c14c4fae8)
- 重构refreshCurrentSubtitles方法，统一处理字幕容器，优化高亮逻辑，避免竞态问题 [`8b04a0d`](https://github.com/metrovoc/immersive-memorize/commit/8b04a0d1ff84a64aab085d91c14784071a78635a)
- gemini fix dict-zlib unzip#4 [`1d0211e`](https://github.com/metrovoc/immersive-memorize/commit/1d0211ee083f81245fe62bf1a4ecf2815165e75c)
- fix [`78d1fe2`](https://github.com/metrovoc/immersive-memorize/commit/78d1fe27330b3e4d1925c81c417eff85e13bc4df)
- font css [`55d78c4`](https://github.com/metrovoc/immersive-memorize/commit/55d78c44645fd6df1ea7f82835cb7a65bcdb8759)
- update options page [`dcc92bc`](https://github.com/metrovoc/immersive-memorize/commit/dcc92bcc1fd05ff522268a9376d3e07e8504311e)
- 解决notification不显示 [`fd3eae4`](https://github.com/metrovoc/immersive-memorize/commit/fd3eae4c4eed219ead8348ad1d8ed4477e1fe04e)
- fix [`62145c3`](https://github.com/metrovoc/immersive-memorize/commit/62145c3d35c491b9e960f1d815eff67cf29fb4a2)
- hotfix [`5a73334`](https://github.com/metrovoc/immersive-memorize/commit/5a7333417f8db76d5bfdf708a6ecc83e8ced86af)
- fixes [`9194f73`](https://github.com/metrovoc/immersive-memorize/commit/9194f73b8808e81059b23e67c1a3d14d1e52c6dc)
- update version number [`3d7e29b`](https://github.com/metrovoc/immersive-memorize/commit/3d7e29b1efced2c5b0da556db8dc43e465ca8ee0)
- innerHTML [`2411dbd`](https://github.com/metrovoc/immersive-memorize/commit/2411dbd54f7064b5b5686e6107dd643a7a1eda41)

## v0.2.0 - 2025-06-20

### Commits

- chore: 更新 .gitignore 文件，添加构建输出、临时文件、环境变量和日志文件的忽略规则 [`3c4f1a9`](https://github.com/metrovoc/immersive-memorize/commit/3c4f1a98539ee7b46e75f9c7488e32542c7a43aa)
- first commit [`b263aec`](https://github.com/metrovoc/immersive-memorize/commit/b263aec934df0ac693533919fb0daa38964e2cec)
- feat: 重构 content_script.js 实现顺序学习模式，优化高亮显示和通知样式，版本号升级至 0.2.0 [`cf05aae`](https://github.com/metrovoc/immersive-memorize/commit/cf05aae4b8baebcf0e3b7cabba148063ea76818f)
- fix:更新 content_script.js 以支持捕获快捷键和调试模式，重构选项页面以包含快捷键和调试设置，更新样式和事件处理逻辑。 [`ae3738d`](https://github.com/metrovoc/immersive-memorize/commit/ae3738d82d85c7ac23feab12bae6c49c83bb760d)
- feat: 更新 content_script.js 以支持已学单词管理和高亮移除功能，优化通知样式，版本号升级至 0.1.2 [`5f7d2b2`](https://github.com/metrovoc/immersive-memorize/commit/5f7d2b28b1cb705dbede8cbaf4268481d6acdece)
- fix [`d6dc570`](https://github.com/metrovoc/immersive-memorize/commit/d6dc570d435e7e32915c481861c7c5138141a11c)
