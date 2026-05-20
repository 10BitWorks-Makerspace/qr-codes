import './style.css';
import { QrRenderer, QrOptions } from './qr-renderer';
import { qrcodegen } from './qrcodegen';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div class="container">
    <div class="header">
      <h1>10BitWorks</h1>
      <p>Custom QR Code Generator</p>
    </div>
    
    <div class="content-grid">
      <div class="controls">
        <div class="input-group">
          <label for="qr-text">Content</label>
          <textarea id="qr-text" placeholder="Enter URL or text to encode...">https://10bitworks.com</textarea>
          <div id="error-msg" class="error-msg"></div>
        </div>

        <div class="settings-panel">
          <h3>Settings</h3>
          
          <div class="input-group">
            <label>Error correction</label>
            <div class="radio-group">
              <label><input type="radio" name="ecc" value="LOW"> Low</label>
              <label><input type="radio" name="ecc" value="MEDIUM"> Medium</label>
              <label><input type="radio" name="ecc" value="QUARTILE"> Quartile</label>
              <label><input type="radio" name="ecc" value="HIGH" checked> High</label>
            </div>
          </div>

          <div class="input-group">
            <label>Output format</label>
            <div class="radio-group">
              <label><input type="radio" name="format" value="svg" checked> Vector (SVG)</label>
              <label><input type="radio" name="format" value="png"> Bitmap (PNG)</label>
            </div>
          </div>

          <div class="input-group">
            <label for="border-input">Border (modules)</label>
            <input type="number" id="border-input" value="4" min="0" step="1">
          </div>

          <div class="input-group">
            <label>Colors</label>
            <div class="color-controls">
              <label>Foreground <input type="color" id="fg-color" value="#000000"></label>
              <label class="checkbox-label"><input type="checkbox" id="transparent-bg" checked> Transparent BG</label>
            </div>
          </div>

          <div class="input-group">
            <label>Version range</label>
            <div class="range-controls">
              <label>Min <input type="number" id="min-version" value="1" min="1" max="40"></label>
              <label>Max <input type="number" id="max-version" value="40" min="1" max="40"></label>
            </div>
          </div>

          <div class="input-group">
            <label for="mask-input">Mask pattern</label>
            <input type="number" id="mask-input" value="-1" min="-1" max="7" placeholder="-1 for auto, 0-7 manual">
          </div>

          <div class="input-group checkbox-group">
            <label class="checkbox-label">
              <input type="checkbox" id="boost-ecc" checked> Increase ECC level within same version
            </label>
          </div>
        </div>
        
        <button id="download-btn" class="button button-primary">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          <span id="download-text">Download SVG</span>
        </button>
      </div>
      
      <div class="preview-area">
        <div class="qr-container" id="qr-container">
          <!-- SVG will be injected here -->
        </div>
        <div id="statistics-panel" class="statistics-panel">
          <!-- Stats injected here -->
        </div>
      </div>
    </div>
  </div>
