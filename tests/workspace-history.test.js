import assert from 'node:assert/strict';
import test from 'node:test';
import {protectWorkspaceEntry,restoreWorkspaceEntry,pushWorkspacePage} from '../src/workspace-history.js';

test('workspace entry replaces login and installs a single same-page history boundary',()=>{
  const entries=[{url:'#/login',state:null}];
  const history={
    get state(){return entries.at(-1).state;},
    replaceState(state,_,url){entries[entries.length-1]={state,url};},
    pushState(state,_,url){entries.push({state,url});}
  };
  protectWorkspaceEntry(history,'#/library');
  protectWorkspaceEntry(history,'#/library');
  assert.deepEqual(entries.map(entry=>[entry.url,entry.state.paWorkspace]),[['#/library','boundary'],['#/library','entry']]);
});

test('back from a regular app page traverses normally and a signed-in boundary restores the entry',()=>{
  let forwards=0;
  const history={forward(){forwards++;}};
  restoreWorkspaceEntry(history,{paWorkspace:'page'},true);
  restoreWorkspaceEntry(history,{paWorkspace:'entry'},true);
  restoreWorkspaceEntry(history,{paWorkspace:'boundary'},false);
  assert.equal(forwards,0);
  restoreWorkspaceEntry(history,{paWorkspace:'boundary'},true);
  assert.equal(forwards,1);
});

test('app buttons record source pages in order, without treating login as a workspace page',()=>{
  const entries=[],history={pushState:(state,_,url)=>entries.push({state,url})};
  pushWorkspacePage(history,'#/authors','#/author/example',true);
  pushWorkspacePage(history,'#/author/example','#/paper/one',true);
  pushWorkspacePage(history,'#/paper/one','#/login',false);
  assert.deepEqual(entries.map(({state})=>state.paFrom),['#/authors','#/author/example',undefined]);
});
