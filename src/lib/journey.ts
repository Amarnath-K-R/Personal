import { gsap } from 'gsap';
import { scenePassages, type SceneCoverMask, type SceneId } from '../data/scenePassages';

type Area = { element: HTMLElement; id: SceneId };
type HashResolution = { index: number; target: HTMLElement | null; sceneHash: boolean };
const ids = Object.keys(scenePassages) as SceneId[];
const coverMasks: Record<SceneCoverMask, { open: string; full: string; close: string }> = {
  iris: { open: 'circle(0% at 50% 50%)', full: 'circle(150% at 50% 50%)', close: 'circle(0% at 50% 50%)' },
  shutter: { open: 'inset(0 0 100% 0)', full: 'inset(0)', close: 'inset(100% 0 0 0)' },
  ribbon: {
    open: 'polygon(-55% 0%,-25% 0%,-85% 100%,-115% 100%)',
    full: 'polygon(-55% 0%,155% 0%,115% 100%,-95% 100%)',
    close: 'polygon(175% 0%,205% 0%,145% 100%,115% 100%)',
  },
  split: { open: 'inset(0 50% 0 50%)', full: 'inset(0)', close: 'inset(50% 0 50% 0)' },
};

export function initJourney() {
  const main = document.querySelector<HTMLElement>('main#main');
  const shell = document.querySelector<HTMLElement>('#site-shell');
  const sceneSections = main
    ? [...main.children].filter((child): child is HTMLElement => child instanceof HTMLElement && child.matches('section[id]'))
    : [];
  const areas: Area[] = ids.flatMap((id) => {
    const element = sceneSections.find((candidate) => candidate.id === id);
    return element ? [{ id, element }] : [];
  });
  const status = document.querySelector<HTMLElement>('[data-journey-status]');
  const skipLink = document.querySelector<HTMLElement>('.skip-link');
  const titleCurtain = document.querySelector<HTMLElement>('[data-scene-title-curtain]');
  const titleCurtainText = titleCurtain?.querySelector<HTMLElement>('[data-scene-title-text]');
  const titleCurtainNumber = titleCurtain?.querySelector<HTMLElement>('[data-scene-title-number]');
  const titleCurtainLine = titleCurtain?.querySelector<HTMLElement>('[data-scene-title-line]');
  const titleCurtainLabel = titleCurtain?.querySelector<HTMLElement>('[data-scene-title-label]');
  if (!main || areas.length !== ids.length || !status || !titleCurtain || !titleCurtainText || !titleCurtainNumber || !titleCurtainLine || !titleCurtainLabel) return false;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let busy = false;
  let projectOpen = false;
  let paused = document.body.classList.contains('liquid-paused');
  let timeline: gsap.core.Timeline | null = null;
  let edgeDirection = 0;
  let edgeDistance = 0;
  let edgeSamples = 0;
  let edgeResetTimer: number | undefined;
  let touchLastY: number | null = null;
  let touchArea: HTMLElement | null = null;

  function decodeFragment(hash: string) {
    if (!hash || hash === '#') return '';
    try { return decodeURIComponent(hash.replace(/^#/, '')); } catch { return ''; }
  }
  function resolveHash(hash = location.hash): HashResolution {
    const id = decodeFragment(hash);
    if (!id) return { index: 0, target: null, sceneHash: true };
    const sceneIndex = areas.findIndex((area) => area.id === id);
    if (sceneIndex >= 0) return { index: sceneIndex, target: null, sceneHash: true };
    const target = document.getElementById(id);
    if (!target) return { index: -1, target: null, sceneHash: false };
    const owner = areas.findIndex((area) => area.element === target || area.element.contains(target));
    return owner >= 0 ? { index: owner, target, sceneHash: false } : { index: -1, target: null, sceneHash: false };
  }
  function ownerIndex(target: HTMLElement) {
    return areas.findIndex((area) => area.element === target || area.element.contains(target));
  }
  function clearEdgeIntent(updateCue = false) {
    if (edgeResetTimer !== undefined) window.clearTimeout(edgeResetTimer);
    edgeResetTimer = undefined;
    edgeDirection = 0;
    edgeDistance = 0;
    edgeSamples = 0;
    if (updateCue) syncScrollCue();
  }
  function edgeTarget(direction: number) {
    const area = areas[active].element;
    const atEnd = area.scrollTop + area.clientHeight >= area.scrollHeight - 3;
    const atStart = area.scrollTop <= 2;
    if (direction > 0 && atEnd) return (active + 1) % areas.length;
    if (direction < 0 && atStart && active > 0) return active - 1;
    return -1;
  }
  function syncScrollCue(continuing = false) {
    const area = areas[active].element;
    const cue = area.querySelector<HTMLAnchorElement>('[data-scroll-cue]');
    const atEnd = area.scrollTop + area.clientHeight >= area.scrollHeight - 3;
    document.body.dataset.scrollEdge = atEnd && !busy && !!cue ? 'end' : '';
    if (!cue) return;
    cue.inert = !atEnd || busy;
    const final = cue.dataset.final === 'true';
    const destinationIndex = (active + 1) % areas.length;
    const destination = cue.dataset.nextLabel || scenePassages[areas[destinationIndex].id].name;
    const copy = final
      ? (continuing ? 'Keep scrolling to return to About' : 'Scroll to return to About')
      : (continuing ? 'Keep scrolling to continue' : 'Scroll to continue');
    const copyElement = cue.querySelector<HTMLElement>('[data-scroll-cue-text]');
    if (copyElement) copyElement.textContent = copy;
    cue.setAttribute('aria-label', final ? `Scroll to return to ${destination}, or activate this link` : `Scroll to continue to ${destination}, or activate this link`);
  }
  function registerEdgeIntent(direction: number, amount: number, minSamples: number) {
    if (edgeDirection !== direction) clearEdgeIntent(false);
    edgeDirection = direction;
    edgeDistance += Math.min(180, amount);
    edgeSamples += 1;
    syncScrollCue(true);
    if (edgeDistance >= 180 && edgeSamples >= minSamples) {
      const destination = edgeTarget(direction);
      clearEdgeIntent(false);
      if (destination >= 0) travel(destination, 'push', null, direction);
      else syncScrollCue();
      return;
    }
    if (edgeResetTimer !== undefined) window.clearTimeout(edgeResetTimer);
    edgeResetTimer = window.setTimeout(() => clearEdgeIntent(true), 750);
  }
  function isInteractiveTouchTarget(target: EventTarget | null) {
    return target instanceof Element && !!target.closest('a,button,input,textarea,select,[contenteditable="true"],[role="button"]');
  }
  function handleWheel(event: WheelEvent, area: Area) {
    if (area.element !== areas[active].element) return;
    if (busy) { if (event.cancelable) event.preventDefault(); return; }
    if (projectOpen || event.ctrlKey || !event.deltaY) return;
    const multiplier = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? area.element.clientHeight : 1;
    const delta = event.deltaY * multiplier;
    const direction = Math.sign(delta);
    if (edgeTarget(direction) < 0) { clearEdgeIntent(true); return; }
    if (!event.cancelable) return;
    event.preventDefault();
    registerEdgeIntent(direction, Math.abs(delta), 2);
  }
  function handleTouchStart(event: TouchEvent, area: Area) {
    if (event.touches.length !== 1 || isInteractiveTouchTarget(event.target)) {
      touchLastY = null;
      touchArea = null;
      return;
    }
    touchLastY = event.touches[0].clientY;
    touchArea = area.element;
  }
  function handleTouchMove(event: TouchEvent, area: Area) {
    if (touchLastY === null || touchArea !== area.element || event.touches.length !== 1) return;
    if (busy) { if (event.cancelable) event.preventDefault(); return; }
    if (projectOpen) return;
    const currentY = event.touches[0].clientY;
    const delta = touchLastY - currentY;
    touchLastY = currentY;
    if (Math.abs(delta) < 1) return;
    const direction = Math.sign(delta);
    if (edgeTarget(direction) < 0) { clearEdgeIntent(true); return; }
    if (!event.cancelable) return;
    event.preventDefault();
    registerEdgeIntent(direction, Math.abs(delta), 3);
  }

  const initial = resolveHash();
  let active = initial.index >= 0 ? initial.index : 0;

  function announce() {
    status!.textContent = `${scenePassages[areas[active].id].name}. ${active + 1} of ${areas.length}.`;
  }
  function sync() {
    document.body.dataset.scene = areas[active].id;
    announce();
  }
  function focusElement(element: HTMLElement) {
    element.tabIndex = -1;
    element.focus({ preventScroll: true });
  }
  function focusArea() {
    const area = areas[active];
    const heading = area.id === 'work' ? area.element.querySelector<HTMLElement>('[data-universe]') : area.element.querySelector<HTMLElement>('h1,h2');
    if (heading) focusElement(heading);
    announce();
  }
  function focusInternalTarget(target: HTMLElement) {
    focusElement(target);
    announce();
  }
  function measure() { document.documentElement.style.setProperty('--scene-height', `${main!.clientHeight}px`); }
  function resetScroll(area: Area) {
    area.element.scrollTop = 0;
  }
  function placeAt(target: HTMLElement, smooth = false) {
    const area = areas[active].element;
    // Divided by the scene's scale, so this is right even mid-transition (the entering scene starts at scale 1.006).
    const scale = area.getBoundingClientRect().height / area.offsetHeight || 1;
    area.scrollTo({
      top: Math.max(0, (target.getBoundingClientRect().top - area.getBoundingClientRect().top) / scale + area.scrollTop - 18),
      behavior: smooth ? 'smooth' : 'auto',
    });
  }
  function scrollToInternalTarget(target: HTMLElement, smooth = false) {
    if (ownerIndex(target) !== active) return;
    placeAt(target, smooth);
    focusInternalTarget(target);
  }
  function activate(index: number, reset = true) {
    active = index;
    areas.forEach((area, position) => {
      area.element.hidden = position !== index;
      area.element.inert = position !== index;
      area.element.setAttribute('aria-hidden', String(position !== index));
      area.element.dataset.sceneActive = String(position === index);
    });
    if (reset) resetScroll(areas[index]);
    sync();
    syncScrollCue();
    window.dispatchEvent(new CustomEvent('portfolio:scene', { detail: { id: areas[index].id, index, element: areas[index].element } }));
    requestAnimationFrame(() => window.dispatchEvent(new CustomEvent('portfolio:layout')));
  }
  function record(index: number, replace = false, target: HTMLElement | null = null) {
    const hash = target?.id || areas[index].id;
    const url = `${location.pathname}${location.search}#${encodeURIComponent(hash)}`;
    const state = { ...(history.state || {}), portfolioScene: areas[index].id };
    if (replace) history.replaceState(state, '', url); else history.pushState(state, '', url);
  }
  function travel(index: number, historyMode: 'push' | 'none' = 'push', target: HTMLElement | null = null, travelDirection?: number) {
    if (busy || projectOpen || index < 0 || index >= areas.length) return;
    if (historyMode === 'push') record(index, false, target);
    if (index === active) {
      if (target && target !== areas[index].element) scrollToInternalTarget(target, true);
      else { resetScroll(areas[index]); focusArea(); }
      return;
    }
    clearEdgeIntent(false);
    if (reduced.matches || paused) {
      activate(index);
      if (target) scrollToInternalTarget(target); else focusArea();
      return;
    }

    busy = true;
    const direction = travelDirection ?? (active === areas.length - 1 && index === 0 ? 1 : index > active ? 1 : -1);
    const leaving = areas[active].element;
    const entering = areas[index].element;
    const fromTone = scenePassages[areas[active].id].tone;
    const passage = scenePassages[areas[index].id];
    const mask = coverMasks[passage.mask];
    document.body.classList.add('journey-transiting');
    document.body.dataset.scrollEdge = '';
    titleCurtain!.style.setProperty('--passage-tone', fromTone);
    titleCurtainNumber!.textContent = `${String(index + 1).padStart(2, '0')} / ${String(areas.length).padStart(2, '0')}`;
    titleCurtainText!.textContent = passage.name;
    titleCurtainLine!.textContent = passage.line;
    if (skipLink) skipLink.inert = true;
    main!.inert = true;
    if (shell) shell.inert = true;
    window.dispatchEvent(new CustomEvent('portfolio:travel', { detail: { active: true } }));

    const finish = () => {
      gsap.set([leaving, entering, titleCurtain!, titleCurtainLabel!], { clearProps: 'opacity,transform,visibility,clipPath' });
      titleCurtainNumber!.textContent = '';
      titleCurtainText!.textContent = '';
      titleCurtainLine!.textContent = '';
      titleCurtain!.style.removeProperty('--passage-tone');
      document.body.classList.remove('journey-transiting');
      if (skipLink) skipLink.inert = false;
      main!.inert = false;
      if (shell) shell.inert = projectOpen;
      busy = false;
      window.dispatchEvent(new CustomEvent('portfolio:travel', { detail: { active: false } }));
      window.dispatchEvent(new CustomEvent('portfolio:layout'));
      syncScrollCue();
      if (target && target !== entering) scrollToInternalTarget(target); else focusArea();
      queueMicrotask(restoreFromHash);
    };
    gsap.set(titleCurtain!, { clipPath: mask.open, autoAlpha: 1 });
    timeline = gsap.timeline({ onComplete: finish });
    timeline.to(titleCurtain!, { '--passage-tone': passage.tone, duration: 1.18, ease: 'sine.inOut' }, 0);
    timeline.to(leaving, { autoAlpha: .68, y: -direction * 10, scale: .994, duration: .46, ease: 'power1.inOut' }, 0);
    timeline.to(titleCurtain!, { clipPath: mask.full, duration: .5, ease: 'power3.inOut' }, 0);
    timeline.fromTo(titleCurtainLabel!, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: .28, ease: 'power2.out' }, .2);
    timeline.add(() => { activate(index); if (target && target !== entering) placeAt(target); }, .48);
    timeline.fromTo(entering, { autoAlpha: .5, y: direction * 9, scale: 1.006 }, { autoAlpha: 1, y: 0, scale: 1, duration: .5, ease: 'power2.out' }, .48);
    timeline.to(titleCurtainLabel!, { autoAlpha: 0, y: -5, duration: .18, ease: 'power1.out' }, .83);
    timeline.to(titleCurtain!, { clipPath: mask.close, duration: .52, ease: 'power3.inOut' }, .82);
  }
  function restoreFromHash() {
    // Pushed overlay URLs (/work/…, /highlights/…) belong to their overlays, not to scene travel.
    if (projectOpen || location.pathname !== '/') return;
    if (busy) { timeline?.progress(1); return; }
    const resolution = resolveHash();
    if (resolution.index < 0) return;
    if (resolution.index !== active) { travel(resolution.index, 'none', resolution.target); return; }
    if (resolution.target) scrollToInternalTarget(resolution.target);
    else { resetScroll(areas[active]); focusArea(); }
  }

  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0 || projectOpen) return;
    const target = event.target instanceof Element ? event.target : null;
    const link = target?.closest<HTMLAnchorElement>('a[href^="#"]');
    if (!link?.hash) return;
    const resolution = resolveHash(link.hash);
    if (resolution.index < 0) return;
    event.preventDefault();
    travel(resolution.index, 'push', resolution.target);
  });
  window.addEventListener('hashchange', restoreFromHash);
  window.addEventListener('popstate', restoreFromHash);
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && busy) { event.preventDefault(); timeline?.progress(1); } });
  window.addEventListener('portfolio:project', (event) => { projectOpen = !(event as CustomEvent<{ closing?: boolean }>).detail.closing; if (projectOpen && busy) timeline?.progress(1); });
  window.addEventListener('portfolio:motion', (event) => { paused = !!(event as CustomEvent<{ paused: boolean }>).detail.paused; if (paused && busy) timeline?.progress(1); });
  reduced.addEventListener('change', () => { if (busy) timeline?.progress(1); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && busy) timeline?.progress(1); });
  areas.forEach((area) => {
    area.element.dataset.sceneScroll = '';
    area.element.dataset.lenisPrevent = '';
    area.element.addEventListener('scroll', () => {
      if (area.element !== areas[active].element) return;
      if (edgeDirection && edgeTarget(edgeDirection) < 0) clearEdgeIntent(false);
      syncScrollCue();
    }, { passive: true });
    area.element.addEventListener('wheel', (event) => handleWheel(event, area), { passive: false });
    area.element.addEventListener('touchstart', (event) => handleTouchStart(event, area), { passive: true });
    area.element.addEventListener('touchmove', (event) => handleTouchMove(event, area), { passive: false });
    area.element.addEventListener('touchend', () => { touchLastY = null; touchArea = null; }, { passive: true });
    area.element.addEventListener('touchcancel', () => {
      touchLastY = null;
      touchArea = null;
      clearEdgeIntent(true);
    }, { passive: true });
  });
  document.body.classList.add('scene-mode');
  main.tabIndex = -1;
  window.scrollTo(0, 0);
  measure();
  new ResizeObserver(() => { measure(); syncScrollCue(); }).observe(main);
  window.addEventListener('resize', () => syncScrollCue());
  activate(active);
  if (initial.target) requestAnimationFrame(() => { if (!busy && active === initial.index) scrollToInternalTarget(initial.target!); });
  document.fonts.ready.then(() => { measure(); syncScrollCue(); window.dispatchEvent(new CustomEvent('portfolio:layout')); });
  return true;
}
