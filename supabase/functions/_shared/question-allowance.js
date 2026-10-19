export async function withQuestionAllowance({service,userId,requestId,conversationId,HTTPError},operation){
 const result=await service.rpc('reserve_ai_question',{target_user:userId,request_uuid:requestId,conversation_uuid:conversationId});
 if(result.error)throw new HTTPError(503,'AI 提问额度读取失败，请重试');
 if(result.data==='exhausted')throw new HTTPError(402,'AI 提问次数已用完，请联系管理员调整额度');
 if(result.data==='forbidden')throw new HTTPError(403,'无权访问此对话');
 if(['inflight','completed','conflict'].includes(result.data))throw new HTTPError(409,'此提问正在处理或已经完成，请刷新对话');
 if(result.data!=='reserved')throw new HTTPError(503,'AI 提问额度暂不可用');
 let answerSaved=false;
 try{return await operation(()=>{answerSaved=true;});}
 finally{try{const finished=await service.rpc('finish_ai_question',{target_user:userId,request_uuid:requestId,succeeded:answerSaved});if(finished.error)console.error('AI allowance settlement deferred; reservation recovery will reconcile saved answers.');}catch{console.error('AI allowance settlement deferred; reservation recovery will reconcile saved answers.');}}
}
