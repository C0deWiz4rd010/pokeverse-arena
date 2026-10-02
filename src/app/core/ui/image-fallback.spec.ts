import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IMG_PLACEHOLDER, installImageFallback } from './image-fallback';

describe('installImageFallback', () => {
  let dispose: () => void;
  beforeEach(() => {
    vi.useFakeTimers();
    dispose = installImageFallback(document);
  });
  afterEach(() => {
    dispose();
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  function brokenImg(src: string): HTMLImageElement {
    const img = document.createElement('img');
    img.setAttribute('src', src);
    document.body.appendChild(img);
    return img;
  }

  it('swaps a still-broken image for the placeholder', () => {
    const img = brokenImg('https://cdn.example/missing.png');
    img.dispatchEvent(new Event('error'));
    vi.runAllTimers();
    expect(img.src).toBe(IMG_PLACEHOLDER);
  });

  it('leaves an image alone when the component already swapped its source', () => {
    const img = brokenImg('https://cdn.example/a.png');
    img.addEventListener('error', () => img.setAttribute('src', 'https://cdn.example/fallback.png'));
    img.dispatchEvent(new Event('error'));
    vi.runAllTimers();
    expect(img.src).toBe('https://cdn.example/fallback.png');
  });
});
