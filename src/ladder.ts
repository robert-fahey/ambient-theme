export interface Step {
  maxLux: number | null;
  theme: string;
  dark: boolean;
}

/** Sorts steps by maxLux ascending, with the unbounded (null) step last. */
export function normalizeLadder(steps: Step[]): Step[] {
  return steps
    .filter((s) => s && typeof s.theme === 'string')
    .slice()
    .sort((a, b) => (a.maxLux ?? Infinity) - (b.maxLux ?? Infinity));
}

/** Index of the step whose range contains lux, ignoring hysteresis. */
export function rawBand(lux: number, ladder: Step[]): number {
  const i = ladder.findIndex((s) => s.maxLux === null || lux < s.maxLux);
  return i === -1 ? ladder.length - 1 : i;
}

/**
 * Band for lux, staying in `current` unless lux has crossed one of its edges
 * by more than the hysteresis fraction.
 */
export function bandFor(lux: number, ladder: Step[], current: number | undefined, hysteresis: number): number {
  if (current === undefined || current < 0 || current >= ladder.length) {
    return rawBand(lux, ladder);
  }
  const lower = current > 0 ? ladder[current - 1].maxLux ?? 0 : 0;
  const upper = ladder[current].maxLux;
  const belowLower = current > 0 && lux < lower * (1 - hysteresis);
  const aboveUpper = upper !== null && lux >= upper * (1 + hysteresis);
  return belowLower || aboveUpper ? rawBand(lux, ladder) : current;
}

export interface ControllerOptions {
  dwellMs: number;
  hysteresis: number;
  /** EMA weight for each new sample, applied in log space. */
  alpha?: number;
}

/**
 * Smooths lux samples and decides when to move to a new ladder band.
 * `feed` returns a band index only when a switch should happen.
 */
export class Controller {
  private logLux: number | undefined;
  private applied: number | undefined;
  private candidate: number | undefined;
  private candidateSince = 0;

  constructor(private ladder: Step[], private opts: ControllerOptions) {}

  get smoothedLux(): number | undefined {
    return this.logLux === undefined ? undefined : Math.expm1(this.logLux);
  }

  get currentBand(): number | undefined {
    return this.applied;
  }

  configure(ladder: Step[], opts: ControllerOptions): void {
    this.ladder = ladder;
    this.opts = opts;
    this.applied = undefined;
    this.candidate = undefined;
  }

  /** Forgets the applied band so the next sample re-applies immediately. */
  reset(): void {
    this.applied = undefined;
    this.candidate = undefined;
  }

  feed(lux: number, now: number): number | undefined {
    if (!Number.isFinite(lux) || lux < 0 || this.ladder.length === 0) return undefined;
    const l = Math.log1p(lux);
    const alpha = this.opts.alpha ?? 0.3;
    this.logLux = this.logLux === undefined ? l : alpha * l + (1 - alpha) * this.logLux;

    const band = bandFor(this.smoothedLux!, this.ladder, this.applied, this.opts.hysteresis);
    if (this.applied === undefined) {
      this.applied = band;
      return band;
    }
    if (band === this.applied) {
      this.candidate = undefined;
      return undefined;
    }
    if (band !== this.candidate) {
      this.candidate = band;
      this.candidateSince = now;
    }
    if (now - this.candidateSince >= this.opts.dwellMs) {
      this.applied = band;
      this.candidate = undefined;
      return band;
    }
    return undefined;
  }
}

/**
 * Returns a copy of the ladder with thresholds moved so that `lux` falls in
 * step `index`, keeping thresholds strictly increasing.
 */
export function calibrate(ladder: Step[], index: number, lux: number): Step[] {
  const out = ladder.map((s) => ({ ...s }));
  const round = (n: number) => Math.round(n * 10) / 10;
  const upper = out[index].maxLux;
  if (upper !== null && lux >= upper) {
    out[index].maxLux = round(Math.max(lux * 1.25, lux + 1));
    for (let j = index + 1; j < out.length; j++) {
      const m = out[j].maxLux;
      const prev = out[j - 1].maxLux!;
      if (m !== null && m <= prev) out[j].maxLux = round(prev * 1.25 + 1);
    }
  }
  if (index > 0 && lux < out[index - 1].maxLux!) {
    out[index - 1].maxLux = round(lux * 0.8);
    for (let j = index - 2; j >= 0; j--) {
      if (out[j].maxLux! >= out[j + 1].maxLux!) out[j].maxLux = round(out[j + 1].maxLux! * 0.8);
    }
  }
  return out;
}
