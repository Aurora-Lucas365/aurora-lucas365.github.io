# aurora-lucas365.github.io

Lucas Taylor 的个人网站，记录我做项目和学习的历程。
Personal website of Lucas Taylor. Notes are written in Obsidian and published automatically.

**👉 [aurora-lucas365.github.io](https://aurora-lucas365.github.io)**

## 它是怎么工作的

我只在 Obsidian 里写笔记。想公开的那篇，把属性 `publish` 打勾，然后在 Obsidian 里运行一条「发布网站」命令，剩下的全自动：

```mermaid
flowchart LR
  A["Obsidian 笔记<br/>publish 打勾"] --> B["sync-notes.mjs<br/>挑出公开笔记、复制图片"]
  B --> C["git push"]
  C --> D["GitHub Actions<br/>用 Astro 生成网页"]
  D --> E["GitHub Pages<br/>网站更新"]
```

- **只发布勾选的笔记**：没勾 `publish` 的一律不上网；指向私人笔记的双链会变成普通文字。
- **图片自动处理**：笔记里的 `![[图片.jpg]]` 会被复制到网站，并改写成网页链接。
- **不需要服务器**：静态网站，托管在免费的 GitHub Pages 上，也不需要备案。

## 目录

| 位置 | 作用 |
| --- | --- |
| `scripts/sync-notes.mjs` | 同步脚本：从 Obsidian 库挑出公开笔记，放进 `src/content/` |
| `src/content/` | 同步过来的笔记（自动生成，不手改） |
| `src/pages/` | 各个页面：首页、项目、历程、关于 |
| `src/layouts/Base.astro` | 全站外壳，以及颜色、字体和动画 |
| `src/components/` | 项目卡片等可复用的小组件 |
| `.github/workflows/deploy.yml` | 推送后自动构建并发布 |
| `发布网站.bat` | 一键同步 + 提交 + 推送 |

## 本地预览

需要 Node.js 22.12 以上。

```bash
npm install          # 第一次运行时安装依赖
npm run drafts       # 同步笔记，草稿也带上（只在本地显示）
npm run dev          # 打开 http://localhost:4321 预览
```

同步脚本从 `sync.config.json` 读取 Obsidian 库的位置，这个文件不上传：

```json
{ "vault": "E:/math model repository/数模" }
```

## 用到的东西

[Astro](https://astro.build) · [GitHub Actions](https://docs.github.com/actions) · [GitHub Pages](https://pages.github.com) · [Obsidian](https://obsidian.md) + [Shell commands](https://github.com/Taitava/obsidian-shellcommands) 插件

网站代码在 AI（Claude）的协助下完成，内容和取舍由我决定。
