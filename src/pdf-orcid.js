// PDF ORCID icons are link annotations, often absent from getTextContent().
export function pdfORCIDLinks(annotations,items){
 const rows=[];
 for(const a of annotations||[]){
  let url;try{url=new URL(a.url||'');}catch{continue;}
  if(!['https:','http:'].includes(url.protocol)||! /^(?:www\.)?orcid\.org$/i.test(url.hostname)||url.username||url.password||url.port)continue;
  const id=url.pathname.match(/^\/(\d{4}-\d{4}-\d{4}-\d{3}[\dX])\/?$/i)?.[1];if(!id)continue;
  const rect=a.rect;if(!Array.isArray(rect)||rect.length!==4||!rect.every(Number.isFinite))continue;
  const x=(rect[0]+rect[2])/2,y=(rect[1]+rect[3])/2;
  const near=items.filter(item=>item.str?.trim()&&Array.isArray(item.transform)&&Math.abs(item.transform[5]-y)<=Math.max(14,Math.abs(rect[3]-rect[1])+4)&&Math.abs(item.transform[4]-x)<220).sort((a,b)=>a.transform[4]-b.transform[4]);
  const context=near.map(item=>item.str).join(' ').slice(0,500);
  rows.push(`ORCID link: https://orcid.org/${id.toUpperCase()} | nearby text (not a confirmed author assignment): ${context||'[no nearby text]'}`);
 }
 return [...new Set(rows)].slice(0,300).join('\n');
}
