import DOMPurify from 'dompurify';
import {sanitizeMailHTML,mailHTMLText,plainMailHTML} from '../../supabase/functions/mail-api/formatted-mail.js';
const parse=html=>({document:new DOMParser().parseFromString(html,'text/html')});
export const cleanEditorHTML=html=>sanitizeMailHTML(DOMPurify.sanitize(html,{FORBID_TAGS:['img','svg','math','style','iframe']}),parse);
export function editorBody(editor){const body_html=cleanEditorHTML(editor.innerHTML);return {body:mailHTMLText(body_html,parse),body_html};}
export function richEditorHTML(d){return `<div class="format-toolbar" role="toolbar" aria-label="邮件正文格式">
 <select data-format="fontName" aria-label="字体"><option value="Arial">Arial</option><option value="Georgia">Georgia</option><option value="Times New Roman">Times New Roman</option><option value="Verdana">Verdana</option><option value="Courier New">等宽字体</option><option value="Microsoft YaHei">微软雅黑</option><option value="SimSun">宋体</option></select>
 <select data-format="fontSize" aria-label="字号"><option value="1">10px</option><option value="2">13px</option><option value="3" selected>16px</option><option value="4">18px</option><option value="5">24px</option><option value="6">32px</option><option value="7">48px</option></select>
 ${[['bold','加粗','<b>B</b>'],['italic','斜体','<i>I</i>'],['underline','下划线','<u>U</u>'],['strikeThrough','删除线','<s>S</s>']].map(([command,label,icon])=>`<button type="button" data-format="${command}" title="${label}" aria-label="${label}" aria-pressed="false">${icon}</button>`).join('')}
 <label class="format-color" title="文字颜色">A<input type="color" value="#303a36" data-format="foreColor" aria-label="文字颜色"></label>
 ${[['justifyLeft','左对齐','≡'],['justifyCenter','居中','☰'],['justifyRight','右对齐','≡'],['insertUnorderedList','项目符号','• ≡'],['insertOrderedList','编号列表','1. ≡'],['removeFormat','清除格式','Tx'],['undo','撤销','↶'],['redo','重做','↷']].map(([command,label,icon])=>`<button type="button" data-format="${command}" title="${label}" aria-label="${label}">${icon}</button>`).join('')}
 </div><div id="compose-body" class="rich-mail-editor" contenteditable="true" role="textbox" aria-label="邮件正文" aria-multiline="true" data-placeholder="写下你想说的话…" spellcheck="true">${cleanEditorHTML(d.body_html||plainMailHTML(d.body))}</div>`;}
export function installRichEditor(root,onChange){
 const editor=root.querySelector('#compose-body'),toolbar=root.querySelector('.format-toolbar');let range=null;
 const remember=()=>{const selection=window.getSelection();if(selection.rangeCount&&editor.contains(selection.anchorNode))range=selection.getRangeAt(0).cloneRange();};
 const update=()=>{remember();onChange(editorBody(editor));for(const button of toolbar.querySelectorAll('[aria-pressed]'))button.setAttribute('aria-pressed',String(document.queryCommandState(button.dataset.format)));};
 const restore=()=>{editor.focus({preventScroll:true});const selection=window.getSelection();if(range&&editor.contains(range.startContainer)){selection.removeAllRanges();selection.addRange(range);}else{const end=document.createRange();end.selectNodeContents(editor);end.collapse(false);selection.removeAllRanges();selection.addRange(end);}};
 const command=(name,value=null)=>{restore();document.execCommand('styleWithCSS',false,true);document.execCommand(name,false,value);update();};
 editor.addEventListener('input',update);for(const type of ['keyup','mouseup','touchend','focus'])editor.addEventListener(type,remember);
 toolbar.addEventListener('pointerdown',event=>{remember();if(event.target.closest('button'))event.preventDefault();});
 toolbar.addEventListener('click',event=>{const button=event.target.closest('button[data-format]');if(!button)return;event.preventDefault();event.stopPropagation();command(button.dataset.format);});
 toolbar.addEventListener('change',event=>{const control=event.target.closest('[data-format]');if(control)command(control.dataset.format,control.value);});
 editor.addEventListener('paste',event=>{event.preventDefault();const html=event.clipboardData.getData('text/html'),text=event.clipboardData.getData('text/plain');command('insertHTML',html?cleanEditorHTML(html):plainMailHTML(text));});
}