`;

// Input references
const textInput = document.querySelector<HTMLTextAreaElement>('#qr-text')!;
const eccRadios = document.querySelectorAll<HTMLInputElement>('input[name="ecc"]');
const formatRadios = document.querySelectorAll<HTMLInputElement>('input[name="format"]');
const borderInput = document.querySelector<HTMLInputElement>('#border-input')!;
const fgColorInput = document.querySelector<HTMLInputElement>('#fg-color')!;
const transparentBgInput = document.querySelector<HTMLInputElement>('#transparent-bg')!;
const minVersionInput = document.querySelector<HTMLInputElement>('#min-version')!;
const maxVersionInput = document.querySelector<HTMLInputElement>('#max-version')!;
const maskInput = document.querySelector<HTMLInputElement>('#mask-input')!;
const boostEccInput = document.querySelector<HTMLInputElement>('#boost-ecc')!;

// UI components
const qrContainer = document.querySelector<HTMLDivElement>('#qr-container')!;
const downloadBtn = document.querySelector<HTMLButtonElement>('#download-btn')!;
const downloadText = document.querySelector<HTMLSpanElement>('#download-text')!;
const errorMsg = document.querySelector<HTMLDivElement>('#error-msg')!;
const statisticsPanel = document.querySelector<HTMLDivElement>('#statistics-panel')!;

const renderer = new QrRenderer();
let currentSvgString = '';

async function init() {
  await renderer.initialize();
  renderQR();
}

function getEcc(): qrcodegen.QrCode.Ecc {
  const checked = document.querySelector<HTMLInputElement>('input[name="ecc"]:checked')?.value;
  switch (checked) {
    case 'LOW': return qrcodegen.QrCode.Ecc.LOW;
    case 'MEDIUM': return qrcodegen.QrCode.Ecc.MEDIUM;
    case 'QUARTILE': return qrcodegen.QrCode.Ecc.QUARTILE;
    case 'HIGH':
    default: return qrcodegen.QrCode.Ecc.HIGH;
  }
}

function renderQR() {
  const text = textInput.value.trim();
  errorMsg.textContent = '';
  statisticsPanel.innerHTML = '';
  
  if (!text) {
    qrContainer.innerHTML = '';
    currentSvgString = '';
    return;
  }

  const options: QrOptions = {
    ecc: getEcc(),
    border: parseInt(borderInput.value, 10) || 0,
    fgColor: fgColorInput.value,
    transparentBg: transparentBgInput.checked,
    minVersion: parseInt(minVersionInput.value, 10) || 1,
    maxVersion: parseInt(maxVersionInput.value, 10) || 40,
    mask: parseInt(maskInput.value, 10),
    boostEcc: boostEccInput.checked
  };

  // Enforce bounds
  if (options.minVersion < 1) options.minVersion = 1;
  if (options.maxVersion > 40) options.maxVersion = 40;
  if (options.mask < -1) options.mask = -1;
  if (options.mask > 7) options.mask = 7;
  
  try {
    const result = renderer.generate(text, options);
    if (result) {
      currentSvgString = result.svg;
      qrContainer.innerHTML = currentSvgString;
      
      statisticsPanel.innerHTML = `
        <strong>Statistics:</strong><br/>
        QR Code version = ${result.version}, mask pattern = ${result.mask}, character count = ${text.length}, 
        encoding mode = ${result.mode}, error correction = level ${result.eccName}, data bits = ${result.dataBits}.
      `;
    }
  } catch (err: any) {
    errorMsg.textContent = err.message || 'Error generating QR code (Content might be too long for the selected version/ECC).';
    qrContainer.innerHTML = '';
    currentSvgString = '';
    console.error(err);
  }
}

async function handleDownload() {
  if (!currentSvgString) return;
  
  const format = document.querySelector<HTMLInputElement>('input[name="format"]:checked')?.value || 'svg';
  
  if (format === 'png') {
    try {
      const dataUrl = await renderer.renderToPngDataUrl(currentSvgString, 1024);
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = '10bitworks-qr.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error(err);
      errorMsg.textContent = 'Failed to generate PNG';
    }
  } else {
    // SVG download
    const blob = new Blob([currentSvgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = '10bitworks-qr.svg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

// Update download button text based on format
formatRadios.forEach(radio => {
  radio.addEventListener('change', () => {
    downloadText.textContent = radio.value === 'png' ? 'Download PNG' : 'Download SVG';
  });
});

// Bind all inputs to re-render
[textInput, borderInput, fgColorInput, transparentBgInput, minVersionInput, maxVersionInput, maskInput, boostEccInput].forEach(el => {
  el.addEventListener('input', renderQR);
  el.addEventListener('change', renderQR); // for checkboxes/color pickers
});

eccRadios.forEach(radio => radio.addEventListener('change', renderQR));

downloadBtn.addEventListener('click', handleDownload);

init();
