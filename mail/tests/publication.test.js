import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {mailPublication} from '../../scripts/mail-publication.mjs';
import {largerEmailFonts} from '../src/typography.js';
const built='<link rel="icon" href="./assets/favicon-a.svg"><script type="module" src="./assets/app-a.js"></script><link rel="stylesheet" href="./assets/app-a.css">';
test('the canonical entry loads current compiled assets and legacy URLs preserve OAuth fragments',()=>{
 const {manifest,redirect}=mailPublication(built);assert.equal(manifest.script,'https://kmluo98.github.io/paper-atlas/mail/assets/app-a.js');assert.equal(manifest.styles[0],'https://kmluo98.github.io/paper-atlas/mail/assets/app-a.css');
 let destination;vm.runInNewContext(redirect.match(/<script>([\s\S]*?)<\/script>/)[1],{location:{search:'?example=1',hash:'#settings?oauth=success',replace:url=>{destination=url;}}});assert.equal(destination,'https://kmluo98.github.io/mail/?example=1#settings?oauth=success');
 assert.throws(()=>mailPublication(built.replace('./assets/app-a.js','https://untrusted.example/app.js')),/Unexpected/);
});
test('incoming HTML fixed sizes grow by 2pt without changing links or hidden text',()=>{
 const html='<style>p{font-size:12pt}small{font:italic 10px/1.5 Arial}</style><p style="font-size:14px!important">Example</p><span style="font-size:0">hidden</span><a href="https://example.edu/font-size:10px">link</a>';
 const result=largerEmailFonts(html);assert.match(result,/font-size:calc\(12pt \+ 2pt\)/);assert.match(result,/font:italic calc\(10px \+ 2pt\)/);assert.match(result,/font-size:calc\(14px \+ 2pt\)!important/);assert.match(result,/style="font-size:0"/);assert.match(result,/href="https:\/\/example.edu\/font-size:10px"/);
});
