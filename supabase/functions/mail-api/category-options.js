export const CATEGORY_ICONS=['folder','mail','inbox','send','book-open','file','feather','star','contact-round','shield-check','info','paperclip','languages','sparkles','camera','archive'];
export const CATEGORY_COLORS=['#638b82','#4779a7','#7b68ac','#b36c9b','#b9665a','#c58b55','#9b994b','#5d8a54','#437d86','#6f7885'];
export function categoryIcon(value){return CATEGORY_ICONS.includes(value)?value:'folder';}
export function moveCategory(ids,id,target){const next=[...ids],from=next.indexOf(id);if(from<0||target<0||target>=next.length)return next;next.splice(from,1);next.splice(target,0,id);return next;}
