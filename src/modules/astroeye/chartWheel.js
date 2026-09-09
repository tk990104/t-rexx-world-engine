import { normalizeLongitude } from './calculation/zodiac.js';

export const ZODIAC_GLYPHS = Object.freeze(['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓']);
export const BODY_GLYPHS = Object.freeze({
  Sun: '☉', Moon: '☽', Mercury: '☿', Venus: '♀', Mars: '♂',
  Jupiter: '♃', Saturn: '♄', Uranus: '♅', Neptune: '♆', Pluto: '♇',
});

const SIZE = 400;
const CENTER = SIZE / 2;

function finite(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new TypeError(`${field} must be finite`);
  return number;
}

function point(longitude, radius, ascendant) {
  const angle = (180 - normalizeLongitude(longitude - ascendant)) * Math.PI / 180;
  return Object.freeze({
    x: Math.round((CENTER + Math.cos(angle) * radius) * 1000) / 1000,
    y: Math.round((CENTER + Math.sin(angle) * radius) * 1000) / 1000,
  });
}

function layoutBodyRadii(positions) {
  const sorted = positions
    .map((position, index) => ({ index, longitude: normalizeLongitude(position.longitude) }))
    .sort((left, right) => left.longitude - right.longitude);
  const radii = Array(positions.length).fill(130);
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index].longitude - sorted[index - 1].longitude < 6) {
      radii[sorted[index].index] = radii[sorted[index - 1].index] === 130 ? 143 : 130;
    }
  }
  if (sorted.length > 1 && 360 - sorted.at(-1).longitude + sorted[0].longitude < 6) {
    radii[sorted[0].index] = radii[sorted.at(-1).index] === 130 ? 143 : 130;
  }
  return radii;
}

/** Build a deterministic, renderer-independent chart-wheel geometry model. */
export function createChartWheelModel(chart) {
  const ascendant = finite(chart?.houses?.angles?.ascendant, 'chart ascendant');
  const midheaven = finite(chart?.houses?.angles?.midheaven, 'chart midheaven');
  if (!Array.isArray(chart?.houses?.cusps) || chart.houses.cusps.length !== 12) {
    throw new TypeError('Chart wheel requires twelve house cusps');
  }
  if (!Array.isArray(chart?.positions)) throw new TypeError('Chart wheel requires body positions');
  const radii = layoutBodyRadii(chart.positions);
  const bodies = chart.positions.map((position, index) => {
    const longitude = finite(position.longitude, `${position.body || 'body'} longitude`);
    const radius = radii[index];
    return Object.freeze({
      body: position.body,
      glyph: BODY_GLYPHS[position.body] ?? '•',
      longitude: normalizeLongitude(longitude),
      retrograde: position.retrograde === true,
      radius,
      point: point(longitude, radius, ascendant),
      aspectPoint: point(longitude, 104, ascendant),
    });
  });
  const bodyMap = new Map(bodies.map((body) => [body.body, body]));
  const aspects = (chart.aspects ?? []).flatMap((aspect) => {
    const left = bodyMap.get(aspect.left);
    const right = bodyMap.get(aspect.right);
    if (!left || !right) return [];
    return [Object.freeze({
      type: aspect.aspect,
      phase: aspect.phase,
      left: left.aspectPoint,
      right: right.aspectPoint,
    })];
  });
  return Object.freeze({
    size: SIZE,
    center: CENTER,
    ascendant,
    midheaven,
    zodiac: Object.freeze(ZODIAC_GLYPHS.map((glyph, index) => Object.freeze({
      index,
      glyph,
      boundary: point(index * 30, 184, ascendant),
      innerBoundary: point(index * 30, 156, ascendant),
      label: point(index * 30 + 15, 170, ascendant),
    }))),
    houses: Object.freeze(chart.houses.cusps.map((cusp, index) => Object.freeze({
      house: index + 1,
      longitude: normalizeLongitude(finite(cusp.longitude, `house ${index + 1} cusp`)),
      outer: point(cusp.longitude, 154, ascendant),
      inner: point(cusp.longitude, 44, ascendant),
      label: point(cusp.longitude + 15, 72, ascendant),
    }))),
    angles: Object.freeze({
      ascendant: Object.freeze({ inner: point(ascendant, 36, ascendant), outer: point(ascendant, 188, ascendant) }),
      midheaven: Object.freeze({ inner: point(midheaven, 36, ascendant), outer: point(midheaven, 188, ascendant) }),
    }),
    bodies: Object.freeze(bodies),
    aspects: Object.freeze(aspects),
  });
}

