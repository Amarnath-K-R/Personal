import { gsap } from 'gsap';

type Film = Awaited<ReturnType<typeof import('./film-gl').createFilm>>;

const hasWebGL2 = () => { try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; } };

// The About film. One pinned stage holds the light-form and the words; empty beats below it set the
// scroll length, and the beat position `t` drives both. Phones, reduced motion and browsers without
// WebGL2 get the words stacked as plain text with a still poster, and never download three.js.
export function initFilm() {
  const film = document.querySelector<HTMLElement>('[data-film]');
  const scroller = document.getElementById('top');
  if (!film || !scroller) return;
  const stage = film.querySelector<HTMLElement>('.film-stage')!;
  const canvas = film.querySelector<HTMLCanvasElement>('.film-canvas')!;
  const beats = [...film.querySelectorAll<HTMLElement>('[data-beat]')];
  const backdrops = [...film.querySelectorAll<HTMLElement>('[data-backdrop]')];
  const backdrop = (name: string) => backdrops.find((b) => b.dataset.backdrop === name);
  const shade = film.querySelector<HTMLElement>('.film-shade');
  const contact = document.getElementById('contact');
  const headline = document.getElementById('contact-title');
  const mm = gsap.matchMedia();

  mm.add('(min-width: 701px) and (prefers-reduced-motion: no-preference)', () => {
    if (!document.body.classList.contains('scene-mode') || !hasWebGL2()) return;
    film.classList.add('film-live');
    let gl: Film | null = null;
    let disposed = false, onScreen = false, paused = false;

    // Beat position: which beat holds the middle of the screen, and how far through it we are.
    const beatT = () => {
      const top = scroller.getBoundingClientRect().top;
      const mid = scroller.clientHeight * .5;
      let t = 0;
      for (let i = 0; i < beats.length; i++) {
        const box = beats[i].getBoundingClientRect();
        if (box.top - top > mid) break;
        t = i + (mid - (box.top - top)) / Math.max(1, box.height);
      }
      return Math.max(0, Math.min(beats.length, t));
    };
    const fade = (t: number, a: number, b: number, c: number, d: number) => Math.max(0, Math.min(1, (t - a) / (b - a), (d - t) / (d - c)));
    // Words hold a fixed place on the pinned screen and switch on for their stretch of the film.
    const shows = [...film.querySelectorAll<HTMLElement>('[data-show]')].map((el) => {
      const [from, to] = (el.dataset.show || '0,0').split(',').map(Number);
      return { el, from, to, on: false };
    });

    // Headlines type themselves in: each character becomes a span the CSS reveals in turn.
    const typed = [...film.querySelectorAll<HTMLElement>('[data-type]')].map((el) => {
      const html = el.innerHTML;
      el.setAttribute('aria-label', el.textContent?.replace(/\s+/g, ' ').trim() || '');
      let i = 0;
      const split = (node: Node) => [...node.childNodes].forEach((child) => {
        if (child.nodeType !== Node.TEXT_NODE) { split(child); return; }
        const frag = document.createDocumentFragment();
        for (const ch of child.textContent || '') {
          const span = document.createElement('span');
          span.className = 'film-char';
          span.setAttribute('aria-hidden', 'true');
          span.style.setProperty('--i', String(i++));
          span.textContent = ch;
          frag.append(span);
        }
        child.replaceWith(frag);
      });
      split(el);
      return { el, html };
    });

    // Figures count up when they appear.
    const countUp = (block: HTMLElement) => {
      const el = block.querySelector<HTMLElement>('.film-figure-value');
      if (!el) return;
      const text = el.dataset.value || (el.dataset.value = el.textContent || '');
      const state = { p: 0 };
      gsap.to(state, { p: 1, duration: 1.4, delay: .3, ease: 'power2.out', onUpdate: () => { el.textContent = text.replace(/\d+/g, (n) => String(Math.round(Number(n) * state.p))); }, onComplete: () => { el.textContent = text; } });
    };

    // The mission headline: a small burst of light as "people." lands.
    const wrap = film.querySelector<HTMLElement>('.about-title-wrap');
    const last = film.querySelector<HTMLElement>('.about-title-last');
    const burst = () => {
      if (!wrap || !last) return;
      const w = wrap.getBoundingClientRect(), l = last.getBoundingClientRect();
      const ox = l.left - w.left + l.width * .5, oy = l.top - w.top + l.height * .55;
      for (let k = 0; k < 18; k++) {
        const dot = document.createElement('i');
        dot.className = 'film-burst';
        dot.style.left = `${ox}px`; dot.style.top = `${oy}px`;
        wrap.append(dot);
        const angle = (k / 18) * Math.PI * 2 + Math.random() * .4, dist = 70 + Math.random() * 130;
        gsap.fromTo(dot, { scale: .4, opacity: 0 }, { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist * .6, scale: 1, opacity: 1, duration: .5, ease: 'power2.out', delay: .9 + Math.random() * .1,
          onComplete: () => { gsap.to(dot, { opacity: 0, y: '+=18', duration: 1.1, ease: 'power1.in', onComplete: () => dot.remove() }); } });
      }
    };

    // Finale progress: 0 as the principles leave, 1 once Contact reaches the top of the screen (or the
    // page ends), which is also exactly where the Contact pill lands.
    const finale = () => {
      if (!contact || !headline) return [0, 0] as const;
      const st = scroller.getBoundingClientRect().top, s = scroller.scrollTop, h = scroller.clientHeight;
      const end = beats[beats.length - 1].getBoundingClientRect();
      const s0 = end.top - st + s + end.height * .02 - h * .5;
      // (journey.ts stops anchor jumps 18px short of their target, hence the margin.)
      const s1 = Math.min(scroller.scrollHeight - h - 1, contact.getBoundingClientRect().top - st + s - Math.max(24, h * .05));
      return [s1 > s0 ? Math.max(0, Math.min(1, (s - s0) / (s1 - s0))) : 0, Math.max(0, s1 - s0)] as const;
    };

    // The headline fades in as the comets near it; they strike it. Then the warp wave: a strong version of
    // the cursor's ripple runs out from the headline, bending the starfield, with luminous particles on its
    // front; each Contact element appears with a jolt as the front passes it.
    const reveal = contact ? [...contact.querySelectorAll<HTMLElement>('.contact-inner > :not(h2), .site-footer > *')] : [];
    const title = (on: boolean) => contact?.classList.toggle('finale-title', on);
    const strike = (on: boolean) => { if (!on) contact?.classList.remove('finale-wave'); };
    const wave = (box: DOMRect, speed: number) => {
      if (!contact) return;
      reveal.forEach((el) => {
        const b = el.getBoundingClientRect();
        // Gap from the words' box to the element (when the front reaches it), and the outward push.
        const gx = Math.max(box.left - b.right, 0, b.left - box.right), gy = Math.max(box.top - b.bottom, 0, b.top - box.bottom);
        const dx = b.left + b.width / 2 - (box.left + box.width / 2), dy = b.top + b.height / 2 - (box.top + box.height / 2);
        const len = Math.hypot(dx, dy) || 1;
        el.style.setProperty('--wave', `${(Math.hypot(gx, gy) / speed).toFixed(2)}s`);
        el.style.setProperty('--wx', `${(dx / len * 16).toFixed(1)}px`);
        el.style.setProperty('--wy', `${(dy / len * 16).toFixed(1)}px`);
      });
      contact.classList.add('finale-wave');
      window.dispatchEvent(new CustomEvent('portfolio:shockwave', { detail: { x: box.left, y: box.top, w: box.width, h: box.height, speed } }));
    };
    // Keyboard users tabbing into Contact (or anyone with motion paused) get everything at once.
    const showAll = () => {
      if (!contact || contact.classList.contains('finale-wave')) return;
      reveal.forEach((el) => el.style.setProperty('--wave', '0s'));
      contact.classList.add('finale-title', 'finale-wave');
    };
    const onFocus = () => showAll();

    const showWords = (t: number) => shows.forEach((show) => {
      const on = t >= show.from && t < show.to;
      if (on === show.on) return;
      show.on = on;
      show.el.classList.toggle('is-on', on);
      if (!on) return;
      if (show.el.matches('.film-figure')) countUp(show.el);
      if (show.el.matches('.about-introduction')) burst();
    });

    const update = () => {
      const t = beatT();
      gl?.setT(t);
      const [f, span] = finale();
      gl?.setFinale(f, span);
      // With motion paused the light cannot travel, so Contact simply shows.
      if (f > .999 && paused) showAll();
      showWords(t);
      backdrop('voice')?.style.setProperty('opacity', String(fade(t, 3.04, 3.18, 3.5, 3.66) * .85));
      backdrop('reach')?.style.setProperty('opacity', String(fade(t, 4.95, 5.03, 5.19, 5.26) * .85));
      // While the camera is close over the villages, shade the side the words sit on.
      shade?.style.setProperty('opacity', String(fade(t, 5.46, 5.56, 5.9, 6.0)));
      // The canvas is fixed to the screen, so it fades in as the film arrives rather than sliding in.
      const arrive = film.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
      canvas.style.setProperty('opacity', String(Math.max(0, Math.min(1, (scroller.clientHeight - arrive) / (scroller.clientHeight * .6)))));
    };
    scroller.addEventListener('scroll', update, { passive: true });

    const run = () => { if (gl && onScreen && !paused && !document.hidden) gl.start(); else gl?.stop(); };
    const seen = new Set<Element>();
    const visibility = new IntersectionObserver((entries) => {
      entries.forEach((entry) => { if (entry.isIntersecting) seen.add(entry.target); else seen.delete(entry.target); });
      onScreen = seen.size > 0; run();
    }, { root: scroller });
    visibility.observe(film);
    if (contact) visibility.observe(contact);
    const onMotion = (event: Event) => { paused = !!(event as CustomEvent<{ paused?: boolean }>).detail?.paused; run(); update(); };
    window.addEventListener('portfolio:motion', onMotion);
    document.addEventListener('visibilitychange', run);
    const resize = new ResizeObserver(() => { gl?.resize(); update(); });
    resize.observe(stage);
    const lost = (event: Event) => { event.preventDefault(); film.classList.remove('film-ready'); contact?.classList.remove('finale-armed', 'finale-title', 'finale-wave'); gl?.stop(); gl = null; };
    canvas.addEventListener('webglcontextlost', lost);

    // three.js arrives only as the reader nears the film.
    const loader = new IntersectionObserver(async ([entry]) => {
      if (!entry.isIntersecting) return;
      loader.disconnect();
      const { createFilm } = await import('./film-gl');
      if (disposed) return;
      gl = await createFilm(canvas, { count: 16000, mapUrl: '/film/india-night.png', text: headline, onTitle: title, onStrike: strike, onWave: wave });
      if (disposed) { gl.dispose(); return; }
      gl.setT(beatT(), true);
      gl.setFinale(...finale());
      film.classList.add('film-ready');
      // Contact waits for the light only once the light exists.
      if (contact && headline) { contact.classList.add('finale-armed'); contact.addEventListener('focusin', onFocus); }
      run();
    }, { root: scroller, rootMargin: '120% 0px' });
    loader.observe(film);

    const refresh = () => requestAnimationFrame(update);
    window.addEventListener('portfolio:scene', refresh);
    refresh();

    return () => {
      disposed = true;
      gl?.dispose(); gl = null;
      [visibility, loader].forEach((o) => o.disconnect());
      resize.disconnect();
      scroller.removeEventListener('scroll', update);
      window.removeEventListener('portfolio:motion', onMotion);
      window.removeEventListener('portfolio:scene', refresh);
      document.removeEventListener('visibilitychange', run);
      canvas.removeEventListener('webglcontextlost', lost);
      film.classList.remove('film-live', 'film-ready');
      contact?.classList.remove('finale-armed', 'finale-title', 'finale-wave');
      contact?.removeEventListener('focusin', onFocus);
      reveal.forEach((el) => ['--wave', '--wx', '--wy'].forEach((k) => el.style.removeProperty(k)));
      shows.forEach(({ el }) => el.classList.remove('is-on'));
      typed.forEach(({ el, html }) => { el.innerHTML = html; el.removeAttribute('aria-label'); });
      [...backdrops, shade, canvas].forEach((b) => b?.style.removeProperty('opacity'));
    };
  });
}
