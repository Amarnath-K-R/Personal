import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, DoubleSide, LineSegments, Mesh, PerspectiveCamera, Points, Scene, ShaderMaterial, Vector2, Vector3, Vector4, WebGLRenderer } from 'three';
import { buildFilm, loadMap } from './film-shapes';

// The About film: one point cloud that becomes India at night, a network, a helix, a heartbeat,
// an image, a core, and India again, lit. `t` is the beat position (0 = first beat, 7 = after the last).
// The finale (0–1, from scroll): the lit map streams away and merges into seven comets that the reader follows
// down, swinging across the screen, into the Contact headline; then a warp wave runs out from it.

type Key = Record<string, number> & { t: number };

// Camera and light, keyed to beats. Values ease between neighbouring keys.
const KEYS: Key[] = [
  { t: 0, dist: .16, fx: 1, kx: 0, lift: -.42, shift: 0, tilt: 0, yaw: 0, reveal: .004, lines: 0, dim: 1, spark: 1, follow: 0 },
  { t: .6, dist: .3, fx: 1, kx: 0, lift: -.42, shift: 0, tilt: 0, yaw: 0, reveal: .008, lines: 0, dim: 1, spark: 1, follow: 0 },
  { t: .85, dist: .7, fx: .8, kx: 0, lift: -.2, shift: .1, tilt: 0, yaw: 0, reveal: .05, lines: 0, dim: 1, spark: .8, follow: 0 },
  { t: 1.3, dist: 3.25, fx: 0, kx: 0, lift: 0, shift: .3, tilt: 0, yaw: 0, reveal: 5, lines: .7, dim: 1, spark: .25, follow: 0 },
  { t: 1.7, dist: 3.05, fx: 0, kx: 0, lift: 0, shift: .32, tilt: .12, yaw: .06, reveal: 5, lines: 1, dim: 1, spark: .25, follow: 0 },
  { t: 2.15, dist: 3, fx: 0, kx: 0, lift: 0, shift: .32, tilt: .12, yaw: .06, reveal: 5, lines: 1, dim: 1, spark: .25, follow: 0 },
  { t: 2.6, dist: 2.75, fx: 0, kx: .18, lift: 0, shift: .3, tilt: .05, yaw: 0, reveal: 5, lines: .35, dim: 1, spark: 1, follow: 0 },
  { t: 3.0, dist: 2.8, fx: 0, kx: .1, lift: 0, shift: .3, tilt: .04, yaw: 0, reveal: 5, lines: .2, dim: 1, spark: .6, follow: 0 },
  // Voice: the light steps aside for the photograph, then returns as a network.
  { t: 3.12, dist: 2.9, fx: 0, kx: 0, lift: 0, shift: .3, tilt: 0, yaw: 0, reveal: 5, lines: 0, dim: 0, spark: 0, follow: 0 },
  { t: 3.55, dist: 3.1, fx: 0, kx: 0, lift: 0, shift: -.33, tilt: 0, yaw: 0, reveal: 5, lines: 0, dim: 0, spark: 0, follow: 0 },
  { t: 3.75, dist: 2.85, fx: 0, kx: 0, lift: 0, shift: -.33, tilt: 0, yaw: 0, reveal: 5, lines: 0, dim: 1, spark: 0, follow: 0 },
  { t: 3.95, dist: 2.75, fx: 0, kx: 0, lift: 0, shift: -.33, tilt: 0, yaw: 0, reveal: 5, lines: 0, dim: 1, spark: 0, follow: 0 },
  { t: 4.1, dist: 2.7, fx: 0, kx: 0, lift: 0, shift: .36, tilt: 0, yaw: 0, reveal: 5, lines: 0, dim: 1, spark: 0, follow: 0 },
  { t: 4.86, dist: 2.2, fx: 0, kx: 0, lift: 0, shift: .34, tilt: 0, yaw: 0, reveal: 5, lines: 0, dim: 1, spark: 0, follow: 0 },
  // Reach: the core goes quiet for the photograph, then reignites and bursts into India.
  { t: 4.98, dist: 2.4, fx: 0, kx: 0, lift: 0, shift: .34, tilt: 0, yaw: 0, reveal: 5, lines: 0, dim: 0, spark: 0, follow: 0 },
  { t: 5.2, dist: 2.0, fx: 0, kx: 0, lift: 0, shift: -.3, tilt: 0, yaw: 0, reveal: 5, lines: 0, dim: 0, spark: 0, follow: 0 },
  { t: 5.26, dist: 1.4, fx: 0, kx: 0, lift: 0, shift: -.3, tilt: 0, yaw: 0, reveal: 5, lines: 0, dim: 1, spark: 0, follow: 0 },
  { t: 5.42, dist: 3.1, fx: 0, kx: 0, lift: 0, shift: -.3, tilt: .06, yaw: 0, reveal: 5, lines: 0, dim: 1, spark: 0, follow: 0 },
  // …then dives in close and follows the light south, village by village, and pulls back at the tip.
  { t: 5.54, dist: .95, fx: 0, kx: 0, lift: 0, shift: -.27, tilt: .45, yaw: 0, reveal: 5, lines: 0, dim: 1, spark: 0, follow: 1 },
  { t: 5.9, dist: .95, fx: 0, kx: 0, lift: 0, shift: -.27, tilt: .45, yaw: 0, reveal: 5, lines: 0, dim: 1, spark: 0, follow: 1 },
  { t: 6.05, dist: 3.35, fx: 0, kx: 0, lift: -.45, shift: -.32, tilt: .12, yaw: 0, reveal: 5, lines: 0, dim: 1, spark: 0, follow: 0 },
  { t: 6.35, dist: 3.2, fx: 0, kx: 0, lift: -.52, shift: -.34, tilt: .78, yaw: -.06, reveal: 5, lines: 0, dim: .85, spark: 0, follow: 0 },
  { t: 7.0, dist: 3.2, fx: 0, kx: 0, lift: -.5, shift: -.3, tilt: .9, yaw: .06, reveal: 5, lines: 0, dim: .85, spark: 0, follow: 0 },
];

