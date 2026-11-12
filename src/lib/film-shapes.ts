// Point sets for the About film. Every shape has the same N points, so point i can travel
// from one shape to the next. All coordinates are world units centred on the origin.

export const SHAPES = { india: 0, network: 1, helix: 2, wave: 3, grid: 4, core: 5 } as const;

export type FilmData = {
  count: number;
  shapes: Float32Array[];        // [india, network, helix, wave, grid, core], xyz each
  rand: Float32Array;            // vec4 per point
  aux: Float32Array;             // vec4: network edge t (-1 = node), edge phase, lit order, city light
  hubs: [number, number][];      // bright cities, world xy
  focus: [number, number];       // the one dim village the film starts on
  kochi: [number, number];
  spine: (y: number) => number;  // India's north–south spine: x for a given y, for the camera to follow
  arcs: Float32Array;            // LineSegments positions
  arcAttr: Float32Array;         // vec3 per vertex: position along arc, arc order, arc seed
  comets: { start: Float32Array; end: Float32Array; meta: Float32Array }; // one travelling light per arc
};

// Equirectangular crop used to build /film/india-night.png (R = night light, G = inside India).
const MAP = { w: 480, h: 512, lon0: 68, lon1: 98, lat0: 6, lat1: 38 };
const SX = 1.875 / MAP.w, SY = 2 / MAP.h;
const toWorld = (px: number, py: number): [number, number] => [(px - MAP.w / 2) * SX, -(py - MAP.h / 2) * SY];
const lonLat = (lon: number, lat: number): [number, number] => toWorld((lon - MAP.lon0) / (MAP.lon1 - MAP.lon0) * MAP.w, (MAP.lat1 - lat) / (MAP.lat1 - MAP.lat0) * MAP.h);

function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(list: T[], r: () => number) {
  for (let k = list.length - 1; k > 0; k--) { const j = (r() * (k + 1)) | 0; [list[k], list[j]] = [list[j], list[k]]; }
  return list;
}

export async function loadMap(url: string) {
  const img = new Image();
  img.src = url;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = MAP.w; canvas.height = MAP.h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, MAP.w, MAP.h);
  return ctx.getImageData(0, 0, MAP.w, MAP.h).data;
}

