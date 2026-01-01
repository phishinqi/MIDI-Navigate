# backend/app/api/endpoints.py
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Body
from typing import Any
import mido
import io
import json
import time
from ..services.analysis import analyze_midi_theory, analyzer
from ..schemas import AnalysisRequest, AnalysisResponse, FileAnalysisResponse

router = APIRouter()


@router.get("/health")
def health_check() -> Any:
    return {"status": "online", "system": "MIDI-Navigate Audio-Reactive Engine", "backend": "musicpy-enabled"}


@router.post("/analyze/chord", response_model=AnalysisResponse)
async def analyze_chord_realtime(request: AnalysisRequest):
    """
    [NEW] Realtime Chord Detection via Musicpy
    接收前端发送的实时 MIDI 音符，返回 musicpy 分析结果
    """
    try:
        # 调用 musicpy 封装服务
        chord_data = analyzer.analyze_realtime(request.notes)

        return AnalysisResponse(
            chord=chord_data,
            timestamp=time.time()
        )
    except Exception as e:
        print(f"Realtime Analysis Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload", response_model=FileAnalysisResponse)
async def upload_midi(
        file: UploadFile = File(...),
        complexity: str = Form('standard'),
        window_size: float = Form(5.0)
) -> Any:
    if not file.filename.endswith((".mid", ".midi")):
        raise HTTPException(status_code=400, detail="Invalid file format.")

    try:
        content = await file.read()

        # Basic Mido Parse for Stats
        memory_file = io.BytesIO(content)

        # 这会自动修正超出 0-127 范围的异常 MIDI 数据字节，防止抛出 OSError
        mid = mido.MidiFile(file=memory_file, clip=True)

        # Deep Analysis (Legacy Global Analysis)
        theory_data = analyze_midi_theory(content, None, complexity, window_size)

        return FileAnalysisResponse(
            filename=file.filename,
            basic_stats={"track_count": len(mid.tracks), "duration_seconds": mid.length},
            music_theory=theory_data,
            message="Analysis complete."
        )

    except OSError as e:
        # 专门捕获 mido 的数据错误
        print(f"MIDI Format Error: {e}")
        raise HTTPException(status_code=400, detail=f"MIDI file corrupted or non-standard: {str(e)}")
    except Exception as e:
        print(f"Upload Error: {e}")
        raise HTTPException(status_code=500, detail=f"Server error processing file: {str(e)}")


@router.post("/analyze")
async def reanalyze_midi(
        file: UploadFile = File(...),
        track_indices: str = Form(...),
        complexity: str = Form('standard'),
        window_size: float = Form(5.0)
) -> Any:
    try:
        content = await file.read()
        indices = json.loads(track_indices)

        print(f"Re-analyzing: {indices}, Mode: {complexity}, Win: {window_size}s")
        theory_data = analyze_midi_theory(content, indices, complexity, window_size)

        return {
            "music_theory": theory_data,
            "message": "Re-analysis complete."
        }
    except Exception as e:
        print(e)
        raise HTTPException(status_code=500, detail=str(e))