// Shape changes: [start t, end t, from, to, scatter]. 0 india, 1 network, 2 helix, 3 wave, 4 grid, 5 core.
const MORPHS: [number, number, number, number, number][] = [
  [3.14, 3.5, 0, 1, .35], [4.0, 4.14, 1, 2, .22], [4.28, 4.4, 2, 3, .18], [4.52, 4.64, 3, 4, .18], [4.76, 4.86, 4, 5, .12], [5.25, 5.42, 5, 0, 1.3],
];

const smooth = (x: number) => x * x * (3 - 2 * x);
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const range = (t: number, a: number, b: number) => clamp((t - a) / (b - a));

function keyAt(t: number) {
  let i = 0;
  while (i < KEYS.length - 2 && t > KEYS[i + 1].t) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  const m = smooth(range(t, a.t, b.t));
  const out: Record<string, number> = {};
  for (const k in a) out[k] = a[k] + (b[k] - a[k]) * m;
  return out;
}

function morphAt(t: number) {
  let shape = 0;
  for (const [a, b, from, to, scatter] of MORPHS) {
    if (t < a) return { from: shape, to: shape, m: 0, scatter };
    if (t <= b) return { from, to, m: range(t, a, b), scatter };
    shape = to;
  }
  return { from: shape, to: shape, m: 0, scatter: .2 };
}

// Finale: the comets, their paths and timing (shared by the points, the comet trails and heads).
const COMETS = 7;
const SWING = [.44, .4, .46, .42, .38, .45, .41]; // how far each comet swings across the screen (× width)
const TAIL = .12;       // trail length, as a share of the whole journey
const WAVE_SPEED = 900; // px/s, the same speed the starfield's warp uses

const finaleChunk = /* glsl */`
  uniform float uFly, uStrike, uStrikeU, uStrikeV, uWaveAt, uWaveV, uPx;
  uniform vec4 uInk;
  uniform vec4 uPath[${COMETS}];
  uniform vec2 uSway[${COMETS}];
  uniform vec2 uScroll, uView;
  vec2 toPx(vec4 c) { vec2 n = c.xy / c.w; return vec2((n.x + 1.) * .5 * uView.x, (1. - n.y) * .5 * uView.y); }
  vec4 toClip(vec2 p) { return vec4(p.x / uView.x * 2. - 1., 1. - p.y / uView.y * 2., 0., 1.); }

  // The warp front: the words' outline grown outward by d (a rounded rectangle that becomes rounder as it
  // spreads), the same shape the starfield warps along. Each point holds its own spot on it.
  vec2 front(float at, float d) {
    vec2 h = uInk.zw * .5;
    float q = 1.5708 * d, s = fract(at * 4.) * (h.x + q + h.y);
    vec2 p = s < h.x ? vec2(s, h.y + d)
      : s < h.x + q ? h + d * vec2(sin((s - h.x) / max(d, .001)), cos((s - h.x) / max(d, .001)))
      : vec2(h.x + d, h.y - (s - h.x - q));
    float k = floor(at * 4.);
    p *= vec2(k == 1. || k == 2. ? -1. : 1., k > 1.5 ? -1. : 1.);
    return uInk.xy + h + p;
  }

  // Comet i at v (0 on the map, 1 in the headline). The path lives on the page, so the reader follows it down
  // as they scroll; through the middle of the journey it swings in a full S from one side of the screen to the other.
  vec2 path(int i, float v) {
    vec4 p = uPath[i]; vec2 s = uSway[i];
    v = clamp(v, 0., 1.);
    float e = v * v * (3. - 2. * v);
    float across = uView.x * (.5 + s.y * sin(6.28318 * v + s.x));
    return vec2(mix(mix(p.x, p.z, e), across, sin(3.14159 * v)),
                mix(p.y, p.w, e) - uScroll.x * (1. - v) + uScroll.y);
  }

  // How far along the comets are: with the scroll, then (once Contact lands) on their own into the words.
  float flight() { return uStrike >= 0. ? uStrikeU + uStrike * uStrikeV : uFly; }

  // Where a map point is in the finale. It leaves the map, streams loosely along its comet's path and merges
  // into the comet on the way; at the impact a few of them ride out on the warp wave.
  // w blends from the map's look to the finale's. mode: 0 map, 2 stream, 3 wave.
  void finale(vec2 mapPx, vec4 r, float ci, out vec2 pos, out float a, out float sz, out float w, out float mode) {
    pos = mapPx; a = 1.; sz = -1.; w = 0.; mode = 0.;
    if (uFly <= 0. && uStrike < 0.) return;
    int i = int(ci + .5);
    float u = flight();
    float v = u - r.x * .12 * (1. - smoothstep(0., .45, u));
    if (v > 0.) {
      mode = 2.; w = smoothstep(0., .04, v);
      // Spirals in towards the path as it goes, until it is part of the comet.
      float m = smoothstep(0., .3, v), an = m * 2.5 * (mod(ci, 2.) < .5 ? 1. : -1.);
      pos = mix(mapPx, path(i, v) + mat2(cos(an), sin(an), -sin(an), cos(an)) * (mapPx - uPath[i].xy) * (1. - m), w);
      a = (.45 + r.w * .7) * (1. - m);
      sz = 1.1 + r.w * 1.5;
    }
    // Then the warp: a scatter of light rides out on the front, some ahead, some behind, fading as it goes.
    float tw = uStrike - uWaveAt;
    if (uStrike >= 0. && tw > 0.) {
      mode = 3.; w = 1.;
      float d = fract(r.z * 13.7) * 24. + uWaveV * tw * (.82 + r.z * .36);
      pos = front(r.y, max(0., d + (fract(r.w * 7.31) - .5) * (14. + d * .08)));
      a = smoothstep(0., .1, tw) * (1. - smoothstep(.5, 2.2, tw)) * (r.x < .09 ? .4 + r.w * r.w * r.w * 3.4 : 0.);
      sz = 1.2 + r.w * r.w * 2.6;
    }
  }
`;

