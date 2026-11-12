import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { initArtwork } from '../lib/art';
import { initAtmosphere } from '../lib/atmosphere';
import { initUniverse } from '../lib/universe';
import { initJourney } from '../lib/journey';
import { initPortraits } from '../lib/portrait';
import { initSky } from '../lib/sky';
import { initFilm } from '../lib/film';
import { initHighlights } from '../lib/highlights';
import { initGlass } from '../lib/glass';
import { initPosts } from '../lib/post';

gsap.registerPlugin(ScrollTrigger);
gsap.ticker.lagSmoothing(0);
const $ = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document) => root.querySelector<T>(selector);
const $$ = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document) => [...root.querySelectorAll<T>(selector)];
const reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');
let reduced = reducedQuery.matches;
document.body.classList.add('js-ready');
document.body.classList.toggle('reduced-motion', reduced);
initJourney();
initHighlights(); // after initJourney: its popstate listener must run after the journey's
initGlass();
initPosts();
initArtwork();
initAtmosphere();
initUniverse();
initPortraits();
initSky();
initFilm();

let lenis: Lenis | null = null;
function setupSmoothScroll(stopped = false) {
  lenis?.destroy();
  lenis = reduced || document.body.classList.contains('scene-mode') ? null : new Lenis({ lerp: .085, anchors: false, autoRaf: false });
  lenis?.on('scroll', ScrollTrigger.update);
  if (stopped) lenis?.stop();
}
setupSmoothScroll();
gsap.ticker.add((time) => lenis?.raf(time * 1000));

const clocks = $$<HTMLTimeElement>('[data-clock]');
function updateClock() {
  const value = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
  clocks.forEach((clock) => { clock.textContent = value; });
}
updateClock();
setInterval(updateClock, 30_000);
const year = $('#current-year');
if (year) year.textContent = String(new Date().getFullYear());
const progress = $('#reading-progress-fill') as HTMLElement | null;
function updateReadingProgress() {
  const scenes = $$<HTMLElement>('main > section[data-scene-scroll]');
  const index = scenes.findIndex((scene) => !scene.hidden);
  const scene = scenes[index];
  const fraction = scene ? scene.scrollTop / Math.max(1, scene.scrollHeight - scene.clientHeight) : scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight);
  if (progress) progress.style.width = `${Math.max(0, Math.min(1, scene ? (index + fraction) / scenes.length : fraction)) * 100}%`;
}
window.addEventListener('scroll', updateReadingProgress, { passive: true, capture: true });
window.addEventListener('resize', () => { updateReadingProgress(); ScrollTrigger.refresh(); }, { passive: true });
window.addEventListener('load', () => { ScrollTrigger.refresh(); updateReadingProgress(); }, { once: true });
window.addEventListener('portfolio:layout', () => { ScrollTrigger.refresh(); updateReadingProgress(); });
window.addEventListener('portfolio:scene', updateReadingProgress);

let revealContext: gsap.Context | null = null;
let revealObserver: IntersectionObserver | null = null;
function revealItem(item: HTMLElement, withScrollTrigger = false) {
  const timeline = gsap.timeline(withScrollTrigger ? { scrollTrigger: { trigger: item, start: 'top 86%', once: true } } : {});
  const aboutImage = item.hasAttribute('data-about-image');
  if (aboutImage) {
    gsap.set(item, { y: 0 });
    timeline.to(item, { autoAlpha: 1, duration: .68, ease: 'power3.out' }, 0);
  } else timeline.to(item, { autoAlpha: 1, y: 0, duration: .68, ease: 'power3.out' }, 0);
  const lines = $$<HTMLElement>('[data-editorial-line]', item);
  if (lines.length) timeline.fromTo(lines, { yPercent: 112, rotateX: 7, transformPerspective: 900, transformOrigin: '50% 100%' }, { yPercent: 0, rotateX: 0, duration: 1.02, stagger: .11, ease: 'power4.out' }, .02);
  return timeline;
}
function setupReveals(initial = false) {
  revealContext?.revert();
  revealObserver?.disconnect();
  const hero = '.hero .eyebrow, .hero h1, .hero-profession, .hero-deck, .hero-actions, .hero-baseline';
  if (reduced) { gsap.set(`${hero}, [data-reveal]`, { autoAlpha: 1, y: 0 }); return; }
  revealContext = gsap.context(() => {
    if (initial) gsap.fromTo(hero, { autoAlpha: 0, y: 22 }, { autoAlpha: 1, y: 0, duration: .85, stagger: .08, ease: 'power3.out', delay: .16 });
    else gsap.set(hero, { autoAlpha: 1, y: 0 });
    if (document.body.classList.contains('scene-mode')) {
      const items = $$<HTMLElement>('[data-reveal]');
      gsap.set(items, { autoAlpha: 0, y: 18 });
      revealObserver = new IntersectionObserver((entries) => entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        revealItem(entry.target as HTMLElement);
        revealObserver?.unobserve(entry.target);
      }), { threshold: .08 });
      items.forEach((item) => revealObserver!.observe(item));
    } else $$<HTMLElement>('[data-reveal]').forEach((item) => { revealItem(item, true); });
  });
}
setupReveals(true);

