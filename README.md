# Ambient Theme

Switches the VS Code color theme, and optionally macOS Dark Mode, based on the MacBook's ambient light sensor.

A small Swift helper (`bin/als-reader`) reads lux from the sensor and streams readings to the extension. The extension smooths them and picks a step from a configurable **theme ladder**, ordered from darkest to brightest environment.

## Build & install

```sh
npm install
npm run package           # builds the Swift helper, compiles TS, creates the .vsix
code --install-extension ambient-theme-0.0.2.vsix
```

Press F5 in this folder to run it in an Extension Development Host.

## Settings

| Setting | Default | |
|---|---|---|
| `ambientTheme.enabled` | `true` | |
| `ambientTheme.ladder` | 5 steps, Dark Modern → HC Light | `{ maxLux, theme, dark }`. The step is used while smoothed lux is below `maxLux` (`null` = no upper bound) |
| `ambientTheme.controlMacAppearance` | `true` | Flips macOS Dark Mode when crossing between dark and light steps (asks for Automation permission once) |
| `ambientTheme.dwellSeconds` | `20` | How long a new level must persist before switching |
| `ambientTheme.hysteresis` | `0.15` | How far past a threshold the light must go before switching |
| `ambientTheme.pollIntervalMs` | `1000` | |
| `ambientTheme.pauseWhenUnfocused` | `true` | |

## Control panel

Click the Ambient Theme icon in the activity bar, or run **Ambient Theme: Open Control Panel**, for:

- live sensor and smoothed lux on a log-scale bar showing each ladder step
- a light simulator: a fake lux slider, with an option to switch instantly instead of waiting for the dwell delay
- a ladder editor: pick a theme per step from the installed themes, set thresholds, preview a theme, or assign a step to the current light level
- sliders for dwell, hysteresis, smoothing and poll interval (saved to settings as you change them)
- macOS Dark/Light test buttons, which also trigger the Automation permission prompt

## Commands

- **Ambient Theme: Calibrate**: shows the current lux and lets you pick the theme you want at this level. The ladder thresholds are adjusted to match.
- **Ambient Theme: Pause for 1 Hour**
- **Ambient Theme: Toggle** (also available by clicking the status bar item)

If you pick a theme by hand, the extension leaves it alone until the light level moves to a different step.

Requires macOS on a MacBook with an ambient light sensor. The helper uses private IOKit HID APIs, which Apple could change in a future macOS release.
