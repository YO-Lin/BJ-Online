// Positions "seats" evenly along a shallow arc, U-shaped from the player's point of
// view: the center seat sits lowest (closest to the viewer), the outer seats sit
// highest (closest to the dealer) — matching a real table photo, where the betting
// line dips toward the camera in the middle and curls up at both ends.
const HALF_SPREAD_DEG = 65;
const CENTER_X_PCT = 50;
const CENTER_Y_PCT = 20.8;
const RADIUS_X_PCT = 50;
const RADIUS_Y_PCT = 57.2;

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
  const top = CENTER_Y_PCT - RADIUS_Y_PCT * Math.sin(thetaRad);
  const rotation = thetaDeg + 90;

  return { left, top, rotation };
}
