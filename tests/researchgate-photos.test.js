import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {researchGateProfile,researchGateAvatar,researchGatePage,discoverResearchGatePhotos} from '../supabase/functions/_shared/researchgate-photos.js';
import {photoIdentityEvidence} from '../supabase/functions/_shared/author-photos.js';
const source='https://www.researchgate.net/profile/Alice-Smith';
const avatar='https://i1.rgstatic.net/ii/profile.image/12345/Alice-Smith.png';
const person={name:'Alice Smith',organization:'Example University'};
test('ResearchGate accepts only public profile links and avatar CDN paths',()=>{
 assert.equal(researchGateProfile(source+'?x=1'),source);
 for(const url of [source+'/publication/12','https://researchgate.net.evil.org/profile/Alice','https://www.researchgate.net/publication/12','http://www.researchgate.net/profile/Alice'])assert.equal(researchGateProfile(url),'');
 assert.equal(researchGateAvatar(avatar),avatar);
 for(const url of ['https://i1.rgstatic.net/publication/123/figure.png','https://evil.org/ii/profile.image/Alice.png','https://i1.rgstatic.net/ii/profile.image/default.png'])assert.equal(researchGateAvatar(url),'');
});
test('ResearchGate profile uses owner avatar with school evidence and excludes unrelated images',()=>{
 const html=`<html><head><title>Alice SMITH | Example University</title><meta property="og:image" content="${avatar}"></head><body><h1>Alice Smith</h1>Example University<img src="https://i1.rgstatic.net/ii/profile.image/88/Bob.png"></body></html>`;
 const items=researchGatePage(html,source,person,parseHTML,photoIdentityEvidence);
 assert.equal(items.length,1);assert.equal(items[0].url,avatar);assert.equal(items[0].exact,true);
 assert.deepEqual(researchGatePage(html.replaceAll('Example University','Other College'),source,person,parseHTML,photoIdentityEvidence),[]);
 assert.deepEqual(researchGatePage(html.replaceAll('Alice','Bob'),source,person,parseHTML,photoIdentityEvidence),[]);
 assert.deepEqual(researchGatePage('<title>Just a moment</title>'+html,source,person,parseHTML,photoIdentityEvidence),[]);
});
test('ResearchGate unavailable sources fail independently without breaking photo search',async()=>{
 const result=await discoverResearchGatePhotos(person,parseHTML,{resolve:async()=>{throw Error('Unavailable');}},photoIdentityEvidence);
 assert.deepEqual(result.items,[]);assert.equal(result.unavailable,true);
});
