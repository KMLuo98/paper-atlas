export function installAttachmentDrop({getEditor,onFiles,onError}){
 let highlighted=null;
 const clear=()=>{highlighted?.classList.remove('attachment-dragging');highlighted=null;};
 const filesDragged=event=>Array.from(event.dataTransfer?.types||[]).includes('Files');
 for(const type of ['dragenter','dragover'])document.addEventListener(type,event=>{
  const editor=getEditor();if(!editor||!filesDragged(event))return;
  event.preventDefault();const inside=editor.contains(event.target);
  if(event.dataTransfer)event.dataTransfer.dropEffect=inside?'copy':'none';
  if(!inside){clear();return;}if(highlighted!==editor){clear();highlighted=editor;editor.classList.add('attachment-dragging');}
 });
 document.addEventListener('dragleave',event=>{if(!event.relatedTarget)clear();});
 document.addEventListener('dragend',clear);
 document.addEventListener('drop',event=>{
  const editor=getEditor();clear();if(!editor||!filesDragged(event))return;
  event.preventDefault();event.stopPropagation();
  if(!editor.contains(event.target)){onError(Error('请将文件拖入邮件编辑区'));return;}
  if(Array.from(event.dataTransfer.items||[]).some(item=>item.webkitGetAsEntry?.()?.isDirectory)){onError(Error('请拖入文件，暂不支持文件夹'));return;}
  const files=Array.from(event.dataTransfer.files||[]);if(files.length)Promise.resolve(onFiles(files)).catch(onError);
 });
}
