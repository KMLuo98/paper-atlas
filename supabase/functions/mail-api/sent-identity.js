// Fudan/Tencent SMTP keeps our UUID but prepends a hexadecimal stamp to Message-ID.
// Never collapse sent mail by subject/time alone: deliberate repeated sends are valid.
export function sentLocalKey(messageId){
 const match=String(messageId||'').trim().match(/^<(?:[a-f0-9]{8,64}\+)?([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})@mail-atlas\.local>$/i);
 return match?.[1].toLowerCase()||'';
}
const recipients=rows=>(rows||[]).map(x=>String(x.address||'').trim().toLowerCase()).sort().join('\n');
const body=text=>String(text||'').replace(/\r\n?/g,'\n').trim();
export function sameSentCopy(local,remote){
 const key=sentLocalKey(remote.message_id);
 return !!key&&local.folder==='sent'&&local.remote_id==='local:'+key&&sentLocalKey(local.message_id)===key&&
  local.from_email?.toLowerCase()===remote.from_email?.toLowerCase()&&local.subject===remote.subject&&
  Number.isFinite(Date.parse(local.received_at))&&Math.abs(Date.parse(local.received_at)-Date.parse(remote.received_at))<=2000&&
  recipients(local.to_list)===recipients(remote.to_list)&&recipients(local.cc_list)===recipients(remote.cc_list)&&
  body(local.text_body)===body(remote.text_body);
}
