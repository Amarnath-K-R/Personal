// Hover only warps how things are drawn (the lens); the stars themselves never get pushed.
// Page background: stars, aurora ribbons, comets and a pointer "gravity lens", drawn on one fixed canvas.
// Colours follow the live palette (--orb-cool / --orb-hot), so the sky shifts with About, Research, Notes and Contact.
type Star = { x: number; y: number; vx: number; vy: number; radius: number; phase: number; twinkle: number; hot: boolean };
type Comet = { x: number; y: number; vx: number; vy: number; age: number; life: number; hot: boolean };
type RGB = [number, number, number];

const random = (min: number, max: number) => min + Math.random() * (max - min);

function parseColor(value: string, fallback: RGB): RGB {
  const v = value.trim();
  if (v.startsWith('#')) {
    let h = v.slice(1);
    if (h.length === 3) h = [...h].map((c) => c + c).join('');
    const n = Number.parseInt(h.slice(0, 6), 16);
    return Number.isFinite(n) ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : fallback;
  }
  const m = v.match(/[\d.]+/g);
  return m && m.length >= 3 ? [Number(m[0]), Number(m[1]), Number(m[2])] : fallback;
}
const rgba = (c: RGB, a: number) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;

export function initSky() {
  const canvas = document.querySelector<HTMLCanvasElement>('[data-sky-field]');
  const ctx = canvas?.getContext('2d', { alpha: true });
  if (!canvas || !ctx) return;

  const reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(pointer: fine)').matches;
  const root = document.documentElement;
  let reduced = reducedQuery.matches;
  let paused = false;
  let width = 1;
  let height = 1;
  let stars: Star[] = [];
  let comets: Comet[] = [];
  let nextComet = performance.now() + random(2800, 5200);
  let cool: RGB = [165, 217, 255];
  let hot: RGB = [31, 107, 255];
  const pointer = { x: 0, y: 0, active: false };
  // Cursor effects on their own canvas above the page: soft ripple rings.
  const fxCanvas = document.createElement('canvas');
  fxCanvas.setAttribute('aria-hidden', 'true');
  fxCanvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9000';
  document.body.appendChild(fxCanvas);
  const fx = fxCanvas.getContext('2d')!;
  let lastRipple = { x: -1e4, y: -1e4, t: 0 };
  let frame = 0;
  let timer = 0;
  let last = 0;

  function readColors() {
    const style = getComputedStyle(root);
    cool = parseColor(style.getPropertyValue('--orb-cool'), cool);
    hot = parseColor(style.getPropertyValue('--orb-hot'), hot);
  }

  // Ripples spread out from the cursor and bend how the sky is drawn as each wave passes (drawing only, never positions).
  // A shockwave is the same warp, far stronger, growing out from a box (the Contact headline's words) instead of a point.
  type Box = { x: number; y: number; w: number; h: number };
  type Ripple = { x: number; y: number; age: number; box?: Box; speed: number; width: number; amp: number; life: number };
  let ripples: Ripple[] = [];
  const RIPPLE_SPEED = 250; // px/s
  const RIPPLE_LIFE = 1.7; // s
  const RIPPLE_WIDTH = 46; // px
  const RIPPLE_AMP = 9; // px
  function lens(x: number, y: number) {
    if (reduced || ripples.length === 0) return { x, y, hidden: false };
    let ox = 0;
    let oy = 0;
    for (const r of ripples) {
      const dx = r.box ? x - Math.min(Math.max(x, r.box.x), r.box.x + r.box.w) : x - r.x;
      const dy = r.box ? y - Math.min(Math.max(y, r.box.y), r.box.y + r.box.h) : y - r.y;
      const d = Math.hypot(dx, dy);
      if (d < 0.01) continue;
      const u = (d - r.age * r.speed) / r.width;
      if (Math.abs(u) > 2.6) continue;
      const k = r.amp * (1 - r.age / r.life) * 2.3 * u * Math.exp(-u * u);
      ox += (dx / d) * k;
      oy += (dy / d) * k;
    }
    return { x: x + ox, y: y + oy, hidden: false };
  }

  function populate() {
    const count = Math.min(460, Math.max(175, Math.round((width * height) / 3300)));
    stars = Array.from({ length: count }, () => ({
      x: random(0, width), y: random(0, height), vx: random(-16, 16), vy: random(-11, 11),
      radius: random(0.7, 2.1), phase: random(0, Math.PI * 2), twinkle: random(0.26, 0.92), hot: Math.random() > 0.64,
    }));
  }

  function resize() {
    width = Math.max(1, window.innerWidth);
    height = Math.max(1, window.innerHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas!.width = Math.round(width * dpr);
    canvas!.height = Math.round(height * dpr);
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    fxCanvas.width = Math.round(width * dpr);
    fxCanvas.height = Math.round(height * dpr);
    fx.setTransform(dpr, 0, 0, dpr, 0, 0);
    auroraLayer.width = Math.round((width + MARGIN * 2) * SCALE);
    auroraLayer.height = Math.round((height + MARGIN * 2) * SCALE);
    populate();
    paint(0, 0);
  }

  // Aurora: soft curtains of light. Each curtain hangs thin vertical rays from a slowly swaying, wandering edge;
  // the rays brighten and fade on their own and shift through shades of the page's colour. Drawn small and stretched up by CSS, which keeps it soft and fast.
  const SCALE = 0.25;
  const MARGIN = 60; // the aurora canvas is a little larger than the screen so CSS blur never darkens the edges
  const auroraLayer = document.querySelector<HTMLCanvasElement>('[data-aurora-field]')!; // its own small canvas, stretched by CSS
  const actx = auroraLayer.getContext('2d')!;
  type Curtain = { dir: number; cx: number; fx: number; px: number; cy: number; fy: number; py: number; span: number; hgt: number; f1: number; f2: number; r1: number; r2: number; a1: number; a2: number; alpha: number; shade: number; shadeRate: number; pulse: number; pulsePhase: number; rayPhase: number; rayPhase2: number };
  const curtains: Curtain[] = Array.from({ length: 5 }, () => ({
    // Curtains hang down from the top edge only; the rest of the screen stays dark.
    dir: 1,
    cx: random(0.3, 0.7), fx: random(0.012, 0.03), px: random(0, 6.3), cy: random(0.0, 0.1), fy: random(0.01, 0.026), py: random(0, 6.3),
    span: random(1.5, 2.1), hgt: random(0.22, 0.4), f1: random(1.0, 2.2), f2: random(2.6, 4.5), r1: random(0.08, 0.2), r2: random(0.12, 0.3),
    a1: random(0.04, 0.1), a2: random(0.012, 0.035), alpha: random(0.2, 0.34), shade: random(0, 1), shadeRate: random(0.015, 0.04),
    pulse: random(0.04, 0.1), pulsePhase: random(0, 6.3), rayPhase: random(0, 6.3), rayPhase2: random(0, 6.3),
  }));
  const mixc = (a: RGB, b: RGB, f: number): RGB => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];

  function drawAurora(time: number) {
    if (document.body.dataset.scene === 'top') return; // no aurora on the first (About) page
    const t = reduced ? 0 : time / 1000;
    actx.setTransform(1, 0, 0, 1, 0, 0);
    actx.clearRect(0, 0, auroraLayer.width, auroraLayer.height);
    actx.setTransform(SCALE, 0, 0, SCALE, MARGIN * SCALE, MARGIN * SCALE);
    actx.globalCompositeOperation = 'lighter';
    actx.lineCap = 'butt';
    const shades: RGB[] = [mixc(cool, [255, 255, 255], 0.12), cool, mixc(cool, hot, 0.5), hot, mixc(hot, [0, 0, 40], 0.45)];
    const RAYS = 110;
    for (const c of curtains) {
      const life = 0.2 + 0.8 * (0.5 + 0.5 * Math.sin(t * c.pulse + c.pulsePhase)) ** 1.4;
      const centre = width * (0.5 + (c.cx - 0.5) * 0.6 + 0.3 * Math.sin(t * c.fx + c.px));
      const spanW = width * c.span;
      const baseY = height * (c.cy + 0.04 * Math.sin(t * c.fy + c.py));
      const stripW = (spanW / RAYS) * 3.4;
      for (let i = 0; i <= RAYS; i++) {
        const u = i / RAYS;
        const env = Math.sin(Math.PI * u) ** 0.9;
        const ray = Math.min(1, Math.max(0.07, 0.68 + 0.3 * Math.sin(i * 0.17 + t * 0.55 + c.rayPhase) * Math.sin(i * 0.071 - t * 0.38 + c.rayPhase2)));
        const x = centre - spanW / 2 + spanW * u;
        const y = baseY + (Math.sin(x / width * Math.PI * 2 * c.f1 + t * c.r1 + c.px) * c.a1 + Math.sin(x / width * Math.PI * 2 * c.f2 - t * c.r2 + c.py) * c.a2) * height;
        const rayH = height * c.hgt * (0.45 + 0.55 * ray) * (0.6 + 0.4 * env);
        const lean = Math.sin(t * 0.3 + i * 0.045 + c.px) * rayH * 0.14;
        const base = lens(x, y);
        const top = lens(x + lean, y - c.dir * rayH);
        const sh = (Math.sin((u * 1.3 + t * c.shadeRate + c.shade) * Math.PI * 2) + 1) / 2 * (shades.length - 1); // smooth loop: same colour at both ends
        const lo = Math.min(shades.length - 2, Math.floor(sh));
        const col = mixc(shades[lo], shades[lo + 1], sh - lo);
        const a = c.alpha * life * env * (0.35 + 0.65 * ray);
        const bx = base.x + (base.x - top.x) * 0.22;
        const by = base.y + (base.y - top.y) * 0.22;
        const g = actx.createLinearGradient(bx, by, top.x, top.y);
        g.addColorStop(0, rgba(col, 0));
        g.addColorStop(0.2, rgba(col, a * 0.75));
        g.addColorStop(0.5, rgba(col, a * 0.5));
        g.addColorStop(1, rgba(col, 0));
        actx.strokeStyle = g;
        actx.lineWidth = stripW;
        actx.beginPath();
        actx.moveTo(bx, by);
        actx.lineTo(top.x, top.y);
        actx.stroke();
      }
    }
  }

  function updateStars(seconds: number) {
    for (const s of stars) {
      s.phase += seconds * (0.35 + s.twinkle);
      s.x += (s.vx + Math.sin(performance.now() * 0.00035 + s.phase) * 7) * seconds;
      s.y += (s.vy + Math.cos(performance.now() * 0.0003 + s.phase * 1.3) * 5) * seconds;
      if (s.x < -4) s.x = width + 4;
      if (s.x > width + 4) s.x = -4;
      if (s.y < -4) s.y = height + 4;
      if (s.y > height + 4) s.y = -4;
    }
  }

  function drawStars(time: number) {
    for (const s of stars) {
      const p = lens(s.x, s.y);
      if (p.hidden) continue;
      const tw = reduced ? 0.52 : s.twinkle * (0.6 + (Math.sin(time * 0.0013 + s.phase) + 1) * 0.2);
      const tint = rgba(s.hot ? hot : cool, 1);
      ctx!.globalAlpha = tw;
      ctx!.fillStyle = tint;
      ctx!.beginPath();
      ctx!.arc(p.x, p.y, s.radius, 0, Math.PI * 2);
      ctx!.fill();
    }
    ctx!.globalAlpha = 1;
  }

  function drawComet(time: number, seconds: number) {
    if (reduced) return;
    if (comets.length < 4 && time >= nextComet) {
      const fromLeft = Math.random() > 0.5;
      const speed = random(520, 900);
      comets.push({ x: fromLeft ? random(-180, -40) : random(width + 40, width + 180), y: random(height * 0.05, height * 0.7), vx: fromLeft ? speed : -speed, vy: random(-160, 190), age: 0, life: random(1.5, 2.8), hot: Math.random() > 0.45 });
      nextComet = time + random(1600, 4200);
    }
    comets = comets.filter((c) => stepComet(c, seconds));
  }

  // Moves and draws one comet; returns false once it has left the screen or run out of life.
  function stepComet(comet: Comet, seconds: number): boolean {
    comet.age += seconds;
    comet.x += comet.vx * seconds;
    comet.y += comet.vy * seconds;
    if (comet.age > comet.life || comet.x < -250 || comet.x > width + 250 || comet.y > height + 100) return false;
    const tint = comet.hot ? hot : cool;
    const tx = comet.x - comet.vx * 0.17;
    const ty = comet.y - comet.vy * 0.17;
    const head = lens(comet.x, comet.y);
    const tail = lens(tx, ty);
    if (head.hidden || tail.hidden) return true;
    const g = ctx!.createLinearGradient(tail.x, tail.y, head.x, head.y);
    g.addColorStop(0, rgba(tint, 0));
    g.addColorStop(0.72, rgba(tint, 0.18));
    g.addColorStop(1, 'rgba(255,255,255,.95)');
    ctx!.strokeStyle = g;
    ctx!.lineWidth = 1.35;
    ctx!.beginPath();
    ctx!.moveTo(tail.x, tail.y);
    for (let i = 1; i <= 12; i++) {
      const t = i / 12;
      const p = lens(tx + (comet.x - tx) * t, ty + (comet.y - ty) * t);
      if (!p.hidden) ctx!.lineTo(p.x, p.y);
    }
    ctx!.stroke();
    ctx!.fillStyle = '#fff';
    ctx!.globalAlpha = 0.95;
    ctx!.beginPath();
    ctx!.arc(head.x, head.y, 1.6, 0, Math.PI * 2);
    ctx!.fill();
    ctx!.globalAlpha = 1;
    return true;
  }

  function spawnRipple(x: number, y: number) {
    const now = performance.now();
    if (now - lastRipple.t < 480 || Math.hypot(x - lastRipple.x, y - lastRipple.y) < 70) return;
    lastRipple = { x, y, t: now };
    ripples.push({ x, y, age: 0, speed: RIPPLE_SPEED, width: RIPPLE_WIDTH, amp: RIPPLE_AMP, life: RIPPLE_LIFE });
    const cursor = ripples.filter((r) => !r.box);
    if (cursor.length > 4) ripples.splice(ripples.indexOf(cursor[0]), 1);
  }

  function drawFx(seconds: number) {
    fx.clearRect(0, 0, width, height);
    ripples = ripples.filter((r) => (r.age += seconds) < r.life);
    if (reduced) return;
    fx.globalCompositeOperation = 'lighter';
    for (const r of ripples) {
      const k = 1 - r.age / r.life;
      if (r.box) {
        // Shockwave: the same soft crest, stronger, along the box grown outward (stacked strokes feather it).
        const d = r.age * r.speed, b = r.box;
        fx.strokeStyle = rgba(cool, 0.011 * k);
        for (let line = 150; line > 8; line *= 0.74) {
          fx.lineWidth = line;
          fx.beginPath();
          fx.roundRect(b.x - d, b.y - d, b.w + d * 2, b.h + d * 2, d);
          fx.stroke();
        }
        continue;
      }
      if (!finePointer) continue;
      // Cursor ripples: a faint soft ring on the wave front.
      const radius = r.age * r.speed;
      if (radius < 2) continue;
      // A wide, feathered band (no hard outline): transparent, a soft crest at the wave front, transparent.
      const band = 22 + (1 - k) * 26;
      const inner = Math.max(0, radius - band);
      const g = fx.createRadialGradient(r.x, r.y, inner, r.x, r.y, radius + band);
      const mid = (radius - inner) / (radius + band - inner);
      g.addColorStop(0, rgba(cool, 0));
      g.addColorStop(mid, rgba(cool, 0.05 * k));
      g.addColorStop(1, rgba(cool, 0));
      fx.fillStyle = g;
      fx.beginPath();
      fx.arc(r.x, r.y, radius + band, 0, Math.PI * 2);
      fx.fill();
    }
    fx.globalCompositeOperation = 'source-over';
  }

  function paint(time: number, delta: number) {
    ctx!.clearRect(0, 0, width, height);
    const seconds = reduced ? 0 : delta / 1000;
    drawAurora(reduced ? 0 : time);
    if (seconds > 0) updateStars(seconds);
    drawStars(time);
    drawComet(time, seconds);
    ctx!.globalAlpha = 1;
    ctx!.filter = 'none';
    ctx!.globalCompositeOperation = 'source-over';
  }

  let colorTick = 0;
  function loop(now: number) {
    frame = 0;
    if (document.hidden || paused) return;
    const delta = last ? Math.min(now - last, 40) : 16;
    last = now;
    if (colorTick++ % 6 === 0) readColors();
    paint(now, delta);
    drawFx(delta / 1000);
    frame = requestAnimationFrame(loop);
  }
  function start() {
    cancelAnimationFrame(frame);
    clearTimeout(timer);
    last = 0;
    if (paused || document.hidden) { ripples = []; fx.clearRect(0, 0, width, height); }
    if (reduced) {
      // A single composed frame; repainted slowly so the colours still follow the palette.
      readColors();
      paint(0, 0);
      timer = window.setTimeout(start, 600);
    } else if (!paused && !document.hidden) frame = requestAnimationFrame(loop);
  }

  if (finePointer) {
    window.addEventListener('pointermove', (e) => { pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = true; spawnRipple(e.clientX, e.clientY); }, { passive: true });
    document.documentElement.addEventListener('pointerleave', () => { pointer.active = false; });
  }
  window.addEventListener('portfolio:shockwave', (e) => {
    const box = (e as CustomEvent<Box & { speed?: number }>).detail;
    if (box) ripples.push({ x: 0, y: 0, age: 0, box, speed: box.speed ?? 900, width: 150, amp: 60, life: 2.6 });
  });
  window.addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', start);
  window.addEventListener('portfolio:motion', (e) => { paused = !!(e as CustomEvent<{ paused?: boolean }>).detail?.paused; start(); });
  reducedQuery.addEventListener('change', (e) => { reduced = e.matches; pointer.active = false; comets = []; ripples = []; start(); });
  readColors();
  resize();
  start();
}
