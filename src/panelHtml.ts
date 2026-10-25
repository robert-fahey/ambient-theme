/** Markup, styles and script for the control panel webview. Inline `style=` attributes are blocked by the CSP. */
export function panelHtml(n: string): string {
  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${n}'; script-src 'nonce-${n}';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style nonce="${n}">
  @property --c1 { syntax: '<color>'; inherits: true; initial-value: #0b1026; }
  @property --c2 { syntax: '<color>'; inherits: true; initial-value: #1c2a5a; }

  :root {
    --card: color-mix(in srgb, var(--vscode-foreground) 5%, transparent);
    --card-border: color-mix(in srgb, var(--vscode-foreground) 10%, transparent);
    --accent: var(--vscode-focusBorder, #3794ff);
    --muted: var(--vscode-descriptionForeground);
    --radius: 12px;
    --night: #0b1026;
    --dusk: #6d3fa0;
    --sunset: #ff8a5c;
    --day: #ffd36e;
    --noon: #fff6d6;
  }
  * { box-sizing: border-box; }
  body { font-family: var(--vscode-font-family); font-size: 13px; color: var(--vscode-foreground); padding: 12px 12px 24px; margin: 0; }
  button { font-family: inherit; }

  /* ---------- Hero ---------- */
  .hero {
    position: relative; overflow: hidden; border-radius: 16px; padding: 16px 16px 14px;
    background: linear-gradient(140deg, var(--c1), var(--c2));
    box-shadow: 0 10px 30px -12px color-mix(in srgb, var(--c2) 70%, transparent), inset 0 1px 0 rgba(255,255,255,.12);
    transition: --c1 1.2s ease, --c2 1.2s ease, color .6s ease;
    color: #fff;
  }
  .hero.bright { color: #2a1d05; }
  .hero::after {
    content: ''; position: absolute; inset: 0; pointer-events: none;
    background: radial-gradient(120% 80% at 100% 0%, rgba(255,255,255,.22), transparent 55%);
  }
  .hero-top { display: flex; justify-content: space-between; align-items: center; }
  .orb { width: 44px; height: 44px; position: relative; }
  .orb svg { width: 100%; height: 100%; overflow: visible; }
  .orb .rays { transform-origin: 50% 50%; animation: spin 40s linear infinite; transition: opacity .8s; }
  .orb .moon, .orb .sun { transition: opacity .8s, transform .8s; transform-origin: 50% 50%; }
  .hero:not(.sunny) .rays, .hero:not(.sunny) .sun { opacity: 0; transform: scale(.6); }
  .hero.sunny .moon { opacity: 0; transform: scale(.6) rotate(-30deg); }
  @keyframes spin { to { transform: rotate(360deg); } }
  .pill {
    display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 600; letter-spacing: .02em;
    padding: 4px 10px; border-radius: 999px; background: rgba(255,255,255,.18); backdrop-filter: blur(6px);
  }
  .hero.bright .pill { background: rgba(0,0,0,.08); }
  .pill .dot { width: 7px; height: 7px; border-radius: 50%; background: #3fdc8c; box-shadow: 0 0 0 0 rgba(63,220,140,.7); animation: pulse 2s infinite; }
  .pill.sim .dot { background: #b78cff; box-shadow: 0 0 0 0 rgba(183,140,255,.7); }
  .pill.warn .dot, .pill.off .dot { background: #ff6b6b; animation: none; }
  .pill.idle .dot { background: #aaa; animation: none; }
  @keyframes pulse { 70% { box-shadow: 0 0 0 7px rgba(0,0,0,0); } 100% { box-shadow: 0 0 0 0 rgba(0,0,0,0); } }
  .lux { display: flex; align-items: baseline; gap: 6px; margin: 10px 0 2px; }
  .lux .num { font-size: 44px; font-weight: 700; letter-spacing: -.03em; line-height: 1; font-variant-numeric: tabular-nums; }
  .lux .unit { font-size: 14px; opacity: .75; font-weight: 600; }
  .sub { font-size: 12px; opacity: .85; display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
  .sub b { font-variant-numeric: tabular-nums; }
  .theme-name { font-weight: 700; }
  .note { margin-top: 8px; font-size: 11px; padding: 6px 8px; border-radius: 8px; background: rgba(0,0,0,.2); display: none; }
  .hero.bright .note { background: rgba(0,0,0,.07); }
  .note.show { display: block; }
  .hero-actions { display: flex; gap: 8px; margin-top: 12px; }
  .hbtn {
    border: none; border-radius: 9px; padding: 7px 12px; font-size: 12px; font-weight: 600; cursor: pointer;
    background: rgba(255,255,255,.92); color: #1a1a2e; display: inline-flex; align-items: center; gap: 6px;
    transition: transform .15s, box-shadow .15s;
  }
  .hbtn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,.2); }
  .hbtn.ghost { background: rgba(255,255,255,.14); color: inherit; }
  .hero.bright .hbtn { background: #2a1d05; color: #fff6d6; }
  .hero.bright .hbtn.ghost { background: rgba(0,0,0,.08); color: inherit; }

  /* ---------- Spectrum ---------- */
  .spectrum { position: relative; padding-top: 34px; margin: 18px 2px 4px; }
  .track {
    display: flex; height: 38px; border-radius: 10px; overflow: hidden;
    box-shadow: 0 0 0 1px var(--card-border), 0 6px 16px -10px rgba(0,0,0,.5);
  }
  .seg {
    position: relative; flex: 0 0 auto; min-width: 0; height: 100%;
    display: flex; align-items: center; justify-content: center;
    font-size: 10.5px; font-weight: 600; white-space: nowrap; overflow: hidden;
    transition: filter .3s, box-shadow .3s;
    cursor: default;
  }
  .seg + .seg { box-shadow: inset 1px 0 0 rgba(128,128,128,.35); }
  .seg::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 3px; background: var(--stripe); opacity: .9; }
  .seg .lbl { overflow: hidden; text-overflow: ellipsis; padding: 0 6px; }
  .seg.active { box-shadow: inset 0 0 0 2px var(--accent); filter: saturate(1.2); }
  .seg.active .lbl { font-weight: 800; }
  .needle { position: absolute; top: 26px; height: 10px; width: 2px; margin-left: -1px; background: var(--accent); border-radius: 2px; transition: left .7s cubic-bezier(.2,.8,.2,1); z-index: 2; box-shadow: 0 0 8px var(--accent); }
  .bubble {
    position: absolute; top: 0; transform: translateX(-50%); padding: 3px 8px; border-radius: 7px; font-size: 11px; font-weight: 700;
    background: var(--accent); color: var(--vscode-button-foreground, #fff); white-space: nowrap; transition: left .7s cubic-bezier(.2,.8,.2,1); z-index: 3;
    font-variant-numeric: tabular-nums;
  }
  .bubble::after { content: ''; position: absolute; left: 50%; bottom: -4px; margin-left: -4px; border: 4px solid transparent; border-bottom: 0; border-top-color: var(--accent); }
  .rawdot { position: absolute; bottom: -7px; width: 9px; height: 9px; margin-left: -4.5px; border-radius: 50%; background: var(--vscode-charts-blue, #3794ff); border: 2px solid var(--vscode-sideBar-background, #1e1e1e); transition: left .5s ease; z-index: 3; }
  .scale { position: relative; height: 16px; margin: 8px 2px 0; font-size: 10px; color: var(--muted); }
  .scale span { position: absolute; transform: translateX(-50%); }
  .scale span:first-child { transform: none; }
  .legend { display: flex; gap: 14px; font-size: 11px; color: var(--muted); margin: 6px 2px 0; }
  .legend i { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 5px; vertical-align: -1px; }
  .legend .l-smooth { background: var(--accent); }
  .legend .l-raw { background: var(--vscode-charts-blue, #3794ff); }

  /* ---------- Cards ---------- */
  .card { background: var(--card); border: 1px solid var(--card-border); border-radius: var(--radius); padding: 12px; margin-top: 14px; }
  .card-title { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700; margin-bottom: 10px; }
  .card-title .emoji { font-size: 14px; }
  .card-title .hint { margin-left: auto; font-weight: 400; font-size: 11px; color: var(--muted); }

  /* Switch */
  .switch { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin: 6px 0; cursor: pointer; font-size: 12px; }
  .switch input { display: none; }
  .switch .knob { flex: 0 0 auto; width: 32px; height: 18px; border-radius: 999px; background: color-mix(in srgb, var(--vscode-foreground) 25%, transparent); position: relative; transition: background .2s; }
  .switch .knob::after { content: ''; position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: #fff; transition: transform .2s cubic-bezier(.3,1.4,.6,1); box-shadow: 0 1px 3px rgba(0,0,0,.3); }
  .switch input:checked + .knob { background: var(--accent); }
  .switch input:checked + .knob::after { transform: translateX(14px); }

  /* Sliders */
  .slider { margin: 12px 0 4px; }
  .slider .head { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 6px; }
  .slider .val { font-weight: 700; font-variant-numeric: tabular-nums; padding: 1px 7px; border-radius: 6px; background: color-mix(in srgb, var(--accent) 18%, transparent); }
  .slider .help { font-size: 11px; color: var(--muted); margin-top: 3px; }
  input[type=range] { -webkit-appearance: none; appearance: none; width: 100%; height: 6px; border-radius: 999px; outline: none; margin: 0;
    background: linear-gradient(90deg, var(--accent) var(--fill, 50%), color-mix(in srgb, var(--vscode-foreground) 18%, transparent) var(--fill, 50%)); }
  input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; border-radius: 50%; background: #fff; border: 3px solid var(--accent); box-shadow: 0 2px 6px rgba(0,0,0,.35); cursor: pointer; transition: transform .15s; }
  input[type=range]::-webkit-slider-thumb:hover { transform: scale(1.15); }
  input.sky { height: 10px; background: linear-gradient(90deg, var(--night), var(--dusk) 35%, var(--sunset) 55%, var(--day) 75%, var(--noon)); }
  input.sky::-webkit-slider-thumb { width: 20px; height: 20px; border-color: #fff; background: var(--thumb, #fff); }

  .presets { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 10px; }
  .chip {
    border: 1px solid var(--card-border); background: var(--card); color: inherit; border-radius: 999px; padding: 4px 10px;
    font-size: 11.5px; cursor: pointer; transition: transform .15s, background .15s, border-color .15s;
  }
  .chip:hover { transform: translateY(-1px); border-color: var(--accent); }
  .chip.on { background: var(--accent); color: var(--vscode-button-foreground, #fff); border-color: var(--accent); }
  .sim-body { transition: opacity .3s; }
  .sim-body.disabled { opacity: .45; }

  /* Ladder */
  .steps { display: flex; flex-direction: column; gap: 10px; }
  .step { border-radius: 10px; overflow: hidden; border: 1px solid var(--card-border); background: var(--vscode-sideBar-background, transparent); transition: box-shadow .3s, transform .3s, border-color .3s; }
  .step.active { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent), 0 8px 22px -10px var(--accent); transform: translateY(-1px); }
  .preview { position: relative; padding: 9px 10px 9px 12px; font-family: var(--vscode-editor-font-family, monospace); font-size: 11.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .preview::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--stripe); }
  .preview .badge { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); font-family: var(--vscode-font-family); font-size: 9.5px; font-weight: 800; letter-spacing: .08em; padding: 2px 6px; border-radius: 5px; background: var(--accent); color: var(--vscode-button-foreground, #fff); display: none; }
  .step.active .preview .badge { display: block; }
  .step.active .preview { padding-right: 52px; }
  .step-body { padding: 8px 10px 10px; display: flex; flex-direction: column; gap: 8px; }
  .row { display: flex; align-items: center; gap: 6px; min-width: 0; }
  .idx { flex: 0 0 auto; width: 20px; height: 20px; border-radius: 6px; display: grid; place-items: center; font-size: 10.5px; font-weight: 800; background: color-mix(in srgb, var(--vscode-foreground) 10%, transparent); }
  select, input[type=number] {
    background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border, var(--card-border));
    padding: 4px 6px; font-family: inherit; font-size: 12px; border-radius: 6px; outline: none; min-width: 0;
  }
  select:focus, input[type=number]:focus { border-color: var(--accent); }
  .row select { flex: 1; }
  .mode { flex: 0 0 auto; font-size: 10.5px; font-weight: 700; padding: 3px 7px; border-radius: 999px; border: none; color: inherit; }
  .mode.dark { background: #1d2340; color: #c9d1ff; }
  .mode.light { background: #fff1c2; color: #6b4a00; }
  .mode.clickable { cursor: pointer; }
  .range { font-size: 11.5px; color: var(--muted); display: flex; align-items: center; gap: 5px; flex: 1; min-width: 0; white-space: nowrap; }
  .range input[type=number] { width: 64px; }
  .inf { font-size: 11px; display: inline-flex; align-items: center; gap: 3px; cursor: pointer; }
  .icons { display: flex; gap: 2px; margin-left: auto; }
  .ibtn { border: none; background: transparent; color: var(--vscode-foreground); width: 26px; height: 26px; border-radius: 7px; display: grid; place-items: center; cursor: pointer; opacity: .75; transition: background .15s, opacity .15s; }
  .ibtn:hover { background: var(--vscode-toolbar-hoverBackground, rgba(128,128,128,.2)); opacity: 1; }
  .ibtn:disabled { opacity: .25; cursor: default; }
  .ibtn svg { width: 15px; height: 15px; }
  .add { width: 100%; margin-top: 10px; border: 1.5px dashed var(--card-border); background: transparent; color: var(--muted); border-radius: 10px; padding: 8px; cursor: pointer; font-size: 12px; font-weight: 600; transition: border-color .15s, color .15s; }
  .add:hover { border-color: var(--accent); color: var(--vscode-foreground); }

  .btns { display: flex; gap: 8px; margin-top: 10px; }
  .btn { flex: 1; border: none; border-radius: 9px; padding: 8px; font-size: 12px; font-weight: 600; cursor: pointer; transition: transform .15s, filter .15s; }
  .btn:hover { transform: translateY(-1px); filter: brightness(1.08); }
  .btn.night { background: linear-gradient(135deg, #0b1026, #2b2f6b); color: #dfe4ff; }
  .btn.day { background: linear-gradient(135deg, #ffd36e, #fff1b8); color: #4a3200; }
  .result { font-size: 11.5px; margin-top: 8px; color: var(--muted); min-height: 1em; }
  .links { font-size: 11.5px; margin-top: 10px; display: flex; gap: 12px; }
  .links a { color: var(--vscode-textLink-foreground); cursor: pointer; text-decoration: none; }
  .links a:hover { text-decoration: underline; }
</style>
</head>
<body>
  <section class="hero" id="hero">
    <div class="hero-top">
      <div class="orb">
        <svg viewBox="0 0 44 44" fill="none">
          <g class="rays" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" opacity=".85">
            <path d="M22 2v5M22 37v5M2 22h5M37 22h5M7.9 7.9l3.5 3.5M32.6 32.6l3.5 3.5M7.9 36.1l3.5-3.5M32.6 11.4l3.5-3.5"/>
          </g>
          <circle class="sun" cx="22" cy="22" r="9" fill="currentColor"/>
          <path class="moon" d="M28.5 29.5A11 11 0 0 1 17 11a11 11 0 1 0 14.6 14.6 11 11 0 0 1-3.1 3.9z" fill="currentColor"/>
        </svg>
      </div>
      <span class="pill" id="mode"><span class="dot"></span><span id="modeText">Starting…</span></span>
    </div>
    <div class="lux"><span class="num" id="smoothed">—</span><span class="unit">lux</span></div>
    <div class="sub"><span>sensor <b id="raw">—</b></span><span>·</span><span class="theme-name" id="theme"></span></div>
    <div class="note" id="note">You picked this theme by hand. It's held until the light moves to another step.</div>
    <div class="hero-actions">
      <button class="hbtn" id="applyNow" title="Skip the dwell delay and any manual pick">⚡ Apply now</button>
      <button class="hbtn ghost" id="toggle">Disable</button>
    </div>
  </section>

  <div class="spectrum" id="spectrum">
    <div class="bubble" id="bubble">—</div>
    <div class="needle" id="needle"></div>
    <div class="track" id="track"></div>
    <div class="rawdot" id="rawdot"></div>
  </div>
  <div class="scale" id="scale"></div>
  <div class="legend"><span><i class="l-smooth"></i>smoothed</span><span><i class="l-raw"></i>sensor</span></div>

  <section class="card">
    <div class="card-title"><span class="emoji">🧪</span>Simulate light<span class="hint">test without covering the sensor</span></div>
    <label class="switch"><span>Use a fake light level</span><input type="checkbox" id="simOn"><span class="knob"></span></label>
    <div class="sim-body" id="simBody">
      <div class="slider">
        <div class="head"><span>Light level</span><span class="val" id="simVal">200 lx</span></div>
        <input type="range" class="sky" id="simLux" min="0" max="1000" step="1">
      </div>
      <div class="presets" id="presets"></div>
      <label class="switch"><span>Switch instantly (skip dwell)</span><input type="checkbox" id="simInstant"><span class="knob"></span></label>
    </div>
  </section>

  <section class="card">
    <div class="card-title"><span class="emoji">🎨</span>Theme ladder<span class="hint">darkest room → brightest</span></div>
    <div class="steps" id="ladder"></div>
    <button class="add" id="addStep">＋ Add step</button>
  </section>

  <section class="card">
    <div class="card-title"><span class="emoji">🎚️</span>Tuning</div>
    <div class="slider"><div class="head"><span>Dwell before switching</span><span class="val" id="dwellSecondsVal"></span></div><input type="range" id="dwellSeconds" min="0" max="120" step="1"><div class="help">How long a new light level must last before the theme changes.</div></div>
    <div class="slider"><div class="head"><span>Hysteresis margin</span><span class="val" id="hysteresisVal"></span></div><input type="range" id="hysteresis" min="0" max="0.6" step="0.01"><div class="help">How far past a threshold the light must go. Stops flicker near a boundary.</div></div>
    <div class="slider"><div class="head"><span>Smoothing</span><span class="val" id="smoothingVal"></span></div><input type="range" id="smoothing" min="0.05" max="1" step="0.05"><div class="help">Lower is steadier but slower to react.</div></div>
    <div class="slider"><div class="head"><span>Sensor poll interval</span><span class="val" id="pollIntervalMsVal"></span></div><input type="range" id="pollIntervalMs" min="250" max="5000" step="250"></div>
    <label class="switch"><span>Pause while the window isn't focused</span><input type="checkbox" id="pauseWhenUnfocused"><span class="knob"></span></label>
  </section>

  <section class="card">
    <div class="card-title"><span class="emoji">🖥️</span>macOS appearance</div>
    <label class="switch"><span>Switch macOS Dark Mode too</span><input type="checkbox" id="controlMacAppearance"><span class="knob"></span></label>
    <div class="btns">
      <button class="btn night" id="macDark">🌙 Test Dark</button>
      <button class="btn day" id="macLight">☀️ Test Light</button>
    </div>
    <div class="result" id="macResult"></div>
    <div class="links"><a id="openAutomation">Automation privacy settings ↗</a><a id="openSettings">All settings ↗</a></div>
  </section>

<script nonce="${n}">
  const vscode = acquireVsCodeApi();
  const $ = (id) => document.getElementById(id);
  const MAX_LOG = 4.3; // slider/bar top ≈ 20,000 lx
  const toLux = (p) => Math.round(Math.pow(10, p / 1000 * MAX_LOG) - 1);
  const toPos = (lux) => Math.round(Math.log10(lux + 1) / MAX_LOG * 1000);
  const pct = (lux) => Math.min(100, Math.max(0, Math.log10(Math.max(0, lux) + 1) / MAX_LOG * 100));
  const fmt = (lux) => lux === undefined || lux === null ? '—' : lux >= 10000 ? Math.round(lux / 1000) + 'k' : lux >= 1000 ? (lux / 1000).toFixed(1) + 'k' : String(Math.round(lux));
  const short = (label) => label.replace(/^Default /, '');
  const send = (msg) => vscode.postMessage(msg);
  const setting = (key, value) => send({ type: 'setting', key, value });

  let state = null;
  let themes = new Map();
  let segKey = '';
  let ladderKey = '';

  // ---------- Sky colours for the hero ----------
  const SKY = [
    [0.00, '#070b1f', '#1b2556'],
    [0.30, '#1b1745', '#4b2a86'],
    [0.48, '#6d3fa0', '#ff8a5c'],
    [0.62, '#ff9f5c', '#ffd36e'],
    [0.80, '#ffd36e', '#fff1b8'],
    [1.00, '#fff6d6', '#ffffff'],
  ];
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, t) => 'rgb(' + hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * t)).join(',') + ')';
  function sky(t) {
    for (let i = 1; i < SKY.length; i++) {
      if (t <= SKY[i][0]) {
        const [t0, a1, a2] = SKY[i - 1], [t1, b1, b2] = SKY[i];
        const k = (t - t0) / (t1 - t0);
        return [mix(a1, b1, k), mix(a2, b2, k)];
      }
    }
    return [SKY[SKY.length - 1][1], SKY[SKY.length - 1][2]];
  }

  // ---------- Animated number ----------
  let shown = null, anim = 0;
  function tweenNumber(target) {
    const el = $('smoothed');
    if (target === undefined || target === null) { el.textContent = '—'; shown = null; return; }
    const from = shown ?? target;
    const t0 = performance.now();
    cancelAnimationFrame(anim);
    const step = (now) => {
      const k = Math.min(1, (now - t0) / 500);
      const v = from + (target - from) * (1 - Math.pow(1 - k, 3));
      el.textContent = fmt(v);
      if (k < 1) anim = requestAnimationFrame(step); else shown = target;
    };
    anim = requestAnimationFrame(step);
  }

  // ---------- Icons ----------
  const ICONS = {
    eye: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M1 8s2.6-5 7-5 7 5 7 5-2.6 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2.2"/></svg>',
    target: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="8" r="6"/><circle cx="8" cy="8" r="2.5"/><path d="M8 0v3M8 13v3M0 8h3M13 8h3"/></svg>',
    trash: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M2.5 4h11M6 4V2.5h4V4M4 4l.7 9.5h6.6L12 4"/></svg>',
  };
  function iconButton(icon, title, onClick) {
    const b = document.createElement('button');
    b.className = 'ibtn'; b.title = title; b.innerHTML = ICONS[icon];
    b.addEventListener('click', onClick);
    return b;
  }

  // ---------- Static controls ----------
  const SLIDERS = {
    dwellSeconds: (v) => v + ' s',
    hysteresis: (v) => Math.round(v * 100) + '%',
    smoothing: (v) => (+v).toFixed(2),
    pollIntervalMs: (v) => (v / 1000).toFixed(2) + ' s',
  };
  const fill = (el) => el.style.setProperty('--fill', ((el.value - el.min) / (el.max - el.min) * 100) + '%');
  for (const [key, label] of Object.entries(SLIDERS)) {
    const el = $(key);
    el.addEventListener('input', () => { $(key + 'Val').textContent = label(el.value); fill(el); });
    el.addEventListener('change', () => setting(key, Number(el.value)));
  }
  for (const key of ['pauseWhenUnfocused', 'controlMacAppearance']) {
    $(key).addEventListener('change', () => setting(key, $(key).checked));
  }

  const PRESETS = [['🌙 Night', 3], ['🕯️ Dim', 40], ['🏠 Indoor', 250], ['🏢 Office', 700], ['⛅ Overcast', 3000], ['☀️ Sun', 15000]];
  for (const [label, lux] of PRESETS) {
    const c = document.createElement('button');
    c.className = 'chip'; c.textContent = label; c.dataset.lux = lux;
    c.addEventListener('click', () => { $('simOn').checked = true; setSimSlider(lux); simulate(); });
    $('presets').appendChild(c);
  }
  function setSimSlider(lux) {
    $('simLux').value = toPos(lux);
    $('simVal').textContent = fmt(lux) + ' lx';
    $('simLux').style.setProperty('--thumb', sky(pct(lux) / 100)[1]);
    document.querySelectorAll('#presets .chip').forEach((c) => c.classList.toggle('on', state?.simulating && +c.dataset.lux === lux));
  }
  function simulate() {
    send({ type: 'simulate', on: $('simOn').checked, lux: toLux(+$('simLux').value), instant: $('simInstant').checked });
  }
  $('simOn').addEventListener('change', simulate);
  $('simInstant').addEventListener('change', simulate);
  $('simLux').addEventListener('input', () => {
    setSimSlider(toLux(+$('simLux').value));
    if (!$('simOn').checked) $('simOn').checked = true;
    simulate();
  });

  $('applyNow').addEventListener('click', () => send({ type: 'applyNow' }));
  $('toggle').addEventListener('click', () => setting('enabled', !state.settings.enabled));
  $('macDark').addEventListener('click', () => { $('macResult').textContent = 'Switching…'; send({ type: 'testMac', dark: true }); });
  $('macLight').addEventListener('click', () => { $('macResult').textContent = 'Switching…'; send({ type: 'testMac', dark: false }); });
  $('openAutomation').addEventListener('click', () => send({ type: 'openAutomation' }));
  $('openSettings').addEventListener('click', () => send({ type: 'openSettings' }));
  $('addStep').addEventListener('click', () => {
    const ladder = state.ladder.map((s) => ({ ...s }));
    const bounded = ladder.filter((s) => s.maxLux !== null);
    const top = bounded.length ? bounded[bounded.length - 1].maxLux : 100;
    const t = [...themes.values()].find((t) => !t.dark && !ladder.some((s) => s.theme === t.id)) ?? [...themes.values()][0];
    ladder.splice(Math.max(0, ladder.length - 1), 0, { maxLux: Math.round(top * 2), theme: t?.id ?? 'Default Light Modern', dark: t?.dark ?? false });
    send({ type: 'ladder', ladder });
  });

  // ---------- Spectrum ----------
  function palette(id, dark) {
    return themes.get(id)?.palette ?? (dark
      ? { background: '#1e1e1e', foreground: '#d4d4d4', accent: '#3794ff', keyword: '#569cd6', string: '#ce9178', comment: '#6a9955' }
      : { background: '#ffffff', foreground: '#1f1f1f', accent: '#005fb8', keyword: '#0000ff', string: '#a31515', comment: '#008000' });
  }
  function label(id) { return short(themes.get(id)?.label ?? id); }

  function buildSegments() {
    const key = JSON.stringify([state.ladder, themes.size]);
    if (key === segKey) return;
    segKey = key;
    const track = $('track');
    track.innerHTML = '';
    let prev = 0;
    state.ladder.forEach((s, i) => {
      const end = s.maxLux === null ? Math.pow(10, MAX_LOG) : s.maxLux;
      const width = Math.max(0, pct(end) - pct(prev));
      const p = palette(s.theme, s.dark);
      const seg = document.createElement('div');
      seg.className = 'seg';
      seg.style.flexBasis = width + '%';
      seg.style.background = p.background;
      seg.style.color = p.foreground;
      seg.style.setProperty('--stripe', p.keyword);
      seg.title = (i + 1) + '. ' + label(s.theme) + ' · ' + fmt(prev) + '–' + (s.maxLux === null ? '∞' : fmt(s.maxLux)) + ' lx';
      if (width >= 4) {
        const l = document.createElement('span');
        l.className = 'lbl';
        l.textContent = width >= 16 ? label(s.theme) : String(i + 1);
        seg.appendChild(l);
      }
      track.appendChild(seg);
      prev = end;
    });

    const scale = $('scale');
    if (!scale.childElementCount) {
      for (const v of [0, 10, 100, 1000, 10000]) {
        const t = document.createElement('span');
        t.style.left = pct(v) + '%'; t.textContent = fmt(v);
        scale.appendChild(t);
      }
    }
  }

  function updateSpectrum() {
    buildSegments();
    [...$('track').children].forEach((seg, i) => seg.classList.toggle('active', i === state.band));
    const smooth = state.smoothedLux;
    const raw = state.simulating ? state.simLux : state.rawLux;
    const show = (el, v) => { el.style.display = v === undefined || v === null ? 'none' : ''; };
    show($('needle'), smooth); show($('bubble'), smooth); show($('rawdot'), raw);
    if (smooth !== undefined && smooth !== null) {
      $('needle').style.left = pct(smooth) + '%';
      // Keep the bubble inside the panel near the ends.
      const w = $('spectrum').clientWidth || 1;
      const half = ($('bubble').offsetWidth / 2 + 2) / w * 100;
      $('bubble').style.left = Math.min(100 - half, Math.max(half, pct(smooth))) + '%';
      $('bubble').textContent = fmt(smooth) + ' lx';
    }
    if (raw !== undefined && raw !== null) $('rawdot').style.left = pct(raw) + '%';
  }

  // ---------- Ladder cards ----------
  function renderLadder() {
    const key = JSON.stringify([state.ladder, themes.size]);
    const host = $('ladder');
    if (key === ladderKey || host.contains(document.activeElement)) return;
    ladderKey = key;
    host.innerHTML = '';
    const sorted = [...themes.values()];
    state.ladder.forEach((step, i) => {
      const lower = i === 0 ? 0 : state.ladder[i - 1].maxLux;
      const known = themes.has(step.theme);
      const p = palette(step.theme, step.dark);

      const card = document.createElement('div');
      card.className = 'step';
      card.dataset.index = i;
      card.dataset.theme = step.theme;
      card.dataset.dark = step.dark;

      const pv = document.createElement('div');
      pv.className = 'preview';
      pv.style.background = p.background;
      pv.style.color = p.foreground;
      pv.style.setProperty('--stripe', p.accent);
      const span = (text, color) => { const s = document.createElement('span'); s.textContent = text; if (color) s.style.color = color; return s; };
      pv.append(span('const ', p.keyword), span('lux = '), span(fmt(lower) + '–' + (step.maxLux === null ? '∞' : fmt(step.maxLux)), p.string), span(';  '), span('// ' + label(step.theme), p.comment));
      const badge = document.createElement('span'); badge.className = 'badge'; badge.textContent = 'NOW';
      pv.appendChild(badge);

      const body = document.createElement('div');
      body.className = 'step-body';

      const r1 = document.createElement('div');
      r1.className = 'row';
      const idx = document.createElement('span'); idx.className = 'idx'; idx.textContent = i + 1;
      const sel = document.createElement('select');
      for (const t of known ? sorted : [{ id: step.theme, label: step.theme + ' (not installed)' }, ...sorted]) {
        const o = document.createElement('option');
        o.value = t.id; o.textContent = short(t.label); o.selected = t.id === step.theme;
        sel.appendChild(o);
      }
      sel.addEventListener('change', () => {
        card.dataset.theme = sel.value;
        const t = themes.get(sel.value);
        if (t) card.dataset.dark = t.dark;
        saveLadderFromDom();
      });
      const mode = document.createElement('button');
      mode.className = 'mode ' + (step.dark ? 'dark' : 'light') + (known ? '' : ' clickable');
      mode.textContent = step.dark ? '☾ Dark' : '☀ Light';
      mode.title = known ? 'Set by the theme' : 'Theme not installed. Click to toggle.';
      if (!known) mode.addEventListener('click', () => { card.dataset.dark = card.dataset.dark !== 'true'; saveLadderFromDom(); });
      r1.append(idx, sel, mode);

      const r2 = document.createElement('div');
      r2.className = 'row';
      const range = document.createElement('div');
      range.className = 'range';
      range.append(span(fmt(lower) + ' –'));
      const max = document.createElement('input');
      max.type = 'number'; max.min = '0'; max.step = '1'; max.className = 'max';
      max.value = step.maxLux ?? ''; max.disabled = step.maxLux === null;
      max.addEventListener('change', saveLadderFromDom);
      const inf = document.createElement('label');
      inf.className = 'inf';
      const unb = document.createElement('input');
      unb.type = 'checkbox'; unb.className = 'unbounded'; unb.checked = step.maxLux === null;
      unb.addEventListener('change', () => { max.disabled = unb.checked; if (!unb.checked && !max.value) max.value = Math.round((lower || 100) * 2); saveLadderFromDom(); });
      inf.append(unb, span('∞'));
      range.append(max, span('lx'), inf);

      const icons = document.createElement('div');
      icons.className = 'icons';
      const del = iconButton('trash', 'Remove step', () => { card.remove(); saveLadderFromDom(); });
      del.disabled = state.ladder.length <= 1;
      icons.append(
        iconButton('eye', 'Preview this theme', () => send({ type: 'preview', theme: sel.value })),
        iconButton('target', 'Use this step at the current light level', () => send({ type: 'calibrate', index: i })),
        del,
      );
      r2.append(range, icons);

      body.append(r1, r2);
      card.append(pv, body);
      host.appendChild(card);
    });
  }

  function saveLadderFromDom() {
    const ladder = [...document.querySelectorAll('.step')].map((card) => ({
      theme: card.dataset.theme,
      dark: themes.get(card.dataset.theme)?.dark ?? card.dataset.dark === 'true',
      maxLux: card.querySelector('.unbounded').checked ? null : Math.max(0, Number(card.querySelector('.max').value) || 0),
    }));
    send({ type: 'ladder', ladder });
  }

  // ---------- Render ----------
  function render() {
    const s = state;
    const lux = s.simulating ? s.simLux : s.smoothedLux ?? s.rawLux;
    const t = lux === undefined || lux === null ? 0.2 : pct(lux) / 100;
    const [c1, c2] = sky(t);
    const hero = $('hero');
    hero.style.setProperty('--c1', c1);
    hero.style.setProperty('--c2', c2);
    hero.classList.toggle('bright', t > 0.6);
    hero.classList.toggle('sunny', t > 0.45);

    tweenNumber(s.smoothedLux);
    $('raw').textContent = fmt(s.simulating ? s.simLux : s.rawLux) + (s.simulating ? ' (sim)' : '');
    $('theme').textContent = s.currentTheme ? short(themes.get(s.currentTheme)?.label ?? s.currentTheme) : '';
    $('note').classList.toggle('show', s.manualOverride);

    const MODES = { running: 'Following sensor', idle: 'Waiting for focus', paused: 'Paused', off: 'Disabled', error: 'Sensor error' };
    const pill = $('mode');
    const simulating = s.simulating && s.mode !== 'off';
    pill.className = 'pill ' + (simulating ? 'sim' : s.mode === 'error' ? 'warn' : s.mode);
    $('modeText').textContent = simulating ? 'Simulating' : MODES[s.mode] + (s.fatal ? ': ' + s.fatal : '');
    $('toggle').textContent = s.settings.enabled ? 'Disable' : 'Enable';

    $('simOn').checked = s.simulating;
    $('simInstant').checked = s.simInstant;
    $('simBody').classList.toggle('disabled', !s.simulating);
    if (document.activeElement !== $('simLux')) setSimSlider(s.simLux);

    for (const [key, label] of Object.entries(SLIDERS)) {
      const el = $(key);
      if (document.activeElement === el) continue;
      el.value = s.settings[key];
      $(key + 'Val').textContent = label(s.settings[key]);
      fill(el);
    }
    $('pauseWhenUnfocused').checked = s.settings.pauseWhenUnfocused;
    $('controlMacAppearance').checked = s.settings.controlMacAppearance;

    updateSpectrum();
    renderLadder();
    document.querySelectorAll('.step').forEach((c) => c.classList.toggle('active', +c.dataset.index === s.band));
  }

  window.addEventListener('message', (e) => {
    const msg = e.data;
    if (msg.type === 'themes') { themes = new Map(msg.themes.map((t) => [t.id, t])); segKey = ladderKey = ''; if (state) render(); }
    if (msg.type === 'state') { state = msg.state; render(); }
    if (msg.type === 'macResult') $('macResult').textContent = msg.text;
  });
  window.addEventListener('resize', () => state && updateSpectrum());
  send({ type: 'ready' });
</script>
</body>
</html>`;
}
