import test from 'node:test';import assert from 'node:assert/strict';import {parseHTML} from 'linkedom';
import {sanitizeMailHTML,formattedMail,plainMailHTML} from '../../supabase/functions/mail-api/formatted-mail.js';
test('formatted mail retains readable styling and derives its matching plain-text MIME alternative',()=>{
 const input='<div style="text-align:center"><b>Bold</b> <i>Italic</i> <u>Underline</u><span style="font-size:x-large;color:#a03020;font-family:Georgia"> Large</span></div><ol><li>First</li><li>Second</li></ol>';
 const result=formattedMail('Untrusted stale plain text',input,parseHTML);assert.match(result.html,/text-align:center/);assert.match(result.html,/font-size:24px/);assert.match(result.html,/<b>Bold<\/b>/);assert.match(result.html,/<ol>/);assert.equal(result.text,'Bold Italic Underline Large\nFirst\nSecond');assert.deepEqual(formattedMail(result.text,result.html,parseHTML),result);
});
test('format sanitizer removes active elements and CSS URLs while retaining safe links and literal text',()=>{
 const result=sanitizeMailHTML('<script>steal()</script><iframe src="https://bad.example"></iframe><img src=x onerror="alert(1)"><div onclick="bad()" style="background-image:url(https://bad.example);position:fixed;color:#123456"><a href="javascript:alert(1)">Bad link</a><a href="https://example.edu/">Good link</a> &lt;literal&gt;</div>',parseHTML);
 assert.doesNotMatch(result,/script|iframe|img|onerror|onclick|javascript|background-image|position:|bad\.example/);assert.match(result,/href="https:\/\/example.edu\/"/);assert.match(result,/color:#123456/);assert.match(result,/&lt;literal&gt;/);
});
test('plain drafts remain compatible and pasted legacy font tags normalize to safe CSS',()=>{
 assert.deepEqual(formattedMail('Old plain draft','',parseHTML),{text:'Old plain draft',html:''});const result=formattedMail('',plainMailHTML('Hello\n<b>literal</b>'),parseHTML);assert.equal(result.text,'Hello\n<b>literal</b>');
 assert.equal(sanitizeMailHTML('<font size="5" color="red" face="Arial">Text</font>',parseHTML),'<span style="font-size:24px;color:red;font-family:Arial">Text</span>');
});
