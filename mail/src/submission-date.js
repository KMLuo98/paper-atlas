import {submissionStages} from '../../supabase/functions/manuscripts-api/core.js';

function dateValue(value) {
  if(typeof value!=='string'||!value.trim())return NaN;
  const text=value.trim().replace(/(\d{1,2})(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(\d{4})/i,'$1 $2 $3');
  if(!/\d{4}/.test(text))return NaN;
  if(/^(?:\d{1,2} [A-Za-z]{3,9} \d{4}|[A-Za-z]{3,9} \d{1,2},? \d{4})$/.test(text))return Date.parse(text+' 00:00:00 UTC');
  return Date.parse(text);
}

// A review or database creation date does not establish the original submission date.
export function submissionDate(item) {
  const dates=[item.submitted_at,item.submission_date];
  const revision=/revis(?:ed|ion)|re-?submit|返修|修回|重投/i;
  for(const event of submissionStages(item)) {
    if(event.status==='submitted'&&event.round===1&&!revision.test(event.raw_status||''))dates.push(event.date);
  }
  for(const table of item.publisher_history?.tables||[]) {
    const headers=table.headers||[];
    const description=headers.findIndex(header=>/description|event|activity|status|说明|事件|状态/i.test(header));
    const date=headers.findIndex(header=>/^(open|date|received|submitted)(?:\s+date)?$|日期/i.test(header.trim()));
    if(description<0||date<0)continue;
    for(const row of table.rows||[]) {
      const text=row[description]||'';
      if(!revision.test(text)&&/manuscript received|submission received|initial submission|original submission|submitted|首次投稿|稿件已收到/i.test(text))dates.push(row[date]);
    }
  }
  const earliest=Math.min(...dates.map(dateValue).filter(Number.isFinite));
  return Number.isFinite(earliest)?new Date(earliest).toISOString():'';
}
