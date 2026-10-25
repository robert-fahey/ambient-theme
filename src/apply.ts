import { execFile } from 'child_process';
import * as vscode from 'vscode';

export function currentTheme(): string | undefined {
  return vscode.workspace.getConfiguration('workbench').get<string>('colorTheme');
}

export async function setTheme(theme: string): Promise<boolean> {
  if (currentTheme() === theme) return false;
  await vscode.workspace.getConfiguration('workbench').update('colorTheme', theme, vscode.ConfigurationTarget.Global);
  return true;
}

export class MacAppearanceError extends Error {
  constructor(message: string, readonly permissionDenied: boolean) {
    super(message);
  }
}

export function setMacDarkMode(dark: boolean): Promise<void> {
  const script = `tell application "System Events" to tell appearance preferences to set dark mode to ${dark}`;
  return new Promise((resolve, reject) => {
    execFile('osascript', ['-e', script], { timeout: 30000 }, (err, _stdout, stderr) => {
      if (!err) return resolve();
      // -1743: the user denied Automation access to System Events.
      reject(new MacAppearanceError(stderr || err.message, /-1743|not authori[sz]ed/i.test(stderr)));
    });
  });
}
