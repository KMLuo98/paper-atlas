# Paper Atlas · 云端文献工作台

为 KMLuo98 创建的个人学术文献管理系统。GitHub Pages 提供网页，Supabase Auth、Postgres、私人 Storage 与 Edge Function 提供后端。AI 服务支持 DeepSeek 等 OpenAI 兼容服务。

在线网页：**https://kmluo98.github.io/paper-atlas/**。

已连接专用项目 `fubuikclgsgcxviymshr`，数据库、RLS、私人 PDF 桶和 `library-api` 已部署。浏览器公钥位于 `src/project-config.js`，可以公开；私密 DeepSeek 密钥仅保存在 Supabase Secrets。当前项目已配置自定义 SMTP，并通过真实邮箱注册与验证；更换项目或发信账号时仍需重新配置 Auth URL 和 SMTP。

网站已连接专用云端项目。未登录时仅显示注册与登录界面，不提供演示文献库；正式论文仅写入私人云端，不使用浏览器本地存储充当数据库。

## 功能

- 用户名或邮箱登录，注册、重名检测、重置密码、可选自动登录。
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

`verify_jwt = false` 是为了兼容外部 API 令牌与匿名用户名登录。**函数内部仍验证 JWT、令牌散列和用户所有权**；只有注册、登录与不包含用户数据的健康状态 action 可匿名调用。不要删除函数内部鉴权。

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

网页注册通过服务端 register action 创建账户，使用 Admin API 的 email_confirm 标志直接启用密码登录，不发送验证邮件；服务端密钥不会发送到浏览器。邮箱仍用于密码找回。此标志代表应用关闭验证步骤，不表示实际邮箱所有权已验证。

在 **URL Configuration** 中设置：

- Site URL：`https://kmluo98.github.io/paper-atlas/`
- Redirect URLs：`https://kmluo98.github.io/paper-atlas/`，本地开发时额外添加 `http://127.0.0.1:5173/`。

