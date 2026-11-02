const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const drop = $<HTMLElement>('drop');
const pickBtn = $<HTMLButtonElement>('pickBtn');
const message = $<HTMLParagraphElement>('message');
const imageSection = $<HTMLElement>('imageSection');
const fileName = $<HTMLElement>('fileName');
const imageInfo = $<HTMLElement>('imageInfo');
const resizeMode = $<HTMLSelectElement>('resizeMode');
const resizeValueBox = $<HTMLElement>('resizeValueBox');
const resizeValueLabel = $<HTMLElement>('resizeValueLabel');
const resizeValue = $<HTMLInputElement>('resizeValue');
const resizeHint = $<HTMLElement>('resizeHint');
const formatSelect = $<HTMLSelectElement>('format');
const formatHint = $<HTMLElement>('formatHint');
const compressInput = $<HTMLInputElement>('compress');
const compressHint = $<HTMLElement>('compressHint');
const qualityBox = $<HTMLElement>('qualityBox');
const qualityInput = $<HTMLInputElement>('quality');
const paletteBox = $<HTMLElement>('paletteBox');
const paletteInput = $<HTMLInputElement>('palette');
const runBtn = $<HTMLButtonElement>('runBtn');
const result = $<HTMLElement>('result');
const resultText = $<HTMLElement>('resultText');
const resultImg = $<HTMLImageElement>('resultImg');
const showBtn = $<HTMLButtonElement>('showBtn');

/** Target type key -> Pillow format name (mirrors FORMATS in backend/core.py). */
const PIL_FORMATS: Record<string, string> = {
  jpg: 'JPEG', png: 'PNG', webp: 'WEBP', bmp: 'BMP', tiff: 'TIFF', gif: 'GIF',
};
const LOSSY = new Set(['JPEG', 'WEBP']);
const NO_ALPHA = new Set(['JPEG', 'BMP']);
const MAX_DIMENSION = 100_000;

let settings: Settings = { folder: '' };
let image: ImageInfo | null = null;
let output: string | null = null;
let busy = false;

// ---- helpers -----------------------------------------------------------------

function showMessage(text: string | null): void {
  message.hidden = !text;
  message.textContent = text ?? '';
}

function formatSize(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function describe(i: ImageInfo): string {
  return [`${i.width}×${i.height}`, i.format ?? 'unknown type', formatSize(i.size)].join(' · ');
}

function fileUrl(file: string): string {
  const segments = file.replace(/\\/g, '/').replace(/^\/+/, '').split('/');
  return 'file:///' + segments.map((s) => (/^[A-Za-z]:$/.test(s) ? s : encodeURIComponent(s))).join('/');
}

/** The Pillow format the result will have: the chosen type, else the source type. */
function outputFormat(): string {
  if (formatSelect.value) return PIL_FORMATS[formatSelect.value];
  const source = image?.format ?? 'PNG';
  return Object.values(PIL_FORMATS).includes(source) ? source : 'PNG';
}

function setBusy(on: boolean): void {
  busy = on;
  for (const el of [runBtn, pickBtn, resizeMode, resizeValue, formatSelect, compressInput, qualityInput, paletteInput]) {
    el.disabled = on;
  }
  if (!on) refreshOptions();
}

// ---- keeping the option fields consistent ------------------------------------

function refreshOptions(): void {
  const mode = resizeMode.value as ResizeMode | '';

  resizeValueBox.hidden = mode === '';
  if (image && mode === 'width') {
    resizeValueLabel.textContent = 'Width (pixels)';
    resizeValue.min = '1'; resizeValue.max = String(MAX_DIMENSION);
    resizeHint.textContent = `Currently ${image.width}. Height follows automatically.`;
  } else if (image && mode === 'height') {
    resizeValueLabel.textContent = 'Height (pixels)';
    resizeValue.min = '1'; resizeValue.max = String(MAX_DIMENSION);
    resizeHint.textContent = `Currently ${image.height}. Width follows automatically.`;
  } else if (mode === 'percent') {
    resizeValueLabel.textContent = 'Percentage of original size';
    resizeValue.min = '1'; resizeValue.max = '1000';
    resizeHint.textContent = 'For example 50 for half the size.';
  }

  // Compression is only offered when not resizing.
  const resizing = mode !== '';
  if (resizing) compressInput.checked = false;
  compressInput.disabled = resizing || busy;
  compressHint.hidden = !resizing;

  const fmt = outputFormat();
  const compressing = compressInput.checked && !resizing;
  qualityBox.hidden = !(compressing && LOSSY.has(fmt));
  paletteBox.hidden = !(compressing && fmt === 'PNG');

  const flatten = image !== null && NO_ALPHA.has(fmt) && fmt !== image.format;
  formatHint.hidden = !flatten;
  formatHint.textContent = flatten ? 'Transparent areas become white.' : '';
}

for (const el of [resizeMode, formatSelect, compressInput]) {
  el.addEventListener('change', refreshOptions);
}

// ---- choosing an image ---------------------------------------------------------

async function loadImage(file: string): Promise<void> {
  showMessage(null);
  result.hidden = true;
  const info = await window.api.probe(file);
  if (info.error !== undefined) {
    showMessage(info.error);
    return;
  }
  image = info;
  fileName.textContent = info.name;
  fileName.title = info.path;
  imageInfo.textContent = describe(info);
  imageSection.hidden = false;
  refreshOptions();

  const folder = info.path.replace(/[\\/][^\\/]*$/, '');
  if (folder && folder !== settings.folder) {
    settings.folder = folder;
    void window.api.saveSettings(settings);
  }
}

async function pickImage(): Promise<void> {
  if (busy) return;
  const file = await window.api.pickImage(settings.folder);
  if (file) await loadImage(file);
}

pickBtn.addEventListener('click', (e) => { e.stopPropagation(); void pickImage(); });
drop.addEventListener('click', () => void pickImage());
drop.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); void pickImage(); }
});

