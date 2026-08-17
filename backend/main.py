# backend/main.py

import os
import sys

# --- Compatibility Shim for Python 3.13+ (missing audioop) ---
try:
    import audioop
except ImportError:
    try:
        import audioop_lts as audioop
        sys.modules['audioop'] = audioop
        print(" [Shim] 'audioop' module patched via 'audioop_lts'")
    except ImportError:
        print(" [Warning] 'audioop' module missing. SF2 functionality may crash.")
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
from app.api import endpoints, sf2_routes

# --- 1. Paths & Configuration ---
def get_resource_path(relative_path):
    if getattr(sys, 'frozen', False):
        base_path = os.path.dirname(sys.executable)
    else:
        base_path = os.path.abspath(".")
    return os.path.join(base_path, relative_path)


# Point to dist root
DIST_ROOT = get_resource_path("dist")

# Predefine absolute paths for key files
PATH_ASSETS = os.path.join(DIST_ROOT, "assets")
PATH_WS_DIR = os.path.join(DIST_ROOT, "ws")
PATH_WS_HTML = os.path.join(PATH_WS_DIR, "index.html")
PATH_FRONTEND_HTML = os.path.join(DIST_ROOT, "frontend", "index.html")
PATH_FAVICON = os.path.join(DIST_ROOT, "favicon.ico")


# --- 2. WebSocket Manager ---
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

# --- 3. App Initialization ---
app = FastAPI(title=settings.PROJECT_NAME)

if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.BACKEND_CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


# --- 4. WebSocket Routes ---
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


# --- 5. API Routes ---
app.include_router(endpoints.router, prefix=settings.API_V1_STR)
app.include_router(sf2_routes.router, prefix=f"{settings.API_V1_STR}/sf2", tags=["sf2"])

# --- 6. Static Files & Frontend Hosting [Final Fix] ---

# Print debug info at startup (to verify paths in console)
print("-" * 50)
print(f"Path Check:")
print(f"Root: {DIST_ROOT}")
print(f"Assets: {PATH_ASSETS} -> {os.path.exists(PATH_ASSETS)}")
print(f"WS HTML: {PATH_WS_HTML} -> {os.path.exists(PATH_WS_HTML)}")
print(f"Main HTML: {PATH_FRONTEND_HTML} -> {os.path.exists(PATH_FRONTEND_HTML)}")
print("-" * 50)

if os.path.exists(DIST_ROOT):
    # A. Mount public assets /assets (Highest priority)
    if os.path.exists(PATH_ASSETS):
        app.mount("/assets", StaticFiles(directory=PATH_ASSETS), name="assets")


    # B. [WS Interface] Explicit Handling
    # 1. Redirect /ws/index.html to /ws (Canonical URL)
    @app.get("/ws/index.html")
    async def redirect_ws():
        return RedirectResponse(url="/ws")


    # 2. Serve HTML directly for /ws or /ws/
    @app.get("/ws")
    @app.get("/ws/")
    async def read_ws_page():
        if os.path.exists(PATH_WS_HTML):
            return FileResponse(PATH_WS_HTML)
        return "Error: dist/ws/index.html missing", 404


    # C. [Main Interface] Explicit Handling
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


    # E. 404 Fallback (SPA Routing Support)
    @app.exception_handler(404)
    async def not_found_handler(request, exc):
        path = request.url.path

        # Exclude API, WS, Assets to prevent them from being incorrectly redirected to home
        if path.startswith(("/api", "/ws", "/assets")):
            return None  # Return real 404

        # Treat other unknown paths as frontend routes, return home
        if os.path.exists(PATH_FRONTEND_HTML):
            return FileResponse(PATH_FRONTEND_HTML)
        return None

else:
    print("WARNING: 'dist' folder not found. Running in API-only mode.")

# --- 7. Startup Logic (includes colorama and WebSocket fix) ---
if __name__ == "__main__":

    # Initialize colorama
    colorama.init(autoreset=True)

    # [Modified] Removed file logging config, keeping only basic config (stdout/stderr)
    # This prevents generating server_debug.log in the folder
    logging.basicConfig(level=logging.INFO,
                        format='%(asctime)s - %(levelname)s - %(message)s')

    # stdout redirection (prevents errors in no-console mode)
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

        # Start uvicorn
        uvicorn.run(app, host=host, port=port, log_level="info", reload=False, use_colors=True)

    except Exception as e:
        # If crash occurs, print error to console only, do not write to file
        logging.error(f"Crash: {str(e)}", exc_info=True)
        print(f"Crash: {str(e)}")