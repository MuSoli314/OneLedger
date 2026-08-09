# 网页版部署指南（Vercel，免费）

「一笔」现在是**桌面版 + 网页版**双形态。网页版部署后，任何人有网址就能在浏览器里用，无需安装。

## 网页版的数据存哪？

**存在每个用户自己的浏览器里**（浏览器的本地存储 IndexedDB）。因此：

- 每个访客的记账数据**不经过任何服务器**，你（站长）也看不到别人记了什么，隐私最好；
- 数据跟着浏览器走：**换电脑 / 换浏览器 / 清理浏览器缓存 → 数据会丢**；
- 网页版和桌面版是两份独立数据，**不会自动同步**；
- 提醒访客定期用「导出 CSV」备份数据。

## 一次点击部署（最省事，推荐）

Vercel 可以连接你的 GitHub 仓库，以后每次推代码自动重新部署：

1. 先把本项目推送到 GitHub（若还没推送）。
2. 打开 https://vercel.com ，用 GitHub 账号登录。
3. 点 **Add New → Project**，选择本项目仓库。
4. **无需改任何配置**——Vercel 会自动识别 Vite：
   - Build Command：`npm run build`
   - Output Directory：`dist`
5. 点 **Deploy**，约 1~2 分钟后即可通过 `https://你的项目名.vercel.app` 访问。

以后每次 `git push`，Vercel 会自动重新构建上线。

## 命令行上传（没有 GitHub 仓库时）

1. 安装 Vercel 命令行工具：`npm i -g vercel`
2. 在项目根目录运行 `vercel`，按提示登录（浏览器里授权一次）。
3. 首次会问配置，直接回车用默认值（构建 `npm run build`、输出 `dist`）即可。
4. 部署完成后，命令行会打印出你的公网网址（形如 `https://xxx.vercel.app`）。

## 更换/补充：每次部署前要做什么？

1. 代码有改动时：`npm run build` 本地先确认能通过。
2. 推送或 `vercel --prod` 部署即可。构建产物由 Vercel 自己生成，**不要**把 `dist/` 提交到 Git。

## 绑定你自己的域名（可选）

Vercel 项目设置 → **Domains** → 添加你的域名，按提示把域名的 CNAME 指到 `cname.vercel-dns.com` 即可，Vercel 会自动签发 HTTPS 证书。

## 常见问题

- **深层链接 404？** 已内置 `vercel.json` 的 SPA 重写规则，直接打开 `/categories`、`/settings` 也不会 404。
- **数据丢了？** 网页版数据存在浏览器里，换设备/清缓存即丢失，务必提醒访客定期导出 CSV。
- **怎么在本地先试试网页版？** 运行 `npm run dev`，然后浏览器打开 http://localhost:5173 即可（此时是网页版数据层，与桌面版互不影响）。
