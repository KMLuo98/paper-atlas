// Editorial workflow dates belong outside the scientific research summary.
const editorialDate = /(?:投稿|收稿|修回|录用|接受|接收|审稿|送审|返修)(?:日期|时间)|(?:投稿|收稿|修回|录用|接受|接收|审稿|送审|返修)[^。！？!?；;\n]{0,24}\d{4}|\b(?:submission|acceptance|revision|received|submitted|revised|accepted)\s+date\b|\b(?:received|submitted|revised|accepted)(?:\s+on)?\s*:?\s*(?:\d|[A-Za-z]+\s+\d)/iu;
export function cleanResearchSummary(value) {
  return String(value || '').split(/(?<=[。！？!?；;])|(?=\r?\n)/u).filter(sentence=>!editorialDate.test(sentence)).join('').replace(/\n{3,}/g,'\n\n').trim();
}
