// ws/ui/controls.ts
/**
 * UI控件创建模块
 * 提供各种UI控件的创建函数
 */

/**
 * 创建section header
 */
export function createSectionHeader(parent: HTMLElement, text: string): void {
    const h = document.createElement('div');
    h.className = 'section-header';
    h.innerText = text;
    parent.appendChild(h);
}

/**
 * 创建Toggle开关
 */
export function createToggle(label: string, checked: boolean, onChange: (value: boolean) => void): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'toggle-wrapper';

    const lbl = document.createElement('div');
    lbl.className = 'toggle-label';
    lbl.innerText = label;

    const toggle = document.createElement('div');
    toggle.className = `toggle-switch ${checked ? 'active' : ''}`;

    const thumb = document.createElement('div');
    thumb.className = 'toggle-thumb';
    toggle.appendChild(thumb);

    const handleClick = () => {
        checked = !checked;
        toggle.classList.toggle('active', checked);
        onChange(checked);
    };

    wrapper.onclick = handleClick;
    wrapper.append(lbl, toggle);
    return wrapper;
}

/**
 * 创建分段控件 (Segmented Control)
 */
export function createSegmentedControl<T>(
    label: string,
    options: Array<{ label: string, value: T }>,
    curr: T,
    onChange: (value: T) => void
): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'control-wrapper';
    const lbl = document.createElement('div');
    lbl.className = 'control-label';
    lbl.innerText = label;
    wrapper.appendChild(lbl);
    const group = document.createElement('div');
    group.className = 'seg-group';
    options.forEach(opt => {
        const btn = document.createElement('button');
        btn.innerText = opt.label;
        btn.className = `seg-btn ${opt.value === curr ? 'active' : ''}`;
        btn.onclick = () => {
            group.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            onChange(opt.value);
        };
        group.appendChild(btn);
    });
    wrapper.appendChild(group);
    return wrapper;
}

/**
 * 创建滑块控件
 */
export function createSlider(
    label: string,
    min: number,
    max: number,
    step: number,
    val: number,
    onChange: (value: number) => void
): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'control-wrapper';
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;justify-content:space-between';
    const lbl = document.createElement('div');
    lbl.className = 'control-label';
    lbl.innerText = label;
    const valDisplay = document.createElement('span');
    valDisplay.className = 'val-display';
    valDisplay.innerText = String(val);
    header.append(lbl, valDisplay);
    wrapper.appendChild(header);
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(val);
    input.className = 'viz-slider-input';
    input.oninput = (e) => {
        const v = parseFloat((e.target as HTMLInputElement).value);
        valDisplay.innerText = String(v);
        onChange(v);
    };
    wrapper.appendChild(input);
    return wrapper;
}

/**
 * 创建通道网格
 */
/**
 * 创建通道列表 (Mixer Style)
 */
export function createChannelGrid(
    isChannelEnabled: (ch: number) => boolean,
    toggleChannel: (ch: number) => void
): HTMLElement {
    const list = document.createElement('div');
    list.className = 'mixer-list';

    // Mock colors for channels 1-16 (just to match the colorful look of frontend mixer)
    const mockColors = [
        '#ef4444', '#f97316', '#f59e0b', '#84cc16',
        '#10b981', '#06b6d4', '#3b82f6', '#6366f1',
        '#8b5cf6', '#d946ef', '#f43f5e', '#fb7185',
        '#e11d48', '#be123c', '#9f1239', '#881337'
    ];

    for (let i = 0; i < 16; i++) {
        const row = document.createElement('div');
        row.className = 'mixer-row';

        // 1. Visibility Button (Eye Icon)
        const visCol = document.createElement('div');
        visCol.className = 'mixer-col-vis';
        const visBtn = document.createElement('button');
        const enabled = isChannelEnabled(i);
        visBtn.className = `mixer-btn-vis ${enabled ? 'active' : ''}`;

        // Icons
        const iconEye = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;
        const iconEyeOff = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.05A10.59 10.59 0 0 1 12 5c7 0 10 7 10 7a13.12 13.12 0 0 1-5.47 5.76"/><path d="M2 2l20 20"/><path d="M17.77 17.77A10.58 10.58 0 0 1 12 19c-7 0-10-7-10-7a13.12 13.12 0 0 1 5.47-5.76"/></svg>`;

        visBtn.innerHTML = enabled ? iconEye : iconEyeOff;

        visBtn.onclick = () => {
            toggleChannel(i);
            const newState = !enabled; // Note: This local var toggle logic is simplified, real state comes from re-render usually, but for DOM:
            // Actually, best to rebuild or toggle class.
            // Since we don't have full React reactivity, we manually toggle classes/icons for immediate feedback
            const isNowActive = visBtn.classList.toggle('active');
            visBtn.innerHTML = isNowActive ? iconEye : iconEyeOff;
        };
        visCol.appendChild(visBtn);

        // 2. Track Name
        const nameCol = document.createElement('div');
        nameCol.className = 'mixer-col-name';
        nameCol.innerText = `Channel ${i + 1}`; // Basic name since we don't have MIDI parsing here yet
        if (i === 9) nameCol.innerText += ' (Percussion)';

        // 3. Color Indicator (Stylistic Only)
        const colorCol = document.createElement('div');
        colorCol.className = 'mixer-col-vis'; // reusing center alignment
        const dot = document.createElement('div');
        dot.className = 'mixer-col-color';
        dot.style.backgroundColor = mockColors[i];
        if (enabled) dot.style.opacity = '1';
        colorCol.appendChild(dot);

        row.appendChild(visCol);
        row.appendChild(nameCol);
        row.appendChild(colorCol);
        list.appendChild(row);
    }
    return list;
}
