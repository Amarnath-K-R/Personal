import { gsap } from 'gsap';

const palettes = {
  night: { name: 'Night', a: '#1f5bff', b: '#1a8cff', c: '#7fdcff', accent: '#a8e6ff', base: '#03050b', glow: '#0a2260', deep: '#010206', glowA: '#0a2bd0', glowB: '#0560d6', hot: '#1f6bff', cool: '#35d8ff' },
  atmosphere: { name: 'Air · Water', a: '#2f7bff', b: '#18b4ff', c: '#5cf0ff', accent: '#b4f4ff', base: '#041a78', glow: '#1250ff', deep: '#020b3a', glowA: '#1458ff', glowB: '#00d4ff', hot: '#2f80ff', cool: '#4df0ff' },
  ember: { name: 'Fire · Sun', a: '#ed2939', b: '#ff5b2f', c: '#ffb63e', accent: '#ffd0a2', base: '#34060b', glow: '#b9192a', deep: '#150205', glowA: '#d4142a', glowB: '#ff7a1a', hot: '#ff2a44', cool: '#ffa31a' },
  verdant: { name: 'Nature · Flora', a: '#0d9d42', b: '#72e33d', c: '#9eea2d', accent: '#d3f7a9', base: '#02261a', glow: '#148242', deep: '#01100a', glowA: '#06a84a', glowB: '#4dff2a', hot: '#10d060', cool: '#7dff3a' },
  neon: { name: 'Neon blue', a: '#1f51ff', b: '#4d4dff', c: '#8aa4ff', accent: '#a6b9ff', base: '#020833', glow: '#1b3cff', deep: '#01031a', glowA: '#1f51ff', glowB: '#3d3bff', hot: '#2a5bff', cool: '#5f7dff' },
  violet: { name: 'Violet', a: '#7a30ff', b: '#5a6bff', c: '#c4b0ff', accent: '#e0d2ff', base: '#06011a', glow: '#5a18d0', deep: '#020008', glowA: '#6a1fe6', glowB: '#2a6bff', hot: '#8c36ff', cool: '#3f8cff' },
} as const;
export type AtmosphereKey = keyof typeof palettes;
const areaPalette: Record<string, AtmosphereKey> = { imaging: 'atmosphere', omics: 'verdant', clinical: 'ember', trust: 'violet' };
const properties = { a: '--liquid-a', b: '--liquid-b', c: '--liquid-c', accent: '--accent', base: '--ambient-base', glow: '--ambient-glow', deep: '--ambient-deep', glowA: '--field-glow-a', glowB: '--field-glow-b', hot: '--orb-hot', cool: '--orb-cool' } as const;
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const isPalette = (value: string): value is AtmosphereKey => Object.hasOwn(palettes, value);