const paperFilters = $$<HTMLButtonElement>('[data-pub-filter]');
const paperRows = $$<HTMLElement>('[data-pub-row]');
paperFilters.forEach((button) => button.addEventListener('click', () => {
  const key = button.dataset.pubFilter;
  paperRows.forEach((row) => { row.hidden = key !== 'all' && row.dataset.group !== key; });
  paperFilters.forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
  window.dispatchEvent(new CustomEvent('portfolio:layout'));
}));

// All constellation nodes and list entries are native links; the dialog enhances them.
const overlay = $('#project-overlay') as HTMLElement | null;
const shell = $('#site-shell') as HTMLElement | null;
const overlayScroll = $('.overlay-scroll', overlay ?? document) as HTMLElement | null;
const chapters = $$<HTMLElement>('[data-chapter]', overlay ?? document);
let activeChapter: HTMLElement | null = null;
let projectOpener: HTMLElement | null = null;
let overlayOpen = false;
let restoreTitle = document.title;
let transition: gsap.core.Timeline | null = null;
type Direction = 'entry' | 'forward' | 'back';
const masks: Record<Direction, string> = { entry: 'inset(100% 0 0 0)', forward: 'inset(0 0 0 100%)', back: 'inset(0 100% 0 0)' };
let entryMask = masks.entry;
function projectBySlug(slug: string) { return chapters.find((chapter) => chapter.dataset.slug === slug) || null; }
function revealChapter(slug: string) {
  const chapter = projectBySlug(slug);
  if (!chapter || !overlay) return;
  if (activeChapter) { activeChapter.hidden = true; activeChapter.setAttribute('aria-hidden', 'true'); activeChapter.inert = true; }
  activeChapter = chapter;
  chapter.hidden = false;
  chapter.setAttribute('aria-hidden', 'false');
  chapter.inert = false;
  const title = chapter.querySelector('.chapter-title');
  if (title?.id) overlay.setAttribute('aria-labelledby', title.id);
  if (title?.textContent) document.title = `${title.textContent.trim()} · Amarnath K R`;
  if (overlayScroll) overlayScroll.scrollTop = 0;
  window.dispatchEvent(new CustomEvent('portfolio:project', { detail: { area: chapter.dataset.area } }));
}
function openProject(slug: string, opener: HTMLElement | null, push: boolean, direction: Direction = 'entry') {
  if (!overlay || !projectBySlug(slug)) return;
  transition?.kill();
  if (!overlayOpen) {
    projectOpener = opener || document.activeElement as HTMLElement;
    restoreTitle = document.title;
    shell?.setAttribute('inert', '');
    overlay.hidden = false;
    overlay.removeAttribute('inert');
    overlay.tabIndex = -1;
    document.body.classList.add('project-open');
    lenis?.stop();
  }
  overlayOpen = true;
  if (push) history.pushState({ ...(history.state || {}), portfolioProject: slug }, '', `/work/${slug}/`);
  revealChapter(slug);
  entryMask = masks[direction];
  overlay.focus({ preventScroll: true });
  if (reduced) { overlay.style.clipPath = 'inset(0)'; activeChapter?.querySelector<HTMLElement>('[data-close-project]')?.focus(); }
  else {
    overlay.style.clipPath = entryMask;
    const title = activeChapter?.querySelector('.chapter-title');
    transition = gsap.timeline({ onComplete: () => activeChapter?.querySelector<HTMLElement>('[data-close-project]')?.focus() });
    transition.to(overlay, { clipPath: 'inset(0)', duration: .72, ease: 'power4.inOut' });
    if (title) transition.fromTo(title, { y: 26, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .48, ease: 'power3.out' }, .2);
  }
}
function finishClose() {
  if (!overlay || !overlayOpen) return;
  transition?.kill();
  overlayOpen = false;
  const complete = () => {
    shell?.removeAttribute('inert');
    document.body.classList.remove('project-open');
    overlay.hidden = true;
    overlay.setAttribute('inert', '');
    overlay.style.clipPath = '';
    if (activeChapter) { activeChapter.hidden = true; activeChapter.setAttribute('aria-hidden', 'true'); activeChapter.inert = true; }
    activeChapter = null;
    document.title = restoreTitle;
    lenis?.start();
    projectOpener?.focus({ preventScroll: true });
    projectOpener = null;
    window.dispatchEvent(new CustomEvent('portfolio:project', { detail: { closing: true } }));
    ScrollTrigger.refresh();
  };
  if (reduced) complete();
  else transition = gsap.timeline({ onComplete: complete }).to(overlay, { clipPath: entryMask, duration: .56, ease: 'power3.inOut' });
}
function closeProject() {
  if (!overlayOpen) return;
  if (history.state?.portfolioProject) history.back();
  else finishClose();
}
if (overlay) {
  overlay.addEventListener('click', (event) => { if ((event.target as HTMLElement).closest('[data-close-project]')) closeProject(); });
  overlay.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { event.preventDefault(); closeProject(); return; }
    if (event.key !== 'Tab') return;
    const items = $$<HTMLElement>('a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])', overlay).filter((item) => !item.closest('[hidden]') && item.getAttribute('aria-hidden') !== 'true');
    if (!items.length) { event.preventDefault(); overlay.focus(); return; }
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  document.addEventListener('click', (event) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="/work/"]');
    if (!link || link.target === '_blank') return;
    const slug = link.pathname.split('/').filter(Boolean)[1] || '';
    if (!projectBySlug(slug)) return;
    event.preventDefault();
    if (link.hasAttribute('data-next-project')) {
      history.replaceState({ ...(history.state || {}), portfolioProject: slug }, '', `/work/${slug}/`);
      openProject(slug, link, false, 'forward');
    } else openProject(slug, link, true);
  });
  window.addEventListener('popstate', (event) => {
    const slug = event.state?.portfolioProject;
    if (overlayOpen && slug) openProject(slug, null, false, 'back');
    else if (overlayOpen) finishClose();
    else if (slug && projectBySlug(slug)) openProject(slug, null, false);
  });
}
reducedQuery.addEventListener('change', (event) => {
  reduced = event.matches;
  document.body.classList.toggle('reduced-motion', reduced);
  setupSmoothScroll(overlayOpen);
  setupReveals();
  if (reduced) transition?.progress(1);
  ScrollTrigger.refresh();
});

