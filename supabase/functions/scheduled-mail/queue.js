export function scheduledTime(value, now = Date.now()) {
  const time = typeof value === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? Date.parse(value) : NaN;
  if (!Number.isFinite(time) || time < now + 60000) throw Error('发送时间至少需要在一分钟以后');
  if (time > now + 366 * 86400000) throw Error('发送时间不能超过一年');
  return new Date(time).toISOString();
}

// Claiming, cancellation and the delivery boundary all use atomic database updates.
// Once delivery starts, a transport error is ambiguous: never automatically resend.
export async function deliverScheduled(row, io) {
  let deliveryStarted = false;
  try {
    const prepared = await io.prepare(row);
    if (!await io.begin(row)) return {status:'changed'};
    deliveryStarted = true;
    const result = await io.send(prepared);
    // Persist acceptance before saving the local sent copy. A copy failure cannot resend mail.
    await io.finish(row, 'sent', {result});
    try { await io.saveCopy(row, prepared); }
    catch { await io.warning(row, '邮件已投递，已发送副本尚未保存，请在原邮箱核实'); }
    return {status:'sent'};
  } catch {
    const status = deliveryStarted ? 'uncertain' : 'failed';
    await io.finish(row, status, {last_error:deliveryStarted
      ? '投递结果尚未确认，请先到原邮箱核实；系统不会自动重复发送'
      : '定时发送准备失败，请检查邮箱授权后取消定时并重新安排'});
    return {status};
  }
}
