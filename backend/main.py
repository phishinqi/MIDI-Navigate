from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from app.core.config import settings
from app.api import endpoints

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

app.include_router(endpoints.router, prefix=settings.API_V1_STR)

if __name__ == "__main__":
    # reload=True: 开启热重载
    # reload_dirs=["app"]: 强制监控 app 目录及其子目录下的文件变更
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_dirs=["app", "."]
    )
