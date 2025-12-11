# backend/main.py

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from typing import List

from app.core.config import settings
from app.api import endpoints

# --- 1. 新增：WebSocket 连接管理器 ---
class ConnectionManager:
    def __init__(self):
        # 存储所有活跃的 WebSocket 连接
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        """接受新的 websocket 连接并将其添加到列表中"""
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"New client connected. Total clients: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        """从列表中移除断开的 websocket 连接"""
        self.active_connections.remove(websocket)
        print(f"Client disconnected. Remaining clients: {len(self.active_connections)}")

    async def broadcast(self, message: str):
        """将消息广播给所有连接的客户端"""
        # 这是核心功能：将来自 VST 的消息转发给所有浏览器页面
        for connection in self.active_connections:
            await connection.send_text(message)

# 创建一个全局的 ConnectionManager 实例
manager = ConnectionManager()


# --- 2. 创建 FastAPI 应用 (您的原有代码) ---
app = FastAPI(title=settings.PROJECT_NAME)

# 配置 CORS (您的原有代码)
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.BACKEND_CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# --- 3. 新增：定义 WebSocket 端点 ---
@app.websocket("/ws/midi")
async def websocket_endpoint(websocket: WebSocket):
    # 当有新客户端（VST 或浏览器）连接时，接受并管理它
    await manager.connect(websocket)
    try:
        # 无限循环，等待并接收来自该客户端的任何消息
        while True:
            data = await websocket.receive_text()
            print(f"Received message: {data}") # 在后端终端打印收到的数据，用于调试
            # 将收到的消息广播给所有连接的客户端
            await manager.broadcast(data)
    except WebSocketDisconnect:
        # 如果客户端断开连接，就从管理器中移除
        manager.disconnect(websocket)
        print("A client disconnected.")
    except Exception as e:
        # 处理其他可能的异常
        print(f"An error occurred in websocket: {e}")
        manager.disconnect(websocket)


# --- 4. 包含您的 HTTP API 路由 (您的原有代码) ---
app.include_router(endpoints.router, prefix=settings.API_V1_STR)


# --- 5. 启动服务器 (您的原有代码) ---
if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8080,
        reload=True,
        reload_dirs=["app", "."]
    )
