import {escapeHTML as e,normalizeKeywordPairs,keywordFields} from './core.js';
import {getLanguage} from './i18n.js';
const l=(zh,en)=>getLanguage()==='en'?en:zh;
const kinds=[['domain','领域','Field'],['topic','主题','Topic'],['problem','问题','Problem'],['method','方法','Method'],['phenomenon','现象','Phenomenon'],['conclusion','结论','Conclusion']];
export function manualKeywordPatch(paper,rows){
 const filled=rows.filter(row=>String(row.zh||'').trim()||String(row.en||'').trim());
 if(filled.some(row=>!/[\p{Script=Han}]/u.test(row.zh||'')||!String(row.en||'').trim()))throw Error(l('每个关键词请填写中文和对应英文。','Each keyword needs Chinese and English text.'));
 if(filled.some(row=>String(row.zh).trim().length>100||String(row.en).trim().length>150||!Number.isFinite(Number(row.importance))||Number(row.importance)<1||Number(row.importance)>100))throw Error(l('中文限100字、英文限150字，重要性为1–100。','Chinese: up to 100 characters; English: 150; importance: 1–100.'));
 const pairs=normalizeKeywordPairs(filled);
 if(pairs.length!==filled.length)throw Error(l('关键词有重复，请修改后保存。','Duplicate keywords; edit them before saving.'));
 const removedTerms=new Set([...(paper.keywords||[]),...(paper.keyword_pairs||[]).flatMap(k=>[k.zh,k.en])].filter(Boolean).map(s=>s.trim().toLowerCase()));
 return {...keywordFields(pairs,(paper.search_terms||[]).filter(term=>!removedTerms.has(term.trim().toLowerCase()))),keywords_edited_at:new Date().toISOString()};
}
export function openKeywordEditor(paper,{modal,save,afterSave=()=>{}}){
 let rows=normalizeKeywordPairs(paper.keyword_pairs).map(k=>({...k}));
 if(!rows.length)rows=(paper.keywords||[]).map((zh,i)=>({zh,en:'',kind:i?'topic':'domain',importance:Math.max(1,100-i)}));
 const d=modal(l('编辑研究关键词','Edit research keywords'),`<p>${l('可修改、增加或移除中英关键词；按领域到具体主题排列，同层按重要性排序。','Edit, add or remove bilingual keywords. Fields come before specific topics, ordered by importance within each level.')}</p><form id="keyword-editor-form"><div id="keyword-editor-rows"></div><button type="button" id="keyword-add">+ ${l('添加关键词','Add keyword')}</button><p id="keyword-editor-error" class="form-error" role="alert"></p><div class="actions"><button type="button" id="keyword-cancel">${l('取消','Cancel')}</button><button type="submit" class="primary">${l('保存关键词','Save keywords')}</button></div></form>`,{wide:true});
 const root=d.el,form=root.querySelector('form'),host=root.querySelector('#keyword-editor-rows'),error=root.querySelector('#keyword-editor-error');let saving=false;
 function read(){rows=[...host.querySelectorAll('[data-keyword-row]')].map(row=>({zh:row.querySelector('[name=zh]').value,en:row.querySelector('[name=en]').value,kind:row.querySelector('[name=kind]').value,importance:Number(row.querySelector('[name=importance]').value)}));}
 function paint(){host.innerHTML=rows.map((k,i)=>`<div class="keyword-edit-row" data-keyword-row><label>${l('中文','Chinese')}<input name="zh" value="${e(k.zh||'')}" maxlength="100" aria-label="${l('中文关键词','Chinese keyword')}"></label><label>English<input name="en" value="${e(k.en||'')}" maxlength="150" aria-label="English keyword"></label><label>${l('类型','Type')}<select name="kind">${kinds.map(([value,zh,en])=>`<option value="${value}" ${k.kind===value?'selected':''}>${l(zh,en)}</option>`).join('')}</select></label><label>${l('重要性','Importance')}<input name="importance" type="number" min="1" max="100" step="1" value="${k.importance||50}" aria-label="${l('重要性','Importance')}"></label><button type="button" data-keyword-remove="${i}" aria-label="${l('移除关键词','Remove keyword')}">×</button></div>`).join('');host.querySelectorAll('[data-keyword-remove]').forEach(button=>button.onclick=()=>{read();rows.splice(Number(button.dataset.keywordRemove),1);paint();});}
 root.querySelector('#keyword-add').onclick=()=>{read();rows.push({zh:'',en:'',kind:'topic',importance:50});paint();host.querySelector('[data-keyword-row]:last-child [name=zh]')?.focus();};
 root.querySelector('#keyword-cancel').onclick=d.close;
 form.onsubmit=async event=>{event.preventDefault();if(saving)return;read();error.textContent='';try{const patch=manualKeywordPatch(paper,rows);saving=true;form.querySelectorAll('button,input,select').forEach(el=>el.disabled=true);await save(paper.id,patch);Object.assign(paper,patch);d.close();await afterSave();}catch(err){error.textContent=err.message;}finally{saving=false;if(form.isConnected)form.querySelectorAll('button,input,select').forEach(el=>el.disabled=false);}};
 paint();return d;
}
