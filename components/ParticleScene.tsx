import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
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

  // Track accumulated auto-rotation separately from mouse interaction
  const autoRotationY = useRef(0);

  // Memoize target color
  const targetColor = useMemo(() => new THREE.Color(color), [color]);

  // 1. Source Data (Immutable)
  // These arrays hold the ideal "Target" positions for Sphere and Text states.
  // We must NOT mutate these arrays.
  const spherePositions = useMemo(() => {
    return generateSpherePositions(particleCount, SPHERE_RADIUS);
  }, [particleCount]);

  const textPositions = useMemo(() => {
    return sampleTextPositions(text, particleCount);
  }, [text, particleCount]);

  // 2. Display Buffer (Mutable)
  // This is the array we pass to the GPU. We initialize it as a copy of spherePositions.
  // R3F will use this for the initial render, and we will update it in useFrame.
  const displayPositions = useMemo(() => {
    return new Float32Array(spherePositions); 
  }, [spherePositions]);

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

    // --- Position Update ---
    // We read from the IMMUTABLE source arrays (spherePositions, textPositions)
    // And write to the MUTABLE buffer attribute (positions)
    const positions = geometryRef.current.attributes.position.array as Float32Array;
    
    // Safety check
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
      positions[i3]     = sx * (1 - ease) + tx * ease + noiseX;
      positions[i3 + 1] = sy * (1 - ease) + ty * ease + noiseY;
      positions[i3 + 2] = sz * (1 - ease) + tz * ease + noiseZ;
    }

    geometryRef.current.attributes.position.needsUpdate = true;
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
      </bufferGeometry>
      <pointsMaterial
        ref={materialRef}
        size={particleSize}
        map={sprite}
        transparent
        opacity={0.8}
        alphaTest={0.01}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        color={new THREE.Color(color)} 
      />
    </points>
  );
};

export default ParticleScene;