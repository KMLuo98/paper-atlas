import test from 'node:test';import assert from 'node:assert/strict';
import {recipientToken,matchRecipients,fillRecipient} from '../src/recipient-picker.js';
const people=[{name:'Albert-László Barabási',email:'barabasi@example.edu',emails:['second@example.edu']},{name:'张三',email:'zhang@example.edu',second_email:'zhang.other@example.edu'},{name:'Deleted',email:'deleted@example.edu',deleted_at:'2026-10-29'},{name:'Duplicate',email:'barabasi@example.edu'}];
test('recipient matching handles accents, Chinese names, alternate addresses and deleted contacts',()=>{
 assert.deepEqual(matchRecipients(people,'barabasi').map(x=>x.email),['barabasi@example.edu','second@example.edu']);assert.equal(matchRecipients(people,'张三').length,2);assert.equal(matchRecipients(people,'second@')[0].name,'Albert-László Barabási');assert.equal(matchRecipients(people,'deleted').length,0);assert.equal(matchRecipients(people,'',[],100).length,4);assert.equal(matchRecipients(people,'barabasi',['barabasi@example.edu']).length,1);
});
test('selection replaces only the active address and preserves surrounding recipients',()=>{
 assert.deepEqual(fillRecipient('first@example.edu, Bar',22,'barabasi@example.edu'),{value:'first@example.edu, barabasi@example.edu, ',caret:41});
 const value='first@example.edu; 张三；third@example.edu',caret=value.indexOf('张')+1;assert.deepEqual(recipientToken(value,caret),{start:18,end:21,query:'张三'});assert.equal(fillRecipient(value,caret,'zhang@example.edu').value,'first@example.edu; zhang@example.edu；third@example.edu');
 assert.equal(fillRecipient('',0,'second@example.edu').value,'second@example.edu, ');
});
