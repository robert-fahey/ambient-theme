import { promises as fs } from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export interface ThemePalette {
  background: string;
  foreground: string;
  accent: string;
  keyword: string;
  string: string;
  comment: string;
}

export interface ThemeInfo {
  /** Value `workbench.colorTheme` expects. */
  id: string;
  label: string;
  dark: boolean;
  palette?: ThemePalette;
}

interface Contribution {
  info: ThemeInfo;
  file: string;
}

let cache: Map<string, Contribution> | undefined;
vscode.extensions.onDidChange(() => {
  cache = undefined;
});

function contributions(): Map<string, Contribution> {
  if (cache) return cache;
  const out = new Map<string, Contribution>();
  for (const ext of vscode.extensions.all) {
    const themes = ext.packageJSON?.contributes?.themes;
    if (!Array.isArray(themes)) continue;
    for (const t of themes) {
      const id = t.id ?? t.label;
      if (typeof id !== 'string' || out.has(id) || typeof t.path !== 'string') continue;
      out.set(id, {
        info: { id, label: t.label ?? id, dark: t.uiTheme === 'vs-dark' || t.uiTheme === 'hc-black' },
        file: path.join(ext.extensionPath, t.path),
      });
    }
  }
  cache = out;
  return out;
}

/** Whether a theme is dark according to its own manifest, or undefined if it isn't installed. */
export function isDarkTheme(id: string): boolean | undefined {
  return contributions().get(id)?.info.dark;
}

/** Strips comments and trailing commas so theme files (JSONC) can go through JSON.parse. */
function stripJsonc(text: string): string {
  let out = '';
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      out += c;
      if (c === '\\') out += text[++i] ?? '';
      else if (c === '"') inString = false;
    } else if (c === '"') {
      inString = true;
      out += c;
    } else if (c === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      out += '\n';
    } else if (c === '/' && text[i + 1] === '*') {
      i = text.indexOf('*/', i + 2);
      if (i === -1) break;
      i++;
    } else {
      out += c;
    }
  }
  return out.replace(/,(\s*[}\]])/g, '$1');
}

interface ThemeFile {
  colors: Record<string, string>;
  tokenColors: { scope?: string | string[]; settings?: { foreground?: string } }[];
}

async function loadThemeFile(file: string, depth = 0): Promise<ThemeFile> {
  const result: ThemeFile = { colors: {}, tokenColors: [] };
  if (depth > 5) return result;
  let json: any;
  try {
    json = JSON.parse(stripJsonc(await fs.readFile(file, 'utf8')));
  } catch {
    return result;
  }
  if (typeof json.include === 'string') {
    const base = await loadThemeFile(path.join(path.dirname(file), json.include), depth + 1);
    Object.assign(result.colors, base.colors);
    result.tokenColors.push(...base.tokenColors);
  }
  if (json.colors && typeof json.colors === 'object') Object.assign(result.colors, json.colors);
  if (Array.isArray(json.tokenColors)) result.tokenColors.push(...json.tokenColors);
  return result;
}

function tokenColor(file: ThemeFile, scope: string): string | undefined {
  let loose: string | undefined;
  for (const entry of file.tokenColors) {
    const fg = entry.settings?.foreground;
    if (!fg || !entry.scope) continue;
    const scopes = Array.isArray(entry.scope) ? entry.scope : entry.scope.split(',').map((s) => s.trim());
    if (scopes.includes(scope)) return fg;
    if (!loose && scopes.some((s) => s.startsWith(scope + '.'))) loose = fg;
  }
  return loose;
}

const paletteCache = new Map<string, ThemePalette>();

async function palette(c: Contribution): Promise<ThemePalette> {
  const cached = paletteCache.get(c.file);
  if (cached) return cached;
  const file = await loadThemeFile(c.file);
  const dark = c.info.dark;
  const background = file.colors['editor.background'] ?? (dark ? '#1e1e1e' : '#ffffff');
  const foreground = file.colors['editor.foreground'] ?? file.colors['foreground'] ?? (dark ? '#d4d4d4' : '#000000');
  const p: ThemePalette = {
    background,
    foreground,
    accent: file.colors['focusBorder'] ?? file.colors['button.background'] ?? (dark ? '#0078d4' : '#005fb8'),
    keyword: tokenColor(file, 'keyword') ?? tokenColor(file, 'storage') ?? foreground,
    string: tokenColor(file, 'string') ?? foreground,
    comment: tokenColor(file, 'comment') ?? foreground,
  };
  paletteCache.set(c.file, p);
  return p;
}

/** Every installed color theme, with a small palette for previews. */
export async function installedThemes(): Promise<ThemeInfo[]> {
  const all = [...contributions().values()];
  const infos = await Promise.all(all.map(async (c) => ({ ...c.info, palette: await palette(c) })));
  return infos.sort((a, b) => a.label.localeCompare(b.label));
}