const pointsVertex = finaleChunk + /* glsl */`
  attribute vec3 aNet; attribute vec3 aHelix; attribute vec3 aWave; attribute vec3 aGrid; attribute vec3 aCore;
  attribute vec4 aRand; attribute vec4 aAux; attribute float aComet;
  uniform float uFrom, uTo, uMorph, uScatter, uTime, uSize, uScale, uReveal, uLit, uRipple, uRippleAmp, uDim;
  uniform vec2 uFocus, uKochi;
  uniform vec3 uCool, uCyan, uWarm;
  varying vec3 vColor; varying float vAlpha;

  vec3 rotY(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z); }
  vec3 rotX(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(p.x, c * p.y - s * p.z, s * p.y + c * p.z); }

  vec3 shapePos(float k) {
    if (k < .5) return position;
    if (k < 1.5) return rotY(aNet, uTime * .12);
    if (k < 2.5) return rotY(rotX(aHelix, uTime * .55), .35);
    if (k < 3.5) return rotY(aWave, sin(uTime * .3) * .25);
    if (k < 4.5) return rotY(rotX(aGrid, -.35), sin(uTime * .25) * .35);
    return rotY(aCore, uTime * .4);
  }

  // Brightness and warmth of a point while it belongs to shape k.
  vec2 shapeLight(float k) {
    if (k < .5) {
      float lit = smoothstep(aAux.z, aAux.z + .025, uLit);
      float wave = exp(-pow((uLit - aAux.z) * 38., 2.)) * step(.001, uLit) * step(uLit, .999);
      return vec2(.16 + aAux.w * 1.5 + lit * .75 + wave * 1.6, aAux.w * (1. - lit));
    }
    if (k < 1.5) {
      float pulse = aAux.x < 0. ? .55 : exp(-pow((fract(uTime * .32 + aAux.y * 5.) - aAux.x) * 9., 2.)) * 1.2;
      return vec2(.3 + pulse, 0.);
    }
    if (k < 2.5) return vec2(.95, 0.);
    if (k < 3.5) return vec2(1.05, 0.);
    if (k < 4.5) return vec2(.3 + aGrid.z * 3.6, 0.);
    return vec2(1.1, 0.);
  }

  void main() {
    float d = aRand.x * .4;
    float m = smoothstep(d, d + .6, uMorph);
    vec3 p = mix(shapePos(uFrom), shapePos(uTo), m);
    p += (aRand.yzw - .5) * uScatter * sin(m * 3.14159);
    p += vec3(sin(uTime * .7 + aRand.y * 40.), cos(uTime * .6 + aRand.z * 40.), 0.) * .0025;

    vec2 light = mix(shapeLight(uFrom), shapeLight(uTo), m);
    bool onMap = uFrom < .5 && uTo < .5;
    float alpha = light.x;
    if (onMap) {
      alpha *= 1. - smoothstep(uReveal * .5, uReveal, distance(p.xy, uFocus));
      float ring = distance(p.xy, uKochi) - uRipple * 2.4;
      alpha += exp(-ring * ring * 90.) * uRippleAmp * .9;
    }
    alpha *= uDim;

    vec4 mv = modelViewMatrix * vec4(p, 1.);
    vec4 clip = projectionMatrix * mv;
    float size = min(uSize * uScale * (.65 + aRand.w * .7) * (.8 + light.x * .5) / -mv.z, 72.);
    vColor = mix(mix(uCool, uCyan, clamp(aRand.y * .55 + light.x * .35, 0., 1.)), uWarm, clamp(light.y * 1.2, 0., .85));

    vec2 fp; float fa, fs, fw, fm;
    finale(toPx(clip), aRand, aComet, fp, fa, fs, fw, fm);
    if (fm > .5) {
      clip = toClip(fp);
      alpha = mix(alpha, fa, fw);
      size = mix(size, fs * uPx, fw);
      vColor = mix(vColor, mix(uCyan, vec3(1.), .5), fw);
    }
    gl_Position = clip;
    gl_PointSize = size;
    vAlpha = clamp(alpha, 0., 3.5);
  }
`;

