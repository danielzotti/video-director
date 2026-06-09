/**
 * Pure utility functions for timeline layer snapping.
 * All calculations are done in pixel space.
 *
 * Snap priority (highest → lowest):
 *   1. Whole-second grid  – threshold × SECONDS_THRESHOLD_MULTIPLIER (stronger pull)
 *   2. Layer edges        – threshold × 1 (normal pull)
 *   3. 100ms grid         – always active, unconditional fallback
 */

export interface LayerTiming {
  uuid: string;
  startMs: number;
  endMs: number;
}

export interface TimelineSnapConfig {
  /** Snap to whole-second boundaries (in addition to the always-on 100ms grid). */
  snapToSeconds: boolean;
  /** Snap to start/end edges of other layers. */
  snapToLayers: boolean;
  /** UUID of the layer being dragged – excluded from layer snap targets. */
  excludeUuid: string;
  /** All layer timings (including the one being dragged, filtered by excludeUuid internally). */
  layerTimings: LayerTiming[];
  /** Base pixel distance to trigger a snap. Seconds snap uses a larger multiplier. */
  thresholdPx: number;
  /** Pixels per stepMs at the current zoom level. */
  stepPx: number;
  /** Step duration in milliseconds (typically 100). */
  stepMs: number;
}

/** How much larger the 1s snap threshold is compared to the base threshold. */
const SECONDS_THRESHOLD_MULTIPLIER = 3;

function msToPx(ms: number, stepPx: number, stepMs: number): number {
  return (ms * stepPx) / stepMs;
}

function trySecondsSnap(valuePx: number, config: TimelineSnapConfig): number | null {
  if (!config.snapToSeconds) return null;
  const gridPx = config.stepPx * (1000 / config.stepMs);
  const candidate = Math.round(valuePx / gridPx) * gridPx;
  return Math.abs(valuePx - candidate) <= config.thresholdPx * SECONDS_THRESHOLD_MULTIPLIER
    ? candidate
    : null;
}

function tryLayersSnap(valuePx: number, config: TimelineSnapConfig): number | null {
  if (!config.snapToLayers) return null;
  let bestSnap: number | null = null;
  let bestDist = config.thresholdPx + 1;
  for (const timing of config.layerTimings) {
    if (timing.uuid === config.excludeUuid) continue;
    for (const ms of [timing.startMs, timing.endMs]) {
      const px = msToPx(ms, config.stepPx, config.stepMs);
      const d = Math.abs(valuePx - px);
      if (d <= config.thresholdPx && d < bestDist) {
        bestDist = d;
        bestSnap = px;
      }
    }
  }
  return bestSnap;
}

/**
 * Snaps a single px edge value using priority-ordered snap targets.
 *
 * Priority:
 *   1. Whole-second grid  (threshold × 3)  – wins over 100ms from farther away
 *   2. Layer edges        (base threshold)  – wins over 100ms at normal distance
 *   3. 100ms grid         (unconditional)   – always applied as fallback
 */
export function snapEdgePx(valuePx: number, config: TimelineSnapConfig): number {
  return (
    trySecondsSnap(valuePx, config) ??
    tryLayersSnap(valuePx, config) ??
    Math.round(valuePx / config.stepPx) * config.stepPx
  );
}

/**
 * Returns the snap target px if the value snaps to a notable target
 * (whole-second grid or layer edge). Returns null when only the
 * always-on 100ms grid applies (no guide needed for that case).
 */
export function getSnapGuidePx(valuePx: number, config: TimelineSnapConfig): number | null {
  return trySecondsSnap(valuePx, config) ?? tryLayersSnap(valuePx, config);
}

/**
 * Snaps a layer move by testing both the left and right edges and
 * returning the new left position that minimises the snap delta.
 */
export function snapMovePx(
  leftPx: number,
  widthPx: number,
  config: TimelineSnapConfig,
): number {
  const snappedLeft = snapEdgePx(leftPx, config);
  const distLeft = Math.abs(leftPx - snappedLeft);

  const rightPx = leftPx + widthPx;
  const snappedRight = snapEdgePx(rightPx, config);
  const distRight = Math.abs(rightPx - snappedRight);

  if (distLeft === 0 && distRight === 0) return leftPx;
  if (distLeft <= distRight) return snappedLeft;
  return snappedRight - widthPx;
}
