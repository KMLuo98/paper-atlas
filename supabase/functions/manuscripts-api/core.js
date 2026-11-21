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
export function normalizeStatus(value) {
  const s=text(value,2000).toLowerCase();
  if (Object.hasOwn(STATUSES,s)) return s;
  if (/not accepted|unable to accept|declin(?:e|ed)|reject|拒稿/.test(s)) return 'rejected';
  if (/major revision|大修/.test(s)) return 'major_revision';
  if (/minor revision|小修/.test(s)) return 'minor_revision';
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
  if(publisher==='Elsevier') result=result.replace(/(?:[.\-_]?R\d*)$/i,'');
  else if(publisher!=='APS')result=result.replace(/(?:[.\-_]?R\d+)$/i,'');
  return result;
}
export function manuscriptKey(item) {
  return [text(item.publisher).toLowerCase(),text(item.journal).toLowerCase().replace(/[^\p{L}\p{N}]/gu,''),canonicalNumber(item.number,item.publisher)].join('|');
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
    [mail.subject,s.slice(0,5000)].join('\n').match(/\b(Physical Review (?:Letters|Research|[ABCDEFX])|Nature(?: Communications| Physics| Materials| Astronomy| Chemistry| Methods| Nanotechnology| Photonics| Energy| Medicine)?|Scientific Reports|Chaos, Solitons (?:&|and) Fractals|Physics Letters [AB]|Physica [ABCDE])\b/i)?.[1]||'');
  const title=s.match(/^(?:manuscript\s+title|article\s+title|title|标题)\s*[:：]\s*["“]?(.+?)["”]?\s*$/im)?.[1]||'';
  const authors=s.match(/^(?:authors?|作者)\s*[:：]\s*(.+)$/im)?.[1]||'';
  const statusLine=s.match(/^(?:(?:current|manuscript)\s+)?status\s*[:：]\s*(.+)$/im)?.[1];
  const status=normalizeStatus(statusLine||mail.subject);
  const links=[...s.matchAll(/https:\/\/[^\s<>"']+/g)].map(m=>safeLink(m[0].replace(/[).,]+$/,''))).filter(Boolean);
  const score=url=>/track\.authorhub\.elsevier\.com/i.test(url)?100:/authors\.aps\.org\/Submissions\/status/i.test(url)?90:/(peerx-press\.org|ejpress\.com)/i.test(url)?80:/editorialmanager\.com/i.test(url)?60:/track|\/status|submission|manuscript/i.test(url)&&!/(support|service)\./i.test(url)?30:0;
  const explicit=s.match(/Check Manuscript Status[\s\S]{0,180}?(https:\/\/[^\s<>"']+)/i)?.[1];
  const tracking_url=(explicit&&safeLink(explicit))||links.filter(url=>score(url)>0).sort((a,b)=>score(b)-score(a))[0]||'';
  return {publisher,journal,title,authors,number,status,raw_status:statusLine||text(mail.subject,300),tracking_url};
}
export function applyObservation(data,observation) {
  const observedNumber=observation.number;
  observation={...observation,publisher:publisherForJournal(observation.journal,observation.publisher)};
  const key=manuscriptKey(observation);
  if((data.tombstones||[]).includes(key))return;
  let item=data.manuscripts.find(item=>item.key===key||((item.number_history||[]).some(number=>manuscriptKey({...item,number})===key)));
  if(!item&&observation.publisher==='APS')item=data.manuscripts.find(item=>sameAPSSubmission(item,observation));
  if(item&&(item.archived_at||item.deleted_at))return;
  if(!item) {
    item={id:crypto.randomUUID(),key,publisher:'',journal:'',title:'',authors:'',number:'',status:'unknown',events:[],created_at:observation.date,manual_fields:[]};
    data.manuscripts.push(item);
  }
  item.number_history=[...new Set([...(item.number_history||[]),item.number,observation.number].filter(Boolean))];
  if(item.publisher==='APS'&&temporaryAPSNumber(item.number)&&!temporaryAPSNumber(observation.number))item.number=observation.number;
  if(item.publisher==='APS'&&!temporaryAPSNumber(item.number)&&temporaryAPSNumber(observation.number))observation={...observation,number:item.number,tracking_url:item.tracking_url};
  for(const field of ['publisher','journal','title','authors','number','tracking_url','lookup_author']) {
    if(observation[field]&&!(item.manual_fields||[]).includes(field)&&(!item[field]||Date.parse(observation.date)>=Date.parse(item.status_at||0)))item[field]=observation[field];
  }
  item.key=manuscriptKey(item);
  if(item.publisher==='APS'&&item.lookup_author&&!temporaryAPSNumber(item.number))item.tracking_url=apsURL(item.number,item.lookup_author);
  if(observation.metrics)recordMetrics(item,observation.metrics,observation.date,observation.source_url||observation.tracking_url);
  const duplicate=item.events.some(event=>event.source_id===observation.source_id&&event.status===observation.status&&event.date===observation.date&&event.raw_status===(observation.raw_status||STATUSES[observation.status]));
  if(!duplicate)item.events.push({id:crypto.randomUUID(),date:observation.date,status:observation.status,raw_status:observation.raw_status||STATUSES[observation.status],source:observation.source,source_id:observation.source_id,message_ref:observation.message_ref||'',source_url:observation.source_url||'',number:observedNumber||item.number});
  item.events.sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
  // Unknown observations remain visible in the history without erasing a known decision.
  const latest=[...item.events].reverse().find(event=>event.status!=='unknown');
  if(latest){item.status=latest.status;item.status_at=latest.date;}
  item.updated_at=new Date().toISOString();
  return item;
}
export function rawStatistics(data) {
  const stats=Object.create(null);
  for(const item of data.manuscripts){
    if(item.deleted_at)continue;
    const journal=item.journal||'未注明期刊';
    const row=stats[journal]??={total:0,active:0,accepted:0,rejected:0,completed:0};
    row.total++;
    if(POST_ACCEPTED.has(item.status))row.accepted++;
    if(item.status==='rejected')row.rejected++;
    if(FINAL.has(item.status))row.completed++;
    else if(!item.archived_at)row.active++;
  }
  return stats;
}
export function statistics(data) {
  const raw=rawStatistics(data);
  for(const journal of Object.keys(data.stats_offsets||{}))raw[journal]??={total:0,active:0,accepted:0,rejected:0,completed:0};
  return Object.entries(raw).map(([journal,row])=>({journal,...Object.fromEntries(Object.entries(row).map(([key,value])=>[key,Math.max(0,value+(data.stats_offsets?.[journal]?.[key]||0))]))}));
}

export function publisherForJournal(journal,publisher='') {
  if(/^chaos(?::|$)/i.test(text(journal))&&!/solitons/i.test(journal))return 'AIP Publishing';
  return publisherOf(publisher)||publisher;
}
export const temporaryAPSNumber=number=>/^es\d{4}[a-z]{3}\d{1,2}_\d+$/i.test(text(number));
const fingerprint=value=>text(value,2000).normalize('NFKD').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
export function sameAPSSubmission(a,b) {
  return a.publisher==='APS'&&b.publisher==='APS'&&
    temporaryAPSNumber(a.number)!==temporaryAPSNumber(b.number)&&
    fingerprint(a.journal)===fingerprint(b.journal)&&fingerprint(a.title).length>=16&&fingerprint(a.title)===fingerprint(b.title);
}
export function reconcileManuscripts(data) {
  for(const item of data.manuscripts){item.publisher=publisherForJournal(item.journal,item.publisher);item.key=manuscriptKey(item);}
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
    if(target.lookup_author)target.tracking_url=apsURL(target.number,target.lookup_author);
    data.manuscripts=data.manuscripts.filter(item=>item.id!==old.id);
  }
  return data;
}
export function extractReviewMetrics(body) {
  const metrics={};
  for(const [key,label] of Object.entries({reviews_completed:'Reviews completed',invitations_accepted:'Review invitations accepted',invitations_sent:'Review invitations sent',last_review_activity:'Last review activity'})){
    const match=String(body).match(new RegExp(label+'\\s*[:：]\\s*([^\\n\\r]+)','i'));
    if(match)metrics[key]=text(match[1],150);
  }
  return Object.keys(metrics).length?metrics:null;
}
export function recordMetrics(item,metrics,date,url='') {
  const value={...metrics,revision:metrics.revision??item.number};
  item.metric_history??=[];
  if(item.metric_history.some(row=>JSON.stringify(row.metrics)===JSON.stringify(value)))return;
  item.metric_history.push({date,metrics:value,source_url:url});
  item.metric_history.sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
}

export function submissionRound(item) {
  const revision=String(item.number||'').match(/R(\d*)$/i);
  const explicit=Number(item.round)||1;
  const metrics=(item.metric_history||[]).map(row=>Number(row.metrics.revision)+1).filter(Number.isFinite);
  const resubmitted=new Set((item.events||[]).filter(event=>event.status==='revised_submitted').map(event=>event.date.slice(0,10))).size;
  return Math.max(1,explicit,revision?(Number(revision[1]||1)+1):1,resubmitted+1,...metrics);
}
