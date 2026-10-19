import {databaseJSON} from './text.js';

export class ModelJSONError extends Error {
  constructor(truncated = false, reason = 'syntax') {
    super(truncated ? '模型输出达到长度限制，未返回完整分析，请重试' : reason === 'empty' ? '模型返回了空内容，自动重试仍未成功，请稍后重试' : '模型返回的分析格式不完整，自动重试仍未成功，请稍后重试');
    this.truncated = truncated;
    this.reason = truncated ? 'length' : reason;
  }
}
// Repair syntax only: do not invent fields, complete truncated strings or evaluate code.
function repairSyntax(text) {
  let result = '', inString = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inString && char === '\\') {
      const next = text[i + 1];
      if (next && (/["\\/bfnrt]/.test(next) || next === 'u' && /^[0-9a-f]{4}$/i.test(text.slice(i + 2, i + 6)))) {result += char + next; i++;}
      else result += '\\\\';
    } else if (char === '"') {inString = !inString; result += char;}
    else if (inString && char.charCodeAt(0) < 32) result += JSON.stringify(char).slice(1, -1);
    else if (!inString && char === ',' && /^\s*[}\]]/.test(text.slice(i + 1))) continue;
    else result += char;
  }
  return result;
}
export function parseModelJSON(choice) {
  if (choice?.finish_reason === 'length') throw new ModelJSONError(true);
  const content = choice?.message?.content;
  if (typeof content !== 'string' || !content.trim()) throw new ModelJSONError(false, 'empty');
  try {
    const text = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    let value;
    try {value = JSON.parse(text);} catch {value = JSON.parse(repairSyntax(text));}
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ModelJSONError(false, 'shape');
    return databaseJSON(value);
  } catch (error) {
    if (error instanceof ModelJSONError) throw error;
    const failure = new ModelJSONError();
    const position = /position (\d+)/.exec(error.message || '');
    failure.syntax = error.message?.startsWith('Expected ') ? error.message.split(' in JSON')[0] : 'Invalid JSON token';
    failure.position = position ? Number(position[1]) : null;
    throw failure;
  }
}
export const conciseJSONInstruction = '\n输出必须为完整且有效的 JSON 对象，不使用 Markdown。保持核心元数据、全部实际作者、8–10个双语关键词和完整总结，总结不超过1200汉字。references 最多保留20条已知引用（每个标题不超过180字符），search_terms 最多12项。用文字表述公式，避免未转义的反斜杠和控制字符。必须闭合所有字符串、数组和对象，不得编造信息。';

export async function requestModelJSON(request, system, {onInvalid = () => {}} = {}) {
  for (let attempt = 0; attempt < 2; attempt++) {
    // HTTP/timeouts propagate immediately: an ambiguous failure must not duplicate work.
    const response = await request(system + (attempt ? conciseJSONInstruction : ''), attempt);
    try {return parseModelJSON(response.choices?.[0]);}
    catch (error) {
      if (!(error instanceof ModelJSONError)) throw error;
      const choice = response.choices?.[0];
      onInvalid({attempt: attempt + 1, reason: error.reason, syntax: error.syntax, position: error.position, finish_reason: choice?.finish_reason || 'missing', content_chars: typeof choice?.message?.content === 'string' ? choice.message.content.length : 0, completion_tokens: response.usage?.completion_tokens ?? null});
      if (attempt) throw error;
    }
  }
}