需要密码找回时请保留 **Custom SMTP**，并按需要开启 CAPTCHA 和邮件发送限流。Supabase 默认邮件服务有收件人与配额限制，不应据此承诺对所有用户发信成功。参考 [Supabase Auth SMTP](https://supabase.com/docs/guides/auth/auth-smtp)。

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

参见 [OpenAPI 文档](public/openapi.json)。外部令牌不能创建令牌、登录、修改文献或调用付费模型。普通 API 限每位用户每分钟 60 次，论文分析每分钟 30 次（限制请求频率，不限制批次篇数），作者分析每小时 10 次。

## 本地开发与验证

需要 Node.js 24 和 pnpm 11：

```sh
pnpm install
pnpm test
pnpm dev
pnpm build
```

复制 `.env.example` 为 `.env.local` 并填写前端公钥；也可使用网站配置界面。依赖锁定在 `pnpm-lock.yaml`。`scripts/smoke-cloud.mjs` 可验证独立测试账号的跨用户隔离与持久化，测试凭据仅通过环境变量提供。

`Verify cloud connection` 工作流使用公共项目配置验证后端可达、免验证注册模式、未登录访问拦截与 CORS，并通过服务端只读模型列表接口验证密钥与模型可用性；不包含私密凭据，不发送论文，不发起内容生成请求。模型连通性检查有短期缓存与请求限流。数据库真实 RLS 隔离已通过事务内两用户测试，测试数据全部回滚。

## 数据与已知边界

- 单篇 PDF 最大 30 MB，不限制每批篇数；支持多选 PDF、文件夹和 ZIP，先完成整批上传，再逐篇分析，单篇失败不会中断队列。ZIP 逐个解压 PDF，避免一次展开全部内容。扫描件、公式图片及复杂分栏的提取可能不完整，需要 OCR 或人工核验。
- 完整 PDF 云端保留。文本提取上限 60 万字符；AI 单次最多分析前 60,000 + 后 25,000 字符，截断会在详情页明确展示。未识别字段保留空值，不猜测。
- PDF 下载使用规范文件名；云端对象键使用 UUID，手动修改元数据不会移动或覆盖原文件。
- 引文边只在所选库内按 DOI 或完整标题匹配。未入库的被引论文不会凭空成为节点。
- 作者按 ORCID 优先、姓名次之分组，同名会有歧义，需人工补充 ORCID。合作次数是当前文献样本统计。
- 机构、邮箱只有原文列出或用户补充才显示，不推测私人联系信息。作者关系推测不代表事实。
- 模型请求失败时保留 PDF 并显示单篇错误，队列继续；双语关键词不完整时优先保存已提取的元数据与摘要，并提示单独补全。
- 前端首次加载以来的元数据缓存在内存中；真实来源是云端。跨浏览器修改后可刷新同步。自动登录保存会话令牌，不保存明文密码。
- Supabase 免费项目的休眠、容量、邮件和备份策略取决于账户计划。需要长期可靠服务时，请配置适合的计划与备份。源码不能替代运营层面的备份保障。
- 后端已部署并通过真实数据库隔离测试与 HTTP 鉴权检查。2026-10-16 已完成真实邮箱注册、邮件验证、登录、实际论文上传与 DeepSeek 解析；数据库确认私人 PDF、元数据、10 个关键词及摘要均已保存，用户确认退出后重新登录仍能打开论文与解析结果。

## 已验证的修复

PDF.js 6 的工作线程由 `PDFDocumentLoadingTask.destroy()` 释放；对文档对象调用已不存在的 `destroy()` 会让全文提取报错，阻断后续 AI 分析。现在统一在加载任务上清理，包括加载失败与扫描件场景。13 项自动测试和生产构建通过，浏览器使用实际 PDF.js 连续提取两份文本 PDF、验证空白 PDF 的 OCR 提示均通过，线上真实论文已成功重试。原有上传文件无需重新上传。

## 扩展验收清单

以下为持续验收清单，不表示每一项都已通过真实账号完整执行。密码找回的实际邮件回跳、第二个真实账号的完整浏览器隔离及外部 API 令牌全流程仍可按此清单继续验证；数据库隔离、HTTP 鉴权与上述核心流程已有对应验证。

1. 注册 A，确认无需验证邮件即可登录；重名注册被阻止；重置密码与不勾选自动登录均正常。
2. A 上传含可提取文本的 PDF，完成解析，检查原文与元数据、日期、作者和 8–10 个关键词一致。
3. 刷新、退出并重新登录，检查同一 PDF 与手动标签仍在；使用另一浏览器验证。
4. 注册 B，确认不能读取 A 的记录、对象路径、签名文件与 API 数据。
5. 多选导出、单篇阅读、选定文献新页面网络、悬停作者、外部检索及限流正常。
6. 创建令牌，验证只读访问、失效与撤销；移入回收站并恢复论文。

## 本次功能更新

- 品牌图标和网页图标使用用户提供的原始 PNG。个人设置支持显示名称、私有云端头像；注销需重新验证当前密码、输入“注销账户”，然后撤销会话、删除私人文件与账户，资料和令牌级联删除。
- 双语关键词存为 keyword_pairs（中文、英文、层级、重要性）；列表与卡片显示前 6 个中文词，其余通过 +N 展开，英文可悬停查看并用于检索。排序先宽领域，再具体研究主题，然后方法和结论/现象，各层内按重要性排序。旧文献在登录后自动整理关键词，也可选中文献后重新分析。
- 中文 PDF 通过随网站部署的 CMap、字体与 WASM 资源提取。扫描图片仍需 OCR，不能仅靠字形映射恢复图片文字。
- 未发表或预印稿可标记 unpublished，期刊和日期允许为空，文件名为 [未发表] 标题.pdf，仍可阅读、总结、搜索、导出和参与网络；引用导出使用相应的未发表记录类型。关键词不完整时优先保存已提取的元数据和摘要，并提示补全。
- 引文结点内部使用 NC、PRE、NHB 等最常用简写；完整标题保留在结点下方和悬停提示。
- 新增回归验证覆盖无限制篇数的队列顺序、ZIP 与损坏文件隔离、中文未发表稿、关键词层级排序、账户文件清理范围；头像与资料 RLS 已做双用户事务测试并回滚。真实账户不会为测试注销。

## 界面语言、下载与管理

- 右上角可切换中文 / English，选择保存在当前浏览器。导航、表单、提示与管理界面提供英文，关键词按当前语言显示；论文标题、作者和原有笔记保持原文。
- 移除文献总数和研究作者统计、顶部统计卡与顶部导出按钮，字体整体增大。勾选论文后选择导出引文，或从下载菜单选择合并为单个 PDF / 逐个 PDF；加密或损坏文档会单独报告，不让其他文件丢失。
- admin 为保留用户名，普通注册不能创建。专用管理员账户已初始化，初始凭据只单独提供给账户所有者。首次登录必须修改初始密码后才可管理用户和论文。管理权限由服务端 admin_users 表判定，不能通过浏览器或 user_metadata 授予；普通客户端没有该表的访问权限。
- 管理删除为永久操作，界面要求确认并重新验证管理员密码。管理员不能在用户列表中删除管理员账户；个人注销入口仍可由本人使用。
- 一次性管理员初始化入口已移除，初始化凭据与测试账户密码未提交仓库。真实中英文 PDF、未发表识别、双语关键词、私人头像、跨用户隔离和跨会话保存已用独立临时账户验证。管理删除采用隔离测试验证，没有删除真实用户。

## PDF 文本兼容修复

- 提取文本在保存前移除 PostgreSQL 不支持的 NUL，并将孤立 UTF-16 代理项替换为占位符，保留有效中文、生僻字和公式；原始 PDF 不变。模型返回的数据也经过相同检查。
- 登录后针对已记录为 unsupported Unicode escape sequence 的失败文献自动重试，其他失败仍可在详情或多选后重试；逐篇失败隔离继续生效。
- 移除顶部“更新双语关键词”“分析待处理”按钮，保留选择后的分析入口。
