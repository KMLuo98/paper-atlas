// PostgreSQL text/jsonb rejects NUL and unpaired UTF-16 surrogates.
// Work by code point so valid Chinese, astral characters and math stay intact.
export function databaseText(value) {
  let result = '';
  for (const char of value) {
    const code = char.codePointAt(0);
    if (code === 0) continue;
    result += code >= 0xd800 && code <= 0xdfff ? '\ufffd' : char;
  }
  return result;
}

export function databaseJSON(value) {
  if (typeof value === 'string') return databaseText(value);
  if (Array.isArray(value)) return value.map(databaseJSON);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [databaseText(key), databaseJSON(item)]));
  return value;
}
