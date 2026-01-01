# MIDI-Navigate

MIDI-Navigate 是一个现代化的 MIDI 可视化工具，结合了 React 前端和 Python 后端，提供沉浸式的 3D/2D 音乐可视化体验。

## ✨ 主要特性

*   **实时可视化**: 支持基于 Three.js 和 P5.js 的动态 MIDI 数据渲染，提供惊艳的视觉效果。
*   **交互式播放控制**: 内置播放器支持播放、暂停、静音、进度跳转等功能。
*   **拖拽导入**: 支持通过拖拽或文件选择器 (`global-file-input`) 快速导入 MIDI 文件。
*   **个性化定制**:
    *   **轨道设置**: 可自定义轨道颜色和音符颜色。
    *   **Zen 模式**: 按 `Z` 键进入沉浸式模式，隐藏无关 UI。
    *   **主题适配**: 支持自动或强制的深色/浅色文本对比度适配。
*   **实时分析**: 内置 HUD 显示实时音频分析数据。
*   **多语言支持**: 完整的国际化 (i18n) 支持。

## ⌨️ 快捷键

| 按键 | 功能 |
| :--- | :--- |
| `Space` | 播放 / 暂停 |
| `Z` | 切换 Zen 模式 (隐藏 UI) |
| `S` | 打开 / 关闭设置面板 |
| `M` | 静音 / 取消静音 |
| `O` | 打开文件选择器 |

## 🛠️ 技术栈

### 前端 (Frontend)
*   **框架**: React 18, Vite 5
*   **样式**: TailwindCSS, Radix UI
*   **图形/动画**: 
    *   Three.js (`@react-three/fiber`, `@react-three/drei`)
    *   P5.js (`react-p5`)
    *   GSAP
*   **状态管理**: Zustand
*   **音频处理**: Tone.js (间接), JZZ
*   **其他**: i18next (国际化), Lucide React (图标)

### 后端 (Backend)
*   **核心**: Python 3.8+
*   **Web 框架**: FastAPI, Uvicorn
*   **MIDI 处理**: MusicPy, Mido, PrettyMIDI
*   **数据校验**: Pydantic

## 🚀 安装与运行

### 环境要求
*   Node.js 18+
*   Python 3.8+

### 1. 后端设置 (Backend)

进入 `backend` 目录并创建虚拟环境：

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

# 安装依赖
pip install -r ../requirements.txt
```

启动后端服务器：

```bash
# 开发模式
python main.py
# 或直接使用 uvicorn
uvicorn main:app --reload
```

### 2. 前端设置 (Frontend)

进入根目录（或 `frontend` 目录，视项目结构而定，此处假设 `package.json` 在根目录）：

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

打开浏览器访问控制台输出的地址 (通常是 `http://localhost:5173`) 即可体验。

## 📦 构建

```bash
npm run build
```

构建产物将输出到 `dist` 目录。

## 📄 许可证

[MIT License](LICENSE)
