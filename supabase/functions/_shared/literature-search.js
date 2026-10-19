import {parseSearchRSS,publicURL,htmlText} from './web-evidence.js';
import {workDate} from './publication.js';
import {journalFull} from './journals.js';
const clean=(value,max=1000)=>htmlText(value).slice(0,max);
async function readBounded(response){
 if(!response.ok){await response.body?.cancel();throw Error(`检索服务暂不可用（${response.status}）`);}
 const reader=response.body.getReader(),chunks=[];let size=0;try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2*1024*1024)throw Error('检索结果过大，请缩小查询范围');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return new TextDecoder().decode(bytes);
}
export function crossrefResult(work){
 const doi=String(work.DOI||'').trim(),url=doi?'https://doi.org/'+encodeURIComponent(doi):publicURL(work.URL);if(!url)return null;
 return {id:doi||url,title:clean(work.title?.[0]||'',1200),url,doi,authors:(work.author||[]).slice(0,20).map(a=>clean([a.given,a.family].filter(Boolean).join(' ')||a.name||'',100)).filter(Boolean),journal:journalFull({journal:clean(work['container-title']?.[0]||'',300)}),date:workDate(work),excerpt:clean(work.abstract||'',1200),citation_count:Number.isInteger(work['is-referenced-by-count'])&&work['is-referenced-by-count']>=0?work['is-referenced-by-count']:null,source:'Crossref'};
}
export async function literatureSearch({engine='crossref',query,offset=0},fetcher=fetch){
 if(!['crossref','bing'].includes(engine))throw Error('请选择 Crossref 或 Bing 站内检索');
 if(typeof query!=='string'||!query.trim()||query.length>300)throw Error('请输入 1–300 个字符的检索词');
 if(!Number.isInteger(offset)||offset<0||offset>990)throw Error('检索分页范围无效');
 const pageSize=10;
 if(engine==='crossref'){
  const url=new URL('https://api.crossref.org/works');url.searchParams.set('query.bibliographic',query.trim());url.searchParams.set('rows',String(pageSize));url.searchParams.set('offset',String(offset));
  const response=await fetcher(url,{headers:{Accept:'application/json','User-Agent':'PaperAtlas/1.2 (+https://kmluo98.github.io/paper-atlas/)'},signal:AbortSignal.timeout(18000)}),body=JSON.parse(await readBounded(response));
  if(!Array.isArray(body.message?.items))throw Error('Crossref 返回的检索结果无效');
  const results=body.message.items.map(crossrefResult).filter(item=>item?.title),total=Number.isInteger(body.message['total-results'])?body.message['total-results']:null;
  return {engine,query:query.trim(),source:'Crossref',results,total,offset,page_size:pageSize,has_more:offset<990&&(total===null?body.message.items.length===pageSize:offset+pageSize<total)};
 }
 const url=new URL('https://www.bing.com/search');url.searchParams.set('q',query.trim());url.searchParams.set('format','rss');url.searchParams.set('first',String(offset+1));
 const response=await fetcher(url,{headers:{Accept:'application/rss+xml, application/xml, text/xml'},signal:AbortSignal.timeout(18000)}),xml=await readBounded(response);
 if(!/<rss\b/i.test(xml))throw Error('Bing 公开检索暂不可用，请切换 Crossref 或在原站重试');
 const results=parseSearchRSS(xml).map(item=>({id:item.url,title:item.title,url:item.url,excerpt:item.excerpt,authors:[],journal:'',date:null,citation_count:null,source:'Bing'}));
 return {engine,query:query.trim(),source:'Bing',results,total:null,offset,page_size:pageSize,has_more:false};
}
