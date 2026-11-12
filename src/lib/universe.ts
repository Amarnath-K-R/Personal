type Point = { x: number; y: number; z: number };
type SpringState = { value: number; velocity: number };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function dampSpring(current: number, velocity: number, target: number, delta: number, smoothTime: number, min: number, max: number): SpringState {
  const safeTime = Math.max(.01, smoothTime);
  const omega = 2 / safeTime;
  const step = omega * delta;
  const decay = 1 / (1 + step + .48 * step * step + .235 * step * step * step);
  const change = current - target;
  const temp = (velocity + omega * change) * delta;
  let nextVelocity = (velocity - omega * temp) * decay;
  const nextValue = target + (change + temp) * decay;
  const boundedValue = clamp(nextValue, min, max);
  if (boundedValue !== nextValue) nextVelocity = 0;
  return { value: boundedValue, velocity: nextVelocity };
}

export function initUniverse() {
  const shell = document.querySelector<HTMLElement>('[data-universe]');
  const stage = shell?.querySelector<HTMLElement>('[data-universe-stage]');
  const canvas = shell?.querySelector<HTMLCanvasElement>('[data-universe-canvas]');
  if (!shell || !stage || !canvas) return;
  const context = canvas.getContext('2d');
  const nodes = [...shell.querySelectorAll<HTMLAnchorElement>('[data-universe-node]')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const small = matchMedia('(max-width: 700px)');
  const fine = matchMedia('(pointer: fine)');
  let width = 1;
  let height = 1;
  let yaw = 0;
  let pitch = 0;
  let targetYaw = 0;
  let targetPitch = 0;
  let yawVelocity = 0;
  let pitchVelocity = 0;
  let inertiaYaw = 0;
  let inertiaPitch = 0;
  let hoverX = 0;
  let hoverY = 0;
  let visible = false;
  let paused = document.body.classList.contains('liquid-paused');
  let overlay = false;
  let frame = 0;
  let last = 0;
  let time = 0;
  let lastPaint = 0;
  let dragging = false;
  let pointer: { x: number; y: number; yaw: number; pitch: number; lastX: number; lastY: number; lastTime: number; velocityYaw: number; velocityPitch: number } | null = null;
  const projected = new Map<HTMLAnchorElement, Point>();
  // A big particle planet; every project is a dot on one of three tilted rings around it. Hovering a dot slows the system so it is easy to click.
  const ORBITS = [{ rx: .27, ry: .31, phi: -.12, speed: .09 }, { rx: .36, ry: .39, phi: .1, speed: -.065 }, { rx: .45, ry: .46, phi: -.06, speed: .045 }];
  let orbitTime = 0;
  let orbitScale = 1;
  let spin = 0;
  let planetCool = '#d48cff';
  let planetHot = '#9a3dff';
  let colourFrame = 0;
  const particles = Array.from({ length: 150 }, (_, index) => ({
    angle: index * 2.39996323,
    radius: .12 + ((index * 37) % 100) / 100 * .42,
    depth: Math.sin(index * 7.31),
    size: index % 9 === 0 ? 1.7 : .8,
  }));
  const planet = Array.from({ length: 1150 }, (_, index) => {
    const y = 1 - (2 * index) / 1149;
    const ring = Math.sqrt(1 - y * y);
    const a = index * 2.39996323;
    return { x: Math.cos(a) * ring, y, z: Math.sin(a) * ring, size: index % 9 === 0 ? 2.1 : 1.2 };
  });
  const dust = ORBITS.map((_, k) => Array.from({ length: 230 }, (_, j) => ({ a: (j / 230) * Math.PI * 2 + ((j * 37 + k * 11) % 10) * .01, r: 1 + (((j * 53 + k * 7) % 100) / 100 - .5) * .09, size: j % 7 === 0 ? 2 : 1.2 })));
  const planetRadius = () => Math.min(width * .17, height * .36);
  function orbitXYZ(k: number, a: number, rScale = 1) {
    const o = ORBITS[k];
    const px = Math.cos(a) * o.rx * width * rScale;
    const py = Math.sin(a) * o.ry * height * rScale;
    const pz = Math.sin(a) * planetRadius() * 2.2;
    const c = Math.cos(o.phi);
    const sn = Math.sin(o.phi);
    return { x: px * c - py * sn, y: px * sn + py * c, z: pz };
  }
  function orbitPoint(index: number): Point {
    const k = index % 3;
    return orbitXYZ(k, Math.floor(index / 3) * (Math.PI * 2 / 3) + k * .9 + orbitTime * ORBITS[k].speed);
  }
  function readColours() {
    const style = getComputedStyle(document.documentElement);
    planetCool = style.getPropertyValue('--orb-cool').trim() || planetCool;
    planetHot = style.getPropertyValue('--orb-hot').trim() || planetHot;
  }
  function drawDust(ctx: CanvasRenderingContext2D, cx: number, cy: number, front: boolean) {
    ctx.fillStyle = planetCool;
    dust.forEach((ring, k) => {
      for (const d of ring) {
        const q = orbitXYZ(k, d.a + orbitTime * ORBITS[k].speed, d.r);
        if ((q.z >= 0) !== front) continue;
        ctx.globalAlpha = front ? .75 : .35;
        ctx.beginPath();
        ctx.arc(cx + q.x, cy + q.y, d.size, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }
  function drawPlanet(ctx: CanvasRenderingContext2D) {
    const cx = width * .5;
    const cy = height * .5;
    const R = planetRadius();
    const glow = ctx.createRadialGradient(cx, cy, R * .3, cx, cy, R * 2.3);
    glow.addColorStop(0, planetHot);
    glow.addColorStop(1, 'transparent');
    ctx.globalAlpha = .16;
    ctx.fillStyle = glow;
    ctx.fillRect(cx - R * 2.3, cy - R * 2.3, R * 4.6, R * 4.6);
    drawDust(ctx, cx, cy, false);
    const cs = Math.cos(spin), sn = Math.sin(spin), tilt = .42, ct = Math.cos(tilt), st = Math.sin(tilt);
    const dots = planet.map((d) => {
      const x = d.x * cs - d.z * sn;
      const z0 = d.x * sn + d.z * cs;
      return { x, y: d.y * ct - z0 * st, z: d.y * st + z0 * ct, d };
    }).sort((a, b) => a.z - b.z);
    for (const { x, y, z, d } of dots) {
      const front = (z + 1) / 2;
      ctx.globalAlpha = clamp(.1 + front * .9, 0, 1);
      ctx.fillStyle = front > .55 ? planetCool : planetHot;
      ctx.beginPath();
      ctx.arc(cx + x * R, cy + y * R, d.size * (.6 + front * .8), 0, Math.PI * 2);
      ctx.fill();
    }
    drawDust(ctx, cx, cy, true);
    ctx.globalAlpha = 1;
  }
  function notifyLayout() { window.dispatchEvent(new CustomEvent('portfolio:layout')); }
  function measure() {
    const rect = stage!.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    const instructions = shell!.querySelector('.universe-instructions');
    if (instructions) instructions.textContent = 'Select a project to explore its methods and evidence.';
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas!.width = Math.max(1, Math.round(width * ratio));
    canvas!.height = Math.max(1, Math.round(height * ratio));
    context?.setTransform(ratio, 0, 0, ratio, 0, 0);
    render();
  }
  function project(point: Point): Point {
    const x = point.x * Math.cos(yaw) + point.z * Math.sin(yaw);
    const z = -point.x * Math.sin(yaw) + point.z * Math.cos(yaw);
    const y = point.y * Math.cos(pitch) - z * Math.sin(pitch);
    const depth = point.y * Math.sin(pitch) + z * Math.cos(pitch);
    const scale = clamp(1000 / (1000 - depth), .86, 1.18);
    return { x: x * scale, y: y * scale, z: scale };
  }
  function render() {
    if (shell!.dataset.view === 'list') return;
    const motion = !reduced.matches && !paused && !small.matches;
    nodes.forEach((node, index) => {
      if (node.hidden) return;
      if (small.matches) {
        const p = project({ x: (index % 2 ? .22 : -.22) * width, y: (-.4 + index * .1) * height, z: 0 });
        projected.set(node, p);
        node.style.transform = `translate3d(calc(-50% + ${p.x.toFixed(2)}px),calc(-50% + ${p.y.toFixed(2)}px),0) scale(${p.z.toFixed(3)})`;
        node.style.zIndex = String(Math.round(p.z * 100));
        return;
      }
      const o = orbitPoint(index);
      const depth = clamp(o.z / (planetRadius() * 2.2), -1, 1);
      const front = (depth + 1) / 2;
      const scale = .8 + front * .38;
      projected.set(node, { x: o.x, y: o.y, z: scale });
      node.style.transform = `translate3d(calc(-50% + ${o.x.toFixed(2)}px),calc(-50% + ${o.y.toFixed(2)}px),0) scale(${scale.toFixed(3)})`;
      node.style.zIndex = depth >= 0 ? String(3 + Math.round(depth * 10)) : '0';
      node.style.opacity = String((.5 + front * .5).toFixed(2));
    });
    if (!context || (motion && performance.now() - lastPaint < 32)) return;
    lastPaint = performance.now();
    context.clearRect(0, 0, width, height);
    for (const star of particles) {
      const angle = star.angle + (motion ? time * .012 : 0);
      const p = project({ x: Math.cos(angle) * star.radius * width, y: Math.sin(angle) * star.radius * height * .75, z: star.depth * 130 });
      const alpha = .13 + .18 * (star.depth + 1);
      context.beginPath();
      context.fillStyle = `rgba(174,202,255,${alpha})`;
      context.arc(width * .5 + p.x, height * .5 + p.y, star.size * p.z, 0, Math.PI * 2);
      context.fill();
    }
    if (!small.matches) {
      if (++colourFrame % 20 === 1) readColours();
      drawPlanet(context);
    }
    stage!.style.setProperty('--camera-yaw', `${yaw * 45}deg`);
    stage!.style.setProperty('--camera-pitch', `${pitch * 45}deg`);
  }
  function cameraCanAnimate() {
    return !reduced.matches && !paused && !small.matches;
  }
  function advanceInertia(delta: number) {
    if (Math.abs(inertiaYaw) < .0005 && Math.abs(inertiaPitch) < .0005) {
      inertiaYaw = 0;
      inertiaPitch = 0;
      return;
    }
    const nextYaw = targetYaw + inertiaYaw * delta;
    const nextPitch = targetPitch + inertiaPitch * delta;
    targetYaw = clamp(nextYaw, -.2, .2);
    targetPitch = clamp(nextPitch, -.14, .14);
    if (targetYaw !== nextYaw) inertiaYaw = 0;
    if (targetPitch !== nextPitch) inertiaPitch = 0;
    const decay = Math.exp(-delta * 7.5);
    inertiaYaw *= decay;
    inertiaPitch *= decay;
  }
  function tick(now: number) {
    frame = 0;
    const delta = Math.min((now - last) / 1000 || .016, .04);
    last = now;
    time += delta;
    const engaged = nodes.some((node) => node.matches(':hover, :focus-visible')) || dragging;
    orbitScale += ((engaged ? .1 : 1) - orbitScale) * (1 - Math.exp(-delta * 4));
    orbitTime += delta * orbitScale;
    spin += delta * .35;
    advanceInertia(delta);
    const yawSpring = dampSpring(yaw, yawVelocity, clamp(targetYaw + hoverX, -.2, .2), delta, .24, -.2, .2);
    const pitchSpring = dampSpring(pitch, pitchVelocity, clamp(targetPitch + hoverY, -.14, .14), delta, .24, -.14, .14);
    yaw = yawSpring.value;
    yawVelocity = yawSpring.velocity;
    pitch = pitchSpring.value;
    pitchVelocity = pitchSpring.velocity;
    render();
    run();
  }
  function run() {
    if (frame) return;
    if (visible && !paused && !reduced.matches && !small.matches && !overlay && !document.hidden && shell!.dataset.view === 'spatial') frame = requestAnimationFrame(tick);
    else render();
  }
  function resetCamera() {
    targetYaw = 0;
    targetPitch = 0;
    inertiaYaw = 0;
    inertiaPitch = 0;
    hoverX = 0;
    hoverY = 0;
    if (!cameraCanAnimate()) {
      yaw = 0;
      pitch = 0;
      yawVelocity = 0;
      pitchVelocity = 0;
      render();
    }
    run();
  }
  function inspect(node: HTMLAnchorElement) {
    nodes.forEach((item) => item.classList.toggle('node-selected', item === node));
    const title = shell!.querySelector('[data-inspector-title]');
    const question = shell!.querySelector('[data-inspector-question]');
    const meta = shell!.querySelector('[data-inspector-meta]');
    if (title) title.textContent = node.dataset.title || '';
    if (question) question.textContent = node.dataset.question || '';
    if (meta) meta.textContent = node.dataset.meta || '';
  }
  nodes.forEach((node) => {
    node.addEventListener('pointerenter', () => inspect(node));
    node.addEventListener('focus', () => inspect(node));
    node.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault();
      const source = node.getBoundingClientRect();
      const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key]!;
      const candidates = nodes.filter((candidate) => candidate !== node && !candidate.hidden).map((candidate) => {
        const rect = candidate.getBoundingClientRect();
        const dx = rect.left + rect.width * .5 - source.left - source.width * .5;
        const dy = rect.top + rect.height * .5 - source.top - source.height * .5;
        const forward = dx * direction[0] + dy * direction[1];
        const perpendicular = Math.abs(dx * direction[1] - dy * direction[0]);
        return { candidate, forward, score: forward + perpendicular * 1.6 };
      }).filter((candidate) => candidate.forward > 5).sort((a, b) => a.score - b.score);
      candidates[0]?.candidate.focus({ preventScroll: true });
    });
  });
  const filters = [...shell.querySelectorAll<HTMLButtonElement>('[data-universe-filter]')];
  filters.forEach((button) => button.addEventListener('click', () => {
    const key = button.dataset.universeFilter;
    const focusedBefore = nodes.find((node) => node === document.activeElement);
    nodes.forEach((node) => { node.hidden = key !== 'all' && node.dataset.area !== key; });
    filters.forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
    if (focusedBefore?.hidden) button.focus({ preventScroll: true });
    if (nodes.some((node) => node.hidden && node.classList.contains('node-selected'))) {
      const first = nodes.find((node) => !node.hidden);
      if (first) inspect(first);
    }
    const count = nodes.filter((node) => !node.hidden).length;
    const label = shell!.querySelector('[data-universe-count]');
    if (label) label.textContent = `${String(count).padStart(2, '0')} / 09`;
    render();
    requestAnimationFrame(() => { measure(); notifyLayout(); });
  }));
  const views = [...shell.querySelectorAll<HTMLButtonElement>('[data-universe-view]')];
  views.forEach((button) => button.addEventListener('click', () => {
    shell!.dataset.view = button.dataset.universeView;
    views.forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
    if (shell!.dataset.view === 'list') nodes.forEach((node) => node.style.removeProperty('transform'));
    requestAnimationFrame(() => { measure(); notifyLayout(); run(); });
  }));
  shell.querySelectorAll<HTMLButtonElement>('[data-universe-camera]').forEach((button) => button.addEventListener('click', () => {
    if (button.dataset.universeCamera === 'reset') resetCamera();
    else {
      inertiaYaw = 0;
      inertiaPitch = 0;
      targetYaw = clamp(targetYaw + (button.dataset.universeCamera === 'left' ? -.09 : .09), -.2, .2);
      if (!cameraCanAnimate()) {
        yaw = targetYaw;
        pitch = targetPitch;
        yawVelocity = 0;
        pitchVelocity = 0;
        render();
      }
      run();
    }
  }));
  stage.addEventListener('pointerdown', (event) => {
    if (paused || reduced.matches || !fine.matches || small.matches || (event.target as Element).closest('a,button')) return;
    dragging = true;
    inertiaYaw = 0;
    inertiaPitch = 0;
    pointer = { x: event.clientX, y: event.clientY, yaw: targetYaw, pitch: targetPitch, lastX: event.clientX, lastY: event.clientY, lastTime: performance.now(), velocityYaw: 0, velocityPitch: 0 };
    stage!.setPointerCapture(event.pointerId);
    stage!.classList.add('is-dragging');
  });
  stage.addEventListener('pointermove', (event) => {
    if (reduced.matches || !fine.matches || small.matches || paused) return;
    if (dragging && pointer) {
      targetYaw = clamp(pointer.yaw + (event.clientX - pointer.x) * .001, -.2, .2);
      targetPitch = clamp(pointer.pitch - (event.clientY - pointer.y) * .0008, -.14, .14);
      const now = performance.now();
      const elapsed = Math.max((now - pointer.lastTime) / 1000, 1 / 240);
      const blend = 1 - Math.exp(-elapsed * 16);
      const velocityYaw = (event.clientX - pointer.lastX) * .001 / elapsed;
      const velocityPitch = (event.clientY - pointer.lastY) * -.0008 / elapsed;
      pointer.velocityYaw += (velocityYaw - pointer.velocityYaw) * blend;
      pointer.velocityPitch += (velocityPitch - pointer.velocityPitch) * blend;
      pointer.lastX = event.clientX;
      pointer.lastY = event.clientY;
      pointer.lastTime = now;
      run();
    } else {
      const bounds = stage!.getBoundingClientRect();
      hoverX = ((event.clientX - bounds.left) / bounds.width - .5) * .035;
      hoverY = ((event.clientY - bounds.top) / bounds.height - .5) * -.025;
      run();
    }
  }, { passive: true });
  function endDrag(withInertia = true) {
    if (withInertia && dragging && pointer) {
      inertiaYaw = clamp(pointer.velocityYaw * .14, -.09, .09);
      inertiaPitch = clamp(pointer.velocityPitch * .14, -.07, .07);
    }
    dragging = false;
    pointer = null;
    stage!.classList.remove('is-dragging');
    run();
  }
  stage.addEventListener('pointerup', () => endDrag());
  stage.addEventListener('pointercancel', () => endDrag(false));
  stage.addEventListener('lostpointercapture', () => endDrag(false));
  stage.addEventListener('pointerleave', () => { hoverX = 0; hoverY = 0; });
  new IntersectionObserver((entries) => { visible = entries[0].isIntersecting; last = performance.now(); run(); }, { rootMargin: '140px' }).observe(stage);
  new ResizeObserver(measure).observe(stage);
  window.addEventListener('portfolio:scene', () => { measure(); run(); });
  window.addEventListener('portfolio:layout', () => { measure(); run(); });
  window.addEventListener('portfolio:motion', (event) => { paused = !!(event as CustomEvent<{ paused: boolean }>).detail.paused; run(); });
  window.addEventListener('portfolio:project', (event) => { overlay = !(event as CustomEvent<{ closing?: boolean }>).detail.closing; run(); });
  document.addEventListener('visibilitychange', run);
  reduced.addEventListener('change', () => { resetCamera(); measure(); run(); });
  small.addEventListener('change', () => { resetCamera(); measure(); });
  measure();
}
