import './received-background.css';

function clearWhiteBackground(style) {
  const color = (style.backgroundColor || '').toLowerCase().replace(/\s/g, '');
  if (color !== 'white' && color !== 'rgb(255,255,255)') return false;
  style.setProperty('background-color', 'transparent', style.getPropertyPriority('background-color'));
  return true;
}

function clearWhiteRules(rules) {
  let changed = false;
  for (const rule of rules) {
    if (rule.style && clearWhiteBackground(rule.style)) changed = true;
    if (rule.cssRules && clearWhiteRules(rule.cssRules)) changed = true;
  }
  return changed;
}

export function transparentReceivedHTML(sanitizedHTML) {
  const template = document.createElement('template');
  template.innerHTML = sanitizedHTML;
  for (const element of template.content.querySelectorAll('[style],[bgcolor]')) {
    if (element.style) clearWhiteBackground(element.style);
    if (/^(?:white|#?fff|#?ffffff)$/i.test(element.getAttribute('bgcolor')?.trim() || '')) {
      element.removeAttribute('bgcolor');
    }
  }
  for (const style of template.content.querySelectorAll('style')) {
    if (typeof CSSStyleSheet !== 'function' || !CSSStyleSheet.prototype.replaceSync) break;
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(style.textContent);
    if (clearWhiteRules(sheet.cssRules)) {
      style.textContent = [...sheet.cssRules].map(rule => rule.cssText).join('\n').replace(/<\/style/gi, '\\3c /style');
    }
  }
  return template.innerHTML;
}
