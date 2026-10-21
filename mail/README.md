# Mail Atlas · 私人邮件工作台

部署入口：https://kmluo98.github.io/paper-atlas/mail/ 。前端位于 `mail/`，由现有 GitHub Pages 工作流一起构建；不会改变文献系统的数据和页面。账号复用已有 Supabase Auth，邮箱数据使用独立 `mail_*` 表和私人 `mail-files` 文件桶。

## 开始使用

1. 用文献管理系统的用户名或邮箱、密码登录；可勾选自动登录。也可以注册新账号。自动登录只存储会话令牌。
2. 设置 → 添加邮箱，为每个邮箱指定标签、颜色和连接方式。
3. QQ：开启 IMAP/SMTP，填授权码。Gmail：使用开启两步验证后创建的应用专用密码，或配置 OAuth。学校邮箱：填服务商的公网 IMAP / SMTP 服务器与授权码，端口 993 / 465。学校使用 Microsoft 365 时请选择 Outlook。
4. Outlook / Microsoft 365 使用 Microsoft OAuth，不能填普通邮箱密码代替。OAuth 需要自己的应用 Client ID；服务商要求时填写 Client Secret。

授权码及 OAuth token 使用 Supabase Vault 加密保存，只能由 `mail-api` 通过 service-role 专用函数访问。前端、GitHub、日志、普通用户的数据查询均不返回这些值。断开邮箱会清除保存的授权凭据，保留已同步邮件；要完全撤销服务商授权，请同时到 Google / Microsoft 的账号权限页撤销。

## OAuth 应用

统一回调 URL：`https://fubuikclgsgcxviymshr.supabase.co/functions/v1/mail-api`。

- Google：在 Google Cloud Console 创建 Web OAuth 客户端，设置上述回调，开放 `https://mail.google.com/` scope。个人测试应用需将自己的 Gmail 加入测试用户。该 scope 属于受限 Gmail 权限，公开给其他用户使用可能需要 Google 审核；测试状态的 refresh token 可能过期，届时重新授权。
- Microsoft：在 Entra App registrations 注册 Web 应用，选择适合的受支持账号类型，设置上述回调。使用 delegated `Mail.ReadWrite`、`Mail.Send` 与 `offline_access`，需要时由学校管理员批准。Outlook 接口使用 Microsoft Graph。
- OAuth state 有效期10分钟、单次使用，含 PKCE；callback 不接受任意返回网址。

参考：[Google Gmail OAuth](https://developers.google.com/workspace/gmail/imap/xoauth2-protocol)、[Google 应用密码](https://support.google.com/accounts/answer/185833)、[Microsoft 授权码流程](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow)、[Graph 邮件 API](https://learn.microsoft.com/en-us/graph/api/resources/mail-api-overview)。

## 功能

- 多邮箱统一收件箱，标签 / 时间 / 发件人 / 主题排列；单邮箱、模糊全文检索、发件人、类别、未读及星标筛选。
- 每5分钟服务器定时增量同步，网页打开时每分钟检查；同步有租约，避免并发重复导入。首次取最近30封 IMAP / 20封 Outlook，历史记录通过“加载更早邮件”逐批导入。IMAP UIDVALIDITY 和远端ID保存在同步状态中。
- DeepSeek 默认分类为机构通知、广告；用户可增删改类别及说明。分类结果云端持久化，手工分类优先。失败会记录原因，用户可显式重试。一个分类批次最多20封，不因打开邮件重新分类。
- 邮件左侧阅读，右侧发件人、联系人照片、机构、第二邮箱、收件邮箱和时间；翻译默认简体中文，按邮件和语言缓存。
- 写信 / 回复支持 CC、BCC、附件、云端草稿、签名及 DeepSeek 辅助。AI 结果需先确认填入，发送时再次展示收件人与正文。请求幂等，投递结果不明时阻止自动重复发送。
- 联系人按 AI 默认分组，可手动改姓名、照片、第二邮箱、电话和机构。头像为私有文件，通过短期签名URL显示。手动分组不自动覆盖。
- JSON / CSV 正文导出，EML 单封原件，MBOX 批量邮件与附件归档。CSV 转义潜在的公式单元格。
- 桌面、平板和手机布局；邮件HTML由 DOMPurify 清洗，并在带 CSP 的 sandbox iframe 内呈现；脚本、表单、外部图片默认阻止。

## 运行和部署

```powershell
pnpm install --frozen-lockfile
pnpm exec vite --config mail/vite.config.js
node --test mail/tests/*.test.js
pnpm build
```

生产构建包含文献系统与邮件网站；GitHub Actions 将 `dist/` 整体发布。数据库迁移与函数源代码分别位于 `supabase/migrations/*mail*` 和 `supabase/functions/mail-api/`。

后端沿用现有项目的 `LLM_API_KEY` / `DEEPSEEK_API_KEY`、`LLM_BASE_URL`、`LLM_MODEL` Secrets。邮箱密钥无需写入部署变量。所有邮件操作先通过 Auth `getUser` 验证账号，数据库有 RLS，private schema 与敏感 RPC 不向 anon / authenticated 开放。Cron 使用独立随机调度凭证，普通用户不能触发或获取它。

## 明确边界

- 尚未完成服务商授权前，不会显示虚构邮件，也不能声称真实收发已验证。邮箱账号授权必须由账号所有者在设置中完成。
- 通用 SMTP 采用465端口；仅支持587端口的学校邮箱当前需要邮件网关或采用 Microsoft 365 授权，不能承诺直连。Supabase 的网络、计划容量和运行时限制也影响吞吐。
- 单封接收原文最大25MB；发送最多10个附件、总计12MB；邮件过大或连接失败会报告错误。草稿只保存文字与地址，附件不跨编辑会话保存。
- 单次 AI 输入按用途有长度限制：分类每封最多6000字符，写信背景最多18000字符，翻译24000字符；翻译超限明确拒绝，避免把部分译文当作完整译文。
- 本站已发送副本会云端保存；通用 SMTP 服务商不一定自动写入远端“已发送”，可在本站查看。Outlook Graph 使用服务商的已发送副本。
- 当前对收件箱同步，新建联系人来自收件发件人。并非原邮箱所有历史文件夹镜像。IMAP 最近100封的已读/星标与服务商同步；归档、垃圾箱移动也会写回原邮箱，恢复可回到收件箱。
- 同步周期按服务器调度执行，遇服务商限流、项目休眠、网络故障或大批积压可能延迟；这不是长连接即时推送。请在设置中查看错误。
- 大模型分类和翻译会把相应文本发到你配置的模型服务，可在设置关闭新邮件自动分类。默认沿用后端模型额度，每用户每小时最多30个邮件AI请求。