// The comets themselves, drawn like the starfield's shooting stars, only bigger: a trail that tapers and fades
// back along the path (a thin ribbon), and a bright head. They form as the points merge.
const trailVertex = finaleChunk + /* glsl */`
  attribute float aC, aS, aSide;
  varying float vAlpha, vSide, vS;
  void main() {
    int i = int(aC + .5);
    float u = flight(), v = u - aS * ${TAIL.toFixed(3)};
    vec2 P = path(i, v), T = path(i, v + .003) - P;
    T = length(T) > .001 ? normalize(T) : vec2(0., 1.);
    // Half-width tapers from the head; a pixel extra so the soft edge stays smooth.
    gl_Position = toClip(P + vec2(-T.y, T.x) * aSide * (mix(1.7, .3, aS) + .8));
    vAlpha = smoothstep(.08, .3, u) * (1. - smoothstep(1., 1.06, u)) * (aS < .28 ? mix(.95, .18, aS / .28) : .18 * (1. - aS) / .72);
    vSide = aSide; vS = aS;
  }
`;

const trailFragment = /* glsl */`
  uniform vec3 uCyan;
  varying float vAlpha, vSide, vS;
  void main() {
    float a = vAlpha * (1. - vSide * vSide);
    gl_FragColor = vec4(mix(uCyan, vec3(1.), smoothstep(.45, .95, 1. - vS)) * a, a);
  }
`;

const headVertex = finaleChunk + /* glsl */`
  attribute float aC;
  varying float vAlpha;
  void main() {
    int i = int(aC + .5);
    float u = flight();
    gl_Position = toClip(path(i, u));
    gl_PointSize = 24. * uPx;
    vAlpha = smoothstep(.08, .3, u) * step(u, 1.);
  }
`;

const headFragment = /* glsl */`
  uniform vec3 uCyan;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - .5) * 2.;
    float a = vAlpha * (exp(-d * d * 16.) + .3 * exp(-d * d * 4.)) * step(d, 1.);
    gl_FragColor = vec4(mix(uCyan, vec3(1.), .85) * a, a);
  }
`;

const pointsFragment = /* glsl */`
  varying vec3 vColor; varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - .5);
    float a = smoothstep(.5, 0., d);
    float k = a * a * vAlpha;
    gl_FragColor = vec4(vColor * k, k);
  }
`;

const arcVertex = /* glsl */`
  attribute vec3 aArc;
  uniform float uLines, uNet, uLit, uRise, uDim, uTime;
  varying float vAlpha;
  void main() {
    float s = aArc.x, order = aArc.y, seed = aArc.z;
    float body = .4 + .6 * sin(3.14159 * s);
    // Distance: lines from each village to its nearest city, with light crawling toward the city.
    float crawl = exp(-pow((fract(uTime * .16 + seed) - (1. - s)) * 7., 2.));
    float still = uLines * (.42 * body + crawl * .7);
    // Reach: a bright head travels out from the city; its trail lingers after the village lights.
    float head = smoothstep(order - .09, order, uLit);
    float travel = step(s, head) * (.32 + exp(-pow((head - s) * 12., 2.)) * 1.4) * (1. - smoothstep(order + .25, order + .6, uLit));
    // Afterwards the country stays connected, with care flowing out along every line.
    float flow = exp(-pow((fract(uTime * .12 + seed * 1.7) - s) * 7., 2.));
    float net = uNet * (.2 * body + flow * .55);
    vAlpha = (still + travel + net) * (1. - uRise) * uDim;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
  }
`;

const arcFragment = /* glsl */`
  uniform vec3 uCyan;
  varying float vAlpha;
  void main() { gl_FragColor = vec4(uCyan * vAlpha, vAlpha); }
`;

