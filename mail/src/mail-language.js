import {getLanguage,setLanguage,translateText} from '../../src/i18n.js';
import {scheduleToolbarFit} from './responsive-toolbars.js';
import './mail-language.css';

export const getMailLanguage=getLanguage;
const entries=`
为每个邮箱，保留独特的身份。|Give every account its own identity.
外观|Appearance
经典|Classic
液态玻璃|Liquid glass
还没有连接邮箱。添加后即可自动接收邮件。|No accounts connected. Add one to receive mail automatically.
机构名称随语言显示|Localize organization names
导出邮件|Export mail
暂无匹配联系人|No matching contacts
让你的邮箱，在这里相遇|Your accounts, together in one inbox
连接第一个邮箱|Connect your first account
QQ 邮箱|QQ Mail
学校邮箱|University mail
邮件工作台|Mail workspace
收件箱|Inbox
分类邮件|Categories
联系人|Contacts
投稿信息|Submissions
星标邮件|Starred
已发送|Sent
草稿箱|Drafts
归档|Archive
垃圾箱|Trash
垃圾邮件|Spam
设置与连接|Settings & accounts
我的邮箱|My accounts
所有邮箱|All accounts
写邮件|Compose
新建邮件|New message
私人工作空间|Private workspace
云端私密空间|Private cloud workspace
退出登录|Sign out
同步所有邮箱|Sync all accounts
同步邮件|Sync mail
智能分类|AI classification
导出|Export
全部邮件|All mail
所有类别|All categories
所有发件人|All senders
邮件类别|Category
发件人|Sender
隐藏广告|Hide ads
未读|Unread
列宽|Columns
刷新|Refresh
最新在前|Newest first
邮箱标签|Account
时间|Date
主题|Subject
收件人|To
加载更早邮件|Load older messages
模糊搜索邮件|Search mail
搜索主题、发件人或正文…|Search subject, sender or body…
搜索发件人|Search senders
搜索姓名或邮箱|Search name or email
没有匹配的发件人|No matching senders
定位到第一封未读邮件|Go to the first unread message
新建联系人|New contact
合并联系人|Merge contacts
智能分组|AI grouping
所有分组|All groups
编辑 / 新增 / 删除分组…|Edit / add / delete groups…
搜索姓名、邮箱或机构…|Search name, email or organization…
搜索联系人|Search contacts
列表视图|List view
卡片视图|Card view
往来邮件|Correspondence
返回联系人|Back to contacts
返回邮件列表|Back to messages
编辑联系人|Edit contact
删除联系人|Delete contact
保存联系人|Save contact
联系人姓名|Contact name
姓名|Name
第二姓名|Second name
机构（国家 · 学校）|Organization (country · institution)
电话|Phone
分组|Group
备注|Notes
未分类|Uncategorized
选择照片|Choose photo
移除照片|Remove photo
自动匹配|Find photo
自动匹配头像|Find avatar
自动匹配照片|Find photo
AI 匹配信息|Find contact details
添加邮箱|Add account
编辑分组|Edit groups
保存分组|Save groups
邮件信息|Message details
发件邮箱|From account
所属邮箱|Account
抄送|Cc
密送|Bcc
回复邮件|Reply
回复|Reply
归档或恢复|Archive or restore
移入垃圾箱或恢复|Move to Trash or restore
导出这封邮件|Export this message
其他邮箱|Other email addresses
联系人分组|Contact group
手动分类 · 已保存|Manual category · saved
AI 分类结果 · 已缓存|AI classification · cached
等待分类|Classification pending
重新用 AI 分类|Reclassify with AI
邮件翻译|Translation
翻译|Translate
读懂每一种语言里的来信|Read mail in your language
只翻译最新正文，跳过历史往来；长邮件自动分段，译文自动保存。|Translates the latest message, skips quoted history and saves the result.
翻译目标语言|Translation language
默认翻译语言|Default translation language
简体中文|Simplified Chinese
繁体中文|Traditional Chinese
日语|Japanese
韩语|Korean
法语|French
德语|German
西班牙语|Spanish
邮件签名|Signature
自动检查间隔（分钟）|Check interval (minutes)
学术版|Academic mode
开启投稿追踪|Enable submission tracking
个人资料|Profile
显示名称|Display name
用户名|Username
账号邮箱|Account email
保存个人资料|Save profile
已连接邮箱|Connected accounts
AI 与阅读偏好|AI & reading preferences
新邮件自动分类|Automatically classify new mail
新联系人自动匹配头像|Find avatars for new contacts
新联系人自动匹配机构|Find organizations for new contacts
机构名称跟随界面语言显示|Localize organization names
机构显示语言|Organization display language
跟随界面语言|Follow interface language
账户与导出|Account & export
修改密码|Change password
保存偏好|Save preferences
未连接邮箱|No connected accounts
邮箱地址|Email address
邮箱名称|Account label
标签颜色|Label color
授权码|App password
密码 / 授权码|Password / app password
保存并连接|Save & connect
保存连接|Save connection
测试连接|Test connection
断开连接|Disconnect
启用|Enable
暂停|Pause
删除|Delete
恢复|Restore
永久删除|Delete permanently
确认|Confirm
取消|Cancel
关闭|Close
完成|Done
添加|Add
保存|Save
返回|Back
标为已读|Mark read
标为未读|Mark unread
更改分类|Change category
选择全部|Select all
全选|Select all
附件|Attachments
保存草稿|Save draft
发送邮件|Send
确认发送邮件|Confirm sending
确认发送|Send
继续编辑|Keep editing
不保存|Discard
保存草稿？|Save draft?
退出写信前，可以将正文保存到草稿箱。|Save your message to Drafts before leaving.
输入邮件主题|Enter a subject
输入姓名或邮箱，多个地址用逗号分隔|Enter names or emails, separated by commas
输入姓名或邮箱（选填）|Enter names or emails (optional)
编辑后可保存为云端草稿|Edits can be saved to Drafts
草稿已保存|Draft saved
输入关键词|Enter keywords
生成回复|Generate reply
填入正文|Insert into message
使用此回复|Use this reply
重新生成|Regenerate
邮件正文|Message body
原邮件|Original message
复制为本站草稿|Copy to workspace Drafts
本站草稿|Workspace drafts
附件预览|Attachment preview
正在读取附件…|Loading attachment…
下载|Download
上一页|Previous
下一页|Next
切换星标|Toggle star
添加星标|Star
取消星标|Unstar
选择照片并裁剪|Choose & crop photo
状态更新|Status updated
出版社|Publisher
投稿期刊|Journal
标题|Title
作者|Authors
稿件号|Manuscript number
稿件状态|Status
状态链接|Status link
状态链接方式|Status link mode
自动匹配链接|Automatic matching
手动输入|Manual entry
状态历史|Status history
出版社信息|Publisher records
邮件信息|Email records
查看来源邮件|Open source email
查看来源|View source
更新状态|Update status
更新中|Updating
手动添加|Add manually
编辑稿件|Edit manuscript
保存稿件|Save manuscript
返回稿件|Back to submissions
进行中|In progress
已完成|Completed
累计投稿|Submissions
期刊|Journal
投稿统计|Submission statistics
编辑投稿统计|Edit submission statistics
编辑统计|Edit statistics
重置统计|Reset statistics
保存统计|Save statistics
添加期刊|Add journal
已归档|Archived
已归档稿件|Archived submissions
稿件垃圾箱|Submission Trash
返回进行中|Back to active
恢复追踪|Resume tracking
批量恢复|Restore multiple
恢复所选|Restore selected
选择期刊|Select journal
添加期刊…|Add journal…
归档所选|Archive selected
删除所选|Delete selected
取消选择|Cancel selection
搜索期刊、标题、作者或稿件号|Search journal, title, authors or manuscript number
搜索稿件|Search submissions
清除筛选|Clear filters
提交|Submitted
编辑处理|Editorial handling
外审|Peer review
接收|Accepted
邮件阶段记录|Email stage record
进度更新时间|Progress updated
累计|Total
重置当前期刊|Reset this journal
已重置该期刊统计|Journal statistics reset
暂无稿件|No submissions
点击更新状态从已同步邮件识别，或手动添加稿件|Update to discover submissions in synced mail, or add one manually.
识别或添加稿件后显示统计|Statistics appear after discovering or adding submissions.
正在检索邮件和查询稿件状态…|Checking mail and publisher status…
上次更新|Last updated
上次状态查询|Last publisher check
尚无审稿进度记录|No review activity recorded yet
APS 查询作者姓氏（前三位之一）|APS author surname (one of the first three authors)
恭喜发表|恭喜发表
投稿追踪暂时无法读写，请稍后重试|Submission tracking is temporarily unavailable. Please retry.
请先在设置中开启学术版|Enable academic mode in Settings first.
请先选择稿件|Select submissions first.
请填写期刊、标题和稿件号|Enter a journal, title and manuscript number.
暂无邮件|No messages
暂无已删除的联系人|No deleted contacts
未注明期刊|Journal not specified
标题待补充|Title not provided
作者待补充|Authors not provided
正在装入信封并提交邮件…|Preparing your message…
邮件已提交投递|Message submitted for delivery
把所有来信，收进一个信封|All your mail, in one place
欢迎来到你的邮件工作台|Welcome to your mail workspace
正在打开邮件工作台|Opening your mail workspace
打开导航|Open navigation
关闭导航|Close navigation
私人云端存储 · 每个账号独立隔离|Private cloud storage · separate workspace for each account
欢迎回来|Welcome back
建立你的邮件空间|Create your mail workspace
使用文献管理系统的账号，即可登录。|Sign in with your Paper Atlas account.
账号与 Paper Atlas 文献管理系统共用。|Your account is shared with Paper Atlas.
登录|Sign in
注册账号|Create account
用户名或邮箱|Username or email
密码|Password
自动登录|Remember me
忘记密码|Forgot password
进入收件箱|Open inbox
注册并进入|Create account & open inbox
`;
const dictionary=Object.fromEntries(entries.trim().split('\n').filter(Boolean).map(line=>{const index=line.indexOf('|');return [line.slice(0,index),line.slice(index+1)];}));
const userContent='[data-user-content],script,style,textarea,pre,code,.rich-mail-editor,.send-preview,.formatted-preview,.row-sender strong,.row-subject strong,.row-subject p,.contact-card h3,.contact-alt-name,.contact-organization,.contact-email-stack,.email-subject h1,.email-from strong,.sender-profile h3,.sender-profile p,.inbox-filter-options button:not([data-value=""]),.category-label,.contact-group,.translation-result,.photo-credit,.mail-check-preferences input,[data-language-control]';
export function mailText(value){
 if(getLanguage()!=='en')return value;
 const clean=value.trim();
 const direct=Object.hasOwn(dictionary,clean)?dictionary[clean]:'';
 if(direct)return value.replace(clean,direct);
 const translated=value
  .replace(/^(已选|全选本页邮件)\s*(\d+)\s*(封|篇)?$/g,(_,label,n)=>label==='已选'?'Selected '+n:'Select '+n+' messages')
  .replace(/^(状态更新|上次更新|上次状态查询)\s+(.+)$/g,(_,label,date)=>dictionary[label]+' '+date)
  .replace(/(\d{4})年(\d+)月(\d+)日/g,'$1-$2-$3')
  .replace(/^自动同步 · 每 (\d+) 分钟(?: · (\d+) 个邮箱)?$/,(_,n,m)=>'Auto sync · every '+n+' min'+(m?' · '+m+' accounts':''))
  .replace(/^(\d+) 封邮件$/, '$1 messages')
  .replace(/^确认(.+)？$/,(_,label)=>'Confirm '+mailText(label)+'?')
  .replace(/^所有邮箱 · (\d+) 封邮件$/, 'All accounts · $1 messages')
  .replace(/^(\d+) 位$/, '$1 contacts');
 return translated!==value?translated:translateText(value,'en');
}
export function languageControlHTML(){
 return '<span class="mail-language-switch" data-language-control role="group" aria-label="切换语言"><button type="button" data-language-choice="zh" lang="zh-CN" aria-pressed="'+(getLanguage()==='zh')+'" aria-label="切换到中文"><span class="language-full">中文</span><span class="language-short">中</span></button><button type="button" data-language-choice="en" lang="en" aria-pressed="'+(getLanguage()==='en')+'" aria-label="Switch to English">EN</button></span>';
}
let installed=false;
export function installMailLanguage(){
 if(installed)return;installed=true;
 const originals=new WeakMap(),attributes=new WeakMap();let pending=false;
 const update=()=>{
  pending=false;document.documentElement.lang=getLanguage()==='en'?'en':'zh-CN';
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
  for(let node;(node=walker.nextNode());){
   if(node.parentElement?.closest(userContent))continue;
   if(!originals.has(node))originals.set(node,node.data);
   const next=mailText(originals.get(node));if(node.data!==next)node.data=next;
  }
  for(const element of document.querySelectorAll('[placeholder],[title],[aria-label],[alt]')){
   if(element.closest('[data-user-content]'))continue;
   let values=attributes.get(element);if(!values){values={};attributes.set(element,values);}
   for(const name of ['placeholder','title','aria-label','alt']){
    if(!element.hasAttribute(name))continue;
    if(!(name in values))values[name]=element.getAttribute(name);
    const next=mailText(values[name]);if(element.getAttribute(name)!==next)element.setAttribute(name,next);
   }
  }
  for(const button of document.querySelectorAll('[data-language-choice]'))button.setAttribute('aria-pressed',String(button.dataset.languageChoice===getLanguage()));
  scheduleToolbarFit();
 };
 const observer=new MutationObserver(()=>{if(!pending){pending=true;queueMicrotask(update);}});
 observer.observe(document.body,{childList:true,subtree:true,characterData:true});
 document.addEventListener('click',event=>{const button=event.target.closest?.('[data-language-choice]');if(button)setLanguage(button.dataset.languageChoice);});
 document.addEventListener('pa-language-change',update);
 window.addEventListener('storage',event=>{if(event.key==='pa-language')setLanguage(event.newValue==='en'?'en':'zh');});
 update();
}
