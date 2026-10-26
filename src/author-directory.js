import {cachedAuthorPhotos,clearAuthorPhotoCache} from './author-photo-cache.js';
import {authorAffiliations,recentAuthorAffiliations,countryName} from '../supabase/functions/_shared/author-affiliations.js';
import {db, api, ensureStorageSpace} from './cloud.js';
import {escapeHTML as e, journalFull, safeURL, searchPapers} from './core.js';
import {buildAuthorDirectory, filterAuthors, formattedAuthorName, publishedPaper, authorInstitutions, authorIndexValue, authorEnrichmentTasks, researchPapers, searchAuthorPapers} from '../supabase/functions/_shared/author-directory.js';
import {openPhotoInput} from '../mail/src/photo-input.js';
import {getLanguage} from './i18n.js';
import './author-directory.css';
const l = (zh, en) => getLanguage() === 'en' ? en : zh;
const formats = () => [['given_family', 'First Last'], ['family_given', 'Last, First'], ['initial_family', 'F. Last']];
export function createAuthorDirectory({state, shell, icon, modal, busy, toast, go, uiIcons}) {
  let owner = '', profiles = [], photos = new Map(), loadedAt = 0, loading = null, revision = 0;
  let maintenance=null, maintenanceTimer=null, repaintTimer=null, rescan=false, paused=false, listPaint=null, pendingRequest=null;
  let preferences = {view: 'cards', sort: 'name', format: 'given_family'}, query = '';
  const ownerId = () => state.user?.id || 'demo';
  function switchOwner() {
    if (owner === ownerId()) return;
    clearAuthorPhotoCache(owner);if(maintenance)maintenance.stopped=true;maintenance=null;paused=false;pendingRequest=null;rescan=false;owner = ownerId(); profiles = []; photos.clear(); loadedAt = 0; loading = null; query = '';
    try {preferences = {...{view: 'cards', sort: 'name', format: 'given_family'}, ...JSON.parse(localStorage.getItem('pa-author-view-' + owner) || '{}')};} catch {}
  }
  function persist() {try {localStorage.setItem('pa-author-view-' + owner, JSON.stringify(preferences));} catch {}}
  async function signPhotos() {
    const paths = [...new Set(profiles.map(p => p.photo_path).filter(p => p?.startsWith(owner + '/')))];
    const id=owner,next=await cachedAuthorPhotos(db,id,paths);if(ownerId()===id)photos=next;
  }

  async function load(force = false) {
    switchOwner(); if (state.demo) return;
    if (!force && loadedAt && Date.now() - loadedAt < 60000) return;
    if (loading) return loading;
    const id = owner;
    loading = (async () => {
      const rows = [];
      for (let start = 0; ; start += 250) {
        const r = await db.from('author_profiles').select('*').eq('user_id', id).order('id').range(start, start + 249);
        if (r.error) throw r.error; rows.push(...r.data); if (r.data.length < 250) break;
      }
      if (ownerId() !== id) return;
      profiles = rows; await signPhotos(); if (ownerId() === id) loadedAt = Date.now();
    })();
    try {await loading;} finally {if (owner === id) loading = null;}
  }
  const people = () => buildAuthorDirectory(state.papers, profiles);
  const nameOf = person => formattedAuthorName(person, preferences.format) || l('英文名待补充', 'English name needed');
  const routeFor = person => 'author/' + encodeURIComponent(person.key);
  function photo(person, large = false) {
    const url = photos.get(person.photo_path), initials = [person.first_name, person.last_name].filter(Boolean).map(n => [...n][0]).join('').toUpperCase() || '?';
    return `<span class="author-avatar ${large ? 'large' : ''}">${url ? `<img src="${e(url)}" alt="${e(nameOf(person))}" loading="lazy" referrerpolicy="no-referrer">` : e(initials)}</span>`;
  }
  function academicStats(person){const best=person.academic_metrics?.best||{};return '<div class="author-academic-stats">'+[['publications',l('公开论文数','Public papers')],['citations',l('引用数','Citations')],['h_index','h-index'],['i10_index','i10-index']].map(([key,label])=>{const m=best[key],value=Number.isSafeInteger(m?.value)?m.value:'—',source=m?({scholar:'Google Scholar',researchgate:'ResearchGate',orcid:'ORCID'}[m.provider]||m.provider)+(m.method==='indexed_snippet'?' · '+l('检索摘录','Search excerpt'):'')+' · '+(m.checked_at||'').slice(0,10):'',url=safeURL(m?.url);return '<div><span>'+label+'</span><strong>'+e(value)+'</strong>'+(url?'<a href="'+e(url)+'" target="_blank" rel="noopener" title="'+e(source)+'">'+e(source)+'</a>':'')+'</div>';}).join('')+'</div>';}
  function formatOptions(value, allowDefault = false) {return `${allowDefault ? `<option value="default" ${value === 'default' ? 'selected' : ''}>${l('跟随作者库设置', 'Use directory setting')}</option>` : ''}${formats().map(([id, label]) => `<option value="${id}" ${value === id ? 'selected' : ''}>${label}</option>`).join('')}`;}
  function institutionMarkup(person,{detail=false}={}) {
    const rows=detail?authorAffiliations(person):recentAuthorAffiliations(person,3),language=getLanguage();
    if(!rows.length)return e(l('未识别','Unidentified'));
    const month=date=>date?date.slice(0,7).replace('-','.'):l('日期未标注','Date unknown');
    return rows.map(row=>{const label=[row.school,countryName(row.country,language)].filter(Boolean).join(' · '),range=row.first_seen&&row.first_seen!==row.last_seen?month(row.first_seen)+' – '+month(row.last_seen):month(row.last_seen),title=row.manual?l('手动补充，未指定论文时间','Manual addition; publication date unspecified'):l('论文署名记录：','Paper affiliation records: ')+range;
      if(!detail)return `<span class="author-institution-line ${row.historical?'historical':''}" title="${e(title)}">${row.last_seen&&row.last_seen===rows[0].last_seen?`<strong>${e(row.school)}</strong>${countryName(row.country,language)?' · '+e(countryName(row.country,language)):''}`:e(label)}</span>`;
      return `<div class="author-affiliation-record ${row.historical?'historical':''}"><span class="author-institution-line">${e(label)}</span><small class="author-affiliation-dates">${row.manual?l('手动补充 · 日期未标注','Manual addition · date unknown'):e(range)}</small>${row.records.length?`<details><summary>${l('论文依据','Source papers')} (${row.records.length})</summary><ul>${row.records.map(r=>`<li><time>${e(month(r.date))}</time> · <a href="#/paper/${encodeURIComponent(r.paper_id)}" data-user-content>${e(r.title)}</a><small data-user-content>${e(r.raw)}</small></li>`).join('')}</ul></details>`:''}</div>`;
    }).join('');
  }
  function cards(authors) {
    const rows=filterAuthors(authors,query,preferences.sort,preferences.format),list=preferences.view==='list',groups=new Map();
    const items=rows.map(person=>{const group=authorIndexValue(person,preferences.sort,preferences.format);let anchor='';if(!groups.has(group)){anchor='author-index-'+groups.size;groups.set(group,anchor);}return `<article ${anchor?`id="${anchor}"`:''} class="author-card-wrapper"><a class="author-entry" href="#/${routeFor(person)}">${photo(person)}<h2 data-user-content>${e(nameOf(person))}</h2><p class="author-institution" data-user-content>${institutionMarkup(person)}</p><div class="author-paper-count"><strong aria-label="${l('库内论文数','Library paper count')}">${person.paper_count}</strong></div></a><button type="button" class="author-card-edit" data-author-card-edit="${e(person.key)}" aria-label="${l('编辑作者信息','Edit author profile')}：${e(nameOf(person))}" title="${l('编辑信息','Edit profile')}">${icon('square-pen')}</button></article>`;}).join('');
    return `<div class="author-results-count">${rows.length} ${l('位作者','authors')}</div><div class="author-browser"><div class="author-entries ${list?'is-list':''}">${list&&rows.length?`<div class="author-list-head"><span></span><span>${l('姓名','Name')}</span><span>${l('机构','Institution')}</span><span>${l('论文数','Papers')}</span></div>`:''}${items||`<div class="notice">${l('没有匹配的作者。','No matching authors.')}</div>`}</div><nav class="author-index" aria-label="${l('作者索引','Author index')}">${[...groups].map(([label,anchor])=>`<button data-author-index="${anchor}" type="button">${e(label)}</button>`).join('')}</nav></div>`;
  }
  async function renderList(isCurrent = () => true) {
    const version = ++revision; switchOwner();
    shell(l('作者库', 'Author directory'), `<div class="content"><p role="status">${l('正在读取作者资料…', 'Loading authors…')}</p></div>`);
    await load(); if (!isCurrent() || revision !== version) return;
    const authors = people();
    shell(l('作者库', 'Author directory'), `<div class="content author-directory"><div class="row page-head"><div><div class="eyebrow">PEOPLE BEHIND THE PAPERS</div><h1 class="page-title">${l('作者库', 'Author directory')}.</h1></div><button id="authors-refresh">${icon('refresh-cw')} ${l('刷新', 'Refresh')}</button><button id="authors-match-all">${icon('sparkles')} ${l('匹配作者信息','Match author information')}</button></div><div class="author-toolbar"><div class="search-wrap">${icon('search')}<input id="authors-search" type="search" placeholder="${l('搜索姓名、别名、机构或邮箱…', 'Search names, aliases, institutions or email…')}" aria-label="${l('搜索作者', 'Search authors')}" value="${e(query)}"></div><label>${l('排序', 'Sort')}<select id="authors-sort"><option value="name" ${preferences.sort === 'name' ? 'selected' : ''}>${l('姓名首字母', 'Name A–Z')}</option><option value="papers" ${preferences.sort === 'papers' ? 'selected' : ''}>${l('库内论文数量', 'Library paper count')}</option></select></label><label>${l('姓名格式', 'Name format')}<select id="authors-format">${formatOptions(preferences.format)}</select></label><div class="view-switch"><button id="authors-cards" aria-label="${l('卡片视图', 'Card view')}" class="${preferences.view === 'cards' ? 'active' : ''}">${icon('layout-grid')}</button><button id="authors-list" aria-label="${l('列表视图', 'List view')}" class="${preferences.view === 'list' ? 'active' : ''}">${icon('list')}</button></div></div><div id="authors-results">${cards(authors)}</div></div>`);
    const paint = () => {const root=document.querySelector('#authors-results');if(!root)return;root.innerHTML=cards(people());bindIndex();bindCardActions();};listPaint=paint;bindIndex();bindCardActions();
    document.querySelector('#authors-search').oninput = event => {query = event.target.value; paint();};
    document.querySelector('#authors-sort').onchange = event => {preferences.sort = event.target.value; persist(); paint();};
    document.querySelector('#authors-format').onchange = event => {preferences.format = event.target.value; persist(); paint();};
    for (const [id, value] of [['authors-cards', 'cards'], ['authors-list', 'list']]) document.querySelector('#' + id).onclick = () => {preferences.view = value; persist(); document.querySelector('#authors-cards').classList.toggle('active', value === 'cards'); document.querySelector('#authors-list').classList.toggle('active', value === 'list'); paint();};
    document.querySelector('#authors-match-all').onclick = () => matchDialog();
    document.querySelector('#authors-refresh').onclick = event => busy(event.currentTarget, async () => {await load(true); await renderList(isCurrent);}); uiIcons();
  }
  function matchDialog() {
    const selected=new Set(),authors=people(),d=modal(l('匹配作者信息','Match author information'),`<input id="author-match-search" type="search" placeholder="${l('搜索姓名、机构或邮箱','Search names, institutions or email')}"><div class="row"><button id="author-match-select">${l('全选搜索结果','Select search results')}</button><span id="author-match-count"></span></div><div id="author-match-list" style="max-height:50vh;overflow:auto"></div><div class="actions"><button id="author-match-selected">${l('匹配选定作者','Match selected')}</button><button id="author-match-everyone" class="primary">${l('匹配所有作者','Match all authors')}</button></div>`,{wide:true});
    const results=()=>filterAuthors(authors,d.el.querySelector('#author-match-search').value,preferences.sort,preferences.format);
    const paint=()=>{d.el.querySelector('#author-match-count').textContent=l('已选择 ','Selected: ')+selected.size;d.el.querySelector('#author-match-selected').disabled=!selected.size;d.el.querySelector('#author-match-list').innerHTML=results().map(p=>`<label style="display:flex;gap:12px;padding:10px"><input type="checkbox" data-match-author="${e(p.key)}" ${selected.has(p.key)?'checked':''}><span data-user-content>${e(nameOf(p))}<small style="display:block">${e(p.institution)}</small></span></label>`).join('');d.el.querySelectorAll('[data-match-author]').forEach(input=>input.onchange=()=>{input.checked?selected.add(input.dataset.matchAuthor):selected.delete(input.dataset.matchAuthor);paint();});};
    d.el.querySelector('#author-match-search').oninput=paint;d.el.querySelector('#author-match-select').onclick=()=>{results().forEach(p=>selected.add(p.key));paint();};
    const run=keys=>{d.close();return startMaintenance({information:true,force:true,authorKeys:keys}).catch(error=>toast(error.message));};
    d.el.querySelector('#author-match-selected').onclick=()=>run([...selected]);d.el.querySelector('#author-match-everyone').onclick=()=>run(authors.map(p=>p.key));paint();
  }
  async function updateProfile(result) {
    if (result.profile.user_id !== ownerId()) throw Error(l('账号已切换，请重试', 'Account changed; retry'));
    const index = profiles.findIndex(p => p.id === result.profile.id);
    if (index >= 0) profiles[index] = result.profile; else profiles.push(result.profile);
    await signPhotos(); loadedAt = Date.now(); return people().find(p => p.profile?.id === result.profile.id);
  }
  async function savePerson(person, extra = {}) {
    if (state.demo) throw Error(l('请登录后编辑作者资料', 'Sign in to edit authors'));
    const profile = {first_name: person.first_name, last_name: person.last_name, institution: person.institution, email: person.email, aliases: person.aliases, orcid: person.orcid, profile_url: person.profile_url,scholar_url:person.scholar_url,researchgate_url:person.researchgate_url, name_format: person.name_format, ...extra};
    const result = await api('author_save', {author_key: person.key, profile});const updated=await updateProfile(result);paused=false;scheduleAutomatic();return updated;
  }
  async function renderDetail(key, isCurrent = () => true) {
    const version = ++revision; switchOwner();
    shell(l('作者资料', 'Author profile'), `<div class="content"><p role="status">${l('正在读取作者资料…', 'Loading author…')}</p></div>`);
    await load(); if (!isCurrent() || revision !== version) return;
    const person = people().find(p => p.key === key || p.identity_keys.includes(key));
    if (!person) {shell(l('作者资料', 'Author profile'), `<div class="content"><a href="#/author-directory">← ${l('返回作者库', 'Back to authors')}</a><p>${l('当前文献库中未找到这位作者。', 'This author is not in the current library.')}</p></div>`); return;}
    const currentPapers = researchPapers(person).map(p => p.id).sort(), keywordStale = person.keywords_generated_at && JSON.stringify(currentPapers) !== JSON.stringify([...person.keywords_paper_ids].sort());
    shell(l('作者资料', 'Author profile'), `<div class="content author-detail"><div class="row page-head"><div><a class="author-back" href="#/author-directory">← ${l('返回作者库', 'Back to authors')}</a><h1 class="page-title" data-user-content>${e(nameOf(person))}</h1></div><button id="author-edit">${icon('square-pen')} ${l('编辑信息', 'Edit profile')}</button></div><div class="author-detail-grid"><section class="author-papers"><div class="row"><h2>${l('库内论文', 'Library papers')} <small>${person.paper_count}</small></h2></div><div class="author-paper-tools"><input id="author-paper-search" type="search" placeholder="${l('搜索这位作者的论文…', 'Search this author’s papers…')}" aria-label="${l('搜索作者论文', 'Search author papers')}"><select id="author-paper-journal" aria-label="${l('筛选期刊','Filter journals')}"><option value="">${l('全部期刊','All journals')}</option>${[...new Set(person.papers.map(p=>journalFull(p)||l('未发表 / 待确认','Unpublished / unconfirmed')))].sort((a,b)=>a.localeCompare(b,'en')).map(j=>`<option value="${e(j)}">${e(j)}</option>`).join('')}</select><select id="author-paper-filter"><option value="all">${l('全部论文', 'All papers')}</option><option value="published">${l('已发表', 'Published')}</option><option value="other">${l('预印本 / 待确认', 'Preprints / unconfirmed')}</option></select></div><div id="author-papers"></div></section><aside class="author-information"><section class="author-info-card"><button class="author-photo-preview" id="author-photo-preview" ${!photos.has(person.photo_path) ? 'disabled' : ''}>${photo(person, true)}</button><details class="author-photo-menu"><summary>${l('照片设置', 'Photo options')}</summary><div class="author-photo-actions"><button id="author-photo-match">${l('一键匹配照片','Match photo')}</button><button id="author-photo-auto">${l('查看候选','Review candidates')}</button><button id="author-photo-manual">${l('选择照片', 'Choose photo')}</button></div></details>${person.photo_source_url ? `<a class="author-photo-source" href="${e(safeURL(person.photo_source_url))}" target="_blank" rel="noopener">${l('照片来源', 'Photo source')} ↗</a>` : ''}<dl><dt>${l('姓名', 'Name')}</dt><dd data-user-content>${e(nameOf(person))}</dd><dt>${l('机构', 'Institution')}</dt><dd data-user-content>${institutionMarkup(person,{detail:true})}</dd><dt>${l('邮箱', 'Email')}</dt><dd data-user-content>${person.email ? `<a href="mailto:${e(person.email)}">${e(person.email)}</a>` : '—'}</dd><dt>ORCID</dt><dd>${person.orcid ? `<a href="https://orcid.org/${e(person.orcid)}" target="_blank" rel="noopener">${e(person.orcid)}</a>` : '—'}</dd>${person.profile_url ? `<dt>${l('主页', 'Homepage')}</dt><dd><a href="${e(safeURL(person.profile_url))}" target="_blank" rel="noopener">${l('作者主页', 'Author homepage')} ↗</a></dd>` : ''}<dt>Google Scholar</dt><dd>${person.scholar_url?`<a href="${e(safeURL(person.scholar_url))}" target="_blank" rel="noopener">Google Scholar ↗</a>`:'—'}</dd><dt>ResearchGate</dt><dd>${person.researchgate_url?`<a href="${e(safeURL(person.researchgate_url))}" target="_blank" rel="noopener">ResearchGate ↗</a>`:'—'}</dd></dl>${academicStats(person)}<details><summary>${l('其他姓名写法', 'Other names')} (${person.aliases.length})</summary><ul class="author-aliases" data-user-content>${person.aliases.map(n => `<li>${e(n)}</li>`).join('')}</ul></details></section><section class="author-info-card"><div class="row"><h2>${l('学术关键词', 'Research keywords')}</h2></div><div class="author-keywords">${person.keywords.map(k => `<span class="badge" title="${e(k.en)}" data-user-content>${e(getLanguage() === 'en' && k.en ? k.en : k.zh)}</span>`).join('') || ''}</div>${person.research_summary ? `<p class="author-research-summary" data-user-content>${e(person.research_summary)}</p>` : ''}${person.keywords_generated_at ? `<small>${l('依据 ', 'Based on ')}${person.keywords_paper_ids.length} ${l('篇库内论文（含 arXiv）', 'library papers (including arXiv)')}${keywordStale ? ' · ' + l('文献已更新，可重新生成', 'Library changed; regenerate to update') : ''}</small>` : ''}<button id="author-keywords" class="primary">${icon('sparkles')} ${person.keywords.length ? l('重新生成关键词', 'Regenerate keywords') : l('生成学术关键词', 'Generate research keywords')}</button></section></aside></div></div>`);
    const paperResults = () => {
      const q = document.querySelector('#author-paper-search').value.trim().toLowerCase(), mode = document.querySelector('#author-paper-filter').value;
      const journal=document.querySelector('#author-paper-journal').value;const rows = searchAuthorPapers(person.papers,q).filter(p => (mode === 'all' || (mode === 'published') === publishedPaper(p)) && (!journal||(journalFull(p)||l('未发表 / 待确认','Unpublished / unconfirmed'))===journal));
      document.querySelector('#author-papers').innerHTML = rows.map(p => `<a class="author-paper" href="#/paper/${encodeURIComponent(p.id)}"><h3 data-user-content>${e(p.title)}</h3><p class="author-paper-authors" data-user-content>${e((p.authors || []).map(a => typeof a === 'string' ? a : a.name || '').filter(Boolean).join('; ') || l('作者待确认', 'Authors unconfirmed'))}</p><p data-user-content>${e(journalFull(p) || l('预印本 / 待确认', 'Preprint / unconfirmed'))} · ${e(p.published_at || p.arxiv_date || '—')}</p>${(p.keyword_pairs || []).slice(0, 4).map(k => `<span class="badge" data-user-content>${e(getLanguage() === 'en' && k.en ? k.en : k.zh)}</span>`).join('')}</a>`).join('') || `<p class="notice">${l('没有匹配的论文。', 'No matching papers.')}</p>`;
    };
    document.querySelector('#author-paper-journal').onchange=paperResults;document.querySelector('#author-paper-search').oninput = paperResults; document.querySelector('#author-paper-filter').onchange = paperResults; paperResults();
    document.querySelector('#author-edit').onclick = () => editPerson(person);
    document.querySelector('#author-photo-match').onclick=event=>busy(event.currentTarget,async()=>{const result=await api('author_match_photo',{author_key:person.key});if(result.in_progress){toast(l('正在匹配照片，请稍候','Photo matching is in progress'));return;}const updated=await updateProfile(result);go(routeFor(updated));toast(updated.photo_path?l('作者照片已保存','Author photo saved'):l('没有找到可确认的照片，可查看候选或手动上传','No verified match; review candidates or upload a photo'));});
    document.querySelector('#author-photo-manual').onclick = () => manualPhoto(person);
    document.querySelector('#author-photo-auto').onclick = () => photoCandidates(person);
    document.querySelector('#author-photo-preview').onclick = () => {const url = photos.get(person.photo_path);if (url) modal(l('作者照片', 'Author photo'), `<img class="author-photo-full" src="${e(url)}" alt="${e(nameOf(person))}">`, {wide: true});};
    document.querySelector('#author-keywords').onclick = event => busy(event.currentTarget, async () => {const id = ownerId();const result = await api('author_keywords', {author_key: person.key});if(result.in_progress){toast(l('正在生成关键词，请稍候','Keywords are being generated'));return;}if (id !== ownerId()) return; const updated = await updateProfile(result);if (isCurrent()) go(routeFor(updated));toast(l('作者学术关键词已保存', 'Research keywords saved'));}); uiIcons();
  }
  function editPerson(person) {
    const d = modal(l('编辑作者信息', 'Edit author profile'), `<form id="author-edit-form"><div class="author-edit-fields"><label>${l('名 / Given name', 'Given name')}<input name="first_name" maxlength="200" value="${e(person.first_name)}"></label><label>${l('姓 / Family name', 'Family name')}<input name="last_name" maxlength="200" value="${e(person.last_name)}"></label><label>${l('姓名格式', 'Name format')}<select name="name_format">${formatOptions(person.name_format, true)}</select></label><label>ORCID<input name="orcid" value="${e(person.orcid)}" placeholder="0000-0000-0000-0000"></label></div><label>${l('其他姓名写法（一行一个）', 'Other names (one per line)')}<textarea name="aliases" rows="5">${e(person.aliases.join('\n'))}</textarea></label><label>${l('机构', 'Institution')}<textarea name="institution" rows="2" maxlength="1500">${e(person.institution)}</textarea></label><label>${l('邮箱', 'Email')}<input name="email" type="email" value="${e(person.email)}"></label><label>${l('作者主页（HTTPS）', 'Homepage (HTTPS)')}<input name="profile_url" type="url" value="${e(person.profile_url)}"></label><label>Google Scholar<input name="scholar_url" type="url" value="${e(person.scholar_url||'')}" placeholder="https://scholar.google.com/citations?user=…"></label><label>ResearchGate<input name="researchgate_url" type="url" value="${e(person.researchgate_url||'')}" placeholder="https://www.researchgate.net/profile/…"></label><label>${l('学术关键词（一行一个，可填写 中文 | English）', 'Research keywords (one per line; Chinese | English)')}<textarea name="research_keywords" rows="5">${e(person.keywords.map(k => k.zh + (k.en ? ' | ' + k.en : '')).join('\n'))}</textarea></label><div class="actions"><button id="author-edit-match" type="button">${l('自动匹配信息','Match information')}</button><button class="primary" type="submit">${l('保存作者信息', 'Save profile')}</button></div></form>`, {wide: true});
    d.el.querySelector('#author-edit-match').onclick=event=>busy(event.currentTarget,async()=>{
      const id=ownerId();let result=await api('author_match_information',{author_key:person.key,automatic:false});if(id!==ownerId())return;person=await updateProfile(result)||person;if((result.information_fields||[]).some(field=>['aliases','orcid'].includes(field))){result=await api('author_match_information',{author_key:person.key,automatic:false});if(id!==ownerId())return;person=await updateProfile(result)||person;}
      const form=d.el.querySelector('form');for(const field of ['first_name','last_name','institution','email','orcid','profile_url','scholar_url','researchgate_url']){const input=form.querySelector('[name='+field+']');if(input&&!input.value)input.value=person[field]||'';}const aliases=form.querySelector('[name=aliases]');aliases.value=[...new Set([...aliases.value.split(/\r?\n/),...person.aliases])].filter(Boolean).join('\n');toast(l('匹配完成，已保留手动填写的信息','Matching complete; manual entries preserved'));
    });
    d.el.querySelector('form').onsubmit = event => {event.preventDefault();return busy(event.currentTarget.querySelector('[type=submit]'), async () => {
      const data = Object.fromEntries(new FormData(event.currentTarget));data.aliases = data.aliases.split(/\r?\n/).map(n => n.trim()).filter(Boolean);data.keywords = data.research_keywords.split(/\r?\n/).map(line => {const [zh, ...en] = line.split('|');return {zh: zh.trim(), en: en.join('|').trim()};}).filter(k => k.zh);delete data.research_keywords;
      const id = ownerId(), updated = await savePerson(person, data);if (id !== ownerId()) return;d.close();go(routeFor(updated));toast(l('作者资料已保存', 'Author profile saved'));
    });};
  }
  async function uploadPhoto(person, blob, source = 'manual', sourceURL = '') {
    const id = ownerId(), bitmap = await createImageBitmap(blob), scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height)), canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));canvas.height = Math.max(1, Math.round(bitmap.height * scale));canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);bitmap.close();
    const photo = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .88));if (!photo || photo.size > 2000000) throw Error(l('照片过大，请裁剪后重试', 'Photo too large; crop it and retry'));
    if (id !== ownerId()) throw Error(l('账号已切换，请重试', 'Account changed; retry'));await ensureStorageSpace(photo.size);
    const path = id + '/' + crypto.randomUUID() + '.jpg', uploaded = await db.storage.from('avatars').upload(path, photo, {contentType: 'image/jpeg'});if (uploaded.error) throw uploaded.error;
    const updated = await savePerson(person, {photo_path: path, photo_source: source, photo_source_url: sourceURL});if (id !== ownerId()) return;go(routeFor(updated));toast(l('作者照片已保存', 'Author photo saved'));
  }
  function manualPhoto(person) {
    let dialog;
    openPhotoInput({overlay: (title, html) => {dialog = modal(title, html, {wide: true});dialog.el.id = 'review-overlay';}, close: () => dialog?.close(), onAutoMatch: () => {dialog?.close();photoCandidates(person);}, onChoose: file => uploadPhoto(person, file), onError: error => toast(error.message)});
  }
  function photoCandidates(person) {
    const d = modal(l('自动匹配作者照片', 'Find an author photo'), `<div class="author-photo-review-tools"><label><input type="checkbox" id="author-photo-expand">${l('扩大到仅按姓名搜索', 'Expand to name-only search')}</label><span class="help-tooltip" tabindex="0">?<span role="tooltip">${l('使用作者姓名、机构与作者主页查找公开照片；不发送论文全文或账户数据。姓名相同不代表同一人，请核对来源与机构后选择。', 'Search public photos using the author’s name, institution and homepage. Paper full text and account data are not sent. Verify identity and affiliation before selecting.')}</span></span></div><div id="author-photo-results" role="status"></div><div class="actions"><button id="author-photo-next">${l('换一组 / 重试', 'More results / retry')}</button><button id="author-photo-local">${l('手动上传与裁剪', 'Upload and crop')}</button></div>`, {wide: true});
    let exclude = [], candidates = [];
    const search = () => busy(d.el.querySelector('#author-photo-next'), async () => {
      const resultRoot = d.el.querySelector('#author-photo-results');resultRoot.textContent = l('正在搜索公开照片…', 'Searching public photos…');const id = ownerId();
      const result = await api('author_photo_candidates', {author_key: person.key, expand: d.el.querySelector('#author-photo-expand').checked, exclude});if (id !== ownerId() || !d.el.isConnected) return;
      candidates = result.candidates || [];exclude.push(...candidates.map(c => c.key));exclude = exclude.slice(-50);
      resultRoot.innerHTML = `<div class="author-photo-candidates">${candidates.map((c, i) => `<article><img src="${e(c.image)}" alt="${e(c.title || nameOf(person))}" loading="lazy"><p data-user-content>${e(c.title || c.provider || '')}</p><small>${e(c.provider || '')}</small>${safeURL(c.source) ? `<a href="${e(c.source)}" target="_blank" rel="noopener">${l('查看来源', 'View source')} ↗</a>` : ''}<small>${c.exact ? l('姓名与机构等线索匹配，仍请核对', 'Name and identity clues match; please verify') : l('候选照片，请人工核对身份', 'Candidate photo; verify identity')}</small><button data-author-photo-pick="${i}" class="primary">${l('使用此照片', 'Use this photo')}</button></article>`).join('') || `<p>${result.unavailable ? l('部分公开来源暂不可用，可稍后重试或手动上传。', 'Some sources are unavailable. Retry later or upload a photo.') : l('没有找到可核实的照片，可扩大搜索或手动上传。', 'No verifiable photo found. Expand the search or upload a photo.')}</p>`}</div>`;
      resultRoot.querySelectorAll('[data-author-photo-pick]').forEach(button => button.onclick = event => busy(event.currentTarget, async () => {const candidate = candidates[+button.dataset.authorPhotoPick];const blob = await (await fetch(candidate.image)).blob();await uploadPhoto(person, blob, 'auto', candidate.source);d.close();}));
    });
    d.el.querySelector('#author-photo-next').onclick = search;d.el.querySelector('#author-photo-expand').onchange = () => {exclude = [];search();};d.el.querySelector('#author-photo-local').onclick = () => {d.close();manualPhoto(person);};search();
  }
  function bindCardActions(){document.querySelectorAll('[data-author-card-edit]').forEach(button=>button.onclick=event=>{event.preventDefault();event.stopPropagation();const person=people().find(p=>p.key===button.dataset.authorCardEdit||p.identity_keys.includes(button.dataset.authorCardEdit));if(person)editPerson(person);});uiIcons();}
  function bindIndex(){document.querySelectorAll('[data-author-index]').forEach(button=>button.onclick=()=>{const target=document.getElementById(button.dataset.authorIndex);target?.scrollIntoView?.({behavior:'smooth',block:'start'});document.querySelectorAll('[data-author-index]').forEach(b=>b.classList.toggle('active',b===button));});}
  function paintMaintenance(){
    let banner=document.querySelector('#author-maintenance-status');
    if(!maintenance?.running){banner?.remove();return;}
    if(!banner){banner=document.createElement('div');banner.id='author-maintenance-status';banner.setAttribute('role','status');document.body.append(banner);}
    banner.innerHTML=`<strong>${l('作者资料自动补全','Updating author profiles')} · ${maintenance.completed}/${maintenance.total}</strong><span>${l('资料已补全 ','Profiles updated: ')}${maintenance.information} · ${l('照片已匹配 ','Photos matched: ')}${maintenance.found} · ${l('关键词已完成 ','Keywords: ')}${maintenance.keywords}${maintenance.errors?' · '+l('未完成 ','Incomplete: ')+maintenance.errors:''}</span><button>${l('停止','Stop')}</button>`;
    banner.querySelector('button').onclick=stop;
  }
  function stop(){pendingRequest=null;paused=true;if(maintenance)maintenance.stopped=true;clearTimeout(maintenanceTimer);clearTimeout(repaintTimer);paintMaintenance();}
  async function mergeBackground(result){
    if(result.profile?.user_id!==ownerId())return;
    const profile=result.profile,index=profiles.findIndex(p=>p.id===profile.id);if(index<0)profiles.push(profile);else if(!profile.updated_at||!profiles[index].updated_at||Date.parse(profile.updated_at)>=Date.parse(profiles[index].updated_at))profiles[index]=profile;
    if(profile.photo_path&&!photos.has(profile.photo_path)){const signed=await cachedAuthorPhotos(db,ownerId(),[profile.photo_path]);if(profile.user_id===ownerId())for(const [path,url] of signed)photos.set(path,url);}
    clearTimeout(repaintTimer);repaintTimer=setTimeout(()=>{if(document.querySelector('#authors-results'))listPaint?.();else if(location.hash.startsWith('#/author/')&&!document.querySelector('.dialog-backdrop')&&!document.activeElement?.matches('input,textarea,select')){const key=decodeURIComponent(location.hash.slice('#/author/'.length));if(key==='profile:'+profile.id||profile.identity_keys?.includes(key))renderDetail(key,()=>location.hash==='#/author/'+encodeURIComponent(key)).catch(error=>toast(error.message));}},500);
  }
  async function startMaintenance({photosOnly=false,information=false,force=false,authorKeys=null}={}){
    if(!state.user||state.demo||state.isAdmin)return;
    if(maintenance?.running){if(force&&(photosOnly||information)){pendingRequest={photosOnly,information,force,authorKeys};maintenance.stopped=true;}rescan=true;return;}
    if(paused&&!force)return;paused=false;const prior=JSON.stringify(profiles.map(p=>[p.id,p.updated_at]));await load(true);const id=ownerId();
    if(prior!==JSON.stringify(profiles.map(p=>[p.id,p.updated_at]))){if(document.querySelector('#authors-results'))listPaint?.();else if(location.hash.startsWith('#/author/')&&!document.querySelector('.dialog-backdrop')){const route=location.hash,key=decodeURIComponent(route.slice('#/author/'.length));renderDetail(key,()=>location.hash===route).catch(error=>toast(error.message));}}
    const selectedPeople=people().filter(p=>!authorKeys||authorKeys.includes(p.key));const tasks=authorEnrichmentTasks(selectedPeople,{photosOnly,force:information?false:force});if(information)tasks.unshift(...selectedPeople.map(person=>({kind:'information',author_key:person.key,identity_keys:person.identity_keys})));if(!tasks.length){if(profiles.some(p=>p.photo_lookup_status==='running'||p.keywords_lookup_status==='running'))maintenanceTimer=setTimeout(()=>startMaintenance().catch(error=>toast(error.message)),10000);return;}
    const job={running:true,stopped:false,total:tasks.length,completed:0,found:0,information:0,keywords:0,errors:0};maintenance=job;paintMaintenance();let next=0,resumeAt=0;
    const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    async function worker(){while(next<tasks.length&&!job.stopped&&id===ownerId()){
      while(state.batchBusy&&!job.stopped)await wait(1200);if(job.stopped||id!==ownerId())break;
      const task=tasks[next++];for(let attempt=0;;attempt++){
        while(resumeAt>Date.now()&&!job.stopped)await wait(Math.min(1200,resumeAt-Date.now()));if(job.stopped||id!==ownerId())break;
        try{const current=people().find(p=>p.key===task.author_key||p.identity_keys.some(key=>task.identity_keys.includes(key)));if(!current)break;
          const result=await api(task.kind==='information'?'author_match_information':task.kind==='photo'?'author_match_photo':'author_keywords',{author_key:current.key,automatic:!force});if(id!==ownerId())return;
          await mergeBackground(result);if(task.kind==='information'&&!result.skipped&&result.information_status==='updated'){job.information++;rescan=true;if(!task.enrichedOnce&&(result.information_fields||[]).some(field=>['aliases','orcid','scholar_url','researchgate_url','profile_url'].includes(field))){tasks.push({kind:'information',author_key:'profile:'+result.profile.id,identity_keys:result.profile.identity_keys||current.identity_keys,enrichedOnce:true});job.total++;}}if(task.kind==='photo'&&result.profile?.photo_path)job.found++;if(task.kind==='keywords'&&!result.skipped)job.keywords++;break;
        }catch(error){if(error.status===429&&attempt<3){resumeAt=Math.max(resumeAt,Date.now()+(error.retryAfter||61)*1000);continue;}job.errors++;break;}
      }job.completed++;paintMaintenance();
    }}
    try{await Promise.all([worker(),worker()]);}finally{job.running=false;paintMaintenance();if(id===ownerId()&&force)toast(information?l('作者信息匹配已完成','Author information matching complete'):l('照片匹配已完成：','Photo matching complete: ')+job.found);if(pendingRequest&&id===ownerId()){const request=pendingRequest;pendingRequest=null;await startMaintenance(request);}else if(rescan&&!job.stopped){rescan=false;scheduleAutomatic();}}
  }
  function scheduleAutomatic(){if(!state.user||state.demo||state.isAdmin)return;clearTimeout(maintenanceTimer);maintenanceTimer=setTimeout(()=>startMaintenance().catch(error=>toast(error.message)),1400);}
  document.addEventListener('pa-authors-changed',()=>{paused=false;scheduleAutomatic();});
  return {renderList, renderDetail, scheduleAutomatic, stop,reset(){stop();clearAuthorPhotoCache(owner);clearAuthorPhotoCache(ownerId());photos.clear();owner='';paused=false;}};
}
