// ws/ui/styles.ts
/**
 * CSS样式注入模块
 * 负责将所有UI样式注入到页面中
 */

export function injectStyles(): void {
    const css = `
        /* Settings Button - Refined glassmorphism design */
        #viz-settings-btn {
            position: absolute;
            top: 20px;
            right: 20px;
            width: 44px;
            height: 44px;
            border-radius: 50%;
            background: rgba(10, 10, 10, 0.85);
            border: 1px solid rgba(255, 255, 255, 0.1);
            color: rgba(255, 255, 255, 0.87);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            z-index: 2000;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }
        
        #viz-settings-btn:hover {
            background: rgba(42, 42, 42, 0.9);
            border-color: rgba(255, 255, 255, 0.15);
            transform: rotate(90deg);
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
        }
        
        #viz-settings-btn.active {
            background: #e0e0e0;
            color: #0a0a0a;
            border-color: #e0e0e0;
            box-shadow: 0 0 15px rgba(224, 224, 224, 0.3);
        }

        /* Settings Modal - Centered Window */
        .modal-backdrop {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(4px);
            z-index: 1998;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.3s;
        }

        .modal-backdrop.visible {
            opacity: 1;
            pointer-events: all;
        }

        #viz-settings-modal {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -48%) scale(0.95);
            width: 500px;
            max-height: 80vh;
            background: rgba(18, 18, 18, 0.95);
            backdrop-filter: blur(24px);
            -webkit-backdrop-filter: blur(24px);
            border-radius: 12px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 24px 64px rgba(0, 0, 0, 0.8);
            opacity: 0;
            pointer-events: none;
            transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            z-index: 1999;
            font-family: inherit;
            color: rgba(255, 255, 255, 0.87);
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        
        #viz-settings-modal.visible {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
            pointer-events: all;
        }

        /* Modal Header */
        .viz-modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 20px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            background: rgba(255, 255, 255, 0.02);
            flex-shrink: 0;
        }

        .viz-modal-title {
            font-family: ui-monospace, 'SF Mono', Consolas, monospace;
            font-size: 16px;
            font-weight: 700;
            color: rgba(255, 255, 255, 0.9);
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .viz-modal-close {
            background: transparent;
            border: none;
            color: rgba(255, 255, 255, 0.4);
            cursor: pointer;
            padding: 4px;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
        }

        .viz-modal-close:hover {
            color: #fff;
            background: rgba(255, 255, 255, 0.1);
        }

        /* Modal Content Scroll Area */
        .viz-modal-content {
            padding: 24px;
            overflow-y: auto;
            flex: 1;
        }
        


        /* Custom Scrollbar */
        #viz-settings-modal::-webkit-scrollbar {
            width: 8px;
        }
        
        #viz-settings-modal::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.02);
            border-radius: 4px;
        }
        
        #viz-settings-modal::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 4px;
            transition: background 0.2s;
        }
        
        #viz-settings-modal::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.2);
        }



        /* Section Headers - Matching frontend Control Panel */
        .section-header {
            font-size: 12px;
            font-weight: 400;
            color: rgba(255, 255, 255, 0.3);
            text-transform: uppercase;
            letter-spacing: 0.1em;
            margin: 20px 0 12px 0;
            padding-bottom: 8px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            font-family: ui-monospace, 'SF Mono', Consolas, monospace;
        }

        .section-header:first-of-type {
            margin-top: 0;
        }

        /* Control Wrapper */
        .control-wrapper {
            margin-bottom: 12px;
        }

        .control-label {
            font-size: 11px;
            color: rgba(255, 255, 255, 0.5);
            margin-bottom: 8px;
            text-transform: uppercase;
            font-weight: 600;
            letter-spacing: 0.5px;
            display: block;
        }

        /* Card-style container for special sections */
        .settings-card {
            background: rgba(255, 255, 255, 0.05);
            padding: 12px;
            border-radius: 8px;
            border: 1px solid rgba(255, 255, 255, 0.05);
            margin-bottom: 12px;
            transition: background 0.2s;
        }

        .settings-card:hover {
            background: rgba(255, 255, 255, 0.07);
        }

        /* Toggle Switch - Control Panel Style */
        .toggle-wrapper {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px;
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.05);
            transition: all 0.2s;
            cursor: pointer;
            margin-bottom: 8px;
        }

        .toggle-wrapper:hover {
            border-color: rgba(255, 255, 255, 0.1);
        }

        .toggle-label {
            font-size: 13px;
            font-weight: 600;
            color: rgba(255, 255, 255, 0.87);
            display: flex;
            align-items: center;
            gap: 8px;
            font-family: Inter, system-ui, sans-serif;
        }

        .toggle-switch {
            width: 40px;
            height: 24px;
            border-radius: 9999px;
            background: rgba(255, 255, 255, 0.1);
            position: relative;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .toggle-switch.active {
            background: rgba(34, 197, 94, 0.2); /* green-500/20 */
            border-color: rgba(34, 197, 94, 0.5); /* green-500/50 */
        }

        .toggle-thumb {
            width: 16px;
            height: 16px;
            background: #fff;
            border-radius: 50%;
            position: absolute;
            top: 3px;
            left: 3px;
            transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
        }

        .toggle-switch.active .toggle-thumb {
            transform: translateX(16px);
        }

        /* Segmented Control - Premium design */
        .seg-group {
            display: flex;
            background: rgba(0, 0, 0, 0.3);
            padding: 4px;
            border-radius: 8px;
            gap: 4px;
            border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .seg-btn {
            flex: 1;
            background: transparent;
            border: none;
            padding: 8px 12px;
            color: rgba(255, 255, 255, 0.5);
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            border-radius: 6px;
            transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
            white-space: nowrap;
        }

        .seg-btn:hover {
            color: rgba(255, 255, 255, 0.87);
            background: rgba(255, 255, 255, 0.05);
        }

        .seg-btn.active {
            background: #e0e0e0;
            color: #0a0a0a;
            font-weight: 700;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }

        /* Value Display */
        .val-display {
            font-size: 11px;
            color: #4ade80;
            font-family: ui-monospace, 'SF Mono', Consolas, monospace;
            font-weight: 600;
        }

        /* Slider - Refined design */
        .viz-slider-input {
            -webkit-appearance: none;
            appearance: none;
            width: 100%;
            height: 6px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 3px;
            outline: none;
            transition: background 0.2s;
            margin: 8px 0;
        }

        .viz-slider-input:hover {
            background: rgba(255, 255, 255, 0.15);
        }

        .viz-slider-input::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: #e0e0e0;
            cursor: grab;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
            border: 2px solid rgba(10, 10, 10, 0.8);
        }

        .viz-slider-input::-webkit-slider-thumb:hover {
            transform: scale(1.15);
            box-shadow: 0 3px 12px rgba(0, 0, 0, 0.4);
        }

        .viz-slider-input::-webkit-slider-thumb:active {
            cursor: grabbing;
            transform: scale(1.05);
        }

        .viz-slider-input::-moz-range-thumb {
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: #e0e0e0;
            cursor: grab;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
            border: 2px solid rgba(10, 10, 10, 0.8);
        }

        .viz-slider-input::-moz-range-thumb:hover {
            transform: scale(1.15);
        }

        /* Channel Mixer List - Replaces Grid */
        .mixer-list {
            display: flex;
            flex-direction: column;
            gap: 4px;
            max-height: 400px;
            overflow-y: auto;
            padding-right: 4px;
        }

        .mixer-list::-webkit-scrollbar {
            width: 4px;
        }

        .mixer-list::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 2px;
        }

        .mixer-row {
            display: grid;
            grid-template-columns: 32px 1fr 32px;
            gap: 8px;
            align-items: center;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 6px;
            padding: 8px;
            transition: background 0.2s;
        }

        .mixer-row:hover {
            background: rgba(255, 255, 255, 0.08);
            border-color: rgba(255, 255, 255, 0.1);
        }

        .mixer-col-vis {
            display: flex;
            justify-content: center;
        }

        .mixer-col-name {
            font-size: 11px;
            font-family: ui-monospace, 'SF Mono', Consolas, monospace;
            color: rgba(255, 255, 255, 0.7);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .mixer-col-color {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: #666;
            margin: auto;
            opacity: 0.5;
        }

        .mixer-btn-vis {
            background: transparent;
            border: none;
            cursor: pointer;
            color: rgba(255, 255, 255, 0.2);
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .mixer-btn-vis:hover {
            transform: scale(1.1);
            color: rgba(255, 255, 255, 0.8);
        }

        .mixer-btn-vis.active {
            color: #4ade80; /* Green for visible */
        }

        /* Select Dropdown */
        .viz-select {
            width: 100%;
            background: rgba(0, 0, 0, 0.3);
            color: rgba(255, 255, 255, 0.87);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            padding: 10px 12px;
            font-size: 12px;
            font-weight: 500;
            outline: none;
            cursor: pointer;
            transition: all 0.2s;
            font-family: inherit;
        }

        .viz-select:hover {
            border-color: rgba(255, 255, 255, 0.2);
            background: rgba(0, 0, 0, 0.4);
        }

        .viz-select:focus {
            border-color: #e0e0e0;
            background: rgba(0, 0, 0, 0.5);
        }


        .viz-select option {
            background: #1a1a1a;
            color: rgba(255, 255, 255, 0.87);
            padding: 8px;
        }

        /* --- Analysis HUD --- */
        .hud-container {
            position: fixed;
            bottom: 32px;
            right: 32px;
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 16px;
            z-index: 1000;
            user-select: none;
            font-family: Inter, system-ui, sans-serif;
            pointer-events: none; /* Let clicks pass through */
        }
        
        /* Chord Section */
        .hud-chord-section {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 4px;
            margin-bottom: 8px;
        }
        
        .hud-header {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 8px;
            margin-bottom: 2px;
        }
        
        .hud-source-badge {
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 9px;
            padding: 2px 6px;
            border-radius: 4px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            color: rgba(255, 255, 255, 0.4);
        }
        
        .hud-conf-wrapper {
            width: 32px;
            height: 6px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 999px;
            overflow: hidden;
        }
        
        .hud-conf-bar {
            height: 100%;
            background: #e0e0e0; /* midi-accent */
            width: 0%;
            transition: width 0.2s;
        }
        
        .hud-chord-name {
            font-size: 32px;
            font-weight: 300;
            line-height: 1;
            letter-spacing: -0.02em;
            color: #fff;
            text-shadow: 0 4px 12px rgba(0,0,0,0.5);
            transition: all 0.1s;
        }
        
        .hud-aliases {
            display: flex;
            align-items: center;
            gap: 6px;
            height: 16px;
            overflow: hidden;
        }
        
        .hud-aliases .label {
            font-size: 8px;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            color: rgba(255, 255, 255, 0.5);
        }
        
        .hud-aliases .value {
            font-size: 10px;
            color: rgba(255, 255, 255, 0.6);
            border-bottom: 1px dashed rgba(255, 255, 255, 0.1);
        }
        
        /* Active Notes */
        .hud-notes-row {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-top: 4px;
        }
        
        .hud-notes-row .label {
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            color: rgba(255, 255, 255, 0.4);
        }
        
        .hud-active-notes {
            display: flex;
            flex-wrap: wrap;
            justify-content: flex-end;
            gap: 4px;
            max-width: 200px;
        }
        
        .hud-note-pill {
            font-size: 11px;
            padding: 2px 6px;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 4px;
            color: #e0e0e0;
        }
        
        .hud-note-empty {
            font-size: 12px;
            color: rgba(255, 255, 255, 0.3);
        }
        
        /* Stats Panel */
        .hud-stats-panel {
            background: rgba(10, 10, 10, 0.4);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            pointer-events: auto; /* Allow interaction if expandable later */
            transition: background 0.3s;
        }
        
        .hud-stats-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            width: 100%;
            margin-bottom: 4px;
        }
        
        .hud-stats-header .label {
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.2em;
            color: rgba(255, 255, 255, 0.4);
            display: flex;
            align-items: center;
            gap: 6px;
        }
        
        .hud-fps {
            font-size: 9px;
            color: rgba(255, 255, 255, 0.3);
            font-feature-settings: "tnum";
            font-variant-numeric: tabular-nums;
        }
        
        .hud-fps.low { color: #f87171; font-weight: bold; }
        
        .hud-stats-grid {
            display: flex;
            align-items: center;
            gap: 16px;
        }
        
        .hud-stat-col {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
        }
        
        .hud-stat-col.center { align-items: center; }
        
        .hud-stat-col .label {
            font-size: 9px;
            color: rgba(255, 255, 255, 0.4);
            margin-bottom: 2px;
        }
        
        .hud-stat-col .value {
            font-size: 16px;
            font-weight: 300;
            color: #fff;
            font-feature-settings: "tnum";
            font-variant-numeric: tabular-nums;
        }
        
        .hud-stat-col .value.accent { color: #e0e0e0; }
        
        .hud-stat-col .row {
            display: flex;
            align-items: center;
            gap: 6px;
        }
        
        .hud-stat-col .conf-text {
            font-size: 9px;
            color: rgba(255, 255, 255, 0.4);
            width: 24px;
            text-align: right;
        }
        
        .hud-stat-col .mini-bar-bg {
            width: 32px;
            height: 4px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 999px;
        }
        
        .hud-stat-col .mini-bar-fill {
            height: 100%;
            border-radius: 999px;
            background: #fff;
            width: 50%;
        }
        
        .hud-stat-col .sub-value {
            font-size: 9px;
            color: rgba(255, 255, 255, 0.3);
            margin-top: 2px;
        }
        
        .hud-divider {
            width: 1px;
            height: 24px;
            background: rgba(255, 255, 255, 0.1);
        }
    `;

    const style = document.createElement('style');
    style.innerHTML = css;
    document.head.appendChild(style);
}
