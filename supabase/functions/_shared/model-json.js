import {databaseJSON} from './text.js';

export class ModelJSONError extends Error {
  constructor(truncated = false) {
    super(truncated ? '模型返回被长度限制截断，请重试' : '模型返回的 JSON 无效，请重试');
    this.truncated = truncated;
  }
}
export function parseModelJSON(choice) {
  if (choice?.finish_reason === 'length') throw new ModelJSONError(true);
  const content = choice?.message?.content;
  if (typeof content !== 'string' || !content.trim()) throw new ModelJSONError();
  try {
    const value = JSON.parse(content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ModelJSONError();
    return databaseJSON(value);
  } catch (error) {if (error instanceof ModelJSONError) throw error; throw new ModelJSONError();}
}
export const conciseJSONInstruction = '\n输出必须为完整且有效的 JSON 对象，不使用 Markdown。保持核心元数据、全部实际作者、8–10个双语关键词和完整总结，总结不超过1200汉字。references 最多保留20条已知引用（每个标题不超过180字符），search_terms 最多12项。用文字表述公式，避免未转义的反斜杠和控制字符。必须闭合所有字符串、数组和对象，不得编造信息。';

export async function requestModelJSON(request, system) {
  for (let attempt = 0; attempt < 2; attempt++) {
    // HTTP/timeouts propagate immediately: an ambiguous failure must not duplicate work.
    const response = await request(system + (attempt ? conciseJSONInstruction : ''), attempt);
    try {return parseModelJSON(response.choices?.[0]);}
    catch (error) {if (!(error instanceof ModelJSONError) || attempt) throw error;}
  }
}
