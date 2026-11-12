import { gsap } from 'gsap';
import { Flip } from 'gsap/Flip';
import { Observer } from 'gsap/Observer';
import { buildCover } from './art';
import { resetSlides, typeIn } from './post';

gsap.registerPlugin(Flip, Observer);

type Item = { el: HTMLElement; x: number; y: number; w: number; h: number };

const mod = (n: number, m: number) => ((n % m) + m) % m;
const FADED = '.hl-copy, .hl-credit';
const DRIFT = -36; // px per second; negative = right to left
const LABEL = 44; // room kept free around a slab, so the cards stay the size they were when a label sat under them
const HANG = [-.6, .5, -.2, .7, -.45, .25]; // fixed heights on the centre line, so every slab keeps its place
// Width of a stack `height` px tall overall: the photo, the card's 2.2% / 17% borders, and the label.
const fit = (el: HTMLElement, height: number) => (height - LABEL) / (.956 / Number(el.dataset.ar) + .192);

// The Highlights rail (desktop, fine pointer, motion allowed): one row of big glass slabs hung along a centre line,
// drifting right to left in an endless loop. Wheel and drag push it; hovering a slab pauses it. Phones, touch and
// reduced motion get a plain finite grid. Each slab opens its post in a dialog and pushes /highlights/<slug>/,
// which is also a real page for no-JS and search.
export function initHighlights() {
  const section = document.querySelector<HTMLElement>('#moments');
  const stage = section?.querySelector<HTMLElement>('[data-wall-stage]');
  const wall = stage?.querySelector<HTMLElement>('[data-wall]');
  const dialog = document.querySelector<HTMLDialogElement>('#highlight-dialog');
  if (!section || !stage || !wall || !dialog) return;

  const articles = new Map([...dialog.querySelectorAll<HTMLElement>('[data-post]')].map((article) => [article.dataset.post!, article]));
  const stacks = [...wall.querySelectorAll<HTMLElement>('[data-stack]')];
  const endlessQuery = matchMedia('(min-width: 701px) and (hover: hover) and (pointer: fine)');
  const reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');
  const paused = () => document.body.classList.contains('liquid-paused');
  const flying = () => !reducedQuery.matches && !paused();

  let endless = false;
  let sceneActive = document.body.dataset.scene === 'moments';
  let items: Item[] = [];
  let period = 0;
  let target = 0;
  let pos = 0;
  let drift = DRIFT;
  let hovering = false;
  let focusedInside = false;
  let observer: Observer | null = null;
  let dragDistance = 0;
  let restoringFocus = false;

  // ---- The rail ----
  // Each highlight appears once per loop, and the loop is always wider than the screen plus a slab, so no slab is
  // ever on screen twice.
  function layout() {
    if (!endless || !sceneActive) return;
    const band = wall!.clientHeight;
    const view = wall!.clientWidth;
    if (!band || !view) return;
    // Sized by height, so tall photos come out narrow; a floor keeps every card a good size (within the rail's height).
    const least = Math.max(280, view * .22);
    stacks.forEach((el) => {
      const wanted = fit(el, band * (el.dataset.featured ? .82 : .7));
      el.style.width = `${Math.min(Math.max(wanted, least), fit(el, band * .98), view * .46)}px`;
    });
    const boxes = stacks.map((el) => ({ el, w: el.offsetWidth, h: el.offsetHeight }));
    const widest = Math.max(...boxes.map((box) => box.w));
    const total = boxes.reduce((sum, box) => sum + box.w, 0);
    // The slabs behind fan out past a slab's edge by about 7% of its width on each side; the gap clears both.
    const gap = Math.max(56, view * .045, widest * .16, (view + widest - total) / boxes.length);
    let x = 0;
    items = boxes.map((box, index) => {
      const free = Math.max(0, band - box.h);
      const item = { ...box, x, y: free / 2 * (1 + HANG[index % HANG.length]) };
      x += box.w + gap;
      return item;
    });
    period = x;
    render();
  }
  function render() {
    if (!period) return;
    for (const item of items) {
      const x = mod(item.x + pos + item.w, period) - item.w;
      item.el.style.transform = `translate3d(${x.toFixed(1)}px,${item.y.toFixed(1)}px,0)`;
    }
  }
  gsap.ticker.add((_time, deltaMs) => {
    if (!endless || !sceneActive || document.hidden || dialog.open || !period) return;
    const dt = Math.min(deltaMs, 50) / 1000;
    const wanted = hovering || focusedInside || paused() ? 0 : DRIFT;
    drift += (wanted - drift) * (1 - Math.exp(-dt * 3));
    target += drift * dt;
    pos += (target - pos) * (paused() ? 1 : 1 - Math.exp(-dt * 7));
    render();
  });

  function setMode() {
    endless = document.body.classList.contains('scene-mode') && endlessQuery.matches && !reducedQuery.matches;
    section!.classList.toggle('wall-endless', endless);
    if (endless && !observer) {
      observer = Observer.create({
        target: stage, type: 'wheel,touch,pointer', tolerance: 2,
        // The wheel pushes the rail along its drift; a sideways swipe or a drag moves it with the hand.
        onWheel: (self) => { target -= self.deltaY + self.deltaX; },
        onPress: () => { dragDistance = 0; },
        onDrag: (self) => { target += self.deltaX; dragDistance += Math.abs(self.deltaX) + Math.abs(self.deltaY); },
      });
    } else if (!endless && observer) {
      observer.kill();
      observer = null;
      items = [];
      period = 0;
      stacks.forEach((el) => { el.style.removeProperty('transform'); el.style.removeProperty('width'); });
    }
    if (endless) requestAnimationFrame(layout);
  }

  // Wall input never reaches the scene's own wheel/touch travel; the rail links are the way out.
  stage.addEventListener('wheel', (event) => {
    if (!endless || event.ctrlKey) return;
    event.preventDefault();
    event.stopPropagation();
  }, { passive: false });
  stage.addEventListener('touchstart', (event) => { if (endless) event.stopPropagation(); }, { passive: true });
  stage.addEventListener('touchmove', (event) => {
    if (!endless) return;
    event.stopPropagation();
    if (event.cancelable) event.preventDefault();
  }, { passive: false });
  // Hovering a stack (or keyboard focus on the wall) holds the drift so it can be read and clicked.
  stage.addEventListener('pointerover', (event) => { hovering = !!(event.target as Element).closest('[data-stack]'); });
  stage.addEventListener('pointerleave', () => { hovering = false; });
  stage.addEventListener('focusout', () => { focusedInside = false; });
  // Letting go of a drag over a stack must not open it.
  stage.addEventListener('click', (event) => {
    if (dragDistance <= 6) return;
    dragDistance = 0;
    event.preventDefault();
    event.stopPropagation();
  }, true);
  stage.addEventListener('keydown', (event) => {
    if (!endless) return;
    const page = stage.clientWidth * .6;
    const step = ({ ArrowRight: 180, ArrowDown: 180, ArrowLeft: -180, ArrowUp: -180, PageDown: page, PageUp: -page } as Record<string, number>)[event.key];
    if (step === undefined) return;
    event.preventDefault();
    target -= step; // Right, Down and Page Down go the way the rail drifts
  });
  // Tabbing to a stack brings it to the middle by the shortest way round.
  // Keyboard focus only: a mouse press also focuses the link, and must not stop or jump the wall.
  stage.addEventListener('focusin', (event) => {
    const element = (event.target as Element).closest<HTMLElement>('[data-stack]');
    focusedInside = !!element?.matches(':focus-visible');
    if (!endless || restoringFocus || !element || !focusedInside || !period) return;
    const tile = element.getBoundingClientRect();
    const view = wall.getBoundingClientRect();
    target = pos + mod((view.left + view.width / 2) - (tile.left + tile.width / 2) + period / 2, period) - period / 2;
  });

  // ---- Opening a post ----
  let current: HTMLElement | null = null;
  let opener: HTMLElement | null = null;
  let restoreTitle = document.title;
  // Closing goes back one history entry; a second Esc (or ✕) before that lands must not go back again.
  let leaving = false;
  const leave = () => { if (leaving) return; leaving = true; history.back(); };

  const heroOf = (article: HTMLElement) => article.querySelector<HTMLElement>('[data-hero]');
  const announce = (article: HTMLElement) => {
    dialog.setAttribute('aria-labelledby', article.getAttribute('aria-labelledby') || '');
    document.title = `${article.dataset.title} · Amarnath K R`;
  };
  function findTile(slug: string) {
    const view = stage!.getBoundingClientRect();
    let best: HTMLElement | null = null;
    let bestDistance = Infinity;
    stage!.querySelectorAll<HTMLElement>(`[data-stack][data-slug="${CSS.escape(slug)}"]`).forEach((element) => {
      const box = element.getBoundingClientRect();
      if (!box.width || box.bottom < view.top || box.top > view.bottom) return;
      const distance = Math.hypot(box.left + box.width / 2 - (view.left + view.width / 2), box.top + box.height / 2 - (view.top + view.height / 2));
      if (distance < bestDistance) { bestDistance = distance; best = element; }
    });
    return best as HTMLElement | null;
  }
  function prepare(article: HTMLElement, source: HTMLElement | null) {
    const image = heroOf(article)?.querySelector<HTMLImageElement>('img');
    if (image) {
      image.loading = 'eager';
      const small = source?.querySelector<HTMLImageElement>('.print-top img')?.currentSrc;
      if (small && !image.complete) {
        image.style.backgroundImage = `url("${small}")`;
        image.addEventListener('load', () => { image.style.backgroundImage = ''; }, { once: true });
      }
    }
    article.querySelectorAll<HTMLCanvasElement>('canvas[data-cover]').forEach((canvas) => buildCover(canvas));
    resetSlides(article);
  }
  function clearFlipIds() { document.querySelectorAll<HTMLElement>('[data-flip-id="highlight"]').forEach((element) => { delete element.dataset.flipId; }); }

  function open(slug: string, source: HTMLElement | null, push: boolean) {
    const article = articles.get(slug);
    if (!article) return;
    if (current) return;
    current = article;
    opener = source;
    restoreTitle = document.title;
    prepare(article, source);
    article.hidden = false;
    const top = source?.querySelector<HTMLElement>('.print-top');
    const hero = heroOf(article);
    let state: Flip.FlipState | null = null;
    if (top && hero && flying()) {
      top.dataset.flipId = hero.dataset.flipId = 'highlight';
      state = Flip.getState(top);
    }
    dialog.showModal();
    dialog.scrollTop = 0;
    if (push) history.pushState({ portfolioScene: 'moments', portfolioHighlight: slug }, '', `/highlights/${slug}/`);
    window.dispatchEvent(new CustomEvent('portfolio:project', { detail: {} }));
    announce(article);
    typeIn(article, state ? .6 : .25);
    requestAnimationFrame(() => dialog.classList.add('is-open'));
    if (state && hero && source) {
      source.classList.add('stack-away');
      Flip.from(state, { targets: hero, scale: true, duration: .75, ease: 'power3.inOut', onComplete: clearFlipIds });
      gsap.fromTo(article.querySelectorAll(FADED), { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: .55, ease: 'power3.out', delay: .32, stagger: .06 });
    } else if (flying()) gsap.fromTo(article, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: .45, ease: 'power3.out' });
    dialog.querySelector<HTMLElement>('[data-hl-close]')?.focus({ preventScroll: true });
  }

  function finish(article: HTMLElement, tile: HTMLElement | null) {
    leaving = false;
    dialog.classList.remove('is-open');
    if (dialog.open) dialog.close();
    article.hidden = true;
    gsap.set([article, ...article.querySelectorAll(FADED)], { clearProps: 'opacity,visibility,transform' });
    document.title = restoreTitle;
    // Focus goes back to the slab, without moving the rail.
    const focusTarget = tile ?? stage!.querySelector<HTMLElement>(`[data-stack][data-slug="${CSS.escape(article.dataset.post!)}"]`);
    // A task later: going back to /#moments makes the browser focus the #moments section after popstate.
    window.setTimeout(() => {
      restoringFocus = true;
      focusTarget?.focus({ preventScroll: true });
      restoringFocus = false;
    }, 0);
    opener = null;
    // One task later: the hashchange queued by going back to /#moments must still see the overlay as open.
    window.setTimeout(() => window.dispatchEvent(new CustomEvent('portfolio:project', { detail: { closing: true } })), 60);
  }

  function close() {
    const article = current;
    if (!article) return;
    current = null;
    const slug = article.dataset.post!;
    const tile = opener?.dataset.slug === slug ? opener : findTile(slug);
    const top = tile?.querySelector<HTMLElement>('.print-top');
    const hero = heroOf(article);
    stage!.querySelectorAll('.stack-away').forEach((element) => element.classList.remove('stack-away'));
    if (!tile || !top || !hero || !flying()) { finish(article, tile); return; }
    tile.classList.add('stack-away');
    dialog.classList.remove('is-open');
    gsap.to(article.querySelectorAll(FADED), { autoAlpha: 0, duration: .2, ease: 'power1.in' });
    gsap.delayedCall(.22, () => {
      hero.dataset.flipId = top.dataset.flipId = 'highlight';
      const state = Flip.getState(hero);
      tile.classList.remove('stack-away');
      tile.classList.add('stack-landing');
      finish(article, tile);
      Flip.from(state, { targets: top, scale: true, duration: .6, ease: 'power3.inOut', onComplete: () => { tile.classList.remove('stack-landing'); clearFlipIds(); } });
    });
  }

  // Stacks are real links; plain clicks open in place, modified clicks behave like normal links.
  stage.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    const stack = (event.target as Element).closest<HTMLElement>('[data-stack]');
    if (!stack?.dataset.slug) return;
    event.preventDefault();
    open(stack.dataset.slug, stack, true);
  });
  dialog.addEventListener('click', (event) => { if ((event.target as Element).closest('[data-hl-close]')) leave(); });
  // History is the single source of truth: Back closes, Forward reopens.
  dialog.addEventListener('cancel', (event) => { event.preventDefault(); if (current) leave(); });
  window.addEventListener('popstate', (event) => {
    leaving = false;
    const slug = event.state?.portfolioHighlight;
    if (typeof slug === 'string' && articles.has(slug)) open(slug, findTile(slug), false);
    else if (current) close();
  });
  // Safety net: the browser closed the dialog on its own (e.g. a repeated Esc), skipping history.
  dialog.addEventListener('close', () => {
    const article = current;
    if (!article) return;
    current = null;
    finish(article, opener);
    if (location.pathname.startsWith('/highlights/')) history.replaceState({ portfolioScene: 'moments' }, '', '/#moments');
  });

  window.addEventListener('portfolio:scene', (event) => {
    sceneActive = (event as CustomEvent<{ id: string }>).detail.id === 'moments';
    if (sceneActive) requestAnimationFrame(layout);
  });
  window.addEventListener('portfolio:layout', layout);
  new ResizeObserver(() => layout()).observe(stage);
  document.fonts.ready.then(layout);
  endlessQuery.addEventListener('change', setMode);
  reducedQuery.addEventListener('change', setMode);
  setMode();
}