// Drag and drop anywhere on the window.
window.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
window.addEventListener('dragleave', (e) => {
  if (e.relatedTarget === null) drop.classList.remove('over');
});
window.addEventListener('drop', (e) => {
  e.preventDefault();
  drop.classList.remove('over');
  const file = e.dataTransfer?.files[0];
  if (file && !busy) void loadImage(window.api.pathForFile(file));
});

// ---- processing ------------------------------------------------------------------

function readOptions(): ProcessOptions | string {
  const mode = resizeMode.value as ResizeMode | '';
  let resize: ProcessOptions['resize'] = null;
  if (mode !== '') {
    const value = Number(resizeValue.value);
    if (resizeValue.value.trim() === '' || !Number.isFinite(value)) return 'Enter a size for the resize.';
    if (mode === 'percent') {
      if (value < 1 || value > 1000) return 'Percentage must be from 1 to 1000.';
    } else if (!Number.isInteger(value) || value < 1 || value > MAX_DIMENSION) {
      return `${mode === 'width' ? 'Width' : 'Height'} must be a whole number from 1 to ${MAX_DIMENSION}.`;
    }
    resize = { mode, value };
  }

  const quality = Number(qualityInput.value);
  if (compressInput.checked && (!Number.isInteger(quality) || quality < 1 || quality > 100)) {
    return 'Quality must be a whole number from 1 to 100.';
  }

  const options: ProcessOptions = {
    resize,
    format: formatSelect.value || null,
    compress: compressInput.checked && resize === null,
    quality,
    pngPalette: paletteInput.checked,
  };
  if (!options.resize && !options.format && !options.compress) {
    return 'Nothing to do: choose a resize, a new image type or compression.';
  }
  return options;
}

runBtn.addEventListener('click', async () => {
  if (!image || busy) return;
  const options = readOptions();
  if (typeof options === 'string') {
    showMessage(options);
    return;
  }
  showMessage(null);
  result.hidden = true;
  setBusy(true);
  try {
    const r = await window.api.process({ file: image.path, options });
    if ('error' in r) {
      showMessage(r.error);
    } else {
      output = r.output;
      resultText.textContent =
        `Saved ${r.output} (${r.width}×${r.height}, ${formatSize(r.size)}; original ${formatSize(r.originalSize)})`;
      resultImg.src = `${fileUrl(r.output)}?t=${Date.now()}`;
      result.hidden = false;
    }
  } finally {
    setBusy(false);
  }
});

showBtn.addEventListener('click', () => { if (output) void window.api.showInFolder(output); });

void window.api.getSettings().then((s) => { settings = s; });
