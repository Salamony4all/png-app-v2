import * as pdfjsLib from 'pdfjs-dist';

import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Configure worker - use local worker via Vite's URL import
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export const loadPDF = async (file) => {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  return loadingTask.promise;
};

export const renderPageToCanvas = async (pdfPage, scale = 2.0) => {
  const viewport = pdfPage.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');

  await pdfPage.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
};

export const loadImageToCanvas = async (file) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      resolve(canvas);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
};

/**
 * Heuristic to find 'stamps' or 'signatures'.
 * Assumes they are islands of non-white pixels.
 */
export const extractRegions = (canvas) => {
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  // 1. Thresholding: Mark visited/content pixels
  // We use a simple grid to avoid pixel-perfect BFS overhead on large images
  // block size 5x5
  const blockSize = 5;
  const bw = Math.ceil(width / blockSize);
  const bh = Math.ceil(height / blockSize);
  const grid = new Uint8Array(bw * bh); // 1 = content, 0 = background

  for (let y = 0; y < height; y += blockSize) {
    for (let x = 0; x < width; x += blockSize) {
      let isContent = false;
      // Check pixels in block
      checkLoop:
      for (let by = 0; by < blockSize && y + by < height; by++) {
        for (let bx = 0; bx < blockSize && x + bx < width; bx++) {
          const idx = ((y + by) * width + (x + bx)) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          // If not white/transparent (tolerance 240)
          if (r < 240 || g < 240 || b < 240) {
            isContent = true;
            break checkLoop;
          }
        }
      }
      if (isContent) {
        grid[(y / blockSize) * bw + (x / blockSize)] = 1;
      }
    }
  }

  // 2. Connected Components on the grid
  const visited = new Uint8Array(bw * bh);
  const regions = [];

  const getIdx = (x, y) => y * bw + x;

  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      const idx = getIdx(x, y);
      if (grid[idx] === 1 && visited[idx] === 0) {
        // Start BFS
        const queue = [{ x, y }];
        visited[idx] = 1;

        let minX = x, maxX = x, minY = y, maxY = y; // Grid coords

        while (queue.length > 0) {
          const curr = queue.shift();
          const cx = curr.x;
          const cy = curr.y;

          minX = Math.min(minX, cx);
          maxX = Math.max(maxX, cx);
          minY = Math.min(minY, cy);
          maxY = Math.max(maxY, cy);

          // Neighbors (8-way for better continuity)
          const moves = [
            { dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
            { dx: 1, dy: 1 }, { dx: 1, dy: -1 }, { dx: -1, dy: 1 }, { dx: -1, dy: -1 }
          ];

          for (const m of moves) {
            const nx = cx + m.dx;
            const ny = cy + m.dy;
            if (nx >= 0 && nx < bw && ny >= 0 && ny < bh) {
              const nIdx = getIdx(nx, ny);
              if (grid[nIdx] === 1 && visited[nIdx] === 0) {
                visited[nIdx] = 1;
                queue.push({ x: nx, y: ny });
              }
            }
          }
        }

        // 3. Convert Grid Box to Canvas Box
        const realBox = {
          x: minX * blockSize,
          y: minY * blockSize,
          w: (maxX - minX + 1) * blockSize,
          h: (maxY - minY + 1) * blockSize
        };

        // Filter valid sizes (ignore tiny specks or full page text blocks if possible)
        // Adjust these heuristics
        if (realBox.w > 30 && realBox.h > 30) {
          regions.push(realBox);
        }
      }
    }
  }

  // 4. Crop Images
  const extractedImages = regions.map((box, index) => {
    // Add padding
    const pad = 10;
    const sx = Math.max(0, box.x - pad);
    const sy = Math.max(0, box.y - pad);
    const sw = Math.min(width - sx, box.w + pad * 2);
    const sh = Math.min(height - sy, box.h + pad * 2);

    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = sw;
    cropCanvas.height = sh;
    const cropCtx = cropCanvas.getContext('2d');
    cropCtx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);

    return {
      id: `region-${Date.now()}-${index}`,
      dataUrl: cropCanvas.toDataURL('image/png'),
      width: sw,
      height: sh
    };
  });

  return extractedImages;
};
