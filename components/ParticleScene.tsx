import React, { useRef, useEffect, useMemo } from 'react';
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

  // Memoize target color to prevent re-creation on every render, but allow updates
  const targetColor = useMemo(() => new THREE.Color(color), [color]);

  // Generate initial Sphere positions (constant)
  const spherePositions = useMemo(() => {
    return generateSpherePositions(particleCount, SPHERE_RADIUS);
  }, [particleCount]);

  // Generate Text Target positions (re-runs when text changes)
  const textPositions = useMemo(() => {
    // New simplified call - utility handles canvas sizing automatically
    return sampleTextPositions(text, particleCount);
  }, [text, particleCount]);

  // Texture for particles
  const sprite = useMemo(() => createGlowTexture(), []);

  // Animation State Refs (to avoid re-renders on every frame)
  // Initialize with correct size, but we handle resizing in useEffect
  const currentPositionsRef = useRef<Float32Array>(new Float32Array(particleCount * 3));
  const morphProgress = useRef(0); // 0 = sphere, 1 = text

  // Initialize current positions to sphere positions and handle resize
  useEffect(() => {
    // If the particle count changed, the ref array might be the wrong size
    if (currentPositionsRef.current.length !== spherePositions.length) {
      currentPositionsRef.current = new Float32Array(spherePositions.length);
    }
    
    currentPositionsRef.current.set(spherePositions);

    if (geometryRef.current) {
        geometryRef.current.setAttribute(
            'position', 
            new THREE.BufferAttribute(currentPositionsRef.current, 3)
        );
    }
  }, [spherePositions]);

  useFrame((state, delta) => {
    if (isPaused || !pointsRef.current || !geometryRef.current) return;

    // --- Color Interpolation ---
    // Smoothly transition the material color to the target color
    if (materialRef.current) {
        materialRef.current.color.lerp(targetColor, delta * 3); // speed 3 for nice transition
    }

    // 1. Calculate Morph Progress
    const targetProgress = isMorphing && text.length > 0 ? 1 : 0;
    
    // Smooth dampening towards target
    const diff = targetProgress - morphProgress.current;
    if (Math.abs(diff) > 0.001) {
      morphProgress.current += diff * Math.min(delta * MORPH_SPEED, 1);
    } else {
        morphProgress.current = targetProgress;
    }

    const t = morphProgress.current;
    
    // Easing function (SmoothStep)
    // ease = t * t * (3 - 2 * t)
    const ease = t * t * (3 - 2 * t);

    // 2. Rotation & Parallax Logic
    // Update auto-rotation (only when in sphere mode mostly, but looks good always)
    const sphereRotationSpeed = 0.1 * (1 - ease * 0.8); // Slow down slightly when text
    autoRotationY.current += sphereRotationSpeed * delta;

    // Mouse Parallax
    // state.pointer x/y are normalized (-1 to 1)
    const parallaxX = state.pointer.y * 0.3; // Tilt Up/Down
    const parallaxY = state.pointer.x * 0.3; // Tilt Left/Right

    // Apply combined rotation
    // Y Axis: Auto spin + Mouse horizontal tilt
    pointsRef.current.rotation.y = autoRotationY.current + (parallaxY * 0.5);
    
    // X Axis: Slight wobble + Mouse vertical tilt
    const wobble = Math.sin(state.clock.elapsedTime * 0.5) * 0.1 * (1 - ease);
    pointsRef.current.rotation.x = wobble - (parallaxX * 0.5);

    // 3. Update Individual Particles
    const positions = geometryRef.current.attributes.position.array as Float32Array;
    
    // Safety check for array size mismatch during hot reload or rapid updates
    if (positions.length !== particleCount * 3) return;

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;

      const sx = spherePositions[i3];
      const sy = spherePositions[i3 + 1];
      const sz = spherePositions[i3 + 2];

      const tx = textPositions[i3];
      const ty = textPositions[i3 + 1];
      const tz = textPositions[i3 + 2];

      // Add noise/wobble during transition
      const wobbleIntensity = Math.sin(t * Math.PI) * 2; 
      const noiseX = (Math.random() - 0.5) * wobbleIntensity * 0.2;
      const noiseY = (Math.random() - 0.5) * wobbleIntensity * 0.2;
      const noiseZ = (Math.random() - 0.5) * wobbleIntensity * 0.5;

      // Interpolate
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
          array={spherePositions} // Initial dummy data, updated in useFrame via attribute
          itemSize={3}
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
        // Initial color only, updates handled by useFrame lerp
        color={new THREE.Color(color)} 
      />
    </points>
  );
};

export default ParticleScene;