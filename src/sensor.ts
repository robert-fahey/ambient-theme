import { ChildProcess, spawn } from 'child_process';
import * as readline from 'readline';

export interface SensorEvents {
  onLux(lux: number): void;
  /** Called once when the sensor is unavailable and the helper won't be restarted. */
  onFatal(reason: string): void;
}

/** Runs the native als-reader helper and restarts it with backoff if it dies. */
export class Sensor {
  private proc: ChildProcess | undefined;
  private restartTimer: NodeJS.Timeout | undefined;
  private backoffMs = 1000;
  private running = false;

  constructor(private binary: string, private intervalMs: number, private events: SensorEvents) {}

  setInterval(ms: number): void {
    if (ms === this.intervalMs) return;
    this.intervalMs = ms;
    if (this.running) {
      this.stop();
      this.start();
    }
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.spawn();
  }

  stop(): void {
    this.running = false;
    clearTimeout(this.restartTimer);
    this.restartTimer = undefined;
    const p = this.proc;
    this.proc = undefined;
    if (p) {
      p.stdin?.end();
      p.kill();
    }
  }

  private spawn(): void {
    const p = spawn(this.binary, ['--interval', String(this.intervalMs)], { stdio: ['pipe', 'pipe', 'ignore'] });
    this.proc = p;
    let fatal: string | undefined;

    readline.createInterface({ input: p.stdout! }).on('line', (line) => {
      try {
        const msg = JSON.parse(line);
        if (typeof msg.lux === 'number') {
          this.backoffMs = 1000;
          this.events.onLux(msg.lux);
        } else if (msg.error && msg.error !== 'no-event') {
          fatal = msg.error;
        }
      } catch {
        // ignore malformed lines
      }
    });

    p.on('error', (err) => {
      fatal = `spawn failed: ${err.message}`;
    });

    p.on('close', (code) => {
      if (this.proc !== p) return;
      this.proc = undefined;
      if (!this.running) return;
      if (code === 2 || fatal?.startsWith('spawn failed')) {
        this.running = false;
        this.events.onFatal(fatal ?? 'no-sensor');
        return;
      }
      this.restartTimer = setTimeout(() => this.spawn(), this.backoffMs);
      this.backoffMs = Math.min(this.backoffMs * 2, 60000);
    });
  }
}
