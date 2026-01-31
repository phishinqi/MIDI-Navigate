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
    name: str          # Primary Name (e.g. "C Maj7")
    aliases: List[str] # [NEW] List of aliases, containing all musicpy inferences
    notes: List[str]
    type_code: str
    confidence: float = 1.0

class AnalysisResponse(BaseModel):
    chord: ChordResponse
    timestamp: float

# Maintain compatibility with existing file analysis response structure
class FileAnalysisResponse(BaseModel):
    filename: str
    basic_stats: dict
    music_theory: dict
    message: str
