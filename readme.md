# MIDI-Navigate

**MIDI-Navigate** 是一个功能强大的 Web 应用程序，旨在提供交互式的 MIDI 文件可视化、播放和实时音乐理论分析。

![](backend/logo.ico)

## ✨ 核心功能

- 🎵 **双引擎可视化**: 在两种渲染引擎之间自由切换：
    
    - **Three.js 引擎**: 提供流畅、连续滚动的 3D "瀑布流" 视图，并带有发光效果。
        
    - **p5.js 引擎**: 提供经典的 2D "钢琴卷帘" 视图，以小节为单位进行翻页。
        
- 🎹 **实时和弦分析**: 在 MIDI 播放或实时输入时，应用能够实时识别当前正在演奏的和弦，并显示其根音、属性和别名。
    
- 🎼 **深度 MIDI 分析**: 上传 MIDI 文件后，后端会进行全面的音乐理论分析，包括全局调性、BPM、拍号以及详细的调性变化时间线。
    
- 🥁 **专用打击乐网格**: 无论是 2D 还是 3D 模式，都有一个独立的网格专门用于可视化打击乐轨道，让节奏声部一目了然。
    
- 🎧 **高级播放与路由**:
    
    - 控制主音量、单独静音/独奏任意轨道。
        
    - 支持将 MIDI 输出到外部硬件合成器或虚拟乐器 (WebMIDI API)。
        
- 🎨 **高度可定制化**: 调整背景颜色、音符视觉效果、布局参数等，打造个性化的视觉体验。
    

## 🛠️ 技术栈

- **前端**:
    
    - **框架**: React (Vite)
        
    - **状态管理**: Zustand
        
    - **可视化**: Three.js (@react-three/fiber), p5.js
        
    - **音频/MIDI**: Tone.js, JZZ.js
        
    - **UI**: Radix UI, Tailwind CSS, Lucide Icons
        
- **后端**:
    
    - **框架**: Python, FastAPI
        
    - **MIDI/音乐分析**: Mido, MusicPy, PrettyMidi, Music21
        
    - **服务器**: Uvicorn
        

## 🚀 快速开始

### 环境要求

- Node.js (v18 或更高版本)
    
- Python (v3.10 或更高版本)
    

### 1. 后端设置

```bash
# 1. 进入后端目录
cd backend

# 2. 创建并激活虚拟环境
# Windows
python -m venv .venv
.\.venv\Scripts\activate

# macOS / Linux
python3 -m venv .venv
source .venv/bin/activate

# 3. 安装依赖
pip install -r requirements.txt

# 4. 启动后端开发服务器
# 服务器将运行在 http://localhost:8000
uvicorn main:app --reload
```

### 2. 前端设置

_在一个新的终端窗口中执行以下命令。_

```bash
# 1. 进入前端目录
cd frontend

# 2. 安装依赖
npm install

# 3. 启动前端开发服务器
# 应用将在 http://localhost:5173 上可用
npm run dev
```

现在，您可以通过浏览器访问 **`http://localhost:5173`** 来使用 MIDI-Navigate！

## ⚙️ 工作原理

1. **文件上传**: 用户在前端上传一个 `.mid` 文件。
    
2. **全局分析**: 前端将文件发送到后端的 `/api/v1/analyze/midi-theory` 端点。后端使用 `pretty_midi` 和 `mido` 等库进行全局分析，返回调性、BPM、节拍等信息。
    
3. **播放与调度**: 前端使用 `Tone.js` 精确调度 MIDI 事件的播放。
    
4. **可视化渲染**:
    
    - **Three.js**: 使用 `InstancedMesh` 高效渲染所有音符，并通过 `useFrame` 循环更新音符颜色和摄影机位置。
        
    - **p5.js**: 以小节为单位缓存音符数据，在 `draw` 循环中绘制当前小节的音符，并实现翻页动画。
        
5. **实时分析**: 在播放过程中，前端将当前时刻正在发声的音符数据发送到后端的 `/api/v1/analyze/realtime-chord` 端点。后端利用 `musicpy` 快速分析并返回和弦结果，前端再将结果显示在分析面板上。
    
