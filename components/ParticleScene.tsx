import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { generateSpherePositions, createGlowTexture, sampleTextPositions } from '../utils/particleUtils';

interface ParticleSceneProps {
  text: string;
  isMorphing: boolean; // true = text, false = sphere
  isPaused: boolean;
  particleCount?: number;
  color: string;
  particleSize?: number;
}

const PARTICLE_COUNT = 8000;
const SPHERE_RADIUS = 3.5;
const MORPH_SPEED = 2.5; // Speed multiplier for interpolation

const ParticleScene: React.FC<ParticleSceneProps> = ({ 
  text, 
  isMorphing, 
  isPaused,
  particleCount = PARTICLE_COUNT,
  color,
  particleSize = 0.15
}) => {
  const pointsRef = useRef<THREE.Points>(null);
  const geometryRef = useRef<THREE.BufferGeometry>(null);
  const materialRef = useRef<THREE.PointsMaterial>(null);
  const { viewport } = useThree();

  // Track accumulated auto-rotation separately from mouse interaction
  const autoRotationY = useRef(0);

  // Memoize target color
  const targetColor = useMemo(() => new THREE.Color(color), [color]);

  // 1. Source Data (Immutable)
  const spherePositions = useMemo(() => {
    return generateSpherePositions(particleCount, SPHERE_RADIUS);
  }, [particleCount]);

  const textPositions = useMemo(() => {
    return sampleTextPositions(text, particleCount);
  }, [text, particleCount]);

  // 2. Display Buffer (Mutable)
  const displayPositions = useMemo(() => {
    return new Float32Array(spherePositions); 
  }, [spherePositions]);
  
  // 3. Color Buffer (Mutable)
  // Stores per-vertex lighting intensity
  const colorAttribute = useMemo(() => {
    const colors = new Float32Array(particleCount * 3);
    colors.fill(1); // Initialize white
    return colors;
  }, [particleCount]);

  // Texture for particles
  const sprite = useMemo(() => createGlowTexture(), []);

  // Animation State
  const morphProgress = useRef(0); // 0 = sphere, 1 = text

  useFrame((state, delta) => {
    if (isPaused || !pointsRef.current || !geometryRef.current) return;

    // --- Color Interpolation ---
    if (materialRef.current) {
        materialRef.current.color.lerp(targetColor, delta * 3);
    }

    // --- Morph Logic ---
    const targetProgress = isMorphing && text.length > 0 ? 1 : 0;
    
    // Smooth dampening
    const diff = targetProgress - morphProgress.current;
    if (Math.abs(diff) > 0.001) {
      morphProgress.current += diff * Math.min(delta * MORPH_SPEED, 1);
    } else {
        morphProgress.current = targetProgress;
    }

    const t = morphProgress.current;
    const ease = t * t * (3 - 2 * t); // SmoothStep

    // --- Rotation ---
    const sphereRotationSpeed = 0.1 * (1 - ease * 0.8);
    autoRotationY.current += sphereRotationSpeed * delta;

    const parallaxX = state.pointer.y * 0.3; 
    const parallaxY = state.pointer.x * 0.3; 

    pointsRef.current.rotation.y = autoRotationY.current + (parallaxY * 0.5);
    const wobble = Math.sin(state.clock.elapsedTime * 0.5) * 0.1 * (1 - ease);
    pointsRef.current.rotation.x = wobble - (parallaxX * 0.5);

    // --- Lighting Calc Prep ---
    // Convert normalized mouse (-1 to 1) to approximate world coordinates at z=0 plane
    const mouseX = (state.pointer.x * viewport.width) / 2;
    const mouseY = (state.pointer.y * viewport.height) / 2;
    const lightZ = 2.0; // Light hovers slightly in front

    // --- Position & Color Update ---
    const positions = geometryRef.current.attributes.position.array as Float32Array;
    const colors = geometryRef.current.attributes.color.array as Float32Array;
    
    if (positions.length !== particleCount * 3) return;

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;

      // READ from sources
      const sx = spherePositions[i3];
      const sy = spherePositions[i3 + 1];
      const sz = spherePositions[i3 + 2];

      const tx = textPositions[i3];
      const ty = textPositions[i3 + 1];
      const tz = textPositions[i3 + 2];

      // Calculate noise
      const wobbleIntensity = Math.sin(t * Math.PI) * 2; 
      const noiseX = (Math.random() - 0.5) * wobbleIntensity * 0.2;
      const noiseY = (Math.random() - 0.5) * wobbleIntensity * 0.2;
      const noiseZ = (Math.random() - 0.5) * wobbleIntensity * 0.5;

      // WRITE to display buffer
      const px = sx * (1 - ease) + tx * ease + noiseX;
      const py = sy * (1 - ease) + ty * ease + noiseY;
      const pz = sz * (1 - ease) + tz * ease + noiseZ;
      
      positions[i3]     = px;
      positions[i3 + 1] = py;
      positions[i3 + 2] = pz;
      
      // --- Dynamic Lighting ---
      // Apply a "flashlight" effect based on mouse distance
      // We use the particle's local position vs mouse world position for a "scanner" effect
      const distToMouseSq = (px - mouseX) ** 2 + (py - mouseY) ** 2 + (pz - lightZ) ** 2;
      
      // Ambient (0.5) + Light Source (based on distance)
      // Divisor controls falloff sharpness. 
      const lightIntensity = 0.5 + (25.0 / (distToMouseSq + 10.0));
      
      colors[i3]     = lightIntensity;
      colors[i3 + 1] = lightIntensity;
      colors[i3 + 2] = lightIntensity;
    }

    geometryRef.current.attributes.position.needsUpdate = true;
    geometryRef.current.attributes.color.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry ref={geometryRef}>
        <bufferAttribute
          attach="attributes-position"
          count={particleCount}
          array={displayPositions}
          itemSize={3}
          usage={THREE.DynamicDrawUsage}
        />
        <bufferAttribute
          attach="attributes-color"
          count={particleCount}
          array={colorAttribute}
          itemSize={3}
          usage={THREE.DynamicDrawUsage}
        />
      </bufferGeometry>
      <pointsMaterial
        ref={materialRef}
        size={particleSize}
        map={sprite}
        transparent
        opacity={0.9}
        alphaTest={0.01}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        vertexColors={true} // Enable vertex colors to modulate brightness
        color={new THREE.Color(color)} 
      />
    </points>
  );
};

export default ParticleScene;