// One glowing light per arc: villages → city in "the distance", city → village as care reaches out,
// and a steady outward flow once every village is lit.
const cometVertex = /* glsl */`
  attribute vec2 aEnd; attribute vec2 aMeta;
  uniform float uLines, uNet, uLit, uRise, uDim, uTime, uScale;
  varying float vAlpha;
  void main() {
    float order = aMeta.x, seed = aMeta.y;
    float sD = 1. - fract(uTime * .16 + seed), aD = uLines * sin(3.14159 * sD) * 1.1;
    float head = smoothstep(order - .09, order, uLit), aR = head > 0. && head < 1. ? .5 + sin(3.14159 * head) * 1.2 : 0.;
    float sF = fract(uTime * .12 + seed * 1.7), aF = uNet * sin(3.14159 * sF) * .9;
    float s = aR > .01 ? head : (aD > aF ? sD : sF);
    vec3 p = vec3(mix(position.xy, aEnd, s), sin(3.14159 * s) * position.z);
    vAlpha = max(aR, max(aD, aF)) * (1. - uRise) * uDim;
    vec4 mv = modelViewMatrix * vec4(p, 1.);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = min(.055 * uScale / -mv.z, 48.);
  }
`;

// The ripple each principle sends out from Kochi.
const ringVertex = /* glsl */`
  uniform vec2 uCenter; uniform float uRadius, uAlpha, uScale, uDim;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(uCenter + position.xy * uRadius, 0., 1.);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = min(.026 * uScale / -mv.z, 24.);
    vAlpha = uAlpha * uDim;
  }
`;

const glowFragment = /* glsl */`
  uniform vec3 uCyan;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - .5);
    float core = smoothstep(.14, 0., d), halo = smoothstep(.5, 0., d);
    vec3 c = (vec3(1.) * core + uCyan * halo * halo) * vAlpha;
    gl_FragColor = vec4(c, max(core, halo * halo) * vAlpha);
  }
`;

const sparkVertex = /* glsl */`
  attribute float aSize; attribute float aAlpha;
  uniform float uScale;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = min(aSize * uScale / -mv.z, 140.);
    vAlpha = aAlpha;
  }
`;

const sparkFragment = /* glsl */`
  uniform vec3 uCyan;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - .5);
    float core = smoothstep(.12, 0., d), halo = smoothstep(.5, 0., d);
    float k = max(core, halo * halo * .8) * vAlpha;
    gl_FragColor = vec4((vec3(1.) * core + uCyan * halo * halo * .8) * vAlpha, k);
  }
`;

