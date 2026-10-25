import * as vscode from 'vscode';
import type { AmbientTheme } from './extension';
import { Step, normalizeLadder } from './ladder';
import { panelHtml } from './panelHtml';
import { installedThemes } from './themes';

export interface PanelState {
  mode: 'running' | 'idle' | 'paused' | 'off' | 'error';
  fatal?: string;
  rawLux?: number;
  smoothedLux?: number;
  band?: number;
  manualOverride: boolean;
  currentTheme?: string;
  ladder: Step[];
  simulating: boolean;
  simLux: number;
  simInstant: boolean;
  settings: {
    enabled: boolean;
    dwellSeconds: number;
    hysteresis: number;
    smoothing: number;
    pollIntervalMs: number;
    controlMacAppearance: boolean;
    pauseWhenUnfocused: boolean;
  };
}

const SETTING_KEYS = new Set([
  'enabled',
  'dwellSeconds',
  'hysteresis',
  'smoothing',
  'pollIntervalMs',
  'controlMacAppearance',
  'pauseWhenUnfocused',
]);

/** Sidebar webview for live readings, simulation and tuning. */
export class ControlPanel implements vscode.WebviewViewProvider {
  static readonly viewId = 'ambientTheme.panel';

  constructor(private readonly extensionUri: vscode.Uri, private readonly app: AmbientTheme) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    const webview = view.webview;
    webview.options = { enableScripts: true, localResourceRoots: [this.extensionUri] };
    webview.html = panelHtml(nonce());

    const post = (msg: unknown) => void webview.postMessage(msg);
    const sub = this.app.onDidUpdate(() => {
      if (view.visible) post({ type: 'state', state: this.app.snapshot() });
    });
    view.onDidChangeVisibility(() => view.visible && post({ type: 'state', state: this.app.snapshot() }));
    view.onDidDispose(() => sub.dispose());

    webview.onDidReceiveMessage(async (msg) => {
      switch (msg?.type) {
        case 'ready':
          post({ type: 'themes', themes: await installedThemes() });
          post({ type: 'state', state: this.app.snapshot() });
          break;
        case 'setting':
          if (SETTING_KEYS.has(msg.key)) await this.app.updateSetting(msg.key, msg.value);
          break;
        case 'ladder':
          if (Array.isArray(msg.ladder)) await this.app.updateSetting('ladder', normalizeLadder(msg.ladder));
          break;
        case 'simulate':
          this.app.setSimulation(!!msg.on, Math.max(0, Number(msg.lux) || 0), !!msg.instant);
          break;
        case 'applyNow':
          this.app.applyNow();
          break;
        case 'preview':
          if (typeof msg.theme === 'string') await this.app.previewTheme(msg.theme);
          break;
        case 'calibrate':
          if (Number.isInteger(msg.index)) await this.app.calibrateStep(msg.index);
          break;
        case 'testMac':
          post({ type: 'macResult', text: await this.app.testMacAppearance(!!msg.dark) });
          break;
        case 'openAutomation':
          void vscode.env.openExternal(
            vscode.Uri.parse('x-apple.systempreferences:com.apple.preference.security?Privacy_Automation'),
          );
          break;
        case 'openSettings':
          void vscode.commands.executeCommand('workbench.action.openSettings', 'ambientTheme');
          break;
      }
    });
  }
}

function nonce(): string {
  let s = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

