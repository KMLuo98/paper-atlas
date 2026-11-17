const rasterImage = /^image\/(?:png|jpe?g|gif|webp|avif|bmp|x-icon)$/i;
const imageCache = new WeakMap();

function contentId(value) {
  let id = String(value ?? '').trim();
  try { id = decodeURIComponent(id); } catch { /* Keep malformed IDs literal. */ }
  return id.trim().replace(/^<|>$/g, '').toLowerCase();
}

// Resolve only the attachment IDs referenced by the sanitized message body.
export function resolveInlineImages(html, message, fetchAttachment) {
  const attachments = (message.attachments || []).filter(file =>
    file.content_id && rasterImage.test(file.mime_type));
  if (!attachments.length || !/cid:/i.test(html)) return null;

  const template = document.createElement('template');
  template.innerHTML = html;
  const imagesByIndex = new Map();
  for (const image of template.content.querySelectorAll('img[src]')) {
    const src = image.getAttribute('src').trim();
    if (!/^cid:/i.test(src)) continue;
    const file = attachments.find(item => contentId(item.content_id) === contentId(src.slice(4)));
    if (!file) continue;
    if (!imagesByIndex.has(file.index)) imagesByIndex.set(file.index, []);
    imagesByIndex.get(file.index).push(image);
  }
  if (!imagesByIndex.size) return null;

  let cache = imageCache.get(message);
  if (!cache) imageCache.set(message, cache = new Map());
  async function load() {
    const files = [...imagesByIndex];
    // The existing attachment endpoint reparses the message on each request.
    for (let i = 0; i < files.length; i += 3) {
      await Promise.all(files.slice(i, i + 3).map(async ([index, images]) => {
        if (!cache.has(index)) {
          cache.set(index, fetchAttachment(index).then(file =>
            rasterImage.test(file.mime_type) && file.content
              ? 'data:' + file.mime_type + ';base64,' + file.content
              : ''
          ).catch(() => { cache.delete(index); return ''; }));
        }
        const url = await cache.get(index);
        if (url) for (const image of images) image.setAttribute('src', url);
      }));
    }
    return template.innerHTML;
  }
  return load();
}
