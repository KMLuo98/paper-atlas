import {normalizeStatus,safeStatusURL,apsURL,text} from './core.js';

// Official authorhub client app.108faa67.js uses this read-only tracker endpoint.
const ELSEVIER_TRACKER='https://tnlkuelk67.execute-api.us-east-1.amazonaws.com/tracker/';
export function publisherDate(value){
  const s=text(value,100).replace(/(\d{1,2})(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(\d{4})/i,'$1 $2 $3').replace(/(\d)(st|nd|rd|th)\b/gi,'$1');
  const n=Date.parse(s);
  return Number.isFinite(n)?new Date(n).toISOString():'';
}
async function readBody(response){
 const reader=response.body.getReader();let size=0;const chunks=[];
 try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>1500000)throw Error('状态页面过大');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
 const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}
 return new TextDecoder().decode(bytes);
}
export async function fetchElsevierStatus(url){
 const link=new URL(url);
 const uuid=link.searchParams.get('uuid')||link.pathname.split('/').filter(Boolean).pop();
 if(!/^[a-f0-9-]{20,64}$/i.test(uuid||''))return {events:[],notice:'状态链接中没有有效的 Elsevier 追踪编号'};
 const response=await fetch(ELSEVIER_TRACKER+encodeURIComponent(uuid),{headers:{Accept:'application/json'},signal:AbortSignal.timeout(12000)});
 if(!response.ok){await response.body?.cancel();return {events:[],notice:'Elsevier 暂未返回追踪数据，请稍后更新'};}
 const data=JSON.parse(await readBody(response));
 const activity=Number(data.LastUpdated);
 const date=Number.isFinite(activity)&&activity>0?new Date(activity*1000).toISOString():new Date().toISOString();
 const summary=data.ReviewSummary||{};
 const metrics={
  reviews_completed:summary.ReviewsCompleted??null,
  invitations_accepted:summary.ReviewInvitationsAccepted??null,
  invitations_sent:summary.ReviewInvitationsSent??null,
  last_review_activity:Number.isFinite(activity)&&activity>0?date:null,
  revision:data.LatestRevisionNumber??null
 };
 const status=data.Status===3||data.Status===23?'under_review':data.Status===4?'reviews_completed':typeof data.Status==='string'?normalizeStatus(data.Status):'unknown';
 return {
  events:status==='unknown'?[]:[{date,status,raw_status:status==='under_review'?'Under Review':'Required Reviews Complete'}],
  metrics,metric_date:date,status_text:status==='under_review'?'Under Review':status==='reviews_completed'?'Required Reviews Complete':'',
  number:text(data.PubdNumber,120),authors:[...new Set([data.FirstAuthor,data.CorrespondingAuthor].filter(value=>typeof value==='string'&&value.trim()).map(value=>text(value,300)))].join(', '),authors_partial:true,url,notice:'',fetched_at:new Date().toISOString()
 };
}
export function parsePublisherHistory(html,parseHTML){
 const {document}=parseHTML(html);
 document.querySelectorAll('script,style,nav,header,footer').forEach(node=>node.remove());
 const tables=[],events=[];
 for(const table of document.querySelectorAll('table')){
  const headers=[...table.querySelectorAll('tr th')].map(node=>text(node.textContent,150));
  const rows=[];
  for(const row of table.querySelectorAll('tr')){
   const cells=[...row.querySelectorAll('td')].map(node=>text(node.textContent.replace(/\s+/g,' '),2000));
   if(cells.length<2)continue;
   const dateIndex=cells.findIndex(value=>value.length<65&&/\d/.test(value)&&publisherDate(value));
   if(dateIndex<0)continue;
   rows.push(cells);
   const description=cells.filter((_,index)=>index!==dateIndex).filter(Boolean).join(' · ');
   if(description)events.push({date:publisherDate(cells[dateIndex]),raw_status:description,status:normalizeStatus(description)});
  }
  if(rows.length)tables.push({headers,rows:rows.slice(0,500)});
 }
 let status_text='';
 for(const label of document.querySelectorAll('dt,th,strong,b')){
  if(/^status\s*:??$/i.test(label.textContent.trim())){status_text=text(label.nextElementSibling?.textContent,200);break;}
 }
 if(!status_text)status_text=text(document.body?.textContent.match(/(?:^|\n)\s*Status:\s*([^\n]+)/i)?.[1],200);
 return {tables,events,status_text,login:Boolean(document.querySelector('input[type=password]'))||/login required|sign in to (?:view|access)/i.test(document.body?.textContent||'')};
}
export async function fetchStatusPage(item,parseHTML) {
 let url=item.publisher==='APS'?apsURL(item.number,item.lookup_author):safeStatusURL(item.tracking_url);
 if(!url)return {events:[],notice:item.publisher==='APS'?'APS 正式稿件号或查询作者姓氏尚未齐全':item.tracking_url?'该出版社暂不支持直接读取，请通过状态链接查看':'尚无可用的状态链接'};
 if(new URL(url).hostname==='track.authorhub.elsevier.com')return fetchElsevierStatus(url);
 const original=url;
 let response;
 for(let redirect=0;redirect<4;redirect++){
  response=await fetch(url,{redirect:'manual',headers:{'User-Agent':'MailAtlas/1.0 (manuscript status lookup)','Accept':'text/html'},signal:AbortSignal.timeout(12000)});
  if(response.status<300||response.status>=400)break;
  const next=safeStatusURL(new URL(response.headers.get('location')||'',url).href);
  await response.body?.cancel();
  if(!next)return {events:[],url:original,notice:'出版社跳转到登录页面，请通过状态链接查看'};
  url=next;
 }
 if(!response?.ok){await response?.body?.cancel();return {events:[],url:original,notice:'出版社暂未提供可读取的状态，请通过状态链接查看'};}
 if(!/text\/html/i.test(response.headers.get('content-type')||'')){await response.body?.cancel();return {events:[],url:original,notice:'状态页面需要在出版社网站查看'};}
 const parsed=parsePublisherHistory(await readBody(response),parseHTML);
 if(!parsed.events.length)return {events:[],url:original,notice:parsed.login?(item.publisher==='AIP Publishing'?'AIP 投稿系统需要登录后才能读取进度，已保留查询入口与邮件记录':'该页面需要出版社登录，已保留邮件中的状态'):'页面未返回可读取的 History，已保留邮件中的状态'};
 return {...parsed,url:original,notice:'',fetched_at:new Date().toISOString()};
}
