import assert from 'node:assert/strict';
import { projectConfig } from '../src/project-config.js';
const endpoint=projectConfig.url+'/functions/v1/library-api';
async function request(url,options={}){let last;for(let n=0;n<3;n++){try{return await fetch(url,{...options,signal:AbortSignal.timeout(15000)});}catch(error){last=error;}}throw last;}
const headers={apikey:projectConfig.key,'Content-Type':'application/json'};
const auth=await request(projectConfig.url+'/auth/v1/settings',{headers});assert.equal(auth.status,200,'Authentication must be available');const settings=await auth.json();assert.equal(settings.external?.email,true,'Email authentication must be enabled');assert.equal(settings.mailer_autoconfirm,false,'Email verification must be required');
const health=await request(endpoint,{method:'POST',headers,body:JSON.stringify({action:'health'})});assert.equal(health.status,200,'Edge Function must be running');const status=await health.json();assert.equal(status.ok,true);console.log('PASS: email auth, required verification, deployed API; AI key configured:',status.ai_configured,'model:',status.model);
const denied=await request(endpoint,{method:'POST',headers,body:JSON.stringify({action:'list'})});assert.equal(denied.status,401,'Anonymous requests must not read papers');
const cors=await request(endpoint,{method:'OPTIONS',headers:{Origin:'https://kmluo98.github.io','Access-Control-Request-Method':'POST'}});assert.equal(cors.status,204);assert.equal(cors.headers.get('Access-Control-Allow-Origin'),'https://kmluo98.github.io');
const badOrigin=await request(endpoint,{method:'POST',headers:{...headers,Origin:'https://untrusted.example'},body:JSON.stringify({action:'health'})});assert.equal(badOrigin.status,403,'Untrusted website origins must be rejected');
console.log('PASS: anonymous data access denied, Pages origin allowed, untrusted origins rejected.');