export function buildFilm(map: Uint8ClampedArray, count: number): FilmData {
  const r = rng(7);
  const gauss = () => Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(2 * Math.PI * r());
  const shapes = Array.from({ length: 6 }, () => new Float32Array(count * 3));
  const rand = new Float32Array(count * 4);
  const aux = new Float32Array(count * 4);
  for (let i = 0; i < count * 4; i++) rand[i] = r();

  // ── India at night: more points where the lights are, a thin even scatter for villages.
  const inside: number[] = [], weight: number[] = [];
  let total = 0;
  for (let p = 0; p < MAP.w * MAP.h; p++) {
    if (map[p * 4 + 1] < 128) continue;
    const light = map[p * 4] / 255;
    total += .2 + 2.4 * Math.pow(light, .9);
    inside.push(p); weight.push(total);
  }
  const lightAt = (px: number, py: number) => map[(Math.min(MAP.h - 1, Math.max(0, py | 0)) * MAP.w + Math.min(MAP.w - 1, Math.max(0, px | 0))) * 4] / 255;

  // Hubs: the brightest, well-separated cities.
  const bright = inside.filter((p) => map[p * 4] > 205).sort((a, b) => map[b * 4] - map[a * 4]);
  const hubPx: [number, number][] = [];
  for (const p of bright) {
    const x = p % MAP.w, y = (p / MAP.w) | 0;
    if (hubPx.every(([hx, hy]) => (hx - x) ** 2 + (hy - y) ** 2 > 30 * 30)) hubPx.push([x, y]);
    if (hubPx.length >= 22) break;
  }
  const nearestHub = (x: number, y: number) => Math.min(...hubPx.map(([hx, hy]) => Math.hypot(hx - x, hy - y)));

  const india = shapes[0];
  const villagePx: [number, number, number][] = [];
  for (let i = 0; i < count; i++) {
    const target = r() * total;
    let lo = 0, hi = weight.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (weight[mid] < target) lo = mid + 1; else hi = mid; }
    const p = inside[lo];
    const x = p % MAP.w + r(), y = ((p / MAP.w) | 0) + r();
    const light = lightAt(x, y);
    const [wx, wy] = toWorld(x, y);
    india.set([wx, wy, (r() - .5) * .012 + light * .02], i * 3);
    // Lit order: care sweeps the country from north to south, with a slightly ragged front.
    const order = Math.min(1, Math.max(0, (.94 - wy) / 1.89)) * .95 + r() * .05;
    aux[i * 4 + 2] = order;
    aux[i * 4 + 3] = light;
    if (light < .08 && r() < .05) villagePx.push([x, y, order]);
  }

  // The film opens on one dim village in the hills east of Kochi, and Kochi answers it.
  const kochi = lonLat(76.27, 9.93);
  // Srinagar, Delhi, Bhopal, Hyderabad, Bengaluru, Thiruvananthapuram.
  const path = [[75.3, 34.1], [77.2, 28.6], [77.4, 23.3], [78.5, 17.4], [77.6, 12.9], [76.9, 8.5]].map(([lon, lat]) => lonLat(lon, lat));
  const spine = (y: number) => {
    if (y >= path[0][1]) return path[0][0];
    for (let k = 1; k < path.length; k++) if (y >= path[k][1]) { const [a, b] = [path[k - 1], path[k]]; return a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]); }
    return path[path.length - 1][0];
  };
  const want = lonLat(76.66, 11.08);
  let focusIndex = 0, best = Infinity;
  for (let i = 0; i < count; i++) {
    if (aux[i * 4 + 3] > .06) continue;
    const d = (india[i * 3] - want[0]) ** 2 + (india[i * 3 + 1] - want[1]) ** 2;
    if (d < best) { best = d; focusIndex = i; }
  }
  const focus: [number, number] = [india[focusIndex * 3], india[focusIndex * 3 + 1]];

  // ── Network: people and ideas, connected.
  const nodes: [number, number, number][] = [];
  for (let k = 0; k < 58; k++) {
    const u = r() * 2 - 1, a = r() * Math.PI * 2, rad = Math.cbrt(r());
    const s = Math.sqrt(1 - u * u);
    nodes.push([s * Math.cos(a) * rad * 1.0, u * rad * .72, s * Math.sin(a) * rad * .6]);
  }
  const edges: [number, number, number][] = [];
  nodes.forEach((n, a) => {
    nodes.map((m, b) => [b, (n[0] - m[0]) ** 2 + (n[1] - m[1]) ** 2 + (n[2] - m[2]) ** 2] as const)
      .filter(([b]) => b !== a).sort((x, y) => x[1] - y[1]).slice(0, 3)
      .forEach(([b]) => { if (!edges.some(([p, q]) => (p === a && q === b) || (p === b && q === a))) edges.push([a, b, r()]); });
  });
  const net = shapes[1];
  for (let i = 0; i < count; i++) {
    if (r() < .24) {
      const n = nodes[(r() * nodes.length) | 0];
      net.set([n[0] + gauss() * .028, n[1] + gauss() * .028, n[2] + gauss() * .028], i * 3);
      aux[i * 4] = -1;
    } else {
      const [a, b, phase] = edges[(r() * edges.length) | 0];
      const t = r(), A = nodes[a], B = nodes[b];
      net.set([A[0] + (B[0] - A[0]) * t + gauss() * .004, A[1] + (B[1] - A[1]) * t + gauss() * .004, A[2] + (B[2] - A[2]) * t + gauss() * .004], i * 3);
      aux[i * 4] = t; aux[i * 4 + 1] = phase;
    }
  }

  // ── Double helix along x, with rungs.
  const helix = shapes[2];
  const turns = 2.6, len = 1.55, radius = .3;
  for (let i = 0; i < count; i++) {
    const rung = r() < .3;
    const u = rung ? Math.round(r() * 44) / 44 : r();
    const angle = u * turns * Math.PI * 2;
    const x = (u - .5) * len;
    if (rung) {
      const s = r() * 2 - 1;
      helix.set([x + gauss() * .004, Math.cos(angle) * radius * s, Math.sin(angle) * radius * s], i * 3);
    } else {
      const strand = r() < .5 ? 0 : Math.PI;
      helix.set([x + gauss() * .006, Math.cos(angle + strand) * radius + gauss() * .01, Math.sin(angle + strand) * radius + gauss() * .01], i * 3);
    }
  }

  // ── A clinical signal: three heartbeats, sampled evenly along the trace.
  const ecg = (x: number) => {
    const ph = ((x + .9) / 1.8 * 3) % 1;
    const bump = (c: number, w: number, h: number) => h * Math.exp(-(((ph - c) / w) ** 2));
    return bump(.22, .035, .09) - bump(.39, .012, .1) + bump(.42, .014, .62) - bump(.45, .012, .18) + bump(.68, .06, .16);
  };
  const trace: [number, number][] = [];
  const lengths = [0];
  for (let k = 0; k <= 2400; k++) {
    const x = -.9 + k / 2400 * 1.8;
    trace.push([x, ecg(x) - .1]);
    if (k) lengths.push(lengths[k - 1] + Math.hypot(x - trace[k - 1][0], trace[k][1] - trace[k - 1][1]));
  }
  const wave = shapes[3];
  for (let i = 0; i < count; i++) {
    const target = r() * lengths[lengths.length - 1];
    let k = lengths.findIndex((l) => l >= target);
    if (k < 0) k = trace.length - 1;
    const layer = ((r() * 3) | 0) - 1;
    wave.set([trace[k][0] + gauss() * .003, trace[k][1] + gauss() * .006, layer * .12 + gauss() * .008], i * 3);
  }

  // ── An image: a coarse pixel grid; each pixel is a small cluster, its height the picture's brightness.
  const grid = shapes[4];
  const side = 46;
  const cells = shuffle(Array.from({ length: count }, (_, k) => k % (side * side)), r);
  const picture = (u: number, v: number) => {
    const d = Math.hypot(u + .08, v - .05);
    const blob = (x: number, y: number, s: number) => Math.exp(-((u - x) ** 2 + (v - y) ** 2) / s);
    return Math.min(1, .7 * Math.exp(-d * d * 4) + .5 * Math.exp(-(((d - .62) / .07) ** 2)) + .6 * blob(.42, -.3, .02) + .45 * blob(-.45, .4, .03));
  };
  for (let i = 0; i < count; i++) {
    const c = cells[i], gx = c % side, gy = (c / side) | 0;
    const u = gx / (side - 1) * 2 - 1, v = gy / (side - 1) * 2 - 1;
    const cell = 1.44 / side;
    const value = Math.round(picture(u, v) * 6) / 6;
    grid.set([u * .72 + (r() - .5) * cell * .45, v * .72 + (r() - .5) * cell * .45, value * .3], i * 3);
  }

  // ── A single bright core.
  const core = shapes[5];
  for (let i = 0; i < count; i++) {
    const u = r() * 2 - 1, a = r() * Math.PI * 2, rad = .2 * Math.pow(r(), 1.8);
    const s = Math.sqrt(1 - u * u);
    core.set([s * Math.cos(a) * rad, u * rad, s * Math.sin(a) * rad], i * 3);
  }

  // Make the focus village point 0, so the film can single it out.
  for (const shape of shapes) for (let c = 0; c < 3; c++) [shape[c], shape[focusIndex * 3 + c]] = [shape[focusIndex * 3 + c], shape[c]];
  for (const arr of [rand, aux]) for (let c = 0; c < 4; c++) [arr[c], arr[focusIndex * 4 + c]] = [arr[focusIndex * 4 + c], arr[c]];

  // ── Arcs from the cities out to dim villages; they arrive as each village lights.
  const SEG = 22;
  // Skip the few villages so far from any city that their arcs would loop across the screen.
  const picked = shuffle(villagePx.filter(([x, y]) => nearestHub(x, y) < 120), r).slice(0, 220);
  const arcs = new Float32Array(picked.length * SEG * 2 * 3);
  const arcAttr = new Float32Array(picked.length * SEG * 2 * 3);
  const comets = { start: new Float32Array(picked.length * 3), end: new Float32Array(picked.length * 2), meta: new Float32Array(picked.length * 2) };
  picked.forEach(([x, y, order], a) => {
    const seed = r();
    let hub = hubPx[0], hd = Infinity;
    for (const h of hubPx) { const d = Math.hypot(h[0] - x, h[1] - y); if (d < hd) { hd = d; hub = h; } }
    const [x0, y0] = toWorld(hub[0], hub[1]), [x1, y1] = toWorld(x, y);
    const lift = Math.min(.14, Math.hypot(x1 - x0, y1 - y0) * .35);
    const at = (s: number) => [x0 + (x1 - x0) * s, y0 + (y1 - y0) * s, Math.sin(Math.PI * s) * lift];
    for (let k = 0; k < SEG; k++) {
      const v = (a * SEG + k) * 2;
      arcs.set([...at(k / SEG), ...at((k + 1) / SEG)], v * 3);
      arcAttr.set([k / SEG, order, seed, (k + 1) / SEG, order, seed], v * 3);
    }
    comets.start.set([x0, y0, lift], a * 3);
    comets.end.set([x1, y1], a * 2);
    comets.meta.set([order, seed], a * 2);
  });

  return { count, shapes, rand, aux, hubs: hubPx.map(([x, y]) => toWorld(x, y)), focus, kochi, spine, arcs, arcAttr, comets };
}
