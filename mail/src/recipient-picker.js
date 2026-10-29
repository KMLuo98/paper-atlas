import {contactEmails} from './contact-workflow.js';
const normalize=s=>String(s||'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().trim();
const separator=/[,;，；]/;
export function recipientToken(value,caret=value.length){
 let start=Math.max(0,Math.min(caret,value.length)),end=start;
 while(start>0&&!separator.test(value[start-1]))start--;
 while(end<value.length&&!separator.test(value[end]))end++;
 return {start,end,query:value.slice(start,end).trim()};
}
export function matchRecipients(contacts,query,excluded=[],limit=12){
 const words=normalize(query).split(/\s+/).filter(Boolean),blocked=new Set(excluded.map(normalize)),seen=new Set(),rows=[];
 for(const c of contacts){if(c.deleted_at)continue;for(const email of contactEmails(c)){
  if(blocked.has(email)||seen.has(email)||!email.includes('@'))continue;
  const name=normalize(c.name),address=normalize(email),haystack=name+' '+address;
  if(!words.every(word=>haystack.includes(word)))continue;
  const q=normalize(query),score=q?(address===q?0:name.startsWith(q)?1:address.startsWith(q)?2:3):4;
  seen.add(email);rows.push({email,name:c.name||'',organization:c.organization||'',score});
 }}
 return rows.sort((a,b)=>a.score-b.score||a.name.localeCompare(b.name,'zh-CN')||a.email.localeCompare(b.email)).slice(0,limit);
}
export function fillRecipient(value,caret,email){
 const {start,end}=recipientToken(value,caret),prefix=value.slice(0,start),space=prefix&&/\s/.test(value[start])?' ':'',suffix=value.slice(end),insert=space+email+(suffix?'':', ');
 return {value:prefix+insert+suffix,caret:prefix.length+insert.length};
}
export function installRecipientPicker(root,contacts,onChange){
 for(const input of root.querySelectorAll('[data-recipient]')){
  const list=root.querySelector('#'+input.getAttribute('aria-controls'));let rows=[],active=-1,composing=false;
  const close=()=>{list.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');active=-1;};
  const highlight=index=>{active=index;[...list.children].forEach((node,i)=>node.setAttribute('aria-selected',String(i===active)));if(active>=0){input.setAttribute('aria-activedescendant',list.children[active].id);list.children[active].scrollIntoView({block:'nearest'});}else input.removeAttribute('aria-activedescendant');};
  const show=()=>{
   if(composing)return;const token=recipientToken(input.value,input.selectionStart??input.value.length),excluded=[];
   for(const field of root.querySelectorAll('[data-recipient]')){let value=field.value;if(field===input)value=value.slice(0,token.start)+value.slice(token.end);excluded.push(...value.split(/[,;，；]/).map(s=>s.trim()).filter(Boolean));}
   rows=matchRecipients(contacts,token.query,excluded);list.replaceChildren();if(!rows.length){close();return;}
   rows.forEach((row,index)=>{const option=document.createElement('div');option.id=list.id+'-'+index;option.setAttribute('role','option');option.setAttribute('aria-selected','false');option.className='recipient-option';const name=document.createElement('strong'),email=document.createElement('small');name.textContent=row.name||row.email;email.textContent=row.email;option.append(name,email);if(row.organization){const org=document.createElement('span');org.textContent=row.organization;option.append(org);}option.addEventListener('pointerdown',event=>event.preventDefault());option.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();choose(index);});list.append(option);});
   active=-1;list.hidden=false;input.setAttribute('aria-expanded','true');input.removeAttribute('aria-activedescendant');
  };
  const choose=index=>{if(!rows[index])return;const result=fillRecipient(input.value,input.selectionStart??input.value.length,rows[index].email);input.value=result.value;input.setSelectionRange(result.caret,result.caret);onChange(input.name,result.value);close();input.focus();};
  input.addEventListener('focus',show);input.addEventListener('input',show);input.addEventListener('click',show);
  input.addEventListener('compositionstart',()=>{composing=true;close();});input.addEventListener('compositionend',()=>{composing=false;show();});
  input.addEventListener('blur',close);
  input.addEventListener('keydown',event=>{
   if(event.isComposing||composing)return;
   if(event.key==='Escape'){close();event.preventDefault();event.stopPropagation();return;}
   if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();if(list.hidden)show();if(!list.hidden)highlight(event.key==='ArrowDown'?(active+1)%rows.length:(active<=0?rows.length-1:active-1));}
   if(event.key==='Enter'&&!list.hidden){event.preventDefault();event.stopPropagation();choose(active<0?0:active);}
   if(event.key==='Tab')close();
  });
 }
}
