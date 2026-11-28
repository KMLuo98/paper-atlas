import {parseSearchRSS,publicURL,htmlText} from './web-evidence.js';
import {workDate} from './publication.js';
import {journalFull} from './journals.js';
import {enrichArxivResults} from './arxiv-search.js';
import {createTitleRelevance, EXACT_TITLE, normalize} from './core.js';

const pageSize = 10;
const crossrefBlockSize = 50;
const crossrefCache = new WeakMap();
const fields = 'DOI,URL,title,subtitle,author,container-title,published-online,published-print,published,issued,abstract,is-referenced-by-count,type';
const isPublishedArticle = type => type==='journal-article'||type==='proceedings-article';
const clean=(value,max=1000)=>htmlText(value).slice(0,max);
async function readBounded(response){
 if(!response.ok){await response.body?.cancel();throw Error(`检索服务暂不可用（${response.status}）`);}
 const reader=response.body.getReader(),chunks=[];let size=0;try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2*1024*1024)throw Error('检索结果过大，请缩小查询范围');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return new TextDecoder().decode(bytes);
}
export function crossrefResult(work){
 const doi=String(work.DOI||'').trim(),url=doi?'https://doi.org/'+encodeURIComponent(doi):publicURL(work.URL);if(!url)return null;
 const title=clean(work.title?.[0],1200),subtitle=clean(work.subtitle?.[0],1200);
 const fullTitle=subtitle && !(' '+normalize(title)).endsWith(' '+normalize(subtitle)) ? [title,subtitle].filter(Boolean).join(': ').slice(0,1200) : title;
 return {id:doi||url,title:fullTitle,url,doi,authors:(work.author||[]).slice(0,20).map(a=>clean([a.given,a.family].filter(Boolean).join(' ')||a.name||'',100)).filter(Boolean),journal:journalFull({journal:clean(work['container-title']?.[0]||'',300)}),date:workDate(work),excerpt:clean(work.abstract||'',1200),citation_count:Number.isInteger(work['is-referenced-by-count'])&&work['is-referenced-by-count']>=0?work['is-referenced-by-count']:null,source:'Crossref'};
}

function rankResults(records, scoreTitle) {
 return records.map(({result,type})=>({
  result,
  score:result?.title?scoreTitle(result.title):-1,
  published:Number(isPublishedArticle(type))
 })).sort((a,b)=>b.score-a.score||(a.score===EXACT_TITLE?b.published-a.published:0)).map(row=>row.result);
}

async function getCrossrefBlock(query, start, scoreTitle, fetcher, articlesOnly=false) {
 let cache=crossrefCache.get(fetcher);
 if(!cache){cache=new Map();crossrefCache.set(fetcher,cache);}
 const key=JSON.stringify([query,start,articlesOnly]);
 const cached=cache.get(key),now=Date.now();
 if(cached?.expires>now)return cached.request;
 const request=(async()=>{
  const url=new URL('https://api.crossref.org/works');
  url.search=new URLSearchParams({'query.bibliographic':query,select:fields,rows:String(crossrefBlockSize),offset:String(start)});
  if(articlesOnly)url.searchParams.set('filter','type:journal-article,type:proceedings-article');
  const response=await fetcher(url,{headers:{Accept:'application/json','User-Agent':'PaperAtlas/1.2 (+https://kmluo98.github.io/paper-atlas/)'},signal:AbortSignal.timeout(articlesOnly?7500:18000)});
  const {message}=JSON.parse(await readBounded(response));
  if(!Array.isArray(message?.items))throw Error('Crossref 返回的检索结果无效');
  const records=message.items.map(work=>({result:crossrefResult(work),type:work.type}));
  return {
   rows:rankResults(records,scoreTitle),
   hasExactArticle:records.some(({result,type})=>isPublishedArticle(type)&&scoreTitle(result?.title)===EXACT_TITLE),
   total:Number.isInteger(message['total-results'])?message['total-results']:null
  };
 })();
 cache.set(key,{request,expires:now+120000});
 if(cache.size>40)cache.delete(cache.keys().next().value);
 try{return await request;}catch(error){if(cache.get(key)?.request===request)cache.delete(key);throw error;}
}

