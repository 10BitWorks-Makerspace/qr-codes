/// <reference types="vite/client" />
import { qrcodegen } from './qrcodegen';

export interface QrOptions {
  ecc: qrcodegen.QrCode.Ecc;
  border: number;
  fgColor: string;
  transparentBg: boolean;
  minVersion: number;
  maxVersion: number;
  mask: number;
  boostEcc: boolean;
}

export interface QrResult {
  svg: string;
  version: number;
  mask: number;
  dataBits: number;
  mode: string;
  eccName: string;
}

export class QrRenderer {
  private finderInner: string = '';
  private unitInner: string = '';

  async initialize() {
    try {
      const [finderRes, unitRes] = await Promise.all([
        fetch(`${import.meta.env.BASE_URL}finder.svg`),
        fetch(`${import.meta.env.BASE_URL}unit-block-template.svg`)
      ]);
      const finderText = await finderRes.text();
      const unitText = await unitRes.text();

      const extractSvgInner = (text: string) => {
        const match = text.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
        if (!match) return '';
        let inner = match[1];
        // Clean inkscape metadata
        inner = inner.replace(/<sodipodi:namedview[\s\S]*?<\/sodipodi:namedview>/gi, '');
        inner = inner.replace(/<defs[^>]*>[\s\S]*?<\/defs>/gi, '');
        return inner;
      };

      this.finderInner = extractSvgInner(finderText);
      this.unitInner = extractSvgInner(unitText);
    } catch (err) {
      console.error('Failed to load SVG templates', err);
    }
  }

  generate(text: string, options: QrOptions): QrResult | null {
    if (!text) return null;
    
    const segs = qrcodegen.QrSegment.makeSegments(text);
    const qr = qrcodegen.QrCode.encodeSegments(
      segs, 
      options.ecc, 
      options.minVersion, 
      options.maxVersion, 
      options.mask, 
      options.boostEcc
    );

    const size = qr.size;
    const moduleSize = 20;
    const quietZone = options.border;
    const viewSize = (size + quietZone * 2) * moduleSize;
    
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" viewBox="0 0 ${viewSize} ${viewSize}" width="100%" height="100%">`;
    
    // Background
    if (!options.transparentBg) {
      svg += `<rect width="100%" height="100%" fill="#ffffff"/>`;
    }
    
    // SVG Content Group (shifted by quietZone, applying foreground color)
    svg += `<g transform="translate(${quietZone * moduleSize}, ${quietZone * moduleSize})" color="${options.fgColor}" fill="${options.fgColor}">`;

    // Draw the 3 finder patterns
    // Top-Left (Render original geometry for editability)
    svg += `<g transform="translate(-20, -20)"><g id="finder-def">${this.finderInner}</g></g>`;
    // Top-Right
    svg += `<use href="#finder-def" x="${(size - 7) * moduleSize - 20}" y="-20" />`;
    // Bottom-Left
    svg += `<use href="#finder-def" x="-20" y="${(size - 7) * moduleSize - 20}" />`;

    // Draw the data modules
    let unitDefRendered = false;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        // Skip finder pattern zones
        const isTopLeft = x < 8 && y < 8; // Include separator
        const isTopRight = x >= size - 8 && y < 8;
        const isBottomLeft = x < 8 && y >= size - 8;
        
        if (isTopLeft || isTopRight || isBottomLeft) {
          continue;
        }

        if (qr.getModule(x, y)) {
          if (!unitDefRendered) {
            svg += `<g transform="translate(${x * moduleSize}, ${y * moduleSize})"><g id="unit-def">${this.unitInner}</g></g>`;
            unitDefRendered = true;
          } else {
            svg += `<use href="#unit-def" x="${x * moduleSize}" y="${y * moduleSize}" />`;
          }
        }
      }
    }

    svg += `</g></svg>`;

    // Gather statistics
    let dataBits = 0;
    let mode = 'Unknown';
    if (segs.length > 0) {
      // Calculate total bits used by segments
      dataBits = qrcodegen.QrSegment.getTotalBits(segs, qr.version);
      
      // Attempt to identify the primary mode
      if (segs.length === 1) {
         if (segs[0].mode === qrcodegen.QrSegment.Mode.NUMERIC) mode = 'numeric';
         else if (segs[0].mode === qrcodegen.QrSegment.Mode.ALPHANUMERIC) mode = 'alphanumeric';
         else if (segs[0].mode === qrcodegen.QrSegment.Mode.BYTE) mode = 'byte';
         else if (segs[0].mode === qrcodegen.QrSegment.Mode.KANJI) mode = 'kanji';
      } else {
         mode = 'mixed';
      }
    }

    let eccName = '';
    if (qr.errorCorrectionLevel === qrcodegen.QrCode.Ecc.LOW) eccName = 'L';
    else if (qr.errorCorrectionLevel === qrcodegen.QrCode.Ecc.MEDIUM) eccName = 'M';
    else if (qr.errorCorrectionLevel === qrcodegen.QrCode.Ecc.QUARTILE) eccName = 'Q';
    else if (qr.errorCorrectionLevel === qrcodegen.QrCode.Ecc.HIGH) eccName = 'H';

    return {
      svg,
      version: qr.version,
      mask: qr.mask,
      dataBits,
      mode,
      eccName
    };
  }

  async renderToPngDataUrl(svgString: string, resolution: number = 1024): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = resolution;
        canvas.height = resolution;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas 2D context not available'));
        
        ctx.drawImage(img, 0, 0, resolution, resolution);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/png'));
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load SVG for PNG conversion'));
      };
      
      img.src = url;
    });
  }
}
