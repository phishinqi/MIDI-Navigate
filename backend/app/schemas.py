# backend/app/schemas.py
from pydantic import BaseModel
from typing import List, Optional, Any

class NoteInput(BaseModel):
    pitch: int
    velocity: int = 64

class AnalysisRequest(BaseModel):
    notes: List[NoteInput]
    detect_type: str = "standard"

class ChordResponse(BaseModel):
    root: str
    quality: str
    name: str          # 主要名称 (e.g. "C Maj7")
    aliases: List[str] # [NEW] 别名列表，包含 Musicpy 的所有推断
    notes: List[str]
    type_code: str
    confidence: float = 1.0

class AnalysisResponse(BaseModel):
    chord: ChordResponse
    timestamp: float

# 保持原有文件分析的响应结构兼容性
class FileAnalysisResponse(BaseModel):
    filename: str
    basic_stats: dict
    music_theory: dict
    message: str
