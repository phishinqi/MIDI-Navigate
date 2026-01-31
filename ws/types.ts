// ws/types.ts
import type * as PIXI from 'pixi.js';

// Config Types
export interface VisualizerConfig {
    // Basic
    scrollDirection: -1 | 1;
    pitchScale: number;
    noteHeight: number;
    playheadPosition: number;
    channelMask: number;

    // Analysis
    showAnalysis: boolean;
    analysisMode: 'chord' | 'roman';
    autoKey: boolean;
    keyRoot: number;
    keyType: string;
    keyHalfLife: number;
    keySensitivity: number;

    // Percussion
    percEnabled: boolean;
    percChannel: number;
    percRows: number;
    percCols: number;
    percBaseSize: number;
    percSpacing: number;
}

// MIDI Event Types
export interface MidiEvent {
    type: 'note_on' | 'note_off';
    note: number;
    velocity: number;
    channel: number;
}

// Chord Analysis Result
export interface ChordResult {
    name: string;
    root: number;
    quality: string;
    notes: number[];
}

// Key Detection Result
export interface KeyResult {
    root: number;
    type: 'Major' | 'Minor';
    name: string;
    scaleName: string;
    confidence: number;
}

// Scale Definitions
export interface ScaleDefinition {
    intervals: number[];
    chordMap?: Record<number, string>;
}

export type Scales = Record<string, ScaleDefinition>;

// Settings Manager Callback Type
export type ConfigChangeCallback = (key: keyof VisualizerConfig, value: any) => void;

// Percussion Hit Type
export interface PercussionHit {
    sprite: PIXI.Graphics;
    time: number;
    velocity: number;
}