export function initAtmosphere() {
  const root = document.documentElement;
  const body = document.body;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const choices = [...document.querySelectorAll<HTMLButtonElement>('[data-atmosphere-choice]')];
  const name = document.querySelector<HTMLElement>('[data-atmosphere-name]');
  const hint = document.querySelector<HTMLElement>('[data-atmosphere-hint]');
  const motion = document.querySelector<HTMLButtonElement>('[data-liquid-motion]');
  let automatic = true;
  let paused = false;
  let active: AtmosphereKey = areaPalette[body.dataset.projectArea || ''] || 'night';
  let projectPalette: AtmosphereKey | null = body.dataset.projectArea ? active : null;
  let tween: gsap.core.Tween | null = null;
  let frame = 0;
  let anchors: { y: number; key: AtmosphereKey }[] = [];
  const defaults: Record<string, AtmosphereKey> = { top: 'night', about: 'atmosphere', work: 'violet', publications: 'verdant', moments: 'neon', contact: 'atmosphere' };
  const sections = [...document.querySelectorAll<HTMLElement>('main > section[id]')];
  let sceneId = body.dataset.scene || '';

  function controls() {
    body.dataset.atmosphereMode = automatic ? 'auto' : 'manual';
    body.dataset.atmosphere = active;
    choices.forEach((button) => button.setAttribute('aria-pressed', String(automatic ? button.dataset.atmosphereChoice === 'auto' : button.dataset.atmosphereChoice === active)));
    if (name) name.textContent = palettes[active].name;
    if (hint) hint.textContent = automatic ? sceneId ? 'One atmosphere, moving between worlds.' : 'One atmosphere, blending as you scroll.' : 'Your palette stays until you choose Auto.';
  }
  function paletteProperties(key: AtmosphereKey): Record<string, string> {
    return Object.fromEntries(Object.entries(properties).map(([field, property]) => [property, palettes[key][field as keyof typeof properties]]));
  }
  function setPalette(key: AtmosphereKey, immediate = false) {
    active = key;
    tween?.kill();
    const props = paletteProperties(key);
    if (immediate || reduced.matches) gsap.set(root, props);
    else tween = gsap.to(root, { ...props, duration: 1.35, ease: 'sine.inOut' });
    const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (themeColor) themeColor.content = palettes[key].base;
    controls();
  }
  function blendAtScroll() {
    const y = window.scrollY + window.innerHeight * .44;
    let left = anchors[0];
    let right = anchors[anchors.length - 1];
    if (!left || !right) return paletteProperties(active);
    if (y <= left.y) right = left;
    else if (y >= right.y) left = right;
    else for (let index = 0; index < anchors.length - 1; index++) {
      if (y >= anchors[index].y && y <= anchors[index + 1].y) { left = anchors[index]; right = anchors[index + 1]; break; }
    }
    const position = left === right ? 0 : clamp((y - left.y) / Math.max(1, right.y - left.y));
    const t = position * position * (3 - 2 * position);
    active = t < .5 ? left.key : right.key;
    return Object.fromEntries(Object.entries(properties).map(([field, property]) => {
      const k = field as keyof typeof properties;
      return [property, gsap.utils.interpolate(palettes[left.key][k], palettes[right.key][k], t)];
    }));
  }
  function update() {
    frame = 0;
    if (automatic && !projectPalette && !sceneId) {
      tween?.kill();
      gsap.set(root, blendAtScroll());
      controls();
    }
    const work = document.getElementById('work');
    if (work) {
      if (sceneId) { root.style.setProperty('--ambient-art-opacity', sceneId === 'work' ? '.055' : '0'); return; }
      const rect = work.getBoundingClientRect();
      const distance = Math.abs(rect.top + rect.height * .5 - window.innerHeight * .5);
      root.style.setProperty('--ambient-art-opacity', String(.11 * clamp(1 - distance / (rect.height * .65 + window.innerHeight))));
    }
  }
  function requestUpdate() { if (!frame) frame = requestAnimationFrame(update); }
  function measure() {
    // First screen: near-black with a hint of blue. The blue comes in through the About story, then the other sections blend on.
    const about = document.getElementById('about');
    const list: { y: number; key: AtmosphereKey }[] = [{ y: window.innerHeight * 0.5, key: 'night' }];
    if (about) list.push({ y: about.getBoundingClientRect().top + window.scrollY + about.offsetHeight * 0.6, key: 'atmosphere' });
    sections.filter((section) => section.id !== 'top').forEach((section) => list.push({ y: section.getBoundingClientRect().top + window.scrollY + section.offsetHeight * .45, key: defaults[section.id] || 'atmosphere' }));
    anchors = list;
    requestUpdate();
  }
  function applyMotion() {
    const isPaused = paused || reduced.matches;
    body.classList.toggle('liquid-paused', isPaused);
    if (motion) {
      motion.disabled = reduced.matches;
      motion.setAttribute('aria-pressed', String(isPaused));
      motion.setAttribute('aria-label', reduced.matches ? 'Animation disabled by reduced-motion preference' : isPaused ? 'Resume liquid animation' : 'Pause liquid animation');
    }
    const icon = document.querySelector('[data-motion-icon]');
    if (icon) icon.textContent = isPaused ? '▷' : 'Ⅱ';
    const label = document.querySelector('[data-motion-label]');
    if (label) label.textContent = isPaused ? 'Resume liquid animation' : 'Pause liquid animation';
    window.dispatchEvent(new CustomEvent('portfolio:motion', { detail: { paused: isPaused } }));
  }
  choices.forEach((button) => button.addEventListener('click', () => {
    const value = button.dataset.atmosphereChoice || 'auto';
    automatic = value === 'auto';
    if (!automatic && isPalette(value)) setPalette(value);
    else if (projectPalette) setPalette(projectPalette);
    else if (sceneId) setPalette(defaults[sceneId] || 'atmosphere');
    else {
      tween?.kill();
      tween = gsap.to(root, { ...blendAtScroll(), duration: reduced.matches ? 0 : 1.1, ease: 'sine.inOut' });
      controls();
    }
  }));
  motion?.addEventListener('click', () => { paused = !paused; applyMotion(); });
  reduced.addEventListener('change', () => { applyMotion(); requestUpdate(); });
  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', measure, { passive: true });
  window.addEventListener('portfolio:layout', measure);
  window.addEventListener('load', measure, { once: true });
  window.addEventListener('portfolio:scene', (event) => {
    sceneId = (event as CustomEvent<{ id: string }>).detail.id;
    if (automatic && !projectPalette) setPalette(defaults[sceneId] || 'atmosphere');
    requestUpdate();
  });
  // About scene: black with a hint of blue at the top; the blue comes in as you read down the About story.
  const aboutScroller = document.getElementById('top');
  const aboutStory = document.getElementById('about');
  function blendAbout() {
    if (!aboutScroller || !aboutStory || sceneId !== 'top' || !automatic || projectPalette) return;
    // Blue rises as the villages light ("Care should reach further") and is fully in by the end of Contact.
    const marker = aboutScroller.querySelector<HTMLElement>('[data-beat="5"]') || aboutScroller.querySelector<HTMLElement>('.about-principles');
    const start = marker ? marker.getBoundingClientRect().top - aboutScroller.getBoundingClientRect().top + aboutScroller.scrollTop - aboutScroller.clientHeight * 0.5 : 0;
    const end = Math.max(start + 1, aboutScroller.scrollHeight - aboutScroller.clientHeight);
    const p = clamp((aboutScroller.scrollTop - start) / (end - start));
    const t = p * p * (3 - 2 * p);
    tween?.kill();
    gsap.set(root, Object.fromEntries(Object.entries(properties).map(([field, property]) => {
      const k = field as keyof typeof properties;
      return [property, gsap.utils.interpolate(palettes.night[k], palettes.atmosphere[k], t)];
    })));
    active = t < .5 ? 'night' : 'atmosphere';
    controls();
  }
  aboutScroller?.addEventListener('scroll', blendAbout, { passive: true });
  document.fonts.ready.then(measure);
  if (document.querySelector('main')) new ResizeObserver(measure).observe(document.querySelector('main')!);
  window.addEventListener('portfolio:project', (event) => {
    const detail = (event as CustomEvent<{ area?: string; closing?: boolean }>).detail;
    if (detail?.closing) {
      projectPalette = null;
      if (automatic && sceneId) setPalette(defaults[sceneId] || 'atmosphere');
      else if (automatic) { tween?.kill(); tween = gsap.to(root, { ...blendAtScroll(), duration: reduced.matches ? 0 : 1.1 }); controls(); }
    } else if (detail?.area && areaPalette[detail.area]) {
      projectPalette = areaPalette[detail.area];
      if (automatic) setPalette(projectPalette);
    }
  });
  const hero = document.querySelector<HTMLElement>('.hero');
  const stage = document.querySelector<HTMLElement>('.liquid-stage');
  if (hero && stage && matchMedia('(pointer: fine)').matches) {
    const x = gsap.quickTo(stage, 'x', { duration: 1.05, ease: 'power3.out' });
    const y = gsap.quickTo(stage, 'y', { duration: 1.05, ease: 'power3.out' });
    hero.addEventListener('pointermove', (event) => {
      if (paused || reduced.matches) return;
      const bounds = hero.getBoundingClientRect();
      x(((event.clientX - bounds.left) / bounds.width - .5) * 25);
      y(((event.clientY - bounds.top) / bounds.height - .5) * 20);
    }, { passive: true });
    hero.addEventListener('pointerleave', () => { x(0); y(0); }, { passive: true });
  }
  setPalette(sceneId ? defaults[sceneId] || 'atmosphere' : active, true);
  measure();
  applyMotion();
}
