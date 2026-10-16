// Run only against a dedicated configured Supabase test project with two verified users.
// Credentials stay in process memory and are never printed.
import { createClient } from '@supabase/supabase-js';
import assert from 'node:assert/strict';
const env=process.env;
for(const key of ['PA_TEST_URL','PA_TEST_ANON_KEY','PA_TEST_EMAIL_A','PA_TEST_PASSWORD_A','PA_TEST_EMAIL_B','PA_TEST_PASSWORD_B'])if(!env[key])throw new Error(`Missing ${key}`);
if(env.PA_ALLOW_TEST_WRITES!=='yes')throw new Error('Set PA_ALLOW_TEST_WRITES=yes for a disposable test project. A soft-deleted fixture will remain for audit.');
const client=()=>createClient(env.PA_TEST_URL,env.PA_TEST_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const a=client(),b=client();
const {data:sa,error:ea}=await a.auth.signInWithPassword({email:env.PA_TEST_EMAIL_A,password:env.PA_TEST_PASSWORD_A});if(ea)throw new Error('Test user A login failed');
const {data:sb,error:eb}=await b.auth.signInWithPassword({email:env.PA_TEST_EMAIL_B,password:env.PA_TEST_PASSWORD_B});if(eb)throw new Error('Test user B login failed');
assert.notEqual(sa.user.id,sb.user.id,'Two distinct users required');
const id=crypto.randomUUID(),path=`${sa.user.id}/${id}.pdf`;
const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R >>','<< /Length 0 >>\nstream\n\nendstream'];
let pdf='%PDF-1.4\n',offsets=[0];for(let i=0;i<objects.length;i++){offsets.push(pdf.length);pdf+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;}
const xref=pdf.length;pdf+='xref\n0 5\n0000000000 65535 f \n'+offsets.slice(1).map(n=>`${String(n).padStart(10,'0')} 00000 n \n`).join('')+`trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
const file=new Blob([pdf],{type:'application/pdf'});
let stored=false;
try{
  const {error}=await a.storage.from('papers').upload(path,file,{contentType:'application/pdf'});assert.equal(error,null,'A can upload private PDF');
  const insert=await a.from('papers').insert({id,user_id:sa.user.id,title:'[SMOKE TEST] persistence and isolation',file_path:path,file_size:file.size,original_filename:'smoke.pdf',tags:['smoke-test']});assert.equal(insert.error,null,'A can save metadata');stored=true;
  const other=await b.from('papers').select('id').eq('id',id);assert.equal(other.error,null);assert.equal(other.data.length,0,'B cannot read A metadata');
  const denied=await b.storage.from('papers').createSignedUrl(path,60);assert(denied.error,'B cannot sign A PDF');
  const mutate=await b.from('papers').update({title:'unauthorized'}).eq('id',id).select('id');assert.equal(mutate.data.length,0,'B cannot modify A metadata');
  const reopen=client();const again=await reopen.auth.signInWithPassword({email:env.PA_TEST_EMAIL_A,password:env.PA_TEST_PASSWORD_A});assert.equal(again.error,null);const persisted=await reopen.from('papers').select('id,title,tags').eq('id',id).single();assert.equal(persisted.error,null);assert.equal(persisted.data.title,'[SMOKE TEST] persistence and isolation','Data survives new authenticated session');
  const attack=await b.functions.invoke('library-api',{body:{action:'get',paper_id:id}});assert(attack.error,'API denies other-user access');
  const key=await a.functions.invoke('library-api',{body:{action:'create_key',name:'smoke test'}});assert.equal(key.error,null);const headers={Authorization:`Bearer ${key.data.token}`,'Content-Type':'application/json'};
  const endpoint=env.PA_TEST_URL+'/functions/v1/library-api';
  const own=await fetch(endpoint,{method:'POST',headers,body:JSON.stringify({action:'get',paper_id:id})});assert.equal(own.status,200);const row=await own.json();assert.equal(row.paper.id,id);assert(!('full_text'in row.paper));
  const write=await fetch(endpoint,{method:'POST',headers,body:JSON.stringify({action:'create_key',name:'forbidden'})});assert.equal(write.status,403,'External token is read-only');
  const {data:keys}=await a.from('api_keys').select('id').eq('name','smoke test');for(const k of keys||[])await a.functions.invoke('library-api',{body:{action:'revoke_key',key_id:k.id}});
  const revoked=await fetch(endpoint,{method:'POST',headers,body:JSON.stringify({action:'get',paper_id:id})});assert.equal(revoked.status,401,'Revoked key cannot read');
  await reopen.auth.signOut();console.log('PASS: cloud persistence, user isolation, private PDF signing, read-only external API, revocation.');
}finally{
  if(stored)await a.from('papers').update({deleted_at:new Date().toISOString()}).eq('id',id);else await a.storage.from('papers').remove([path]);
  await a.auth.signOut();await b.auth.signOut();
}