function element(name, attributes = {}, text = null) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  if (text != null) node.textContent = text;
  return node;
}

function line(group, from, to, className) {
  group.append(element('line', { x1: from.x, y1: from.y, x2: to.x, y2: to.y, class: className }));
}

/** Render an accessible SVG chart wheel without interpolating imported text into markup. */
export function renderAstroEyeChartWheel(container, chart) {
  if (!container?.replaceChildren) throw new TypeError('Chart wheel container must be a DOM element');
  const model = createChartWheelModel(chart);
  const svg = element('svg', {
    viewBox: `0 0 ${model.size} ${model.size}`,
    role: 'img',
    'aria-label': 'AstroEye zodiac wheel showing houses, planetary positions, and major aspects',
  });
  svg.append(element('circle', { cx: model.center, cy: model.center, r: 188, class: 'astro-wheel-ring astro-wheel-outer' }));
  svg.append(element('circle', { cx: model.center, cy: model.center, r: 156, class: 'astro-wheel-ring' }));
  svg.append(element('circle', { cx: model.center, cy: model.center, r: 104, class: 'astro-wheel-ring astro-wheel-inner' }));
  svg.append(element('circle', { cx: model.center, cy: model.center, r: 36, class: 'astro-wheel-ring astro-wheel-core' }));

  const aspects = element('g', { class: 'astro-wheel-aspects' });
  for (const aspect of model.aspects) line(aspects, aspect.left, aspect.right, `astro-wheel-aspect aspect-${aspect.type}`);
  svg.append(aspects);

  const zodiac = element('g', { class: 'astro-wheel-zodiac' });
  for (const sign of model.zodiac) {
    line(zodiac, sign.innerBoundary, sign.boundary, 'astro-wheel-sign-boundary');
    zodiac.append(element('text', { x: sign.label.x, y: sign.label.y, class: 'astro-wheel-sign' }, sign.glyph));
  }
  svg.append(zodiac);

  const houses = element('g', { class: 'astro-wheel-houses' });
  for (const house of model.houses) {
    line(houses, house.inner, house.outer, 'astro-wheel-house-line');
    houses.append(element('text', { x: house.label.x, y: house.label.y, class: 'astro-wheel-house' }, house.house));
  }
  svg.append(houses);

  line(svg, model.angles.ascendant.inner, model.angles.ascendant.outer, 'astro-wheel-angle astro-wheel-asc');
  line(svg, model.angles.midheaven.inner, model.angles.midheaven.outer, 'astro-wheel-angle astro-wheel-mc');

  const bodies = element('g', { class: 'astro-wheel-bodies' });
  for (const body of model.bodies) {
    const group = element('g', { class: `astro-wheel-body body-${String(body.body).toLowerCase()}` });
    group.append(element('circle', { cx: body.point.x, cy: body.point.y, r: 11 }));
    group.append(element('text', { x: body.point.x, y: body.point.y }, body.glyph));
    if (body.retrograde) group.append(element('text', { x: body.point.x + 9, y: body.point.y - 8, class: 'astro-wheel-retrograde' }, 'R'));
    bodies.append(group);
  }
  svg.append(bodies);
  svg.append(element('text', { x: 19, y: model.center - 7, class: 'astro-wheel-angle-label' }, 'ASC'));
  container.replaceChildren(svg);
  return model;
}
