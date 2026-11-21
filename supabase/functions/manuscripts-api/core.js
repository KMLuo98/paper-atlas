export const STATUSES = {
  submitted:'Submitted', with_editor:'With editor', under_review:'Under review',
  reviews_completed:'Reviews completed', decision_pending:'Decision pending',
  minor_revision:'Minor revision', major_revision:'Major revision', revision_requested:'Revision requested',
  revised_submitted:'Revised submitted', accepted:'Accepted', rejected:'Rejected',
  withdrawn:'Withdrawn', transferred:'Transferred', published:'Published', unknown:'待核实'
};
export const FINAL = new Set(['accepted','rejected','withdrawn','transferred','published']);
export const text = (value,max=1000) => String(value??'').trim().slice(0,max);
export function publisherOf(value) {
  const s=String(value||'');
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
  // A reviewer accepting an invitation is not a publication decision.
  if (!/reviewer|referee|invitation/.test(s) && /accepted for publication|approved for publication|acceptance|decision.{0,10}accept|^accepted$|正式接收/.test(s)) return 'accepted';
  if (/required reviews completed|reviews? complet|评审完成/.test(s)) return 'reviews_completed';
  if (/decision in process|decision pending|editorial decision started/.test(s)) return 'decision_pending';
  if (/under review|sent to (?:referee|reviewer)|out for review|外审/.test(s)) return 'under_review';
  if (/with editor|editor assigned|editorial assessment|编辑处理/.test(s)) return 'with_editor';
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
    const hosts=['aps.org','elsevier.com','elsevier.cn','editorialmanager.com','nature.com','springernature.com','springer.com','manuscriptcentral.com','sciencemag.org','wiley.com','tandfonline.com','sagepub.com','aip.org','iop.org','pnas.org','pnascentral.org','science.org','acs.org','rsc.org','frontiersin.org','mdpi.com','oup.com','cambridge.org'];
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
  const tracking_url=links.find(url=>/track|\/status|submission|manuscript|editorialmanager\.com/i.test(url))||'';
  return {publisher,journal,title,authors,number,status,raw_status:statusLine||text(mail.subject,300),tracking_url};
}
export function applyObservation(data,observation) {
  const key=manuscriptKey(observation);
  if((data.tombstones||[]).includes(key))return;
  let item=data.manuscripts.find(item=>item.key===key);
  if(item&&(item.archived_at||item.deleted_at))return;
  if(!item) {
    item={id:crypto.randomUUID(),key,publisher:'',journal:'',title:'',authors:'',number:'',status:'unknown',events:[],created_at:observation.date,manual_fields:[]};
    data.manuscripts.push(item);
  }
  for(const field of ['publisher','journal','title','authors','number','tracking_url','lookup_author']) {
    if(observation[field]&&!(item.manual_fields||[]).includes(field)&&(!item[field]||Date.parse(observation.date)>=Date.parse(item.status_at||0)))item[field]=observation[field];
  }
  const duplicate=item.events.some(event=>event.source_id===observation.source_id&&event.status===observation.status&&event.date===observation.date&&event.raw_status===(observation.raw_status||STATUSES[observation.status]));
  if(!duplicate)item.events.push({id:crypto.randomUUID(),date:observation.date,status:observation.status,raw_status:observation.raw_status||STATUSES[observation.status],source:observation.source,source_id:observation.source_id,message_ref:observation.message_ref||'',source_url:observation.source_url||'',number:observation.number||item.number});
  item.events.sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
  // Unknown observations remain visible in the history without erasing a known decision.
  const latest=[...item.events].reverse().find(event=>event.status!=='unknown');
  if(latest){item.status=latest.status;item.status_at=latest.date;}
  item.updated_at=new Date().toISOString();
  return item;
}
export function rawStatistics(data) {
  const stats={};
  for(const item of data.manuscripts){
    if(item.deleted_at)continue;
    const journal=item.journal||'未注明期刊';
    const row=stats[journal]??={total:0,active:0,accepted:0,rejected:0,completed:0};
    row.total++;
    if(['accepted','published'].includes(item.status))row.accepted++;
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
