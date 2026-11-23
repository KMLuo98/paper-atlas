export const STATUSES = {
  submitted:'Submitted', with_editor:'With editor', with_author:'With author(s)', under_review:'Under review', decision_sent:'Decision sent',
  reviews_completed:'Reviews completed', decision_pending:'Decision pending',
  minor_revision:'Minor revision', major_revision:'Major revision', revision_requested:'Revision requested',
  revised_submitted:'Revised submitted', accepted:'Accepted', rejected:'Rejected',
  withdrawn:'Withdrawn', transferred:'Transferred', production:'In production', copyediting:'Copyediting', proofs:'Proofs', in_press:'In press', publishing:'Publishing', published:'Published', unknown:'未更新'
};
export const POST_ACCEPTED = new Set(['accepted','production','copyediting','proofs','in_press','publishing','published']);
export const FINAL = new Set([...POST_ACCEPTED,'rejected','withdrawn','transferred']);
export const acceptedBefore=item=>POST_ACCEPTED.has(item.status)||(item.events||[]).some(event=>POST_ACCEPTED.has(event.status));
export const text = (value,max=1000) => String(value??'').trim().slice(0,max);
export function publisherOf(value) {
  const s=String(value||'');
  if (/aip(?:\.org| publishing)|peerx-press|ejpress|^aip$/i.test(s)) return 'AIP Publishing';
  if (/elsevier|editorialmanager|sciencedirect/i.test(s)) return 'Elsevier';
  if (/(?:^|[^a-z])aps(?:\.org|[^a-z]|$)|american physical society|physical review/i.test(s)) return 'APS';
  if (/nature|springer/i.test(s)) return 'Springer Nature';
  if (/wiley/i.test(s)) return 'Wiley';
  if (/taylor|tandf|taylorandfrancis/i.test(s)) return 'Taylor & Francis';
  if (/sagepub/i.test(s)) return 'Sage';
  return '';
}
const REVISION_NEEDED=/\b(?:further|additional)\s+(?:review\s+and\s+)?revisions?\s+(?:(?:may|might|will)\s+be|is|are)\s+(?:necessary|required)\b|\brevisions?\s+(?:is|are)\s+(?:required|requested)\b/i;
export function normalizeStatus(value) {
  const s=text(value,2000).toLowerCase();
  if (Object.hasOwn(STATUSES,s)) return s;
  if (/not accepted|unable to accept|declin(?:e|ed)|reject|拒稿/.test(s)) return 'rejected';
  if (/major revision|大修/.test(s)) return 'major_revision';
  if (/minor revision|小修/.test(s)) return 'minor_revision';
  if (REVISION_NEEDED.test(s)) return 'revision_requested';
  if (/revis(?:ed|ion).{0,25}(?:submit|receiv)|resubmi/.test(s)) return 'revised_submitted';
  if (/revis(?:e|ion).{0,20}(?:request|invit)|revise your|修改后/.test(s)) return 'revision_requested';
  if (/withdraw|撤稿/.test(s)) return 'withdrawn';
  if (/transfer(?:red)? to|已转投/.test(s)) return 'transferred';
  if (/published|已发表/.test(s)) return 'published';
  if (/copy.?edit|language edit|文字编辑/.test(s)) return 'copyediting';
  if (/proof|校样|校对/.test(s)) return 'proofs';
  if (/in press|article in press/.test(s)) return 'in_press';
  if (/publishing|publication in progress/.test(s)) return 'publishing';
  if (/production|制作中|排版/.test(s)) return 'production';
  // A reviewer accepting an invitation is not a publication decision.
  if (!/reviewer|referee|invitation/.test(s) && /accepted for publication|approved for publication|acceptance|decision.{0,10}accept|^accepted$|正式接收/.test(s)) return 'accepted';
  if (/required reviews completed|reviews? complet|评审完成/.test(s)) return 'reviews_completed';
  if (/decision in process|decision pending|editorial decision started/.test(s)) return 'decision_pending';
  if (/editorial decision and\/or referee comments sent|decision sent/.test(s)) return 'decision_sent';
  if (/with author|author action/.test(s)) return 'with_author';
  if (/under review|sent to (?:referee|reviewer)|out for review|外审/.test(s)) return 'under_review';
  if (/with editor|editor assigned|editorial assessment|acknowledgment sent|编辑处理/.test(s)) return 'with_editor';
  if (/submitted|submission received|received.{0,20}manuscript|稿件已收到/.test(s)) return 'submitted';
  return 'unknown';
}
export function canonicalNumber(number,publisher) {
  let result=text(number,120).toUpperCase().replace(/\s/g,'');
  if(publisher==='Elsevier'||publisher==='AIP Publishing') result=result.replace(/(?:[.\-_]?R\d*)$/i,'');
  else if(publisher!=='APS')result=result.replace(/(?:[.\-_]?R\d+)$/i,'');
  return result;
}
export function manuscriptKey(item) {
  const journal=canonicalJournal(item.journal),publisher=publisherForJournal(journal,item.publisher);
  return [text(publisher).toLowerCase(),journal.toLowerCase().replace(/[^\p{L}\p{N}]/gu,''),canonicalNumber(item.number,publisher)].join('|');
}
export function apsURL(number,author) {
  if(!/^[A-Z]{1,4}\d{3,8}$/i.test(number||'')||!text(author))return '';
  return 'https://authors.aps.org/Submissions/status?'+new URLSearchParams({accode:number,author:text(author,100)});
}
export function safeLink(value) {
  try {
    const u=new URL(value);
    if(u.protocol!=='https:'||u.username||u.password||u.port)return '';
    if(/(?:unsubscribe|decline|accept-invitation|confirm-author|approve|reset-password|logout|delete)/i.test(u.pathname+u.search))return '';
    return u.href;
  }catch{return '';}
}
export function safeStatusURL(value) {
  try {
    const u=new URL(value);
    if(u.protocol!=='https:'||u.username||u.password||u.port)return '';
    const hosts=['aps.org','elsevier.com','elsevier.cn','editorialmanager.com','nature.com','springernature.com','springer.com','manuscriptcentral.com','sciencemag.org','wiley.com','tandfonline.com','sagepub.com','aip.org','iop.org','pnas.org','pnascentral.org','science.org','acs.org','rsc.org','frontiersin.org','mdpi.com','oup.com','cambridge.org','peerx-press.org','ejpress.com'];
    if(!hosts.some(host=>u.hostname===host||u.hostname.endsWith('.'+host)))return '';
    if(/(?:unsubscribe|decline|accept-invitation|confirm-author|approve|reset-password|logout|delete)/i.test(u.pathname+u.search))return '';
    return u.href;
  }catch{return '';}
}
export function automaticTrackingLink(value,records=[]){
  const publisher=publisherForJournal(value.journal,publisherOf(value.publisher)||value.publisher);
  const key=manuscriptKey({...value,publisher});
  const matching=records.filter(item=>manuscriptKey(item)===key||(item.number_history||[]).some(number=>manuscriptKey({...item,number})===key));
  if(publisher==='APS'){
    const generated=apsURL(value.number,value.lookup_author||matching.find(item=>item.lookup_author)?.lookup_author);
    if(generated)return generated;
  }
  return matching.filter(item=>item.tracking_mode!=='manual'&&(item.tracking_mode==='auto'||!item.manual_fields?.includes('tracking_url')))
    .map(item=>safeLink(item.tracking_url)).find(Boolean)||'';
}
export function trackingLinkFromText(body){
  const s=String(body||'');
  const links=[...s.matchAll(/https:\/\/[^\s<>"']+/g)].map(m=>safeLink(m[0].replace(/[).,]+$/,''))).filter(Boolean);
  const score=url=>/track\.authorhub\.elsevier\.com/i.test(url)?100:/authors\.aps\.org\/Submissions\/status/i.test(url)?90:/(peerx-press\.org|ejpress\.com)/i.test(url)?80:/editorialmanager\.com/i.test(url)?60:/track|\/status|submission|manuscript/i.test(url)&&!/(support|service)\./i.test(url)?30:0;
  const explicit=s.match(/Check Manuscript Status[\s\S]{0,180}?(https:\/\/[^\s<>"']+)/i)?.[1];
  return (explicit&&safeLink(explicit.replace(/[).,]+$/,'')))||links.filter(url=>score(url)>0).sort((a,b)=>score(b)-score(a))[0]||'';
}
export function candidateMail(mail) {
  const value=[mail.from_email,mail.from_name,mail.subject,mail.text_body?.slice(0,2500)].join(' ');
  return /manuscript|稿件|投稿|submission|physical review|decision on|editorial decision|decision letter|revised article|editorialmanager/i.test(value) &&
    (/manuscript.{0,25}(?:number|id|#)|稿件[编号号]|[A-Z]+-D-\d{2}-\d+|\b[A-Z]{1,3}\d{4,7}\b/i.test(value)||Boolean(publisherOf(mail.from_email+' '+mail.from_name)));
}
export function ruleExtract(mail,body) {
  const s=String(body||'');
  if(/invit(?:e|ation).{0,30}(?:review|referee)|review invitation/i.test(mail.subject))return null;
  const publisher=publisherOf(mail.from_email+' '+mail.from_name+' '+s.slice(0,1000));
  const number=(s.match(/(?:manuscript\s*(?:number|id|no\.?|#)|稿件[编号号]+|accession\s*(?:code|number))\s*[:：#]?\s*([A-Z][A-Z0-9._\-/]{3,90})/i)||s.match(/\b([A-Z]+-D-\d{2}-\d{3,8}(?:R\d+)?)\b/))?.[1]||
    (publisher==='APS'?[mail.subject,s].join(' ').match(/\b([A-Z]{1,3}\d{4,7})\b/)?.[1]:'');
  if(!number)return null;
  const journal=(s.match(/^(?:journal|journal name|期刊)\s*[:：]\s*(.+)$/im)?.[1]||
    [mail.subject,s.slice(0,5000)].join('\n').match(/\b(Physical Review (?:Letters|Research|[ABCDEFX])|Nature(?: Communications| Physics| Materials| Astronomy| Chemistry| Methods| Nanotechnology| Photonics| Energy| Medicine)?|Scientific Reports|Chaos, Solitons (?:&|and) Fractals|Physics Letters [AB]|Physica [ABCDE])\b/i)?.[1]||
    (publisher==='AIP Publishing'&&/^CHA\d{2}-(?:AR|ER)-/i.test(number)&&/\bChaos\b/i.test(mail.subject||'')?'Chaos':''));
  const title=s.match(/^(?:manuscript\s+title|article\s+title|title|标题)\s*[:：]\s*["“]?(.+?)["”]?\s*$/im)?.[1]||s.match(/^\s*["“]([^"”\n]{8,1000})["”]\s*$/m)?.[1]||'';
  const authors=s.match(/^(?:(?:co[- ]?|all\s+)?authors?|author\s+list|作者)\s*[:：]\s*(.+)$/im)?.[1]||'';
  const statusLine=s.match(/^(?:(?:current|manuscript)\s+)?status\s*[:：]\s*(.+)$/im)?.[1];
  const editorial=s.split(/\n\s*(?:reviewer(?:\s*#?\d+)?\s*(?:comments|evaluations|reports?)|referee(?:\s*#?\d+)?\s*(?:comments|reports?)|sincerely|best regards|on .+ wrote:)(?=[\s,:]|$)/i)[0].slice(0,10000);
  const revisionQuote=/decision\s+(?:letter|on)|editorial decision/i.test(mail.subject||'')&&/revised manuscript.{0,40}due|submit your revision|resubmission should include/i.test(editorial)?editorial.match(REVISION_NEEDED)?.[0]:'';
  const subjectStatus=normalizeStatus(statusLine||mail.subject);
  const status=revisionQuote&&!['major_revision','minor_revision','rejected','accepted'].includes(subjectStatus)?'revision_requested':subjectStatus;
  const tracking_url=trackingLinkFromText(s);
  return {publisher,journal,title,authors,number,status,raw_status:revisionQuote||statusLine||text(mail.subject,300),tracking_url,editorial_decision:Boolean(revisionQuote)};
}
export function applyObservation(data,observation) {
  const observedNumber=observation.number;
  observation={...observation,journal:canonicalJournal(observation.journal),publisher:publisherForJournal(observation.journal,observation.publisher)};
  const key=manuscriptKey(observation);
  if((data.tombstones||[]).includes(key))return;
  let item=data.manuscripts.find(item=>manuscriptKey(item)===key||((item.number_history||[]).some(number=>manuscriptKey({...item,number})===key)));
  if(!item&&observation.publisher==='APS')item=data.manuscripts.find(item=>sameAPSSubmission(item,observation));
  if(item&&(item.archived_at||item.deleted_at))return;
  if(!item) {
    item={id:crypto.randomUUID(),key,publisher:'',journal:'',title:'',authors:'',number:'',status:'unknown',events:[],created_at:observation.date,manual_fields:[]};
    data.manuscripts.push(item);
  }
  item.number_history=[...new Set([...(item.number_history||[]),item.number,observation.number].filter(Boolean))];
  if(item.publisher==='APS'&&temporaryAPSNumber(item.number)&&!temporaryAPSNumber(observation.number))item.number=observation.number;
  if(item.publisher==='APS'&&!temporaryAPSNumber(item.number)&&temporaryAPSNumber(observation.number))observation={...observation,number:item.number,tracking_url:item.tracking_url};
  if(revisionNumber(item.number)>revisionNumber(observation.number)&&canonicalNumber(item.number,item.publisher)===canonicalNumber(observation.number,item.publisher))observation={...observation,number:item.number};
  for(const field of ['publisher','journal','title','authors','number','tracking_url','lookup_author']) {
    if(field==='authors'&&observation.source==='website')continue;
    if(observation[field]&&!(item.manual_fields||[]).includes(field)&&!(field==='tracking_url'&&item.tracking_mode==='manual')&&(!item[field]||(field==='authors'&&item.authors_partial)||Date.parse(observation.date)>=Date.parse(item.status_at||0))){item[field]=observation[field];if(field==='authors'){item.authors_partial=false;item.authors_source=observation.source;}}
  }
  item.key=manuscriptKey(item);
  if(item.publisher==='APS'&&item.lookup_author&&!temporaryAPSNumber(item.number)&&item.tracking_mode!=='manual'&&!item.manual_fields?.includes('tracking_url'))item.tracking_url=apsURL(item.number,item.lookup_author);
  const sameMail=event=>observation.source==='email'&&event.source==='email'&&event.source_id===observation.source_id&&Date.parse(event.date)===Date.parse(observation.date);
  const unresolved=observation.status!=='unknown'&&item.events.find(event=>sameMail(event)&&event.status==='unknown');
  if(unresolved)Object.assign(unresolved,{status:observation.status,raw_status:observation.raw_status||STATUSES[observation.status],reprocessed_at:new Date().toISOString()});
  const duplicate=item.events.some(event=>(sameMail(event)&&observation.status==='unknown'&&event.status!=='unknown')||(event.source_id===observation.source_id&&event.status===observation.status&&Date.parse(event.date)===Date.parse(observation.date)&&event.raw_status===(observation.raw_status||STATUSES[observation.status])));
  if(!unresolved&&!duplicate)item.events.push({id:crypto.randomUUID(),date:observation.date,status:observation.status,raw_status:observation.raw_status||STATUSES[observation.status],source:observation.source,source_id:observation.source_id,message_ref:observation.message_ref||'',source_url:observation.source_url||'',number:observedNumber||item.number});
  item.events.sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
  if(observation.metrics)recordMetrics(item,observation.metrics,observation.date,observation.source_url||observation.tracking_url,{source:observation.source,source_id:observation.source_id,status:observation.status});
  // Unknown observations remain visible in the history without erasing a known decision.
  resolveManuscriptStatus(item);
  item.updated_at=new Date().toISOString();
  return item;
}
export const MAIL_EXTRACTION_VERSION=1;
export function unknownMailRetries(data,limit=3){
 const pending=new Map();
 for(const item of data.manuscripts||[]){
  if(item.archived_at||item.deleted_at)continue;
  for(const event of item.events||[]){
   if(event.source!=='email'||event.status!=='unknown'||!event.message_ref||item.extraction_retries?.[event.source_id]?.version===MAIL_EXTRACTION_VERSION)continue;
   if(item.events.some(other=>other.source==='email'&&other.source_id===event.source_id&&other.status!=='unknown'))continue;
   pending.set(event.message_ref,{item_id:item.id,message_ref:event.message_ref,source_id:event.source_id,date:event.date});
  }
 }
 return [...pending.values()].sort((a,b)=>(Date.parse(b.date)||0)-(Date.parse(a.date)||0)).slice(0,limit);
}
export function rawStatistics(data) {
  const stats=Object.create(null);
  for(const item of data.manuscripts){
    const journal=canonicalJournal(item.journal)||'未注明期刊';
    const row=stats[journal]??={total:0,active:0,accepted:0,rejected:0,completed:0};
    row.total++;
    if(POST_ACCEPTED.has(item.status))row.accepted++;
    if(item.status==='rejected')row.rejected++;
    if(FINAL.has(item.status))row.completed++;
    else row.active++;
  }
  return stats;
}
export function statistics(data) {
  const raw=rawStatistics(data);
  for(const journal of Object.keys(data.stats_offsets||{}))raw[journal]??={total:0,active:0,accepted:0,rejected:0,completed:0};
  return Object.entries(raw).map(([journal,row])=>({journal,...Object.fromEntries(Object.entries(row).map(([key,value])=>[key,Math.max(0,value+(data.stats_offsets?.[journal]?.[key]||0))]))}));
}
export function resetJournalStatistics(data,value){
  const journal=canonicalJournal(value);
  if(!journal||(!Object.hasOwn(rawStatistics(data),journal)&&!Object.hasOwn(data.stats_offsets||{},journal)))throw Error('请选择要重置的已保存期刊');
  data.stats_offsets={...data.stats_offsets,[journal]:{total:0,active:0,completed:0,accepted:0,rejected:0}};
}

export function publisherForJournal(journal,publisher='') {
  if(/^chaos(?::|$)/i.test(text(journal))&&!/solitons/i.test(journal))return 'AIP Publishing';
  return publisherOf(publisher)||publisher;
}
export function canonicalJournal(value) {
  const name=text(value,200),key=name.toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
  if(['chaos','chaosaninterdisciplinaryjournalofnonlinearscience'].includes(key))return 'Chaos: An Interdisciplinary Journal of Nonlinear Science';
  if(/^chaossolitons(?:and)?fractals/.test(key))return 'Chaos, Solitons & Fractals';
  if(['physicad','physicadnonlinearphenomena'].includes(key))return 'Physica D: Nonlinear Phenomena';
  return name;
}
const revisionNumber=number=>Number(String(number||'').match(/\d[.\-_]?R(\d*)$/i)?.[1]||(/\d[.\-_]?R$/i.test(number||'')?1:0));
export const temporaryAPSNumber=number=>/^es\d{4}[a-z]{3}\d{1,2}_\d+$/i.test(text(number));
const fingerprint=value=>text(value,2000).normalize('NFKD').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
export function sameAPSSubmission(a,b) {
  return a.publisher==='APS'&&b.publisher==='APS'&&
    temporaryAPSNumber(a.number)!==temporaryAPSNumber(b.number)&&
    fingerprint(a.journal)===fingerprint(b.journal)&&fingerprint(a.title).length>=16&&fingerprint(a.title)===fingerprint(b.title);
}
export function reconcileManuscripts(data) {
  data.stats_offsets=Object.entries(data.stats_offsets||{}).reduce((all,[journal,offsets])=>{
    const key=canonicalJournal(journal),previous=all[key]||{};
    all[key]=Object.fromEntries(['total','active','completed','accepted','rejected'].map(field=>[field,(previous[field]||0)+(offsets[field]||0)]));return all;
  },Object.create(null));
  data.tombstones=[...new Set((data.tombstones||[]).flatMap(key=>{const [publisher,journal,number]=key.split('|');return [key,manuscriptKey({publisher,journal,number})];}))];
  for(const item of data.manuscripts){item.journal=canonicalJournal(item.journal);item.publisher=publisherForJournal(item.journal,item.publisher);item.key=manuscriptKey(item);}
  const groups=new Map();
  for(const item of data.manuscripts){const entries=groups.get(item.key)||[];entries.push(item);groups.set(item.key,entries);}
  data.manuscripts=[...groups.values()].map(entries=>{
    if(entries.length===1)return entries[0];
    const sorted=[...entries].sort((a,b)=>Date.parse(b.status_at||b.updated_at||b.created_at)-Date.parse(a.status_at||a.updated_at||a.created_at));
    const target=[...entries].sort((a,b)=>(b.manual_fields?.length||0)-(a.manual_fields?.length||0)||sorted.indexOf(a)-sorted.indexOf(b))[0];
    target.merged_ids=[...new Set(entries.flatMap(item=>[item.id,...(item.merged_ids||[])]))].filter(id=>id!==target.id);
    for(const field of ['title','authors','lookup_author','tracking_url']){
      const manual=[...entries].filter(item=>item[field]&&item.manual_fields?.includes(field)).sort((a,b)=>Date.parse(b.updated_at)-Date.parse(a.updated_at))[0];
      const source=manual||sorted.find(item=>item[field]&&(field!=='authors'||!item.authors_partial))||sorted.find(item=>item[field]);
      if(source){target[field]=source[field];if(field==='authors'){target.authors_partial=Boolean(source.authors_partial);target.authors_source=source.authors_source;}if(field==='tracking_url'&&(source.tracking_mode==='manual'||source.manual_fields?.includes(field)))target.tracking_mode='manual';}
    }
    target.manual_fields=[...new Set(entries.flatMap(item=>item.manual_fields||[]))];
    target.number_history=[...new Set(entries.flatMap(item=>[item.number,...(item.number_history||[])]).filter(Boolean))];
    target.number=[...target.number_history].sort((a,b)=>revisionNumber(b)-revisionNumber(a))[0];
    const events=new Map();
    for(const event of entries.flatMap(item=>item.events||[])){
      const key=[event.source,event.source_id,event.date,event.status].join('|'),old=events.get(key);
      if(!old||String(event.raw_status||'').length>String(old.raw_status||'').length)events.set(key,event);
    }
    target.events=[...events.values()].sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
    const latest=[...target.events].reverse().find(event=>event.status!=='unknown');
    if(latest){target.status=latest.status;target.status_at=latest.date;}
    target.created_at=entries.map(item=>item.created_at).filter(Boolean).sort((a,b)=>Date.parse(a)-Date.parse(b))[0];
    target.updated_at=entries.map(item=>item.updated_at||item.created_at).filter(Boolean).sort((a,b)=>Date.parse(b)-Date.parse(a))[0];
    target.archived_at=entries.find(item=>item.archived_at)?.archived_at||null;
    target.deleted_at=entries.find(item=>item.deleted_at)?.deleted_at||null;
    target.publisher_history=sorted.find(item=>item.publisher_history)?.publisher_history;
    const metrics=entries.flatMap(item=>item.metric_history||[]);target.metric_history=[];
    for(const row of metrics)recordMetrics(target,row.metrics,row.metric_date||row.date,row.source_url,{...row,observed_at:row.date});
    target.key=manuscriptKey(target);
    return target;
  });
  const temporary=data.manuscripts.filter(item=>item.publisher==='APS'&&temporaryAPSNumber(item.number));
  for(const old of temporary){
    const target=data.manuscripts.find(item=>item.id!==old.id&&sameAPSSubmission(item,old));
    if(!target)continue;
    target.number_history=[...new Set([...(target.number_history||[]),...(old.number_history||[]),old.number,target.number])];
    for(const event of old.events||[]){
      if(!target.events.some(e=>e.source_id===event.source_id&&e.date===event.date&&e.raw_status===event.raw_status))target.events.push(event);
    }
    target.events.sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
    target.created_at=new Date(Math.min(Date.parse(target.created_at),Date.parse(old.created_at))).toISOString();
    target.archived_at=target.archived_at||old.archived_at;target.deleted_at=target.deleted_at||old.deleted_at;
    for(const field of ['title','authors','lookup_author'])if(!target[field])target[field]=old[field]||'';
    if(target.lookup_author&&target.tracking_mode!=='manual'&&!target.manual_fields?.includes('tracking_url'))target.tracking_url=apsURL(target.number,target.lookup_author);
    data.manuscripts=data.manuscripts.filter(item=>item.id!==old.id);
  }
  return data;
}
export function applyPublisherMetadata(item,result) {
  if(item.publisher==='Elsevier'&&!result.number)return;
  if(result.number&&canonicalNumber(result.number,item.publisher)!==canonicalNumber(item.number,item.publisher))return;
  if(result.submitted_at&&Number.isFinite(Date.parse(result.submitted_at))&&(!item.submitted_at||Date.parse(result.submitted_at)<Date.parse(item.submitted_at))){item.submitted_at=result.submitted_at;}
  if(result.authors&&!(item.manual_fields||[]).includes('authors')&&(!item.authors||item.authors_partial||item.authors_source==='website')){
    item.authors=result.authors;item.authors_partial=Boolean(result.authors_partial);item.authors_source='publisher';
  }
}

const EXPLICIT_DECISIONS=new Set(['minor_revision','major_revision','revision_requested','rejected','withdrawn','transferred',...POST_ACCEPTED]);
const GENERIC_DECISIONS=new Set(['with_author','decision_sent','decision_pending']);
const FORWARD_STAGES=['submitted','with_editor','under_review','reviews_completed','decision_pending'];
function canReplaceStatus(previous,next){
  if(!previous||next.source==='manual')return true;
  if(EXPLICIT_DECISIONS.has(previous.status)&&GENERIC_DECISIONS.has(next.status))return false;
  // An old review page can remain active after a decision email. A new round
  // starts with an actual revised-submission record, not a later query time.
  if(next.source==='website'&&EXPLICIT_DECISIONS.has(previous.status)&&!EXPLICIT_DECISIONS.has(next.status)&&next.status!=='revised_submitted'&&next.round<=previous.round)return false;
  if(POST_ACCEPTED.has(previous.status)&&!POST_ACCEPTED.has(next.status)&&!['rejected','withdrawn','transferred'].includes(next.status))return false;
  return true;
}

export function resolveManuscriptStatus(item){
  const specific=status=>EXPLICIT_DECISIONS.has(status)?2:GENERIC_DECISIONS.has(status)?0:1;
  const priority=event=>(event.source==='manual'?10:0)+specific(event.status)+(event.source==='email'?.1:0);
  const candidates=submissionStages(item).filter(event=>Object.hasOwn(STATUSES,event.status)&&event.status!=='unknown'&&Number.isFinite(progressTime(event.date)));
  const snapshot=item.publisher_status;
  if(Object.hasOwn(STATUSES,snapshot?.status)&&snapshot.status!=='unknown'&&Number.isFinite(progressTime(snapshot.date)))candidates.push({...snapshot,source:'website',round:snapshot.round||1});
  candidates.sort((a,b)=>progressTime(a.date)-progressTime(b.date)||priority(a)-priority(b));
  let latest;
  for(const event of candidates)if(canReplaceStatus(latest,event))latest=event;
  // Undated portal text is useful for a clear forward transition, but cannot
  // overturn a dated decision or turn the time of checking into progress.
  if(Object.hasOwn(STATUSES,snapshot?.status)&&snapshot.status!=='unknown'&&!Number.isFinite(progressTime(snapshot.date))){
    const from=FORWARD_STAGES.indexOf(latest?.status),to=FORWARD_STAGES.indexOf(snapshot.status);
    if(!latest||(latest.source!=='manual'&&((from>=0&&to>from)||(!EXPLICIT_DECISIONS.has(latest.status)&&EXPLICIT_DECISIONS.has(snapshot.status)))))latest={...snapshot,source:'website',date:'',round:snapshot.round||1};
  }
  if(latest){item.status=latest.status;item.status_at=latest.date;item.status_source=latest.source;}
  return item;
}

export function applyPublisherStatus(item,result){
  const status=normalizeStatus(result.current_status||result.status_text||'');
  if(status!=='unknown'){
    const dates=[result.status_updated_at,...(result.events||[]).filter(event=>normalizeStatus(event.status||event.raw_status)===status).map(event=>event.date)];
    if(result.metrics&&normalizeStatus(result.status_text)===status)dates.push(result.metric_date);
    const at=Math.max(...dates.map(progressTime).filter(Number.isFinite));
    const revision=metricRevision(result.metrics?.revision);
    item.publisher_status={status,date:Number.isFinite(at)?new Date(at).toISOString():'',round:revision===null?submissionRound(item):revision+1,source_url:result.url||''};
  }
  return resolveManuscriptStatus(item);
}
export function bulkManuscriptAction(data,action,ids,scope='') {
  const selected=[...new Set(Array.isArray(ids)?ids:[])].map(id=>data.manuscripts.find(item=>item.id===id));
  if(!selected.length)throw Error('请先选择稿件');
  if(!['archive','trash','restore'].includes(action))throw Error('未知操作');
  if(selected.some(item=>!item||(action==='restore'?(!item.archived_at&&!item.deleted_at)||(scope==='archived'&&Boolean(item.deleted_at))||(scope==='trash'&&!item.deleted_at):item.archived_at||item.deleted_at)))throw Error('所选稿件状态已变化，请刷新后重试');
  for(const item of selected){
    if(action==='restore'){item.archived_at=null;item.deleted_at=null;item.last_checked_day='';}
    else item[action==='archive'?'archived_at':'deleted_at']=new Date().toISOString();
  }
  if(action==='restore'){data.cursor=null;data.last_day='';}
}
export function extractReviewMetrics(body) {
  const metrics={};
  for(const [key,label] of Object.entries({reviews_completed:'Reviews completed',invitations_accepted:'Review invitations accepted',invitations_sent:'Review invitations sent',last_review_activity:'Last review activity'})){
    const match=String(body).match(new RegExp(label+'\\s*[:：]\\s*([^\\n\\r]+)','i'));
    if(match)metrics[key]=text(match[1],150);
  }
  return Object.keys(metrics).length?metrics:null;
}
export function recordMetrics(item,metrics,date,url='',observation={}) {
  const value={...metrics,revision:metrics.revision??null},observed=observation.observed_at||date;
  item.metric_history??=[];
  if(item.metric_history.some(row=>row.date===observed&&row.source_url===url&&JSON.stringify(row.metrics)===JSON.stringify(value)))return;
  const candidate={date:observed,metric_date:date,metrics:value,source_url:url,source:observation.source||'website',source_id:observation.source_id||'',status:observation.status||''};
  const previous=item.metric_history.at(-1);
  if(previous&&reviewSnapshotRows(item,[previous,candidate]).length===1){
    if((!previous.status||previous.status==='unknown')&&candidate.status)previous.status=candidate.status;
    return;
  }
  item.metric_history.push(candidate);
  item.metric_history.sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
}

function eventRevision(number,publisher) {
  const value=String(number||'');
  if(publisher==='APS')return null;
  // R inside an accession code (EXR1134) has no revision meaning.
  const suffix=value.match(/^(?:[A-Z]+-D-\d{2}-\d+|CHA\d{2}-(?:AR|ER)-\d+)[._-]?R(\d*)$/i);
  return suffix?Number(suffix[1]||1):null;
}
function metricRevision(value) {
  return value!==null&&value!==undefined&&value!==''&&Number.isInteger(Number(value))&&Number(value)>=0?Number(value):null;
}
export function submissionStages(item) {
  let round=1,pending=false,revised=false;
  return [...(item.events||[])].sort((a,b)=>Date.parse(a.date)-Date.parse(b.date)).map(event=>{
    const revision=eventRevision(event.number,item.publisher);
    if(revision!==null&&event.status!=='unknown')round=Math.max(round,revision+1);
    if(['minor_revision','major_revision','revision_requested'].includes(event.status))pending=true;
    if(event.status==='revised_submitted'){
      if(revision!==null&&revision>0)round=Math.max(round,revision+1);
      else if(pending||!revised)round++;
      pending=false;revised=true;
    }
    return {...event,round};
  });
}
export function submissionRound(item) {
  const explicit=Number.isInteger(Number(item.round))&&Number(item.round)>0?Number(item.round):1;
  const metrics=(item.metric_history||[]).map(row=>metricRevision(row.metrics.revision)).filter(value=>value!==null).map(value=>value+1);
  return Math.max(1,explicit,...submissionStages(item).map(event=>event.round),...metrics);
}
function reviewSnapshotRows(item,snapshots) {
  const stages=submissionStages(item);
  const rows=[];
  for(const row of [...snapshots].sort((a,b)=>Date.parse(a.date)-Date.parse(b.date))){
    const revision=metricRevision(row.metrics.revision);
    const at=row.metric_date||row.date;
    const inferred=[...stages].reverse().find(event=>Date.parse(event.date)<=Date.parse(at))?.round||1;
    const round=revision===null?inferred:revision+1;
    const normalized=normalizeStatus(row.status);
    const status=normalized==='unknown'?'':normalized;
    const signature=JSON.stringify([round,...['reviews_completed','invitations_accepted','invitations_sent'].map(key=>row.metrics[key]==null?'':String(row.metrics[key]).trim()),Number.isFinite(progressTime(row.metrics.last_review_activity))?new Date(progressTime(row.metrics.last_review_activity)).toISOString():String(row.metrics.last_review_activity||'').trim()]);
    const progressDate=[row.metric_date,row.metrics.last_review_activity,...(!Object.hasOwn(row,'metric_date')?[row.date]:[])].find(value=>Number.isFinite(progressTime(value)))||'';
    const previous=rows.at(-1);
    if(previous&&previous.signature===signature&&(!previous.status||!status||previous.status===status)){
      previous.status=status||previous.status;
      if(Date.parse(progressDate)>Date.parse(previous.date)||!previous.date)previous.date=progressDate;
    }else rows.push({...row,kind:'metrics',round,status,date:progressDate,signature});
  }
  return rows;
}
export function reviewHistory(item) {
  const stages=submissionStages(item);
  const rows=reviewSnapshotRows(item,item.metric_history||[]);
  const available=new Set(rows.map(row=>row.round));
  const seen=new Set();
  for(const event of stages){
    if(event.source!=='email'||event.status==='unknown'||available.has(event.round))continue;
    const key=[event.source_id,event.date,event.status].join('|');if(seen.has(key))continue;seen.add(key);
    rows.push({...event,kind:'email'});
  }
  return rows.sort((a,b)=>(Date.parse(b.date)||0)-(Date.parse(a.date)||0));
}
function progressTime(value){
  if(typeof value!=='string'||!value.trim())return NaN;
  const formatted=value.replace(/(\d{1,2})(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(\d{4})/i,'$1 $2 $3');
  if(/^(?:\d{1,2} [A-Za-z]{3,9} \d{4}|[A-Za-z]{3,9} \d{1,2},? \d{4})$/.test(formatted))return Date.parse(formatted+' 00:00:00 UTC');
  return /\d{4}/.test(formatted)?Date.parse(formatted):NaN;
}
export function progressUpdatedAt(item){
  const dates=(item.events||[]).filter(event=>event.source==='email'||event.source==='website').map(event=>event.date);
  dates.push(item.publisher_history?.status_updated_at,item.publisher_status?.date);
  for(const row of item.metric_history||[]){
    const activity=row.metrics?.last_review_activity;
    if(Number.isFinite(progressTime(activity)))dates.push(activity);
    else if(row.source==='email')dates.push(row.metric_date||row.date);
  }
  for(const table of item.publisher_history?.tables||[]){
    const columns=(table.headers||[]).map((header,index)=>/\b(open|closed|date|updated|activity)\b|日期|时间/i.test(header)?index:-1).filter(index=>index>=0);
    for(const row of table.rows||[])for(const index of columns)dates.push(row[index]);
  }
  const latest=Math.max(...dates.map(progressTime).filter(Number.isFinite));
  return Number.isFinite(latest)?new Date(latest).toISOString():'';
}
export const SUBMISSION_PHASES={submitted:'提交',editorial:'编辑处理',review:'外审',accepted:'接收'};
export function submissionPhase(status){
  if(POST_ACCEPTED.has(status))return 'accepted';
  if(['under_review','reviews_completed'].includes(status))return 'review';
  if(['submitted','revised_submitted','unknown'].includes(status)||!status)return 'submitted';
  return 'editorial';
}
