# Paper Atlas · 云端文献工作台

为 KMLuo98 创建的个人学术文献管理系统。GitHub Pages 提供网页，Supabase Auth、Postgres、私人 Storage 与 Edge Function 提供后端。AI 服务支持 DeepSeek 等 OpenAI 兼容服务。

在线网页：**https://kmluo98.github.io/paper-atlas/**。

已连接专用项目 `fubuikclgsgcxviymshr`，数据库、RLS、私人 PDF 桶和 `library-api` 已部署。浏览器公钥位于 `src/project-config.js`，可以公开；私密 DeepSeek 密钥仅保存在 Supabase Secrets。网页能否真实发出验证邮件，仍取决于 Auth URL 和 SMTP 配置。

**项目源码不等于已启用云服务。** 没有连接后端时，网站提供登录界面及明确标注的虚构演示库。演示记录不会写进真实账户；正式论文仅写入云端，不使用浏览器本地存储充当数据库。

## 功能

- 用户名或邮箱登录，注册、验证邮件、重名检测、重置密码、可选自动登录。
- 每位用户独立的云端 PDF 与元数据；按用户隔离的数据库和私人文件桶。
- PDF 全文提取；AI 识别期刊、日期、作者、机构、DOI、8–10 个研究关键词、中英检索词和中文总结；手动修订标签、引用和元数据。
- 下载文件按 `[PRL 2023.5] Paper title.pdf` 格式命名。云端对象以用户 ID / UUID 保存，避免重名覆盖；显示名与下载名采用论文元数据。
- 多选导出 BibTeX、RIS、CSL JSON、GB/T 与 APA 常用文本；正式排版建议使用 BibTeX / CSL 配合目标期刊样式。
- 本地模糊检索与中英词表匹配；AI 生成中英等价检索词；可主动调用 AI 做任意查询的跨语言扩展。
- 独立页面的引文网络、作者网络，默认全选、可选子集，支持拖动、缩放和导出 SVG。
- 作者两两合作次数排名、悬停机构与邮箱、关系分析；默认只分析库内记录，可勾选 Crossref 公开检索。
- 只读外部 API、SHA-256 散列存储令牌、90 天有效期、撤销与请求限流。
- 软删除与回收站恢复。原始文件不因移入回收站被删除。

## 1. GitHub Pages 发布

仓库：`KMLuo98/paper-atlas`。预期地址：`https://kmluo98.github.io/paper-atlas/`（须以 GitHub Pages 实际部署成功结果为准）。

1. 推送源码到 `main`。
2. 仓库 **Settings → Pages → Source** 选择 **GitHub Actions**。
3. **Actions → Deploy Paper Atlas → Run workflow**。构建包含核心逻辑测试。
4. 完成后使用部署输出中的 `page_url`。

前端使用相对资源路径和 hash 路由，支持 GitHub Pages 子目录部署。公开源码只包括程序，不包括用户论文、账号或密钥。

## 2. 创建并部署 Supabase 后端

新建专用 Supabase 项目。迁移为新项目设计，不要直接应用到已有同名表的业务数据库。

推荐通过仓库 Actions 部署：

1. 在 GitHub **Settings → Secrets and variables → Actions → Variables** 填写：
   - `SUPABASE_PROJECT_REF`：项目 URL 中的项目 ID。
   - `VITE_SUPABASE_URL`：`https://项目ID.supabase.co`。
   - `VITE_SUPABASE_ANON_KEY`：Publishable key 或 anon public key（公钥，可在前端公开）。
2. 在同一页面 **Secrets** 填写：
   - `SUPABASE_ACCESS_TOKEN`：Supabase 账户访问令牌。
   - `SUPABASE_DB_PASSWORD`：项目数据库密码。
3. **Actions → Deploy Supabase backend → Run workflow**。这会创建数据表、RLS 策略、私人 PDF 桶并部署 API。
4. 重新运行 **Deploy Paper Atlas**，把项目公钥构建进前端。也可以在网站「云端设置」中配置公钥，但这只对当前浏览器生效。

也可在本机安装官方 Supabase CLI 后执行：

```sh
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
supabase functions deploy library-api
```

`verify_jwt = false` 是为了兼容外部 API 令牌与匿名用户名登录。**函数内部仍验证 JWT、已验证邮箱、令牌散列和用户所有权**；只有登录与不包含用户数据的健康状态 action 可匿名调用。不要删除函数内部鉴权。

## 3. DeepSeek 密钥（仅后端）

Supabase Dashboard → **Edge Functions → Secrets** 添加：

| 名称 | 值 |
| --- | --- |
| `LLM_BASE_URL` | `https://api.deepseek.com` |
| `LLM_MODEL` | 默认 `deepseek-flash`，可选填写其他支持 JSON 输出的模型 |
| `LLM_API_KEY` | 你自己的 DeepSeek API Key |
| `ALLOWED_ORIGINS` | `https://kmluo98.github.io` |

默认模型服务地址已设为 DeepSeek，因此只设置 `LLM_API_KEY` 即可开始调用；也兼容 Secret 名称 `DEEPSEEK_API_KEY`。DeepSeek 请求使用非推理模式以控制解析耗时。当前模型名称已根据 2026-10-16 的官方文档核对。

