// Ambient types shared by main, preload and renderer (no imports/exports on purpose,
// so the renderer stays a plain browser script).

/** An image that was probed (see backend/core.py probe). */
interface ImageInfo {
  error?: undefined;
  name: string;
  path: string;
  width: number;
  height: number;
  /** Pillow format name, e.g. "JPEG", "PNG". */
  format: string | null;
  /** Size in bytes. */
  size: number;
}

type ProbeResult = ImageInfo | { error: string };

type ResizeMode = 'width' | 'height' | 'percent';

interface ProcessOptions {
  /** null keeps the original size. */
  resize: { mode: ResizeMode; value: number } | null;
  /** Target type key (jpg, png, webp, bmp, tiff, gif); null keeps the source type. */
  format: string | null;
  /** Only valid when `resize` is null. */
  compress: boolean;
  /** 1-100, used for JPG and WEBP. */
  quality: number;
  /** PNG only: reduce to 256 colors. */
  pngPalette: boolean;
}

interface ProcessRequest {
  file: string;
  options: ProcessOptions;
}

type ProcessResult =
  | { output: string; width: number; height: number; size: number; originalSize: number }
  | { error: string };

/** Events the Python backend writes as JSON lines (see backend/backend.py). */
type BackendEvent =
  | ({ event: 'probe' } & Omit<ImageInfo, 'error'>)
  | { event: 'process'; output: string; width: number; height: number; size: number; original_size: number }
  | { event: 'check'; pillow: string }
  | { event: 'error'; message: string };

interface Settings {
  /** Folder the last image was picked from. */
  folder: string;
}

/** What preload.ts exposes to the renderer as `window.api`. */
interface Api {
  getSettings(): Promise<Settings>;
  saveSettings(settings: Settings): Promise<void>;
  /** Opens a file dialog; null when cancelled. */
  pickImage(current: string): Promise<string | null>;
  /** Absolute path of a file dropped onto the window. */
  pathForFile(file: File): string;
  probe(file: string): Promise<ProbeResult>;
  /** Processes the image; the result is saved next to the source. */
  process(request: ProcessRequest): Promise<ProcessResult>;
  showInFolder(path: string): Promise<void>;
}

interface Window {
  api: Api;
}
