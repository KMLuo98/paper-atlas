export function categorySignature(categories){return JSON.stringify(categories.map(c=>({id:c.id,name:c.name,description:c.description||''})).sort((a,b)=>a.id.localeCompare(b.id)));}
