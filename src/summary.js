import {escapeHTML as e} from './core.js';
import {cleanResearchSummary} from '../supabase/functions/_shared/summary-content.js';

const labels = {'研究问题':'问题','研究目标':'问题','问题':'问题','研究模型':'模型','模型':'模型','模型与方法':'模型与方法','方法与模型':'模型与方法','方法':'模型与方法','研究方法':'模型与方法','主要结论/现象':'结论与现象','主要结论与现象':'结论与现象','主要结论':'结论与现象','结论/现象':'结论与现象','结论':'结论与现象','结果':'结论与现象','局限':'局限与待核验','局限性':'局限与待核验','局限与待核验':'局限与待核验','待核验':'局限与待核验'};
const headings = /(?:^|[\r\n]|(?<=[。；;]))[ \t]*(?:#{1,4}\s*)?(?:\*\*)?(研究问题|研究目标|问题|研究模型|模型与方法|方法与模型|模型|研究方法|方法|主要结论\/现象|主要结论与现象|主要结论|结论\/现象|结论|结果|局限与待核验|局限性|局限|待核验)(?:\*\*)?\s*[:：](?:\*\*)?[ \t]*/gu;
export function summarySections(value) {
  const text = String(value || '').trim(), matches = [...text.matchAll(headings)];
  if (!matches.length) {const content=cleanResearchSummary(text);return content ? [{heading:'',text:content}] : [];}
  const sections = [], prefix = cleanResearchSummary(text.slice(0,matches[0].index));
  if(prefix)sections.push({heading:'',text:prefix});
  matches.forEach((match,index)=>{
    const content = cleanResearchSummary(text.slice(match.index+match[0].length,matches[index+1]?.index??text.length));
    if(content)sections.push({heading:labels[match[1]],text:content});
  });
  return sections;
}
export function renderSummary(value, fallback = '') {
  return summarySections(value || fallback).map(section=>`<section class="summary-section">${section.heading?`<h4 data-summary-heading="${e(section.heading)}">${e(section.heading)}：</h4>`:''}<p>${e(section.text)}</p></section>`).join('');
}
