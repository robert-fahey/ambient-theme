import * as vscode from 'vscode';
import type { AmbientTheme } from './extension';
import { Step, normalizeLadder } from './ladder';

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

interface ThemeInfo {
  id: string;
  label: string;
  dark: boolean;
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

/** Lists every installed color theme by the value `workbench.colorTheme` expects. */
function installedThemes(): ThemeInfo[] {
  const seen = new Map<string, ThemeInfo>();
  for (const ext of vscode.extensions.all) {
    const themes = ext.packageJSON?.contributes?.themes;
    if (!Array.isArray(themes)) continue;
    for (const t of themes) {
      const id = t.id ?? t.label;
      if (typeof id !== 'string' || seen.has(id)) continue;
      seen.set(id, { id, label: t.label ?? id, dark: t.uiTheme === 'vs-dark' || t.uiTheme === 'hc-black' });
    }
  }
  return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/** Sidebar webview for live readings, simulation and tuning. */
export class ControlPanel implements vscode.WebviewViewProvider {
  static readonly viewId = 'ambientTheme.panel';

  constructor(private readonly extensionUri: vscode.Uri, private readonly app: AmbientTheme) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    const webview = view.webview;
    webview.options = { enableScripts: true, localResourceRoots: [this.extensionUri] };
    webview.html = html(nonce());

    const post = (msg: unknown) => void webview.postMessage(msg);
    const sub = this.app.onDidUpdate(() => {
      if (view.visible) post({ type: 'state', state: this.app.snapshot() });
    });
    view.onDidChangeVisibility(() => view.visible && post({ type: 'state', state: this.app.snapshot() }));
    view.onDidDispose(() => sub.dispose());

    webview.onDidReceiveMessage(async (msg) => {
      switch (msg?.type) {
        case 'ready':
          post({ type: 'themes', themes: installedThemes() });
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

function html(n: string): string {
  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${n}'; script-src 'nonce-${n}';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style nonce="${n}">
  body { font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); color: var(--vscode-foreground); padding: 0 12px 16px; }
  h3 { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: var(--vscode-descriptionForeground); margin: 18px 0 8px; font-weight: 600; }
  .readout { display: flex; gap: 16px; align-items: baseline; flex-wrap: wrap; }
  .big { font-size: 26px; font-weight: 600; font-variant-numeric: tabular-nums; }
  .muted { color: var(--vscode-descriptionForeground); }
  .pill { display: inline-block; padding: 1px 7px; border-radius: 9px; font-size: 11px; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); }
  .pill.warn { background: var(--vscode-inputValidation-warningBackground, #b58900); }
  .bar { position: relative; height: 34px; margin: 10px 0 18px; border-radius: 4px; overflow: hidden; display: flex; border: 1px solid var(--vscode-widget-border, transparent); }
  .seg { height: 100%; display: flex; align-items: center; justify-content: center; font-size: 10px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; padding: 0 2px; border-right: 1px solid rgba(128,128,128,.4); box-sizing: border-box; }
  .seg.dark { background: #1e1e1e; color: #ccc; }
  .seg.light { background: #f3f3f3; color: #333; }
  .seg.active { outline: 2px solid var(--vscode-focusBorder); outline-offset: -2px; font-weight: 600; }
  .marker { position: absolute; top: 0; bottom: 0; width: 2px; background: var(--vscode-charts-orange, orange); }
  .marker.raw { background: var(--vscode-charts-blue, #3794ff); opacity: .7; }
  .ticks { position: relative; height: 12px; margin-top: -16px; font-size: 9px; color: var(--vscode-descriptionForeground); }
  .ticks span { position: absolute; transform: translateX(-50%); }
  .legend { font-size: 11px; display: flex; gap: 12px; margin-top: 4px; }
  .legend i { display: inline-block; width: 10px; height: 3px; vertical-align: middle; margin-right: 4px; }
  label.row { display: grid; grid-template-columns: 1fr auto; gap: 4px 8px; align-items: center; margin: 8px 0; }
  label.row input[type=range] { grid-column: 1 / -1; width: 100%; }
  .val { font-variant-numeric: tabular-nums; color: var(--vscode-descriptionForeground); }
  .check { display: flex; gap: 6px; align-items: center; margin: 6px 0; }
  button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 4px 10px; border-radius: 2px; cursor: pointer; font-family: inherit; font-size: 12px; }
  button:hover { background: var(--vscode-button-hoverBackground); }
  button.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
  button.secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
  button.icon { background: transparent; color: var(--vscode-foreground); padding: 2px 5px; }
  button.icon:hover { background: var(--vscode-toolbar-hoverBackground); }
  .buttons { display: flex; gap: 6px; flex-wrap: wrap; margin: 8px 0; }
  .step { border: 1px solid var(--vscode-widget-border, rgba(128,128,128,.3)); border-radius: 4px; padding: 8px; margin: 6px 0; }
  .step.active { border-color: var(--vscode-focusBorder); }
  .step .top { display: flex; gap: 6px; align-items: center; }
  .step select { flex: 1; min-width: 0; }
  .step .bottom { display: flex; gap: 8px; align-items: center; margin-top: 6px; flex-wrap: wrap; font-size: 12px; }
  .step input[type=number] { width: 72px; }
  select, input[type=number] { background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border, transparent); padding: 3px 4px; font-family: inherit; border-radius: 2px; }
  #macResult { font-size: 12px; margin-top: 4px; }
  a { color: var(--vscode-textLink-foreground); cursor: pointer; }
</style>
</head>
<body>
  <h3>Live</h3>
  <div class="readout">
    <div><div class="big" id="smoothed">—</div><div class="muted">smoothed lux</div></div>
    <div><div class="big muted" id="raw">—</div><div class="muted">sensor lux</div></div>
  </div>
  <div style="margin-top:8px"><span id="mode" class="pill">…</span> <span id="theme" class="muted"></span></div>
  <div class="bar" id="bar"></div>
  <div class="ticks" id="ticks"></div>
  <div class="legend"><span><i style="background:var(--vscode-charts-orange,orange)"></i>smoothed</span><span><i style="background:var(--vscode-charts-blue,#3794ff)"></i>sensor</span></div>
  <div class="buttons">
    <button id="applyNow" title="Skip the dwell delay and any manual override">Apply now</button>
    <button id="toggle" class="secondary">Disable</button>
  </div>

  <h3>Simulate light</h3>
  <div class="check"><input type="checkbox" id="simOn"><label for="simOn">Use a fake light level instead of the sensor</label></div>
  <label class="row"><span>Light level</span><span class="val" id="simVal">200 lx</span><input type="range" id="simLux" min="0" max="1000" step="1"></label>
  <div class="check"><input type="checkbox" id="simInstant"><label for="simInstant">Switch instantly (skip dwell)</label></div>

  <h3>Theme ladder <span class="muted" style="text-transform:none;letter-spacing:0">darkest room → brightest</span></h3>
  <div id="ladder"></div>
  <div class="buttons"><button id="addStep" class="secondary">+ Add step</button></div>

  <h3>Tuning</h3>
  <label class="row"><span>Dwell before switching</span><span class="val" id="dwellVal"></span><input type="range" id="dwellSeconds" min="0" max="120" step="1"></label>
  <label class="row"><span>Hysteresis margin</span><span class="val" id="hysteresisVal"></span><input type="range" id="hysteresis" min="0" max="0.6" step="0.01"></label>
  <label class="row"><span>Smoothing (lower = steadier)</span><span class="val" id="smoothingVal"></span><input type="range" id="smoothing" min="0.05" max="1" step="0.05"></label>
  <label class="row"><span>Sensor poll interval</span><span class="val" id="pollVal"></span><input type="range" id="pollIntervalMs" min="250" max="5000" step="250"></label>
  <div class="check"><input type="checkbox" id="pauseWhenUnfocused"><label for="pauseWhenUnfocused">Pause while the window isn't focused</label></div>

  <h3>macOS appearance</h3>
  <div class="check"><input type="checkbox" id="controlMacAppearance"><label for="controlMacAppearance">Switch macOS Dark Mode too</label></div>
  <div class="buttons">
    <button class="secondary" id="macDark">Test Dark</button>
    <button class="secondary" id="macLight">Test Light</button>
  </div>
  <div id="macResult" class="muted"></div>
  <div class="muted" style="font-size:12px;margin-top:6px"><a id="openAutomation">Open Automation privacy settings</a> · <a id="openSettings">All settings</a></div>

<script nonce="${n}">
  const vscode = acquireVsCodeApi();
  const $ = (id) => document.getElementById(id);
  const MAX_LOG = 4.3; // slider/bar top ≈ 20,000 lx
  const toLux = (p) => Math.round(Math.pow(10, p / 1000 * MAX_LOG) - 1);
  const toPos = (lux) => Math.round(Math.log10(lux + 1) / MAX_LOG * 1000);
  const pct = (lux) => Math.min(100, Math.max(0, Math.log10(lux + 1) / MAX_LOG * 100));
  const fmt = (lux) => lux === undefined || lux === null ? '—' : lux >= 1000 ? (lux / 1000).toFixed(1) + 'k' : String(Math.round(lux));

  let state = null;
  let themes = [];
  let renderedLadder = '';

  const send = (msg) => vscode.postMessage(msg);
  const setting = (key, value) => send({ type: 'setting', key, value });
  const simulate = () => send({ type: 'simulate', on: $('simOn').checked, lux: toLux(+$('simLux').value), instant: $('simInstant').checked });

  // Sliders: update the label while dragging, save on release.
  const sliders = {
    dwellSeconds: [(v) => v + ' s', Number],
    hysteresis: [(v) => Math.round(v * 100) + '%', Number],
    smoothing: [(v) => (+v).toFixed(2), Number],
    pollIntervalMs: [(v) => (v / 1000).toFixed(2) + ' s', Number],
  };
  const valIds = { dwellSeconds: 'dwellVal', hysteresis: 'hysteresisVal', smoothing: 'smoothingVal', pollIntervalMs: 'pollVal' };
  for (const [key, [label, parse]] of Object.entries(sliders)) {
    const el = $(key);
    el.addEventListener('input', () => { $(valIds[key]).textContent = label(el.value); });
    el.addEventListener('change', () => setting(key, parse(el.value)));
  }
  for (const key of ['pauseWhenUnfocused', 'controlMacAppearance']) {
    $(key).addEventListener('change', () => setting(key, $(key).checked));
  }

  $('simOn').addEventListener('change', simulate);
  $('simInstant').addEventListener('change', simulate);
  $('simLux').addEventListener('input', () => {
    $('simVal').textContent = fmt(toLux(+$('simLux').value)) + ' lx';
    if ($('simOn').checked) simulate();
  });
  $('applyNow').addEventListener('click', () => send({ type: 'applyNow' }));
  $('toggle').addEventListener('click', () => setting('enabled', !state.settings.enabled));
  $('macDark').addEventListener('click', () => { $('macResult').textContent = 'Switching…'; send({ type: 'testMac', dark: true }); });
  $('macLight').addEventListener('click', () => { $('macResult').textContent = 'Switching…'; send({ type: 'testMac', dark: false }); });
  $('openAutomation').addEventListener('click', () => send({ type: 'openAutomation' }));
  $('openSettings').addEventListener('click', () => send({ type: 'openSettings' }));
  $('addStep').addEventListener('click', () => {
    const ladder = state.ladder.map((s) => ({ ...s }));
    const lastBounded = ladder.filter((s) => s.maxLux !== null).pop();
    const fallback = themes.find((t) => !t.dark) ?? themes[0];
    ladder.splice(Math.max(0, ladder.length - 1), 0, {
      maxLux: Math.round((lastBounded?.maxLux ?? 100) * 2),
      theme: fallback?.id ?? 'Default Light Modern',
      dark: fallback?.dark ?? false,
    });
    send({ type: 'ladder', ladder });
  });

  function saveLadderFromDom() {
    const ladder = [...document.querySelectorAll('.step')].map((row) => {
      const max = row.querySelector('.max');
      const unbounded = row.querySelector('.unbounded').checked;
      return {
        theme: row.querySelector('select').value,
        dark: row.querySelector('.dark').checked,
        maxLux: unbounded ? null : Math.max(0, Number(max.value) || 0),
      };
    });
    send({ type: 'ladder', ladder });
  }

  function renderLadder() {
    const key = JSON.stringify([state.ladder, themes.length]);
    const host = $('ladder');
    if (key === renderedLadder || host.contains(document.activeElement)) return;
    renderedLadder = key;
    host.innerHTML = '';
    state.ladder.forEach((step, i) => {
      const lower = i === 0 ? 0 : state.ladder[i - 1].maxLux;
      const row = document.createElement('div');
      row.className = 'step';
      row.dataset.index = i;

      const top = document.createElement('div');
      top.className = 'top';
      const sel = document.createElement('select');
      const known = themes.some((t) => t.id === step.theme);
      for (const t of known ? themes : [{ id: step.theme, label: step.theme + ' (not installed)', dark: step.dark }, ...themes]) {
        const o = document.createElement('option');
        o.value = t.id; o.textContent = t.label; o.selected = t.id === step.theme;
        sel.appendChild(o);
      }
      sel.addEventListener('change', () => {
        const t = themes.find((t) => t.id === sel.value);
        if (t) row.querySelector('.dark').checked = t.dark;
        saveLadderFromDom();
      });
      const preview = button('👁', 'Preview this theme', () => send({ type: 'preview', theme: sel.value }));
      const here = button('◎', 'Use this step at the current light level', () => send({ type: 'calibrate', index: i }));
      const del = button('✕', 'Remove step', () => { row.remove(); saveLadderFromDom(); });
      del.disabled = state.ladder.length <= 1;
      top.append(sel, preview, here, del);

      const bottom = document.createElement('div');
      bottom.className = 'bottom';
      bottom.innerHTML =
        '<span class="muted">' + fmt(lower) + ' lx → below</span>' +
        '<input type="number" class="max" min="0" step="1">' +
        '<label class="check" style="margin:0"><input type="checkbox" class="unbounded">∞</label>' +
        '<label class="check" style="margin:0"><input type="checkbox" class="dark">dark</label>';
      const max = bottom.querySelector('.max');
      const unb = bottom.querySelector('.unbounded');
      max.value = step.maxLux ?? '';
      max.disabled = step.maxLux === null;
      unb.checked = step.maxLux === null;
      bottom.querySelector('.dark').checked = step.dark;
      max.addEventListener('change', saveLadderFromDom);
      unb.addEventListener('change', () => { max.disabled = unb.checked; if (!unb.checked && !max.value) max.value = Math.round((lower || 100) * 2); saveLadderFromDom(); });
      bottom.querySelector('.dark').addEventListener('change', saveLadderFromDom);

      row.append(top, bottom);
      host.appendChild(row);
    });
  }

  function button(text, title, onClick) {
    const b = document.createElement('button');
    b.className = 'icon'; b.textContent = text; b.title = title;
    b.addEventListener('click', onClick);
    return b;
  }

  function renderBar() {
    const bar = $('bar');
    bar.innerHTML = '';
    let prev = 0;
    state.ladder.forEach((s, i) => {
      const end = s.maxLux === null ? Math.pow(10, MAX_LOG) : s.maxLux;
      const seg = document.createElement('div');
      seg.className = 'seg ' + (s.dark ? 'dark' : 'light') + (i === state.band ? ' active' : '');
      seg.style.width = Math.max(0, pct(end) - pct(prev)) + '%';
      const t = themes.find((t) => t.id === s.theme);
      seg.textContent = t ? t.label : s.theme;
      seg.title = (t ? t.label : s.theme) + ': ' + fmt(prev) + '–' + (s.maxLux === null ? '∞' : fmt(s.maxLux)) + ' lx';
      bar.appendChild(seg);
      prev = end;
    });
    const lux = state.simulating ? state.simLux : state.rawLux;
    for (const [cls, v] of [['raw', lux], ['', state.smoothedLux]]) {
      if (v === undefined || v === null) continue;
      const m = document.createElement('div');
      m.className = 'marker ' + cls;
      m.style.left = 'calc(' + pct(v) + '% - 1px)';
      bar.appendChild(m);
    }
    const ticks = $('ticks');
    if (!ticks.childElementCount) {
      for (const v of [10, 100, 1000, 10000]) {
        const s = document.createElement('span');
        s.style.left = pct(v) + '%'; s.textContent = fmt(v);
        ticks.appendChild(s);
      }
    }
  }

  function render() {
    const s = state;
    $('smoothed').textContent = fmt(s.smoothedLux);
    $('raw').textContent = fmt(s.rawLux);
    const modeText = { running: 'Following sensor', idle: 'Waiting for focus', paused: 'Paused', off: 'Disabled', error: 'Sensor error: ' + (s.fatal || '') }[s.mode];
    const mode = $('mode');
    mode.textContent = s.simulating && s.mode !== 'off' ? 'Simulating' : modeText;
    mode.className = 'pill' + (s.mode === 'error' || s.mode === 'off' ? ' warn' : '');
    $('theme').textContent = (s.currentTheme || '') + (s.manualOverride ? ' (manual, held until next band change)' : '');
    $('toggle').textContent = s.settings.enabled ? 'Disable' : 'Enable';

    $('simOn').checked = s.simulating;
    $('simInstant').checked = s.simInstant;
    if (document.activeElement !== $('simLux')) {
      $('simLux').value = toPos(s.simLux);
      $('simVal').textContent = fmt(s.simLux) + ' lx';
    }

    for (const [key, [label]] of Object.entries(sliders)) {
      if (document.activeElement === $(key)) continue;
      $(key).value = s.settings[key];
      $(valIds[key]).textContent = label(s.settings[key]);
    }
    $('pauseWhenUnfocused').checked = s.settings.pauseWhenUnfocused;
    $('controlMacAppearance').checked = s.settings.controlMacAppearance;

    renderBar();
    renderLadder();
    document.querySelectorAll('.step').forEach((row) => row.classList.toggle('active', +row.dataset.index === s.band));
  }

  window.addEventListener('message', (e) => {
    const msg = e.data;
    if (msg.type === 'themes') { themes = msg.themes; renderedLadder = ''; if (state) render(); }
    if (msg.type === 'state') { state = msg.state; render(); }
    if (msg.type === 'macResult') $('macResult').textContent = msg.text;
  });
  send({ type: 'ready' });
</script>
</body>
</html>`;
}
