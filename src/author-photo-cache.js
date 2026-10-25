// Uploaded avatar paths are immutable UUIDs. Keep the same local URL across views.
const owners=new Map(),MAX_BYTES=64*1024*1024,MAX_ITEMS=2000;
export function clearAuthorPhotoCache(owner){const cache=owners.get(owner);if(!cache)return;owners.delete(owner);for(const row of cache.entries.values())if(row.local)URL.revokeObjectURL(row.url);}
export async function cachedAuthorPhotos(db,owner,paths,{fetcher=fetch}={}){
 if(!db||!owner)return new Map();
 let cache=owners.get(owner);if(!cache){cache={entries:new Map(),pending:new Map(),bytes:0};owners.set(owner,cache);}
 const wanted=[...new Set(paths.filter(p=>typeof p==='string'&&p.startsWith(owner+'/')))],missing=wanted.filter(path=>{const row=cache.entries.get(path);return !cache.pending.has(path)&&(!row||!row.local&&row.expires<Date.now());});
 for(let start=0;start<missing.length;start+=100){const batch=missing.slice(start,start+100);
  const work=(async()=>{
   const response=await db.storage.from('avatars').createSignedUrls(batch,3600);if(response.error)throw response.error;
   const rows=(response.data||[]).filter(r=>r.signedUrl&&!r.error),result=new Map();let next=0;
   const worker=async()=>{while(next<rows.length){const row=rows[next++];let url=row.signedUrl,local=false,bytes=0;
    try{const r=await fetcher(url,{signal:AbortSignal.timeout(10000)});if(r.ok&&/^image\/(?:jpeg|png|webp)/i.test(r.headers.get('content-type')||'')&&Number(r.headers.get('content-length')||0)<=2500000){const blob=await r.blob();if(blob.size<=2500000&&owners.get(owner)===cache&&cache.bytes+blob.size<=MAX_BYTES){url=URL.createObjectURL(blob);local=true;bytes=blob.size;}}}catch{/* A stable signed URL remains a usable fallback. */}
    if(owners.get(owner)!==cache){if(local)URL.revokeObjectURL(url);continue;}
    const prior=cache.entries.get(row.path);if(prior?.local){URL.revokeObjectURL(prior.url);cache.bytes-=prior.bytes;}cache.entries.delete(row.path);cache.entries.set(row.path,{url,local,bytes,expires:Date.now()+50*60000});cache.bytes+=bytes;result.set(row.path,{url,signed:row.signedUrl});
    while(cache.entries.size>MAX_ITEMS){const key=cache.entries.keys().next().value,old=cache.entries.get(key);if(old.local)URL.revokeObjectURL(old.url);cache.bytes-=old.bytes;cache.entries.delete(key);}
   }};await Promise.all(Array.from({length:Math.min(8,rows.length)},worker));return result;
  })();
  for(const path of batch){const pending=work.then(rows=>rows.get(path));cache.pending.set(path,pending);pending.finally(()=>{if(cache.pending.get(path)===pending)cache.pending.delete(path);}).catch(()=>{});}
 }
 const result=new Map();await Promise.all(wanted.map(async path=>{const pending=cache.pending.get(path),row=pending?await pending:null,url=cache.entries.get(path)?.url||row?.signed;if(url&&owners.get(owner)===cache){result.set(path,url);const row=cache.entries.get(path);if(row){cache.entries.delete(path);cache.entries.set(path,row);}}}));return result;
}
