/**
 * Last-resort placeholder for any <img> that fails to load (offline, missing
 * sprite, CDN hiccup). Components with their own `(error)` fallback run first;
 * only if the image is *still* broken afterwards do we swap in the placeholder.
 */
export const IMG_PLACEHOLDER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><g fill="none" stroke="#8a88ad" stroke-width="4" opacity=".55">' +
      '<circle cx="48" cy="48" r="30"/><path d="M18 48h18M60 48h18"/><circle cx="48" cy="48" r="9"/></g></svg>',
  );

/** Installs one capture-phase listener (image errors don't bubble). Returns a disposer. */
export function installImageFallback(doc: Document = document): () => void {
  const onError = (event: Event): void => {
    const img = event.target;
    if (!(img instanceof HTMLImageElement) || img.dataset['pvFallback']) return;
    const failed = img.currentSrc || img.src;
    // Let the component's own (error) handler swap the source first.
    setTimeout(() => {
      const unchanged = (img.currentSrc || img.src) === failed;
      const reFailed = img.dataset['pvRetried'] === '1' && !img.complete;
      if (!img.isConnected || img.src.startsWith('data:')) return;
      if (unchanged || reFailed) {
        img.dataset['pvFallback'] = '1';
        img.src = IMG_PLACEHOLDER;
      } else {
        img.dataset['pvRetried'] = '1'; // component swapped to its own fallback; watch it once
      }
    }, 0);
  };
  doc.addEventListener('error', onError, true);
  return () => doc.removeEventListener('error', onError, true);
}
