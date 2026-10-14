# Wenx’s Design

一个通过 Markdown 更新的设计师个人网站。保留首页、项目手札、奇思妙想、唱唱反调、关于我五个栏目；写好一篇 `.md` 文件并提交到 GitHub，网站就会自动更新。

浏览器端是静态 HTML、CSS 和 JavaScript。发布时由 Node.js 将 Markdown 转换成页面内容，GitHub Pages 只托管生成的 `dist/` 文件。

## 平时怎么更新

| 想发布什么 | 新文件放在哪里 | 详情页地址 |
| --- | --- | --- |
| 项目手札 | `content/projects/项目名.md` | `#/project/项目名` |
| 奇思妙想 | `content/playground/实验名.md` | `#/experiment/实验名` |
| 唱唱反调 | `content/articles/文章名.md` | `#/article/文章名` |

文件名使用小写英文与短横线，例如 `a-small-observation.md`。可以写文字、插入图片、添加链接，无需修改页面代码。

1. 在 GitHub 仓库中选择 **Add file → Create new file**，填写上表中的路径，复制 `content/_templates/` 中对应模板并写入内容。初稿保持 `draft: true`。
2. 完成后将 `draft` 改为 `false`，提交到 `main`。GitHub Actions 会构建并发布；完成后刷新网站即可。

不需要为了每次发布启动本地服务或运行 npm。完整例子、字段说明和图片操作见 [写作指南](./写作指南.md)。

**草稿正文不会进入生成的网站内容，但公开仓库里的 Markdown 草稿仍可被他人查看。** `assets/` 中的文件都会随网站发布，即使它们只被草稿引用。尚不想公开的内容请保留在本地。

## 修改个人资料

编辑 `site.json`：

- `site.name`：站名；`site.designer`：姓名；`site.description`：网站描述。
- `site.email`：联系邮箱；留空时不显示邮件联系入口。
- `about`：个人简介、介绍段落与设计原则。

站名已配置为 Wenx’s Design。目前的项目、文章与个人介绍均为演示内容。用自己的经历替换时，将对应 Markdown 中的 `sample` 设为 `false` 或删除该字段。`sample` 按篇设置，不影响同站的其他条目。

`content.js` 是自动生成的浏览器数据文件，**不要手工编辑**。正文改 Markdown，个人资料改 `site.json`，构建会重新生成它。

## 第一次发布到 GitHub Pages

1. 创建 GitHub 仓库，将 **本目录内的完整源码** 放在仓库根目录，包括 `.github/`、`content/`、`scripts/`、`package.json` 和 `package-lock.json`。不要再包一层 `portfolio/`，也不要只上传 `dist/`。
2. 将代码提交到仓库的 `main` 分支。
3. 在仓库 **Settings → Pages → Build and deployment** 中，把 **Source** 设为 **GitHub Actions**。
4. 在 **Actions** 中打开部署工作流并选择 **Run workflow**，在 `main` 分支运行。此后提交到 `main` 会自动构建并发布。
5. 从 **Settings → Pages** 或部署任务打开网站地址。若构建失败，先查看 Actions 中的具体文件和报错；本次更新不会发布成功。

工作流位于 `.github/workflows/deploy.yml`，安装依赖、构建，再上传 `dist/`。Markdown 源文件、模板和写作工具不随站点产物发布。若默认分支不是 `main`，请同步修改工作流中的分支触发条件和部署条件。

普通仓库的网址为 `https://用户名.github.io/仓库名/`；名为 `用户名.github.io` 的仓库对应 `https://用户名.github.io/`。本站保留 hash 路由和相对资源路径，适用于这两种地址；文章使用 `#/article/文章名` 形式的链接。

发布配置参考：[GitHub 官方：使用自定义工作流发布 GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。本交付没有代你推送或发布仓库。

## 可选：在本地写作与预览

安装 Node.js 22 或更新版本后，在本文件所在目录执行：

```sh
npm ci
npm run dev
```

打开 [http://localhost:4173](http://localhost:4173)。开发服务会监测内容变化并重新构建，保存后刷新浏览器查看。按 `Ctrl+C` 停止服务。

其他常用命令：

```sh
# 创建一篇项目草稿
npm run new -- projects my-slug

# 生成静态发布文件到 dist/
npm run build

# 运行内容构建相关检查
npm test
```

新增文章或实验时，把命令中的 `projects` 换成 `articles` 或 `playground`。生成的文件默认 `draft: true`，先写内容，再改为 `false` 才会出现在站点预览与正式网站中。

构建依赖 `markdown-it` 与 `yaml`，版本由 `package-lock.json` 固定。发布后的网站无需 Node.js 服务器。

## 文件分工

| 文件 / 目录 | 用途 |
| --- | --- |
| `content/projects/`、`content/playground/`、`content/articles/` | 三个栏目的 Markdown 正文与发布信息 |
| `site.json` | 全站资料与关于我 |
| `content/_templates/` | 新项目、实验和文章的起始模板 |
| `assets/` | 封面和正文图片 |
| `scripts/` | 内容构建、开发预览和新建草稿工具 |
| `index.html`、`app.js`、`styles.css` | 页面结构、交互与视觉样式 |
| `favicon.svg` | 浏览器标签页图标 |
| `content.js` | 上次构建生成的内容快照，不手改 |
| `dist/` | 本次构建生成的网站，供 GitHub Pages 发布 |

直接打开源码目录的 `index.html`，看到的是上次构建的内容快照。外层独立预览 HTML 也只是交付时的快照，两者都不是写作入口；修改 Markdown 后请使用开发预览，或等待 GitHub Actions 发布完成。
