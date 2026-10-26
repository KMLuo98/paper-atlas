export function createReaderExchange(mainSlot,main,onChange=()=>{}){
 let swapped=null;const compact=()=>{main.controller?.()?.setCompact?.(!!swapped);swapped?.entry.controller?.()?.setCompact?.(false);};
 function restore(){if(!swapped)return;const {entry,slot}=swapped;slot.replaceChildren(entry.node);mainSlot.replaceChildren(main.node);entry.controller?.()?.setCompact?.(true);swapped=null;compact();onChange(main);}
 return {main,swap(entry,slot){const same=swapped?.entry===entry;restore();if(same)return;slot.replaceChildren(main.node);mainSlot.replaceChildren(entry.node);swapped={entry,slot};compact();onChange(entry);},close(entry){if(swapped?.entry===entry)restore();},current:()=>swapped?.entry||main,refresh:compact,destroy:restore};
}
