// A highlight post's motion, in the wall's dialog and on /highlights/<slug>/:
// the hero photo is a slideshow, and the title, lede and story type themselves in.

const SLIDE_MS = 3000;
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches || document.body.classList.contains('liquid-paused');

// ---- Slideshow ----
function show(box: HTMLElement, index: number) {
  const slides = [...box.querySelectorAll<HTMLElement>('[data-slide]')];
  const at = ((index % slides.length) + slides.length) % slides.length;
  slides.forEach((slide, i) => slide.classList.toggle('is-shown', i === at));
  // The card takes the shape of the photo on show (the CSS eases between shapes).
  const shape = slides[at].dataset.shape;
  if (shape) box.querySelector<HTMLElement>('[data-hero]')?.style.setProperty('--shape', shape);
  box.querySelectorAll<HTMLElement>('[data-slide-to]').forEach((dot, i) => dot.toggleAttribute('aria-current', i === at));
  const caption = box.querySelector<HTMLElement>('[data-slide-caption]');
  if (caption) caption.textContent = slides[at].dataset.caption ?? '';
  box.dataset.at = String(at);
  box.dataset.since = String(performance.now()); // each photo gets its full time on screen
}

// Back to the cover (what the wall's tile flies into), playing again; every slide loads now so none fades in empty.
export function resetSlides(article: HTMLElement) {
  article.querySelectorAll<HTMLElement>('[data-slideshow]').forEach((box) => {
    delete box.dataset.stopped;
    box.querySelectorAll<HTMLImageElement>('img[data-slide]').forEach((img) => { img.loading = 'eager'; });
    show(box, 0);
  });
}

// ---- Typing ----
// Each character becomes a span the CSS reveals in turn; a hidden copy of the plain text is what screen readers read.
function split(block: HTMLElement) {
  if (block.dataset.chars) return;
  let i = 0;
  const walk = (node: Node) => [...node.childNodes].forEach((child) => {
    if (child.nodeType !== Node.TEXT_NODE) { walk(child); return; }
    const frag = document.createDocumentFragment();
    for (const ch of child.textContent || '') {
      const span = document.createElement('span');
      span.className = 'hl-char';
      span.style.setProperty('--i', String(i++));
      span.textContent = ch;
      frag.append(span);
    }
    child.replaceWith(frag);
  });
  const plain = block.textContent?.replace(/\s+/g, ' ').trim() || '';
  const visible = document.createElement('span');
  visible.setAttribute('aria-hidden', 'true');
  visible.append(...block.childNodes);
  walk(visible);
  const reader = document.createElement('span');
  reader.className = 'sr-only';
  reader.textContent = plain;
  block.append(reader, visible);
  block.dataset.chars = String(i);
}

let watcher: IntersectionObserver | null = null;
// Types a post's text in reading order: each block starts as it scrolls into view, never before the one above has
// finished. Headlines type slowly, the lede faster, the story quickly.
export function typeIn(article: HTMLElement, delay: number) {
  watcher?.disconnect();
  if (calm()) return;
  // Paragraphs holding links stay as they are, so nothing focusable is duplicated.
  const blocks = [...article.querySelectorAll<HTMLElement>('[data-typed], .hl-story > p')].filter((block) => !block.querySelector('a, button'));
  blocks.forEach((block) => { split(block); block.classList.remove('is-typing'); block.classList.add('hl-typed'); });
  let free = performance.now() + delay * 1000;
  watcher = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const block = entry.target as HTMLElement;
      watcher!.unobserve(block);
      const now = performance.now();
      const start = Math.max(now, free);
      const step = block.matches('h1, h2') ? 40 : block.matches('.hl-summary') ? 14 : 5;
      block.style.setProperty('--t0', `${((start - now) / 1000).toFixed(3)}s`);
      block.style.setProperty('--step', `${step}ms`);
      block.classList.add('is-typing');
      free = start + Number(block.dataset.chars) * step;
    }
  }, { threshold: .2 });
  blocks.forEach((block) => watcher!.observe(block));
}

export function initPosts() {
  document.addEventListener('click', (event) => {
    const dot = (event.target as Element).closest<HTMLElement>('[data-slide-to]');
    const box = dot?.closest<HTMLElement>('[data-slideshow]');
    if (!dot || !box) return;
    event.preventDefault();
    box.dataset.stopped = 'true'; // choosing a photo stops the show
    show(box, Number(dot.dataset.slideTo));
  });
  window.setInterval(() => {
    if (document.hidden || calm()) return;
    const now = performance.now();
    document.querySelectorAll<HTMLElement>('[data-slideshow]').forEach((box) => {
      if (box.dataset.stopped || !box.getClientRects().length) return;
      // Hovering or focusing the photo holds it.
      if (box.matches(':hover, :focus-within') || !box.dataset.since) { box.dataset.since = String(now); return; }
      if (now - Number(box.dataset.since) >= SLIDE_MS) show(box, Number(box.dataset.at || 0) + 1);
    });
  }, 250);
  // The standalone post page types in on arrival.
  const page = document.querySelector<HTMLElement>('.highlight-page .hl-post');
  if (page) typeIn(page, .2);
}
