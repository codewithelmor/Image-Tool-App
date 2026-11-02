import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

let win: BrowserWindow | null = null;
/** True while an image is being processed (only one at a time). */
let busy = false;

const PROBE_TIMEOUT_MS = 30_000;
const PROCESS_TIMEOUT_MS = 120_000;
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'tif', 'tiff', 'gif'];

// ---- locating the Python backend -------------------------------------------

function backendCommand(args: string[]): { cmd: string; args: string[] } {
  const isWindows = process.platform === 'win32';
  if (app.isPackaged) {
    const exe = isWindows ? 'backend.exe' : 'backend';
    return { cmd: path.join(process.resourcesPath, 'backend', exe), args };
  }
  // out/main.js -> app/out -> repo root
  const script = path.join(__dirname, '..', '..', 'backend', 'backend.py');
  const python = process.env.PYTHON || (isWindows ? 'python' : 'python3');
  return { cmd: python, args: ['-X', 'utf8', '-u', script, ...args] };
}

interface RunOptions {
  timeoutMs?: number;
}

// Runs one backend command and resolves with the last JSON event it printed.
function runBackend(args: string[], opts: RunOptions = {}): Promise<BackendEvent> {
  return new Promise((resolve) => {
    const { cmd, args: fullArgs } = backendCommand(args);
    const proc = spawn(cmd, fullArgs, {
      windowsHide: true,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    });

    let last: BackendEvent | null = null;
    let buffer = '';
    let stderr = '';
    let settled = false;
    let timer: NodeJS.Timeout | undefined;
    const finish = (ev: BackendEvent): void => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve(ev);
    };
    if (opts.timeoutMs) {
      timer = setTimeout(() => {
        proc.kill();
        finish({ event: 'error', message: 'The backend took too long to respond.' });
      }, opts.timeoutMs);
    }

    const parseLine = (raw: string): void => {
      const line = raw.trim();
      if (!line) return;
      try {
        last = JSON.parse(line) as BackendEvent;
      } catch {
        /* ignore non-JSON noise */
      }
    };

    proc.stdout.setEncoding('utf8');
    proc.stdout.on('data', (chunk: string) => {
      buffer += chunk;
      let nl: number;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        parseLine(buffer.slice(0, nl));
        buffer = buffer.slice(nl + 1);
      }
    });
    proc.stderr.on('data', (d) => { stderr += d; });
    proc.on('error', (err) => finish({ event: 'error', message: `Could not start the backend: ${err.message}` }));
    proc.on('close', () => {
      parseLine(buffer);
      finish(last ?? { event: 'error', message: stderr.trim() || 'The backend did not respond.' });
    });
  });
}

function unexpected(ev: BackendEvent): { error: string } {
  return { error: ev.event === 'error' ? ev.message : 'Unexpected backend response.' };
}

// ---- settings --------------------------------------------------------------

const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');

function loadSettings(): Partial<Settings> {
  try {
    return JSON.parse(fs.readFileSync(settingsFile(), 'utf8'));
  } catch {
    return {};
  }
}

// ---- IPC ---------------------------------------------------------------------

ipcMain.handle('settings:get', (): Settings => ({
  folder: app.getPath('pictures'),
  ...loadSettings(),
}));

ipcMain.handle('settings:set', (_e, settings: Settings): void => {
  fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
  fs.writeFileSync(settingsFile(), JSON.stringify(settings));
});

ipcMain.handle('image:pick', async (_e, current: string): Promise<string | null> => {
  const r = await dialog.showOpenDialog(win!, {
    properties: ['openFile'],
    defaultPath: current,
    filters: [
      { name: 'Image files', extensions: IMAGE_EXTENSIONS },
      { name: 'All files', extensions: ['*'] },
    ],
  });
  return r.canceled ? null : r.filePaths[0];
});

ipcMain.handle('image:probe', async (_e, file: string): Promise<ProbeResult> => {
  const ev = await runBackend(['probe', file], { timeoutMs: PROBE_TIMEOUT_MS });
  if (ev.event === 'probe') {
    const { event: _event, ...info } = ev;
    return info;
  }
  return unexpected(ev);
});

ipcMain.handle('image:process', async (_e, req: ProcessRequest): Promise<ProcessResult> => {
  if (busy) return { error: 'An image is already being processed.' };

  const { resize, format, compress, quality, pngPalette } = req.options;
  const args = ['process', req.file];
  if (resize) args.push('--resize-mode', resize.mode, '--resize-value', String(resize.value));
  if (format) args.push('--format', format);
  if (compress) {
    args.push('--compress', '--quality', String(quality));
    if (pngPalette) args.push('--png-palette');
  }

  busy = true;
  try {
    const ev = await runBackend(args, { timeoutMs: PROCESS_TIMEOUT_MS });
    if (ev.event === 'process') {
      return { output: ev.output, width: ev.width, height: ev.height, size: ev.size, originalSize: ev.original_size };
    }
    return unexpected(ev);
  } finally {
    busy = false;
  }
});

ipcMain.handle('file:show', (_e, file: string): void => shell.showItemInFolder(file));

// ---- window ------------------------------------------------------------------

function createWindow(): void {
  win = new BrowserWindow({
    width: 900,
    height: 760,
    minWidth: 680,
    minHeight: 600,
    backgroundColor: '#121212',
    icon: path.join(__dirname, '..', 'assets', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
