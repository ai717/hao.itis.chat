# AI薅羊毛日报 · hao.itis.chat

羊毛线报看板（Muse 空间 `yang-mao-xian-bao`）的公开发布站：纯静态、GitHub Pages 托管、中英双语。
界面与看板同款：浅色米白线报纸、墨黑字、唯一砖红 `#9c4a38` 强调、卡片标题 24px 特粗、单列清爽。

## 架构与数据流

```
看板采集（每天 09:00 主刊 / 20:40 大羊毛快讯）
  → Muse 导出全量 data.json（中文）+ data-en.json（英文，结构与 id 对齐）
  → 免审核自动同步：双文件以单次提交推送到 main
  → GitHub Actions（sync-on-data-push.yml）跑 node sync-site-seo.js
      ① 再生 data-fallback.js / data-en-fallback.js
      ② 刷新中英首页 meta / 总数 / JSON-LD ItemList
      ③ 生成 deal/<id>/ 与 en/deal/<id>/ 静态详情页（Article + Offer 结构化数据）
      ④ 全量重建 sitemap.xml，⑤ 生成 robots.txt
    → bot 提交回 main → GitHub Pages 发布
```

- 写入口只有 Muse 的同步流程；不要手改生成物（`deal/`、`en/deal/`、`sitemap.xml`、fallback、首页 JSON-LD），改动回数据文件或 `sync-site-seo.js` 源头。
- 收藏「想薅的」在独立站为浏览器 localStorage 本地收藏，不回传看板。

## 文件清单

| 文件 | 说明 |
|---|---|
| `index.html` / `en/index.html` | 中 / 英首页（SEO 头 + 列表容器，内容由 app.js 渲染） |
| `app.js` / `style.css` | 双语共用渲染与样式（fetch data，失败回退 fallback） |
| `data.json` / `data-en.json` | 全量数据（双语同构、id 对齐） |
| `data-fallback.js` / `data-en-fallback.js` | 由 sync 脚本再生的内嵌数据兜底 |
| `sync-site-seo.js` | 一键 SEO 同步引擎（node，无依赖） |
| `deal/<id>/` / `en/deal/<id>/` | 每条线报的中英静态详情页（sync 生成） |
| `sitemap.xml` / `robots.txt` | sync 生成 |

## 本地预览

```bash
cd hao-site
node sync-site-seo.js        # 先再生详情页 / sitemap / fallback
python3 -m http.server 8000  # 打开 http://localhost:8000/ 与 /en/
```

## 启用自定义域名（CNAME）

1. 用户在域名 DNS 处加一条 CNAME：`hao` → `ai717.github.io`。
2. DNS 生效后，在仓库根目录新增 `CNAME` 文件，内容一行：`hao.itis.chat`。
3. 在仓库 Settings → Pages 确认 Custom domain 为 `hao.itis.chat` 并勾选 Enforce HTTPS。
4. 解析与证书就绪前不要放 CNAME —— 先用 `ai717.github.io/hao.itis.chat` 地址验收。

## SEO

- 每条线报有独立中英详情页（canonical、hreflang、Article + Offer JSON-LD、原文出处链接）。
- `sitemap.xml` 含首页、中英首页与全部详情页，交由站点所有者提交 Google Search Console。
