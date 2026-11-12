import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export function initPortraits() {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(pointer: fine)');
  const small = matchMedia('(max-width: 700px)');
  const portraits = [...document.querySelectorAll<HTMLElement>('[data-portrait]')];
  portraits.forEach((portrait) => {
    const inner = portrait.querySelector<HTMLElement>('[data-portrait-reveal]');
    const button = portrait.querySelector<HTMLButtonElement>('[data-portrait-toggle]');
    let reveal: gsap.core.Tween | null = null;
    let locked = reduced.matches || !fine.matches;
    let explicitChoice = false;
    let frame = 0;
    const scene = portrait.closest<HTMLElement>('[data-scene-scroll]');
    function renderColour() {
      portrait.classList.toggle('portrait-colour-locked', locked);
      button?.setAttribute('aria-pressed', String(locked));
      if (button) button.innerHTML = locked ? 'Monochrome <span aria-hidden="true">◐</span>' : 'Reveal colour <span aria-hidden="true">◉</span>';
    }
    function configure() {
      reveal?.scrollTrigger?.kill();
      reveal?.kill();
      if (!inner) return;
      if (scene?.hidden) { gsap.set(inner, { clearProps: 'clipPath,opacity,transform' }); return; }
      if (reduced.matches || small.matches) gsap.set(inner, { clearProps: 'clipPath,opacity,transform' });
      else reveal = gsap.fromTo(inner, { clipPath: 'ellipse(60% 8% at 50% 50%)', opacity: .35, y: 22 }, {
        clipPath: 'ellipse(72% 76% at 50% 50%)', opacity: 1, y: 0, ease: 'none',
        scrollTrigger: { trigger: portrait, ...(scene ? { scroller: scene } : {}), start: 'top 94%', end: 'top 34%', scrub: .65, invalidateOnRefresh: true },
      });
      portrait.classList.toggle('portrait-natural', reduced.matches || small.matches || !fine.matches);
      if (!explicitChoice) locked = reduced.matches || small.matches || !fine.matches;
      renderColour();
    }
    portrait.addEventListener('pointerenter', () => { if (!reduced.matches && fine.matches) portrait.classList.add('portrait-hovered'); });
    portrait.addEventListener('pointerleave', () => portrait.classList.remove('portrait-hovered'));
    portrait.addEventListener('pointermove', (event) => {
      if (reduced.matches || !fine.matches || locked) return;
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const bounds = inner?.getBoundingClientRect();
        if (!bounds) return;
        portrait.style.setProperty('--lens-x', `${Math.max(0, Math.min(100, (event.clientX - bounds.left) / bounds.width * 100))}%`);
        portrait.style.setProperty('--lens-y', `${Math.max(0, Math.min(100, (event.clientY - bounds.top) / bounds.height * 100))}%`);
        frame = 0;
      });
    }, { passive: true });
    button?.addEventListener('click', () => {
      explicitChoice = true;
      locked = !locked;
      renderColour();
    });
    reduced.addEventListener('change', configure);
    fine.addEventListener('change', configure);
    small.addEventListener('change', configure);
    window.addEventListener('portfolio:scene', configure);
    window.addEventListener('portfolio:layout', () => { if (!scene?.hidden) reveal?.scrollTrigger?.refresh(); });
    configure();
  });
}