export async function createFilm(canvas: HTMLCanvasElement, options: { count: number; mapUrl: string; text?: HTMLElement | null; onTitle?: (on: boolean) => void; onStrike?: (on: boolean) => void; onWave?: (box: DOMRect, speed: number) => void }) {
  const map = await loadMap(options.mapUrl);
  const data = buildFilm(map, options.count);

  const renderer = new WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  const scene = new Scene();
  const camera = new PerspectiveCamera(35, 1, .01, 50);

  const css = getComputedStyle(document.documentElement);
  const colour = (name: string, fallback: string) => new Color(css.getPropertyValue(name).trim() || fallback);
  const shared = {
    uTime: { value: 0 }, uScale: { value: 900 }, uLit: { value: 0 }, uRise: { value: 0 }, uDim: { value: 1 },
    uCool: { value: new Color('#3d7bff') }, uCyan: { value: colour('--liquid-c', '#6fe8ff') }, uWarm: { value: new Color('#ffd79a') },
  };

  const fin = {
    uFly: { value: 0 }, uStrike: { value: -1 }, uStrikeU: { value: 0 }, uStrikeV: { value: .6 }, uWaveAt: { value: 0 }, uWaveV: { value: WAVE_SPEED },
    uPath: { value: Array.from({ length: COMETS }, () => new Vector4()) }, uSway: { value: Array.from({ length: COMETS }, () => new Vector2()) },
    uScroll: { value: new Vector2() },
    uPx: { value: 1 }, uInk: { value: new Vector4() }, uView: { value: new Vector2(1, 1) },
  };

  // Each comet gathers one slice of the map (equal slices around its middle); comets land left to right
  // in the headline in the order their slices sit across the map.
  const n = data.count, map0 = data.shapes[0];
  let mx = 0, my = 0;
  for (let i = 0; i < n; i++) { mx += map0[i * 3]; my += map0[i * 3 + 1]; }
  mx /= n; my /= n;
  const cometOf = new Float32Array(n), centres = Array.from({ length: COMETS }, () => new Vector3());
  Array.from({ length: n }, (_, i) => i)
    .sort((a, b) => Math.atan2(map0[a * 3 + 1] - my, map0[a * 3] - mx) - Math.atan2(map0[b * 3 + 1] - my, map0[b * 3] - mx))
    .forEach((p, k) => { const c = Math.floor(k * COMETS / n); cometOf[p] = c; centres[c].add(new Vector3(map0[p * 3], map0[p * 3 + 1], map0[p * 3 + 2])); });
  centres.forEach((c) => c.divideScalar(n / COMETS));
  const slot = new Array<number>(COMETS);
  centres.map((_, i) => i).sort((a, b) => centres[a].x - centres[b].x).forEach((c, k) => { slot[c] = k; });

  const geometry = new BufferGeometry();
  const names = ['position', 'aNet', 'aHelix', 'aWave', 'aGrid', 'aCore'];
  data.shapes.forEach((shape, k) => geometry.setAttribute(names[k], new BufferAttribute(shape, 3)));
  geometry.setAttribute('aRand', new BufferAttribute(data.rand, 4));
  geometry.setAttribute('aAux', new BufferAttribute(data.aux, 4));
  geometry.setAttribute('aComet', new BufferAttribute(cometOf, 1));
  const pointsMaterial = new ShaderMaterial({
    vertexShader: pointsVertex, fragmentShader: pointsFragment, transparent: true, premultipliedAlpha: true, depthWrite: false, depthTest: false, blending: AdditiveBlending,
    uniforms: {
      ...shared, uFrom: { value: 0 }, uTo: { value: 0 }, uMorph: { value: 0 }, uScatter: { value: .2 }, uSize: { value: .0085 },
      uReveal: { value: .02 }, uRipple: { value: 0 }, uRippleAmp: { value: 0 },
      uFocus: { value: data.focus }, uKochi: { value: data.kochi },
      ...fin,
    },
  });
  const points = new Points(geometry, pointsMaterial);
  points.frustumCulled = false;
  scene.add(points);

  // Comet trails (a ribbon of SEG pieces each) and heads.
  const SEG = 48, trailC: number[] = [], trailS: number[] = [], trailSide: number[] = [], trailIndex: number[] = [];
  for (let c = 0; c < COMETS; c++) for (let j = 0; j <= SEG; j++) {
    const base = trailC.length;
    for (const side of [-1, 1]) { trailC.push(c); trailS.push(j / SEG); trailSide.push(side); }
    if (j < SEG) trailIndex.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
  }
  const trailGeometry = new BufferGeometry();
  trailGeometry.setAttribute('position', new BufferAttribute(new Float32Array(trailC.length * 3), 3));
  trailGeometry.setAttribute('aC', new BufferAttribute(new Float32Array(trailC), 1));
  trailGeometry.setAttribute('aS', new BufferAttribute(new Float32Array(trailS), 1));
  trailGeometry.setAttribute('aSide', new BufferAttribute(new Float32Array(trailSide), 1));
  trailGeometry.setIndex(trailIndex);
  const additive = { transparent: true, premultipliedAlpha: true, depthWrite: false, depthTest: false, blending: AdditiveBlending, side: DoubleSide };
  const trailMaterial = new ShaderMaterial({ vertexShader: trailVertex, fragmentShader: trailFragment, ...additive, uniforms: { ...fin, uCyan: shared.uCyan } });
  const trails = new Mesh(trailGeometry, trailMaterial);
  const headGeometry = new BufferGeometry();
  headGeometry.setAttribute('position', new BufferAttribute(new Float32Array(COMETS * 3), 3));
  headGeometry.setAttribute('aC', new BufferAttribute(Float32Array.from({ length: COMETS }, (_, c) => c), 1));
  const headMaterial = new ShaderMaterial({ vertexShader: headVertex, fragmentShader: headFragment, ...additive, uniforms: { ...fin, uCyan: shared.uCyan } });
  const heads = new Points(headGeometry, headMaterial);
  for (const o of [trails, heads]) { o.frustumCulled = false; o.visible = false; scene.add(o); }
  // How each comet swings: its own phase and reach, in the order they land.
  slot.forEach((k, c) => fin.uSway.value[c].set((k - 3) * .2, SWING[k]));

  // Where the comets strike: the headline's words themselves (the heading's box spans the whole column).
  const text = options.text;
  const ink = document.createRange();
  if (text) ink.selectNodeContents(text);

  const arcGeometry = new BufferGeometry();
  arcGeometry.setAttribute('position', new BufferAttribute(data.arcs, 3));
  arcGeometry.setAttribute('aArc', new BufferAttribute(data.arcAttr, 3));
  const glow = { transparent: true, premultipliedAlpha: true, depthWrite: false, depthTest: false, blending: AdditiveBlending };
  const lineUniforms = { ...shared, uLines: { value: 0 }, uNet: { value: 0 } };
  const arcMaterial = new ShaderMaterial({ vertexShader: arcVertex, fragmentShader: arcFragment, ...glow, uniforms: lineUniforms });
  const arcs = new LineSegments(arcGeometry, arcMaterial);
  arcs.frustumCulled = false;
  scene.add(arcs);

  const cometGeometry = new BufferGeometry();
  cometGeometry.setAttribute('position', new BufferAttribute(data.comets.start, 3));
  cometGeometry.setAttribute('aEnd', new BufferAttribute(data.comets.end, 2));
  cometGeometry.setAttribute('aMeta', new BufferAttribute(data.comets.meta, 2));
  const cometMaterial = new ShaderMaterial({ vertexShader: cometVertex, fragmentShader: glowFragment, ...glow, uniforms: lineUniforms });
  const comets = new Points(cometGeometry, cometMaterial);
  comets.frustumCulled = false;
  scene.add(comets);

  const ringGeometry = new BufferGeometry();
  ringGeometry.setAttribute('position', new BufferAttribute(Float32Array.from({ length: 480 * 3 }, (_, i) => (i % 3 === 2 ? 0 : (i % 3 ? Math.sin : Math.cos)(((i / 3) | 0) / 480 * Math.PI * 2))), 3));
  const ringMaterial = new ShaderMaterial({ vertexShader: ringVertex, fragmentShader: glowFragment, ...glow, uniforms: { uCenter: { value: data.kochi }, uRadius: { value: 0 }, uAlpha: { value: 0 }, uScale: shared.uScale, uDim: shared.uDim, uCyan: shared.uCyan } });
  const ring = new Points(ringGeometry, ringMaterial);
  ring.frustumCulled = false;
  scene.add(ring);

  // Two sparks: the village the film starts on, and the light that travels to it from Kochi.
  const sparkGeometry = new BufferGeometry();
  const sparkPos = new Float32Array([data.focus[0], data.focus[1], .01, data.kochi[0], data.kochi[1], .01]);
  const sparkSize = new Float32Array([.03, .05]), sparkAlpha = new Float32Array([0, 0]);
  sparkGeometry.setAttribute('position', new BufferAttribute(sparkPos, 3));
  sparkGeometry.setAttribute('aSize', new BufferAttribute(sparkSize, 1));
  sparkGeometry.setAttribute('aAlpha', new BufferAttribute(sparkAlpha, 1));
  const sparkMaterial = new ShaderMaterial({ vertexShader: sparkVertex, fragmentShader: sparkFragment, transparent: true, premultipliedAlpha: true, depthWrite: false, depthTest: false, blending: AdditiveBlending, uniforms: { uScale: shared.uScale, uCyan: shared.uCyan } });
  const sparks = new Points(sparkGeometry, sparkMaterial);
  sparks.frustumCulled = false;
  scene.add(sparks);

  const target = new Vector3(), front = new Vector3(), point = new Vector3();
  let t = 0, goal = 0, last = 0, frame = 0, running = false;
  let finGoal = 0, finSpan = 0, fly = 0, titled = false, strikeAt = -1, waved = false;
  let width = 0, height = 0, left = 0, top = 0;
  let frames = 0, slow = 0, tiered = false;

  function resize() {
    const box = canvas.getBoundingClientRect();
    width = Math.max(1, box.width); height = Math.max(1, box.height); left = box.left; top = box.top;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    shared.uScale.value = height * renderer.getPixelRatio();
    fin.uPx.value = renderer.getPixelRatio();
    fin.uView.value.set(width, height);
  }

  function apply(time: number) {
    const k = keyAt(t);
    const mo = morphAt(t);
    const u = pointsMaterial.uniforms;
    shared.uTime.value = time;
    u.uFrom.value = mo.from; u.uTo.value = mo.to; u.uMorph.value = mo.m; u.uScatter.value = mo.scatter;
    u.uReveal.value = k.reveal;
    shared.uDim.value = k.dim;
    // Villages light faster and faster: the reach accelerates.
    shared.uLit.value = range(t, 5.54, 5.9);
    // Finale: the lines go as the map gathers; the comets and the wave track the headline wherever it is.
    shared.uRise.value = smooth(range(fly, 0, .06));
    fin.uFly.value = fly;
    fin.uStrike.value = strikeAt < 0 ? -1 : time - strikeAt;
    const finale = (fly > 0 || strikeAt >= 0) && !!text;
    trails.visible = heads.visible = finale;
    if (finale) {
      const w = ink.getBoundingClientRect();
      fin.uInk.value.set(w.left - left, w.top - top, w.width, w.height);
    }
    lineUniforms.uLines.value = k.lines;
    lineUniforms.uNet.value = smooth(range(t, 5.95, 6.15));
    // Principles: each one sends a ripple out from Kochi.
    const p = range(t, 6.15, 6.95) * 4;
    const amp = p > 0 && p < 4 ? Math.sin((p % 1) * Math.PI) : 0;
    u.uRipple.value = p % 1;
    u.uRippleAmp.value = amp;
    ringMaterial.uniforms.uRadius.value = (p % 1) * 2.4;
    ringMaterial.uniforms.uAlpha.value = amp * 1.2;

    // The opening spark flickers like a weak light; the travelling light leaves Kochi in the turn.
    const flicker = .75 + .25 * Math.sin(time * 3.1) * Math.sin(time * 1.7 + 1.3);
    const travel = smooth(range(t, 2.18, 2.66));
    sparkAlpha[0] = k.spark * flicker * (t > 2.6 ? 1.8 : 1);
    sparkSize[0] = t > 2.6 ? .08 : .032;
    sparkPos[3] = data.kochi[0] + (data.focus[0] - data.kochi[0]) * travel;
    sparkPos[4] = data.kochi[1] + (data.focus[1] - data.kochi[1]) * travel;
    sparkPos[5] = .01 + Math.sin(Math.PI * travel) * .12;
    sparkSize[1] = .1;
    sparkAlpha[1] = t > 2.1 && t < 2.72 ? Math.sin(Math.PI * range(t, 2.1, 2.72)) * 2 : 0;
    sparkGeometry.attributes.position.needsUpdate = true;
    sparkGeometry.attributes.aSize.needsUpdate = true;
    sparkGeometry.attributes.aAlpha.needsUpdate = true;

    // Camera: orbit a target that starts on the village and settles on the whole map (or Kochi).
    const kx = data.kochi[0] * k.kx, ky = data.kochi[1] * k.kx;
    target.set(data.focus[0] * k.fx + kx, data.focus[1] * k.fx + ky, 0);
    if (k.follow > 0) {
      const frontY = .8 - shared.uLit.value * 1.66;
      target.lerp(front.set(data.spine(frontY), frontY, 0), k.follow);
    }
    const drift = Math.sin(time * .07) * .03;
    camera.position.set(
      target.x + k.dist * Math.sin(k.yaw + drift) * Math.cos(k.tilt),
      target.y - k.dist * Math.sin(k.tilt),
      k.dist * Math.cos(k.yaw + drift) * Math.cos(k.tilt),
    );
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    camera.projectionMatrix.elements[8] = -k.shift;     // lens shift: the form sits beside the words
    camera.projectionMatrix.elements[9] = -k.lift;

    // Each comet runs from where its slice of the map gathers to its spot in the headline, measured where the
    // headline will be once Contact lands (it is still `scroll` px further down the page).
    if (finale) {
      camera.updateMatrixWorld();
      const w = fin.uInk.value, scroll = finSpan * (1 - finGoal);
      fin.uScroll.value.set(finSpan, scroll);
      centres.forEach((c, i) => {
        const p = point.copy(c).project(camera), k = slot[i];
        fin.uPath.value[i].set((p.x + 1) / 2 * width, (1 - p.y) / 2 * height, w.x + w.z * (k + .5) / COMETS, w.y + w.w * (k % 2 ? .68 : .32) - scroll);
      });
    }
  }

  function loop(now: number) {
    frame = requestAnimationFrame(loop);
    const dt = last ? Math.min(.1, (now - last) / 1000) : .016;
    last = now;
    t += (goal - t) * (1 - Math.exp(-dt * 4.5));
    // Finale beats, in seconds once triggered: the map falls as the principles leave; the strike and the
    // warp wave play once Contact arrives. Scrolling clearly back undoes them, so they can play again.
    fly += (finGoal - fly) * (1 - Math.exp(-dt * 5));
    if (Math.abs(finGoal - fly) < 1e-4) fly = finGoal;
    const sec = now / 1000;
    if (!titled && finGoal > .8) { titled = true; options.onTitle?.(true); }
    else if (titled && finGoal < .7) { titled = false; options.onTitle?.(false); }
    if (strikeAt < 0 && finGoal > .995) {
      // From wherever they are, the comets reach the words within .8s; the wave leaves the moment they hit.
      strikeAt = sec; waved = false;
      const from = fin.uStrikeU.value = fly, speed = fin.uStrikeV.value = Math.max(.6, (1 - from) / .8);
      fin.uWaveAt.value = (1 - from) / speed;
      options.onStrike?.(true);
    }
    else if (strikeAt >= 0 && finGoal < .97) { strikeAt = -1; options.onStrike?.(false); }
    if (strikeAt >= 0 && !waved && sec - strikeAt >= fin.uWaveAt.value && text) { waved = true; options.onWave?.(ink.getBoundingClientRect(), WAVE_SPEED); }
    apply(now / 1000);
    renderer.render(scene, camera);
    // One quality step down if the machine struggles: half the points.
    if (!tiered && ++frames > 30) {
      slow = dt > 1 / 45 ? slow + 1 : Math.max(0, slow - 1);
      if (slow > 40) { tiered = true; geometry.setDrawRange(0, Math.floor(n / 2)); pointsMaterial.uniforms.uSize.value *= 1.25; }
      if (frames > 400) tiered = true;
    }
  }

  resize();
  apply(0);
  renderer.render(scene, camera);

  return {
    // A long jump (the Contact pill, say) cuts rather than fast-forwarding the whole film on screen.
    setT(value: number, jump = false) { goal = value; if (jump || Math.abs(value - t) > 1.5) t = value; },
    setFinale(value: number, span: number) { finGoal = value; finSpan = span; },
    resize,
    start() { if (running) return; running = true; last = 0; frame = requestAnimationFrame(loop); },
    stop() { running = false; cancelAnimationFrame(frame); },
    dispose() {
      cancelAnimationFrame(frame);
      [geometry, trailGeometry, headGeometry, arcGeometry, cometGeometry, ringGeometry, sparkGeometry].forEach((g) => g.dispose());
      [pointsMaterial, trailMaterial, headMaterial, arcMaterial, cometMaterial, ringMaterial, sparkMaterial].forEach((m) => m.dispose());
      renderer.dispose();
    },
  };
}
