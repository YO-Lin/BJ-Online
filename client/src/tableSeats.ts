// Positions "seats" evenly along the top edge of a wide, flattened ellipse so they
// read as a shallow arc (like a real blackjack table's betting line) rather than a
// full semicircle. The ellipse's center sits below the visible container so only its
// flattened top edge is ever shown.
const HALF_SPREAD_DEG = 65;
const CENTER_X_PCT = 50;
const CENTER_Y_PCT = 102;
const RADIUS_X_PCT = 50;
const RADIUS_Y_PCT = 57;

export interface SeatTransform {
  left: number;
  top: number;
  rotation: number;
}

export function getSeatTransform(index: number, total: number): SeatTransform {
  const spreadFraction = total > 1 ? (2 * index) / (total - 1) - 1 : 0;
  const thetaDeg = -90 + HALF_SPREAD_DEG * spreadFraction;
  const thetaRad = (thetaDeg * Math.PI) / 180;

  const left = CENTER_X_PCT + RADIUS_X_PCT * Math.cos(thetaRad);
  const top = CENTER_Y_PCT + RADIUS_Y_PCT * Math.sin(thetaRad);
  const rotation = thetaDeg + 90;

  return { left, top, rotation };
}
