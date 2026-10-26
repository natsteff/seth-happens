export const ROUTE_OFFSET = 200;
export const LEVEL_WIDTH = 7530 + ROUTE_OFFSET; // Exactly 3 × the original 2510-unit route.
export const GROUND_Y = 2700;
export const FLOOR_RISE = 76;
export const ROAD = { floor:-1, x:0, y:GROUND_Y+FLOOR_RISE, width:LEVEL_WIDTH };
export const floors = Array.from({ length: 27 }, (_, floor) => ({
  floor, x: ROUTE_OFFSET + floor * 280, y: GROUND_Y - floor * FLOOR_RISE,
  width: floor === 26 ? 250 : 240,
}));
export const photoStops = [
  { floor: 6, x: ROUTE_OFFSET + 1790, y: floors[6].y - 30, title: 'LOON ZONE', caption: 'Caught the ball. With a camera. Much safer.', short: 'Soccer' },
  { floor: 17, x: ROUTE_OFFSET + 4870, y: floors[17].y - 30, title: 'ROOFTOP ENCORE', caption: 'ISO 6400. Dignity 0. Still got the shot.', short: 'Concert' },
];
export const beerSpot = { floor: 12, x: ROUTE_OFFSET + 3475, y: floors[12].y - 28 };
export function missing(beer, photos) { return `${beer ? '✓' : '○'} six-pack   •   ${photos.size}/2 photos`; }
export function missedPhotos(x, photos) { return photoStops.flatMap((stop, i) => x > stop.x + 115 && !photos.has(i) ? [i] : []); }
export function photoIndicator(x, photos) {
  return photoStops.map((stop, i) => photos.has(i) ? `✓ ${stop.short}` : x > stop.x + 115 ? `! MISSED ${stop.short} ←` : `○ ${stop.short} →`).join('     ');
}

export const PIANO_DROP_MS = 360;
export const PIANO_PAUSE_MS = 850;
export function pianoStep(state, time, inTriggerZone) {
  let next = state;
  if (inTriggerZone && time >= state.readyAt) {
    next = { startedAt: time, readyAt: time + PIANO_DROP_MS + PIANO_PAUSE_MS, serial: state.serial + 1 };
  }
  const elapsed = time - next.startedAt;
  return { ...next, dropping: elapsed >= 0 && elapsed < PIANO_DROP_MS,
    offset: -230 + 310 * Math.min(Math.max(elapsed / PIANO_DROP_MS, 0), 1) ** 2 };
}

export function objectImpactReaction(randomValue) { return randomValue < 0.5 ? 'ouch' : 'ahh'; }
export const PIANO_TRIGGER_DISTANCE = 155;

export function runScore(beer, photos, mishaps, latePhotos = new Set()) {
  const photoPoints = photoStops.reduce((points, _, i) => points + (photos.has(i) ? (latePhotos.has(i) ? 125 : 250) : 0), 0);
  return Math.max(0, 1000 + photoPoints + (beer ? 500 : 0)
    - 10 * (mishaps.falls + mishaps.squishes + mishaps.bumps));
}
export function recordMishap(mishaps, reaction) {
  const key = reaction === 'fall' ? 'falls' : reaction === 'squish' ? 'squishes' : 'bumps';
  return { ...mishaps, [key]: mishaps[key] + 1 };
}
export const RESTART_HOLD_MS = 650;

// A normal step down is 76 units. Allow that landing before calling it a fall.
export function isTrueFall(bottom, departureY, velocityY) {
  return velocityY > 120 && bottom > departureY + FLOOR_RISE + 28;
}

export const fallingAssignments = [[7,'piano'],[14,'anvil'],[20,'ac'],[23,'cooler']];
