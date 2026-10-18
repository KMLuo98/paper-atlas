import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import {analysisPrompt,keywordPrompt,validateAnalysis} from '../supabase/functions/_shared/analysis.js';
import {normalizeKeywordPairs,validKeywordHierarchy,keywordFields} from '../supabase/functions/_shared/paper-details.js';
import {requestModelJSON} from '../supabase/functions/_shared/model-json.js';
import {normalizePaperJournal} from '../supabase/functions/_shared/journals.js';
import {arxivID} from '../supabase/functions/_shared/publication.js';

const id='12345678-1234-1234-1234-123456789012';
const source=stripTypeScriptTypes(fs.readFileSync(new URL('../supabase/functions/library-api/index.ts',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,''),{mode:'transform'});
function fixture() {
  let handler, attempts=0, saved;
  const row={id,title:'Manuscript',full_text:'Unpublished manuscript on complex networks. '.repeat(2500)};
  const service={rpc:async()=>({data:true}),auth:{getUser:async token=>token==='test-token'?{data:{user:{id:'owner'}}}:{data:{user:null},error:Error('denied')}},from(table){assert.equal(table,'papers');return {select(){return this;},eq(key,value){if(key==='user_id')assert.equal(value,'owner');return this;},is(){return this;},maybeSingle:async()=>({data:row}),update(patch){saved=patch;return this;},single:async()=>({data:{...row,...saved}})};}};
  const pairs=[['domain','复杂网络'],['topic','同步'],['problem','结构重构'],['method','变分方法'],['method','数值模拟'],['phenomenon','稳定态'],['conclusion','稀疏恢复'],['conclusion','鲁棒性']].map(([kind,zh],n)=>({kind,zh,en:'term '+n,importance:100-n}));
  const settings={SUPABASE_URL:'https://project.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'fake-service-key',LLM_API_KEY:'fake-llm-key'};
  vm.runInNewContext(source,{Deno:{env:{get:key=>settings[key]},serve:fn=>{handler=fn;}},createClient:()=>service,system:analysisPrompt,keywordPrompt,validateAnalysis,normalizeKeywordPairs,validKeywordHierarchy,keywordFields,requestModelJSON,normalizePaperJournal,arxivID,URL,Request,Response,AbortSignal,DOMException,TextEncoder,crypto,console,
    fetch:async(url,options)=>{
      if(url.endsWith('/models'))return Response.json({data:[{id:'deepseek-flash'}]});
      assert(url.endsWith('/chat/completions'));const body=JSON.parse(options.body);assert.equal(body.max_tokens,8192);attempts++;
      return Response.json({choices:[attempts===1?{finish_reason:'length',message:{content:'{"title":"paper","references":['}}:{finish_reason:'stop',message:{content:JSON.stringify({title:'Unpublished research',publication_status:'unpublished',authors:[{name:'Researcher'}],keyword_pairs:pairs,summary:'研究问题：重构网络。方法：变分方法。主要结论/现象：恢复稳定态网络。局限与待核验：未发表稿件。'})}}]});
    }});
  return {request:body=>handler(new Request('https://project.supabase.co/functions/v1/library-api',{method:'POST',headers:{Authorization:'Bearer test-token','Content-Type':'application/json'},body:JSON.stringify(body)})),get attempts(){return attempts;},get saved(){return saved;}};
}
test('complete Edge handler keeps model probe and rate limiting operational', async()=>{
  const f=fixture();const response=await f.request({action:'health',probe_model:true});assert.equal(response.status,200);assert.equal((await response.json()).model_probe.model_available,true);assert.equal(f.attempts,0);
});
test('complete authenticated analysis recovers long JSON and saves an unpublished paper',async()=>{
  const f=fixture();const response=await f.request({action:'analyze',paper_id:id});const result=await response.json();assert.equal(response.status,200,JSON.stringify(result));assert.equal(f.attempts,2);assert.equal(f.saved.status,'ready');assert.equal(f.saved.publication_status,'unpublished');assert.equal(f.saved.published_at,null);assert.equal(f.saved.keyword_pairs.length,8);assert.equal(f.saved.analysis_error,null);
});
