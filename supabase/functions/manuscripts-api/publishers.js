import {normalizeStatus,safeStatusURL,apsURL,text} from './core.js';

export async function fetchStatusPage(item,parseHTML) {
  let url=item.publisher==='APS'?apsURL(item.number,item.lookup_author):safeStatusURL(item.tracking_url);
  if(!url)return {events:[],notice:item.publisher==='APS'?'请填写前三位作者之一的姓氏，以查询 APS History':item.tracking_url?'该出版社暂不支持直接读取，请通过状态链接查看':'尚无可用的状态链接'};
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
  const reader=response.body.getReader();let size=0;const chunks=[];
  try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>1500000)throw Error('状态页面过大');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
  const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}
  const {document}=parseHTML(new TextDecoder().decode(bytes));
  document.querySelectorAll('script,style,nav,header,footer').forEach(node=>node.remove());
  const events=[];
  for(const row of document.querySelectorAll('table tr')){
    const cells=[...row.querySelectorAll('td')].map(node=>node.textContent.trim()).filter(Boolean);
    if(cells.length<2)continue;
    const dateIndex=cells.findIndex(value=>value.length<65&&(/\d/.test(value))&&Number.isFinite(Date.parse(value)));
    if(dateIndex<0)continue;
    const description=cells.filter((_,i)=>i!==dateIndex).join(' · ');
    if(!description||/accession code|author.s last name/i.test(description))continue;
    events.push({date:new Date(Date.parse(cells[dateIndex])).toISOString(),raw_status:text(description,2000),status:normalizeStatus(description)});
  }
  if(!events.length)return {events:[],url:original,notice:/password|sign in|log in|login required/i.test(document.body.textContent)?'该页面需要出版社登录，已保留邮件中的状态':'页面未返回可读取的 History，已保留邮件中的状态'};
  return {events,url:original,notice:''};
}