async function findPromotedArticle(query, scoreTitle, fetcher) {
 const words=normalize(query);
 if(words.split(' ').length<3&&!/\p{Script=Han}{6}/u.test(words))return null;
 const head=await getCrossrefBlock(query,0,scoreTitle,fetcher);
 if(head.hasExactArticle)return null;
 try{
  // An exact article title may be buried under book and chapter matches.
  const {rows,hasExactArticle}=await getCrossrefBlock(query,0,scoreTitle,fetcher,true);
  if(!hasExactArticle)return null;
  const article=rows.find(row=>row?.doi&&scoreTitle(row.title)===EXACT_TITLE);
  return article&&!head.rows.some(row=>row?.id.toLowerCase()===article.id.toLowerCase())?article:null;
 }catch{return null;}
}

export async function literatureSearch({engine='crossref',query,offset=0,promotedDOI},fetcher=fetch){
 if(!['crossref','bing'].includes(engine))throw Error('请选择 Crossref 或 Bing 站内检索');
 if(typeof query!=='string'||!query.trim()||query.length>300)throw Error('请输入 1–300 个字符的检索词');
 if(!Number.isInteger(offset)||offset<0||offset>990)throw Error('检索分页范围无效');
 query=query.trim();
 const scoreTitle=createTitleRelevance(query);
 if(engine==='crossref'){
  const known=offset>0&&typeof promotedDOI==='string'&&(promotedDOI===''||/^10\.\d{4,9}\/\S{1,300}$/i.test(promotedDOI));
  const promoted=known?null:await findPromotedArticle(query,scoreTitle,fetcher);
  const promotedId=(known?promotedDOI:promoted?.doi||'').toLowerCase();
  const position=Math.max(0,offset-(promotedId?1:0));
  const pinned=offset===0&&promoted?[promoted]:[];
  const start=position-position%crossrefBlockSize,withinBlock=position-start;
  const {rows,total}=await getCrossrefBlock(query,start,scoreTitle,fetcher);
  const end=withinBlock+pageSize-pinned.length;
  const crossesBlock=end>crossrefBlockSize&&rows.length===crossrefBlockSize&&(total===null||total>start+crossrefBlockSize);
  const next=crossesBlock?await getCrossrefBlock(query,start+crossrefBlockSize,scoreTitle,fetcher):null;
  // Rank a fixed source block before slicing it so switching pages cannot shift ranks.
  const window=next?[...rows,...next.rows]:rows;
  // A promoted DOI takes one list position. Suppress its original occurrence on later pages.
  const results=[...pinned,...window.slice(withinBlock,end).filter(item=>item?.title&&item.id.toLowerCase()!==promotedId)];
  const hasMore=total===null?(end<window.length||end===window.length&&(next?.rows??rows).length===crossrefBlockSize):start+end<total;
  return {engine,query,source:'Crossref',...await enrichArxivResults(results,fetcher),total,offset,page_size:pageSize,has_more:offset<990&&hasMore,promoted_doi:promotedId};
 }
 const url=new URL('https://www.bing.com/search');url.searchParams.set('q',query);url.searchParams.set('format','rss');url.searchParams.set('first',String(offset+1));
 const response=await fetcher(url,{headers:{Accept:'application/rss+xml, application/xml, text/xml'},signal:AbortSignal.timeout(18000)}),xml=await readBounded(response);
 if(!/<rss\b/i.test(xml))throw Error('Bing 公开检索暂不可用，请切换 Crossref 或在原站重试');
 const results=rankResults(parseSearchRSS(xml).map(item=>({result:{id:item.url,title:item.title,url:item.url,excerpt:item.excerpt,authors:[],journal:'',date:null,citation_count:null,source:'Bing'}})),scoreTitle);
 return {engine,query,source:'Bing',...await enrichArxivResults(results,fetcher),total:null,offset,page_size:pageSize,has_more:false};
}