// Keep keyboard, ordinary anchors and independently scrollable full-screen chapters usable.
document.addEventListener('click', (event) => {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
  const link = (event.target as Element).closest<HTMLAnchorElement>('a[href^="#"]');
  if (!link?.hash || link.hash === '#') return;
  const target = document.getElementById(decodeURIComponent(link.hash.slice(1)));
  if (!target) return;
  event.preventDefault();
  if (overlayOpen && overlayScroll && overlay?.contains(target)) overlayScroll.scrollTo({ top: target.getBoundingClientRect().top - overlayScroll.getBoundingClientRect().top + overlayScroll.scrollTop - 78, behavior: reduced ? 'auto' : 'smooth' });
  else if (document.body.classList.contains('scene-mode')) {
    const scene = target.closest<HTMLElement>('[data-scene-scroll]');
    if (scene) scene.scrollTo({ top: target.getBoundingClientRect().top - scene.getBoundingClientRect().top + scene.scrollTop - 18, behavior: reduced ? 'auto' : 'smooth' });
    else if (target.id === 'main') { target.tabIndex = -1; target.focus({ preventScroll: true }); }
  }
  else if (lenis) lenis.scrollTo(Math.max(0, target.getBoundingClientRect().top + scrollY - 112), { duration: .9 });
  else window.scrollTo({ top: Math.max(0, target.getBoundingClientRect().top + scrollY - 112), behavior: reduced ? 'auto' : 'smooth' });
});
const toast = $('#toast-message');
let toastTimer = 0;
function showToast(text: string) {
  if (!toast) return;
  toast.textContent = text;
  toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 2300);
}
async function copyText(text: string) {
  try {
    if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text);
    else {
      const input = document.createElement('textarea');
      input.value = text;
      input.setAttribute('readonly', '');
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.append(input);
      input.select();
      document.execCommand('copy');
      input.remove();
    }
    showToast(text.includes('@') ? 'Email address copied.' : 'Link copied.');
  } catch { showToast('Copy was unavailable. Please select the text instead.'); }
}
$$<HTMLButtonElement>('[data-copy]').forEach((button) => button.addEventListener('click', () => { if (button.dataset.copy) void copyText(button.dataset.copy); }));
ScrollTrigger.refresh();
updateReadingProgress();
