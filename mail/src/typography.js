// Incoming mail often fixes its own font sizes, so increasing the reader base alone is insufficient.
function largerCSS(css, points) {
  const increase = (_, prefix, size) => parseFloat(size) ? `${prefix}calc(${size} + ${points}pt)` : prefix + size;
  return css
    .replace(/(font-size\s*:\s*)(\d+(?:\.\d+)?(?:px|pt))(?=\s*(?:!important)?\s*(?:;|$|}))/gi, increase)
    .replace(/(\bfont\s*:\s*(?:(?:normal|italic|oblique|small-caps|bold|bolder|lighter|[1-9]00)\s+)*)(\d+(?:\.\d+)?(?:px|pt))(?=\s|\/)/gi, increase);
}
export function largerEmailFonts(html, points = 2) {
  return html
    .replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (_, open, css, close) => open + largerCSS(css, points) + close)
    .replace(/(\bstyle\s*=\s*)(["'])([\s\S]*?)\2/gi, (_, prefix, quote, css) => prefix + quote + largerCSS(css, points) + quote);
}
