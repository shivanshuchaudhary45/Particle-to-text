import * as THREE from 'three';

/**
 * Generates points on a sphere surface using Fibonacci sphere algorithm
 * for even distribution.
 */
export const generateSpherePositions = (count: number, radius: number): Float32Array => {
  const positions = new Float32Array(count * 3);
  const phi = Math.PI * (3 - Math.sqrt(5)); // Golden angle

  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2; // y goes from 1 to -1
    const radiusAtY = Math.sqrt(1 - y * y); // radius at y

    const theta = phi * i; // golden angle increment

    const x = Math.cos(theta) * radiusAtY;
    const z = Math.sin(theta) * radiusAtY;

    positions[i * 3] = x * radius;
    positions[i * 3 + 1] = y * radius;
    positions[i * 3 + 2] = z * radius;
  }
  return positions;
};

/**
 * Creates a soft glow texture programmatically to avoid external asset dependencies.
 */
export const createGlowTexture = (): THREE.Texture => {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  
  if (context) {
    const center = size / 2;
    const gradient = context.createRadialGradient(center, center, 0, center, center, center);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.2, 'rgba(230, 240, 255, 0.6)');
    gradient.addColorStop(0.5, 'rgba(100, 150, 255, 0.2)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
};

/**
 * Samples text from an off-screen canvas to get particle coordinates.
 * Enhanced with edge detection to prioritize outlining the text shape,
 * ensuring legibility even with fewer particles.
 */
export const sampleTextPositions = (
  text: string, 
  particleCount: number
): Float32Array => {
  const targetPositions = new Float32Array(particleCount * 3);
  
  if (!text || text.trim().length === 0) return targetPositions;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  
  if (!ctx) return targetPositions;

  // 1. Setup Canvas with high resolution
  // Using a larger font size for better pixel sampling precision
  const fontSize = 200; 
  const fontName = 'Arial, sans-serif'; 
  ctx.font = `900 ${fontSize}px ${fontName}`; // 900 weight for boldness

  const measure = ctx.measureText(text);
  const textWidth = Math.ceil(measure.width);
  const textHeight = Math.ceil(fontSize * 1.5);

  // Pad canvas to handle edges
  const padding = 30;
  canvas.width = textWidth + padding * 2;
  canvas.height = textHeight + padding * 2;

  // Background Black
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw Text White
  ctx.font = `900 ${fontSize}px ${fontName}`;
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const width = canvas.width;
  const height = canvas.height;
  
  interface Point { x: number; y: number; isEdge: boolean; }
  const points: Point[] = [];

  const threshold = 30; // Sensitive threshold for anti-aliased pixels

  // Helper to check pixel opacity
  const getAlpha = (x: number, y: number) => {
    return data[((y * width) + x) * 4];
  }

  // 2. Scan Pixels with Edge Detection
  // Step 2 is a good balance between performance and detail
  const step = 2; 
  
  for (let y = 2; y < height - 2; y += step) {
    for (let x = 2; x < width - 2; x += step) {
      if (getAlpha(x, y) > threshold) {
        // It's a text pixel. Check neighbors to find edges.
        // We check neighbors at distance 'step' to align with grid
        const nT = getAlpha(x, y - step);
        const nB = getAlpha(x, y + step);
        const nL = getAlpha(x - step, y);
        const nR = getAlpha(x + step, y);

        // If any neighbor is dark (below threshold), this is an edge
        const isEdge = nT < threshold || nB < threshold || nL < threshold || nR < threshold;
        
        points.push({ x, y, isEdge });
      }
    }
  }

  if (points.length === 0) return targetPositions;

  // 3. Sort & Distribute
  // Edges first ensures the outline is drawn even if we run out of particles.
  const edges = points.filter(p => p.isEdge);
  const interior = points.filter(p => !p.isEdge);
  
  // Custom shuffle for organic distribution
  const shuffle = (arr: Point[]) => {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  // Combine: Edges first, then random interior points
  const sortedPoints = [...shuffle(edges), ...shuffle(interior)];
  
  // Calculate Scale to fit the text into the 3D viewport
  const targetWorldWidth = 18; 
  const scale = targetWorldWidth / width;
  const offsetX = width / 2;
  const offsetY = height / 2;

  for (let i = 0; i < particleCount; i++) {
    // Wrap around if we have more particles than sampled points
    const pt = sortedPoints[i % sortedPoints.length];
    
    // Apply less jitter on edges to keep them sharp, more on interior to fill volume
    const jitterRange = pt.isEdge ? 0.25 : 2.5; 
    const jx = (Math.random() - 0.5) * jitterRange;
    const jy = (Math.random() - 0.5) * jitterRange;

    targetPositions[i * 3] = (pt.x - offsetX + jx) * scale;
    targetPositions[i * 3 + 1] = -(pt.y - offsetY + jy) * scale;
    targetPositions[i * 3 + 2] = 0;
  }

  return targetPositions;
};