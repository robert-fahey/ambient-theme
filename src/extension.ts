import * as path from 'path';
import * as vscode from 'vscode';
import { MacAppearanceError, currentTheme, setMacDarkMode, setTheme } from './apply';
import { Controller, ControllerOptions, Step, calibrate, normalizeLadder } from './ladder';
import { Sensor } from './sensor';
import { ControlPanel, PanelState } from './panel';
import { isDarkTheme } from './themes';

const AUTO_DETECT_PROMPTED = 'ambientTheme.autoDetectPrompted';

let state: AmbientTheme | undefined;

export function activate(context: vscode.ExtensionContext): void {
  if (process.platform !== 'darwin') return;
  state = new AmbientTheme(context);
}

export function deactivate(): void {
  state?.dispose();
  state = undefined;
}

function config() {
  return vscode.workspace.getConfiguration('ambientTheme');
}

function readLadder(): Step[] {
  return normalizeLadder(config().get<Step[]>('ladder') ?? []);
}

/** A step is dark if its theme says so; the `dark` flag only matters for themes that aren't installed. */
function isDarkStep(step: Step): boolean {
  return isDarkTheme(step.theme) ?? step.dark;
}

function readOptions(): ControllerOptions {
  return {
    dwellMs: (config().get<number>('dwellSeconds') ?? 20) * 1000,
    hysteresis: config().get<number>('hysteresis') ?? 0.15,
    alpha: config().get<number>('smoothing') ?? 0.3,
  };
}

export class AmbientTheme implements vscode.Disposable {
  private readonly sensor: Sensor;
  private readonly controller: Controller;
  private readonly status: vscode.StatusBarItem;
  private readonly disposables: vscode.Disposable[] = [];
  private ladder = readLadder();
  private lastLux: number | undefined;
  private lastDark: boolean | undefined;
  /** Theme we last wrote, so our own config change isn't mistaken for a manual pick. */
  private writtenTheme: string | undefined;
  private manualOverride = false;
  private pausedUntil = 0;
  private pauseTimer: NodeJS.Timeout | undefined;
  private fatal: string | undefined;
  private rawLux: number | undefined;
  private simulating = false;
  private simLux = 200;
  private simInstant = true;
  private simTimer: NodeJS.Timeout | undefined;
  private readonly updated = new vscode.EventEmitter<void>();
  /** Fires whenever readings, band or settings change, for the control panel. */
  readonly onDidUpdate = this.updated.event;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.controller = new Controller(this.ladder, this.controllerOptions());
    this.sensor = new Sensor(
      path.join(context.extensionPath, 'bin', 'als-reader'),
      config().get<number>('pollIntervalMs') ?? 1000,
      {
        onLux: (lux) => this.onLux(lux),
        onFatal: (reason) => {
          this.fatal = reason;
          this.render();
          vscode.window.showWarningMessage(`Ambient Theme: light sensor unavailable (${reason}).`);
        },
      },
    );

    this.status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.status.command = 'ambientTheme.toggle';
    this.status.show();

    this.disposables.push(
      this.status,
      vscode.commands.registerCommand('ambientTheme.toggle', () => {
        if (this.fatal) {
          this.fatal = undefined;
          this.updateRunning();
          return;
        }
        return config().update('enabled', !this.enabled, vscode.ConfigurationTarget.Global);
      }),
      vscode.commands.registerCommand('ambientTheme.pause', () => this.pause(60 * 60 * 1000)),
      vscode.commands.registerCommand('ambientTheme.calibrate', () => this.calibrate()),
      vscode.commands.registerCommand('ambientTheme.openPanel', () =>
        vscode.commands.executeCommand(`${ControlPanel.viewId}.focus`),
      ),
      vscode.window.registerWebviewViewProvider(ControlPanel.viewId, new ControlPanel(context.extensionUri, this)),
      this.updated,
      vscode.workspace.onDidChangeConfiguration((e) => this.onConfigChange(e)),
      vscode.window.onDidChangeWindowState(() => this.updateRunning()),
    );

