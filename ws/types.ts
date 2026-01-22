// ws/types.ts
import type * as PIXI from 'pixi.js';

// 配置类型
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

// MIDI事件类型
export interface MidiEvent {
    type: 'note_on' | 'note_off';
    note: number;
    velocity: number;
    channel: number;
}

// 和弦分析结果
export interface ChordResult {
    name: string;
    root: number;
    quality: string;
    notes: number[];
}

// 调性检测结果
export interface KeyResult {
    root: number;
    type: 'Major' | 'Minor';
    name: string;
    scaleName: string;
    confidence: number;
}

// 音阶定义
export interface ScaleDefinition {
    intervals: number[];
    chordMap?: Record<number, string>;
}

export type Scales = Record<string, ScaleDefinition>;

// Settings Manager回调类型
export type ConfigChangeCallback = (key: keyof VisualizerConfig, value: any) => void;

// 打击乐Hit类型
export interface PercussionHit {
    sprite: PIXI.Graphics;
    time: number;
    velocity: number;
}
