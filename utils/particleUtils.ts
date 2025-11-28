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
 * improved to automatically size canvas and use jitter for organic distribution.
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

  // Use a high resolution font size for better sampling detail
  const fontSize = 120;
  const fontName = 'Arial, sans-serif';
  ctx.font = `bold ${fontSize}px ${fontName}`;

  // Measure text to fit canvas tightly
  const measure = ctx.measureText(text);
  const textWidth = Math.ceil(measure.width);
  const textHeight = Math.ceil(fontSize * 1.2); // Estimate height with padding

  // Set canvas size with some padding to avoid edge clipping
  canvas.width = textWidth + 40;
  canvas.height = textHeight + 40;

  // Background must be black
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw Text
  ctx.font = `bold ${fontSize}px ${fontName}`;
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  interface Point { x: number; y: number; }
  const validPixels: Point[] = [];

  // Sampling step: checks every Nth pixel to save performance while maintaining shape
  // Smaller step = more detail but slower generation
  const step = 2; 

  for (let y = 0; y < canvas.height; y += step) {
    for (let x = 0; x < canvas.width; x += step) {
      const i = (y * canvas.width + x) * 4;
      // Check Red channel (since white text is 255, 255, 255)
      // Using a threshold > 128 ensures we stick to the core of the letter
      if (data[i] > 100) { 
        validPixels.push({ x, y });
      }
    }
  }

  if (validPixels.length === 0) return targetPositions;

  // Scale calculations to fit the text into the 3D viewport
  // We want the text to roughly span 15 world units wide
  const targetWidth = 15;
  const scale = targetWidth / canvas.width;
  
  const offsetX = canvas.width / 2;
  const offsetY = canvas.height / 2;

  // Assign particles to valid pixels
  for (let i = 0; i < particleCount; i++) {
    // Round-robin assignment if we have more particles than pixels
    const pixelIndex = i % validPixels.length;
    const pixel = validPixels[pixelIndex];

    // Jitter: Add random offset to prevent particles from stacking on the exact same grid points.
    // Since we sampled with `step`, the jitter should cover that gap.
    const jitterX = (Math.random() - 0.5) * step;
    const jitterY = (Math.random() - 0.5) * step;

    // Normalize coordinates: 0,0 is center of screen
    const rawX = (pixel.x - offsetX) + jitterX;
    const rawY = -(pixel.y - offsetY) + jitterY; // Invert Y for 3D coordinate system

    targetPositions[i * 3] = rawX * scale;
    targetPositions[i * 3 + 1] = rawY * scale;
    targetPositions[i * 3 + 2] = 0; // Flat 2D Text
  }

  return targetPositions;
};