    this.updateRunning();
    this.render();
    if (this.enabled) this.maybeDisableAutoDetect();
  }

  private get enabled(): boolean {
    return config().get<boolean>('enabled') ?? true;
  }

  private get shouldRun(): boolean {
    if (!this.enabled || this.fatal || Date.now() < this.pausedUntil) return false;
    if (config().get<boolean>('pauseWhenUnfocused') && !vscode.window.state.focused) return false;
    return true;
  }

  private updateRunning(): void {
    if (this.shouldRun) this.sensor.start();
    else this.sensor.stop();
    this.render();
  }

  private controllerOptions(): ControllerOptions {
    const opts = readOptions();
    return this.simulating && this.simInstant ? { ...opts, dwellMs: 0 } : opts;
  }

  private onLux(raw: number): void {
    this.rawLux = raw;
    if (this.simulating) this.render();
    else this.process(raw);
  }

  private process(lux: number): void {
    this.lastLux = lux;
    const band = this.controller.feed(lux, Date.now());
    if (band !== undefined) {
      this.manualOverride = false;
      void this.applyStep(this.ladder[band]);
    }
    this.render();
  }

  private async applyStep(step: Step): Promise<void> {
    this.writtenTheme = step.theme;
    try {
      await setTheme(step.theme);
    } catch (err) {
      vscode.window.showErrorMessage(`Ambient Theme: couldn't set theme "${step.theme}": ${err}`);
    }

    const dark = isDarkStep(step);
    if (!config().get<boolean>('controlMacAppearance') || dark === this.lastDark) return;
    try {
      await setMacDarkMode(dark);
      this.lastDark = dark;
    } catch (err) {
      if (err instanceof MacAppearanceError && err.permissionDenied) {
        await config().update('controlMacAppearance', false, vscode.ConfigurationTarget.Global);
        vscode.window.showWarningMessage(
          'Ambient Theme: macOS denied permission to control System Events, so only the VS Code theme will change. ' +
            'Grant it in System Settings › Privacy & Security › Automation, then re-enable "ambientTheme.controlMacAppearance".',
        );
      } else {
        console.error('Ambient Theme: failed to set macOS appearance', err);
      }
    }
  }

  private onConfigChange(e: vscode.ConfigurationChangeEvent): void {
    if (e.affectsConfiguration('workbench.colorTheme')) {
      const theme = currentTheme();
      if (theme !== this.writtenTheme && this.controller.currentBand !== undefined) {
        // Manual pick: hold it until the light level moves to another band.
        this.manualOverride = true;
        this.render();
      }
    }
    if (!e.affectsConfiguration('ambientTheme')) return;

    if (e.affectsConfiguration('ambientTheme.ladder') || e.affectsConfiguration('ambientTheme.dwellSeconds') ||
        e.affectsConfiguration('ambientTheme.hysteresis') || e.affectsConfiguration('ambientTheme.smoothing')) {
      this.ladder = readLadder();
      this.controller.configure(this.ladder, this.controllerOptions());
      this.manualOverride = false;
    }
    if (e.affectsConfiguration('ambientTheme.pollIntervalMs')) {
      this.sensor.setInterval(config().get<number>('pollIntervalMs') ?? 1000);
      if (this.simulating) this.startSimTimer();
    }
    if (e.affectsConfiguration('ambientTheme.controlMacAppearance')) {
      this.lastDark = undefined;
    }
    if (e.affectsConfiguration('ambientTheme.enabled')) {
      this.fatal = undefined;
      this.controller.reset();
      this.manualOverride = false;
      if (this.enabled) this.maybeDisableAutoDetect();
    }
    this.updateRunning();
  }

  private pause(ms: number): void {
    this.pausedUntil = Date.now() + ms;
    clearTimeout(this.pauseTimer);
    this.pauseTimer = setTimeout(() => {
      this.pausedUntil = 0;
      this.updateRunning();
    }, ms);
    this.updateRunning();
    vscode.window.showInformationMessage('Ambient Theme paused for 1 hour.');
  }

  private async calibrate(): Promise<void> {
    const lux = this.controller.smoothedLux ?? this.lastLux;
    if (lux === undefined) {
      vscode.window.showWarningMessage('Ambient Theme: no light reading yet. Is the extension enabled and the window focused?');
      return;
    }
    const items = this.ladder.map((s, i) => ({
      label: s.theme,
      description: `${s.dark ? 'dark' : 'light'} · ${i === 0 ? 0 : this.ladder[i - 1].maxLux}–${s.maxLux ?? '∞'} lx`,
      picked: i === this.controller.currentBand,
      index: i,
    }));
    const pick = await vscode.window.showQuickPick(items, {
      title: `Current light: ${Math.round(lux)} lx`,
      placeHolder: 'Which theme should be used at this light level?',
    });
    if (!pick) return;
    const updated = calibrate(this.ladder, pick.index, lux);
    await config().update('ladder', updated, vscode.ConfigurationTarget.Global);
    vscode.window.showInformationMessage(`Ambient Theme: "${pick.label}" will now be used at ${Math.round(lux)} lx.`);
  }

  // ---- Control panel API ----

  snapshot(): PanelState {
    const c = config();
    let mode: PanelState['mode'] = 'running';
    if (this.fatal) mode = 'error';
    else if (!this.enabled) mode = 'off';
    else if (Date.now() < this.pausedUntil) mode = 'paused';
    else if (!this.shouldRun && !this.simulating) mode = 'idle';
    return {
      mode,
      fatal: this.fatal,
      rawLux: this.rawLux,
      smoothedLux: this.controller.smoothedLux,
      band: this.controller.currentBand,
      manualOverride: this.manualOverride,
      currentTheme: currentTheme(),
      ladder: this.ladder.map((s) => ({ ...s, dark: isDarkStep(s) })),
      simulating: this.simulating,
      simLux: this.simLux,
      simInstant: this.simInstant,
      settings: {
        enabled: this.enabled,
        dwellSeconds: c.get<number>('dwellSeconds') ?? 20,
        hysteresis: c.get<number>('hysteresis') ?? 0.15,
        smoothing: c.get<number>('smoothing') ?? 0.3,
        pollIntervalMs: c.get<number>('pollIntervalMs') ?? 1000,
        controlMacAppearance: c.get<boolean>('controlMacAppearance') ?? true,
        pauseWhenUnfocused: c.get<boolean>('pauseWhenUnfocused') ?? true,
      },
    };
  }

  /** Feeds a fake lux value instead of the sensor, optionally skipping the dwell delay. */
  setSimulation(on: boolean, lux: number, instant: boolean): void {
    const changed = on !== this.simulating || instant !== this.simInstant;
    this.simulating = on;
    this.simLux = lux;
    this.simInstant = instant;
    if (changed) {
      this.controller.configure(this.ladder, this.controllerOptions());
      this.manualOverride = false;
    }
    if (on) {
      if (changed || !this.simTimer) this.startSimTimer();
      this.process(lux);
    } else {
      clearInterval(this.simTimer);
      this.simTimer = undefined;
      if (this.rawLux !== undefined) this.process(this.rawLux);
      else this.render();
    }
  }

  private startSimTimer(): void {
    clearInterval(this.simTimer);
    this.simTimer = setInterval(() => this.process(this.simLux), config().get<number>('pollIntervalMs') ?? 1000);
  }

  /** Drops the manual override and dwell wait, and applies the band for the latest reading now. */
  applyNow(): void {
    this.controller.reset();
    this.manualOverride = false;
    const lux = this.simulating ? this.simLux : this.rawLux;
    if (lux !== undefined) this.process(lux);
    else this.render();
  }

  /** Applies a theme without moving the ladder; it's held like a manual pick. */
  async previewTheme(theme: string): Promise<void> {
    await setTheme(theme);
  }

  async testMacAppearance(dark: boolean): Promise<string> {
    try {
      await setMacDarkMode(dark);
      this.lastDark = dark;
      return `macOS switched to ${dark ? 'Dark' : 'Light'} mode.`;
    } catch (err) {
      if (err instanceof MacAppearanceError && err.permissionDenied) {
        return 'Permission denied. Enable System Events for this app in System Settings › Privacy & Security › Automation.';
      }
      return `Failed: ${err instanceof Error ? err.message : err}`;
    }
  }

  /** Moves thresholds so the current reading falls in the given step. */
  async calibrateStep(index: number): Promise<void> {
    const lux = this.simulating ? this.simLux : this.controller.smoothedLux ?? this.rawLux;
    if (lux === undefined) return;
    await config().update('ladder', calibrate(this.ladder, index, lux), vscode.ConfigurationTarget.Global);
  }

  async updateSetting(key: string, value: unknown): Promise<void> {
    await config().update(key, value, vscode.ConfigurationTarget.Global);
  }

  /** window.autoDetectColorScheme would fight our theme writes when macOS appearance flips. */
  private async maybeDisableAutoDetect(): Promise<void> {
    const win = vscode.workspace.getConfiguration('window');
    if (!win.get<boolean>('autoDetectColorScheme') || this.context.globalState.get(AUTO_DETECT_PROMPTED)) return;
    await this.context.globalState.update(AUTO_DETECT_PROMPTED, true);
    const choice = await vscode.window.showInformationMessage(
      'Ambient Theme: "window.autoDetectColorScheme" is on and will override theme changes. Turn it off?',
      'Turn Off',
      'Keep',
    );
    if (choice === 'Turn Off') {
      await win.update('autoDetectColorScheme', false, vscode.ConfigurationTarget.Global);
    }
  }

  private render(): void {
    this.updated.fire();
    const lux = this.controller.smoothedLux;
    const luxText = lux === undefined ? '— lx' : `${Math.round(lux)} lx`;
    const band = this.controller.currentBand;
    const step = band === undefined ? undefined : this.ladder[band];

    if (this.fatal) {
      this.status.text = '$(warning) Ambient';
      this.status.tooltip = `Light sensor unavailable: ${this.fatal}. Click to retry.`;
    } else if (!this.enabled) {
      this.status.text = '$(circle-slash) Ambient';
      this.status.tooltip = 'Ambient Theme is off. Click to enable.';
    } else if (Date.now() < this.pausedUntil) {
      this.status.text = '$(debug-pause) Ambient';
      this.status.tooltip = `Paused until ${new Date(this.pausedUntil).toLocaleTimeString()}. Click to disable.`;
    } else if (this.simulating) {
      this.status.text = `$(beaker) ${Math.round(this.simLux)} lx (sim)${step ? ` · ${step.theme}` : ''}`;
      this.status.tooltip = 'Simulating a light level from the Ambient Theme panel. Click to disable.';
    } else {
      const icon = step && isDarkStep(step) ? '$(color-mode)' : '$(lightbulb)';
      this.status.text = `${icon} ${luxText}${step ? ` · ${step.theme}` : ''}${this.manualOverride ? ' (manual)' : ''}`;
      this.status.tooltip = this.manualOverride
        ? 'You picked a theme manually; Ambient Theme will resume when the light level changes band. Click to disable.'
        : 'Ambient Theme is following the light sensor. Click to disable.';
    }
  }

  dispose(): void {
    clearTimeout(this.pauseTimer);
    clearInterval(this.simTimer);
    this.sensor.stop();
    this.disposables.forEach((d) => d.dispose());
  }
}
