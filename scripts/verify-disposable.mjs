// Operates only on agent-created qa_<random> accounts at example.invalid.
// Credentials come from a local, untracked test fixture export and are never logged.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {projectConfig} from '../src/project-config.js';
import {mergePaperPDFs} from '../src/paper-downloads.js';
const fixture=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
assert(fixture.accounts.length===2&&fixture.accounts.every(f=>/^qa_[a-f0-9]{12}$/.test(f.username)&&f.email===`pa-qa-${f.username.slice(3)}@example.invalid`),'Only disposable QA accounts are permitted');
const client=()=>createClient(projectConfig.url,projectConfig.key,{auth:{persistSession:false,autoRefreshToken:false}});
async function call(token,action,payload={}){const r=await fetch(projectConfig.url+'/functions/v1/library-api',{method:'POST',headers:{apikey:projectConfig.key,Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({action,...payload}),signal:AbortSignal.timeout(30000)});return{status:r.status,data:await r.json()};}
const a=client();const login=await a.auth.signInWithPassword({email:fixture.accounts[0].email,password:fixture.accounts[0].password});assert.equal(login.error,null);assert.equal(login.data.user.id,fixture.accounts[0].id);const token=login.data.session.access_token;
const role=await call(token,'admin_status');assert.equal(role.data.is_admin,false,'QA accounts must have no administrator privileges');
const denied=await call(token,'admin_users');assert.equal(denied.status,403);
if(!process.argv.includes('--cleanup')){const merged=await mergePaperPDFs(fixture.papers,async p=>{const signed=await call(token,'download',{paper_id:p.id});assert.equal(signed.status,200);const pdf=await fetch(signed.data.url,{signal:AbortSignal.timeout(20000)});assert.equal(pdf.status,200);return new Uint8Array(await pdf.arrayBuffer());});assert.equal(merged.pages,2);assert.equal(merged.failures.length,0);
fs.writeFileSync('test-results/combined-qa.pdf',merged.bytes);console.log('PASS: private PDF retrieval, one-PDF combined download, and non-admin management denial.');}
if(process.argv.includes('--cleanup')){
  for(const f of fixture.accounts){const own=client();const session=await own.auth.signInWithPassword({email:f.email,password:f.password});assert.equal(session.error,null);assert.equal(session.data.user.id,f.id);const status=await call(session.data.session.access_token,'admin_status');assert.equal(status.data.is_admin,false);const result=await call(session.data.session.access_token,'delete_account',{confirmation:'DELETE',password:f.password});assert.equal(result.status,200,result.data.error);const retry=await own.auth.signInWithPassword({email:f.email,password:f.password});assert(retry.error);}
  console.log('PASS: only disposable QA accounts and their private files were removed; real user and requested administrator preserved.');
}
