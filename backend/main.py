# backend/main.py

import os
import sys
import webbrowser
import logging
import colorama
from typing import List

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, RedirectResponse

from app.core.config import settings
from app.api import endpoints


# --- 1. 路径与配置 ---
def get_resource_path(relative_path):
    if getattr(sys, 'frozen', False):
        base_path = os.path.dirname(sys.executable)
    else:
        base_path = os.path.abspath(".")
    return os.path.join(base_path, relative_path)


# 指向 dist 根目录
DIST_ROOT = get_resource_path("dist")
PATH_ASSETS = os.path.join(DIST_ROOT, "assets")
PATH_WS_DIR = os.path.join(DIST_ROOT, "ws")
PATH_WS_HTML = os.path.join(PATH_WS_DIR, "index.html")
PATH_FRONTEND_HTML = os.path.join(DIST_ROOT, "frontend", "index.html")
PATH_FAVICON = os.path.join(DIST_ROOT, "favicon.ico")


# --- 2. WebSocket 管理器 ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception:
                pass


manager = ConnectionManager()

# --- 3. App 初始化 ---
app = FastAPI(title=settings.PROJECT_NAME)

if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.BACKEND_CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


# --- 4. WebSocket 路由 ---
@app.websocket("/ws/midi")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            await manager.broadcast(data)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        manager.disconnect(websocket)


# --- 5. API 路由 ---
app.include_router(endpoints.router, prefix=settings.API_V1_STR)

# --- 6. 静态文件与前端托管 [终极修正版] ---

# 启动时打印调试信息
print("-" * 50)
print(f"Path Check:")
print(f"Root: {DIST_ROOT}")
print(f"Assets: {PATH_ASSETS} -> {os.path.exists(PATH_ASSETS)}")
print(f"WS HTML: {PATH_WS_HTML} -> {os.path.exists(PATH_WS_HTML)}")
print(f"Main HTML: {PATH_FRONTEND_HTML} -> {os.path.exists(PATH_FRONTEND_HTML)}")
print("-" * 50)

if os.path.exists(DIST_ROOT):
    # A. 挂载公共资源 /assets
    if os.path.exists(PATH_ASSETS):
        app.mount("/assets", StaticFiles(directory=PATH_ASSETS), name="assets")


    # B. [WS 界面] 显式处理
    # 1. 访问 /ws/index.html 时，重定向到 /ws (规范 URL)
    @app.get("/ws/index.html")
    async def redirect_ws():
        return RedirectResponse(url="/ws")


    # 2. 访问 /ws 或 /ws/ 时，直接返回 HTML 文件
    @app.get("/ws")
    @app.get("/ws/")
    async def read_ws_page():
        if os.path.exists(PATH_WS_HTML):
            return FileResponse(PATH_WS_HTML)
        return "Error: dist/ws/index.html missing", 404


    # C. [主界面] 显式处理
    @app.get("/")
    async def read_index():
        if os.path.exists(PATH_FRONTEND_HTML):
            return FileResponse(PATH_FRONTEND_HTML)
        return "Error: dist/frontend/index.html missing", 404


    # D. Favicon
    @app.get("/favicon.ico")
    async def favicon():
        if os.path.exists(PATH_FAVICON):
            return FileResponse(PATH_FAVICON)
        return None, 404


    # E. 404 兜底 (SPA 路由支持)
    @app.exception_handler(404)
    async def not_found_handler(request, exc):
        path = request.url.path

        # 排除 API, WS, Assets，防止它们被错误地重定向到主页
        if path.startswith(("/api", "/ws", "/assets")):
            return None  # 返回真正的 404

        # 其他未知路径认为是前端路由，返回主页
        if os.path.exists(PATH_FRONTEND_HTML):
            return FileResponse(PATH_FRONTEND_HTML)
        return None

else:
    print("WARNING: 'dist' folder not found. Running in API-only mode.")

# --- 7. 启动逻辑 (含 colorama 和 WebSocket 修复) ---
if __name__ == "__main__":

    colorama.init(autoreset=True)
    logging.basicConfig(level=logging.INFO,
                        format='%(asctime)s - %(levelname)s - %(message)s')

    # stdout 重定向处理 (防止无控制台模式报错)
    if sys.stdout is None: sys.stdout = open(os.devnull, "w")
    if sys.stderr is None: sys.stderr = open(os.devnull, "w")

    host = "0.0.0.0"
    port = 8080
    url = f"http://127.0.0.1:{port}"
    ws_url = f"http://127.0.0.1:{port}/ws"

    try:
        webbrowser.open(url)
        print(f"Main App: {url}")
        print(f"WS Test:  {ws_url}")

        # 启动 uvicorn
        uvicorn.run(app, host=host, port=port, log_level="info", reload=False, use_colors=True)

    except Exception as e:
        logging.error(f"Crash: {str(e)}", exc_info=True)
        print(f"Crash: {str(e)}")