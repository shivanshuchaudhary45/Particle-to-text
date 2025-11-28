import * as THREE from 'three';

export interface ParticleState {
  positions: Float32Array; // Current positions
  targets: Float32Array;   // Target text positions
  initials: Float32Array;  // Original sphere positions
}

export enum MorphState {
  SPHERE = 'SPHERE',
  TEXT = 'TEXT',
}

export interface ParticleConfig {
  count: number;
  color: string;
  size: number;
}