DeepSeek 的模型名称会变化，应使用账户当前支持的名称。参考 [DeepSeek 官方首次调用文档](https://api-docs.deepseek.com/zh-cn/) 和 [JSON 输出文档](https://api-docs.deepseek.com/guides/json_mode)。模型须支持 JSON object 输出；系统提示和服务端校验会检查结构及关键词数量。

作者关系默认只根据库内文献分析，不发送姓名到公开检索服务。每次可勾选「同时检索公开论文（Crossref）」；仅在用户勾选时向 Crossref 发送两位作者姓名，无需额外密钥，不发送 PDF、摘要、邮箱或账户数据。公开检索失败时明确说明只使用库内资料。同名候选无法自动确认为同一作者，优先补充 ORCID。

不要将服务端密钥填入前端、GitHub Variables、README 或代码。部署函数所需的 `SUPABASE_URL`、`SUPABASE_ANON_KEY` 和 `SUPABASE_SERVICE_ROLE_KEY` 由 Supabase 运行时提供。

## 4. 邮箱验证与找回密码

Supabase → **Authentication → Providers → Email**：开启 **Confirm email**。

在 **URL Configuration** 中设置：

- Site URL：`https://kmluo98.github.io/paper-atlas/`
- Redirect URLs：`https://kmluo98.github.io/paper-atlas/`，本地开发时额外添加 `http://127.0.0.1:5173/`。

生产使用请配置 **Custom SMTP**，并按需要开启 CAPTCHA 和邮件发送限流。Supabase 默认邮件服务有收件人与配额限制，不应据此承诺对所有用户发信成功。参考 [Supabase Auth SMTP](https://supabase.com/docs/guides/auth/auth-smtp)。

用户名唯一性在数据库触发器与大小写不敏感唯一索引中执行，前端检查只用于及时提示。用户名登录由后端转换为邮箱，邮箱不通过公开查询泄露。数据库密码重置通过 Supabase 邮件链接完成。

## 5. 外部 API

在网站 **API 与集成** 创建令牌。令牌仅显示一次，仅能读取该用户的数据。

```sh
curl -X POST 'https://YOUR_PROJECT.supabase.co/functions/v1/library-api' \
  -H 'Authorization: Bearer pa_YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"action":"list","query":"同步","limit":20,"offset":0}'
```

| action | 参数 | 返回 |
| --- | --- | --- |
| `list` | query?, limit? (1–200), offset? | papers, total, limit, offset |
| `get` | paper_id | paper |
| `download` | paper_id | 300 秒有效的私人 PDF 下载 URL |
| `citations` | paper_ids?, format: bibtex/ris/csl/gbt/apa | content |
| `network` | paper_ids?, kind: citations/authors | nodes, edges |

参见 [OpenAPI 文档](public/openapi.json)。外部令牌不能创建令牌、登录、修改文献或调用付费模型。普通 API 限每位用户每分钟 60 次，论文分析每小时 12 次，作者分析每小时 10 次。

## 本地开发与验证

需要 Node.js 24 和 pnpm 11：

```sh
pnpm install
pnpm test
pnpm dev
pnpm build
```

复制 `.env.example` 为 `.env.local` 并填写前端公钥；也可使用网站配置界面。依赖锁定在 `pnpm-lock.yaml`。`scripts/smoke-cloud.mjs` 可验证独立测试账号的跨用户隔离与持久化，测试凭据仅通过环境变量提供。

`Verify cloud connection` 工作流使用公共项目配置验证后端可达、邮箱确认要求、未登录访问拦截与 CORS；不包含私密凭据，不调用付费模型。数据库真实 RLS 隔离已通过事务内两用户测试，测试数据全部回滚。

## 数据与已知边界

- 文件最大 30 MB，每批最多 10 篇。扫描件、公式图片及复杂分栏的提取可能不完整，需要 OCR 或人工核验。
- 完整 PDF 云端保留。文本提取上限 60 万字符；AI 单次最多分析前 60,000 + 后 25,000 字符，截断会在详情页明确展示。未识别字段保留空值，不猜测。
- PDF 下载使用规范文件名；云端对象键使用 UUID，手动修改元数据不会移动或覆盖原文件。
- 引文边只在所选库内按 DOI 或完整标题匹配。未入库的被引论文不会凭空成为节点。
- 作者按 ORCID 优先、姓名次之分组，同名会有歧义，需人工补充 ORCID。合作次数是当前文献样本统计。
- 机构、邮箱只有原文列出或用户补充才显示，不推测私人联系信息。作者关系推测不代表事实。
- 模型返回结构或关键词数不合要求时保留 PDF 并显示解析失败，支持重试。
- 前端首次加载以来的元数据缓存在内存中；真实来源是云端。跨浏览器修改后可刷新同步。自动登录保存会话令牌，不保存明文密码。
- Supabase 免费项目的休眠、容量、邮件和备份策略取决于账户计划。需要长期可靠服务时，请配置适合的计划与备份。源码不能替代运营层面的备份保障。
- 后端已部署并通过真实数据库隔离测试与 HTTP 鉴权检查；真实收件箱的邮件投递、实际论文的 AI 解析及完整跨会话上传流程，仍需使用验证过的账号验收。不要把演示成功视为生产验收。

## 生产验收

1. 注册 A，确认未验证邮箱不能登录；重名注册被阻止；邮件验证、重置密码与不勾选自动登录均正常。
2. A 上传含可提取文本的 PDF，完成解析，检查原文与元数据、日期、作者和 8–10 个关键词一致。
3. 刷新、退出并重新登录，检查同一 PDF 与手动标签仍在；使用另一浏览器验证。
4. 注册 B，确认不能读取 A 的记录、对象路径、签名文件与 API 数据。
5. 多选导出、单篇阅读、选定文献新页面网络、悬停作者、外部检索及限流正常。
6. 创建令牌，验证只读访问、失效与撤销；移入回收站并恢复论文。
