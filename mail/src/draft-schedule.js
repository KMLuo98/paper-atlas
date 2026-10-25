// A future Date on a Tencent draft is a scheduling hint, not a delivery command.
// This is a display hint only; the original mailbox remains responsible for delivery.
export function scheduledDraftAt(message,account,now=Date.now()){
 if(message?.folder!=='drafts'||account?.provider!=='imap')return null;
 const host=String(account.config?.imap_host||'').toLowerCase();
 if(!['imap.qq.com','imap.exmail.qq.com','hwimap.exmail.qq.com'].includes(host))return null;
 const timestamp=Date.parse(message.received_at);
 if(!Number.isFinite(timestamp)||timestamp<=now+60000)return null;
 return new Date(timestamp).toISOString();
}
