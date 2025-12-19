# backend/main.py

import os
import sys
import webbrowser
from typing import List

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# 假设这些模块在你的 app 目录下 (打包时需确保 app 文件夹在正确位置)
from app.core.config import settings
from app.api import endpoints


# --- 1. 核心工具：资源路径获取 (兼容 PyInstaller) ---
def get_resource_path(relative_path):
    """
    获取资源的绝对路径。
    PyInstaller 会将资源解压到 sys._MEIPASS 临时文件夹中。
    """
    if hasattr(sys, '_MEIPASS'):
        return os.path.join(sys._MEIPASS, relative_path)
    return os.path.join(os.path.abspath("."), relative_path)


# 定义前端构建输出目录 (对应 npm run build 生成的 dist)
DIST_DIR = get_resource_path("dist")


# --- 2. WebSocket 连接管理器 ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        # print(f"New client connected. Total: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            # print(f"Client disconnected. Remaining: {len(self.active_connections)}")

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception:
                # 发送失败可能是连接已断开但尚未移除，安全起见忽略或移除
                pass


manager = ConnectionManager()

# --- 3. 创建 FastAPI 应用 ---
app = FastAPI(title=settings.PROJECT_NAME)

# 配置 CORS
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.BACKEND_CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


# --- 4. WebSocket 端点 ---
@app.websocket("/ws/midi")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # print(f"Received: {data}")
            await manager.broadcast(data)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"WebSocket error: {e}")
        manager.disconnect(websocket)


# --- 5. API 路由 (原有功能) ---
app.include_router(endpoints.router, prefix=settings.API_V1_STR)

# --- 6. 静态文件托管 (前端页面) ---
# 只有当 dist 文件夹存在时才挂载，防止开发环境(未 build)报错
if os.path.exists(DIST_DIR):
    # 1. 挂载 assets (CSS, JS, Images)
    # Vite 打包后，静态资源通常在 dist/assets 下
    app.mount("/assets", StaticFiles(directory=os.path.join(DIST_DIR, "assets")), name="assets")

    # 2. 挂载 ws 页面所需的静态资源 (如果 ws/index.html 依赖同级资源)
    ws_dir = os.path.join(DIST_DIR, "ws")
    if os.path.exists(ws_dir):
        # 挂载 /ws 路径下的静态文件
        app.mount("/ws", StaticFiles(directory=ws_dir, html=True), name="ws")


    # 3. 处理主页路由 "/" -> 返回 index.html
    @app.get("/")
    async def read_index():
        return FileResponse(os.path.join(DIST_DIR, "index.html"))


    # 4. 处理 React 路由 (Fallback)
    # 如果用户刷新页面或访问 React 内部路由，始终返回 index.html，交由前端路由处理
    # 注意：这应该放在所有 API 路由之后
    @app.exception_handler(404)
    async def not_found_handler(request, exc):
        # 如果是 API 请求，返回 404
        if request.url.path.startswith("/api") or request.url.path.startswith("/ws/midi"):
            return None
            # 否则返回前端页面
        return FileResponse(os.path.join(DIST_DIR, "index.html"))
else:
    print(f"警告: 未找到目录 '{DIST_DIR}'。请先运行 'npm run build'。")

# --- 7. 启动服务器 ---
if __name__ == "__main__":
    # 自动打开浏览器
    host = "0.0.0.0"
    port = 8080
    url = f"http://127.0.0.1:{port}"

    print(f"Starting server at {url} ...")
    webbrowser.open(url)

    # 启动 Uvicorn
    # 注意：打包成 EXE 时，reload 必须为 False，否则会产生多进程错误
    # 传递 app 对象而不是字符串 "main:app"
    uvicorn.run(app, host=host, port=port, log_level="info", reload=False)