from fastapi import APIRouter, File, UploadFile, HTTPException, Query, Response
from typing import List, Optional
import shutil
import os
import tempfile
from ..services.sf2_service import SF2Manager

router = APIRouter()

# Store uploaded SF2 file in a persistent temp location or specific asset folder
SF2_STORAGE_DIR = "assets/sf2_uploads"
os.makedirs(SF2_STORAGE_DIR, exist_ok=True)

@router.post("/upload")
async def upload_sf2(file: UploadFile = File(...)):
    if not file.filename.lower().endswith('.sf2'):
        raise HTTPException(status_code=400, detail="Invalid file type. Must be .sf2")

    file_location = os.path.join(SF2_STORAGE_DIR, "current_input.sf2")
    
    try:
        # Stream write to disk
        with open(file_location, "wb+") as file_object:
            shutil.copyfileobj(file.file, file_object)
            
        # Load into Service
        manager = SF2Manager.get_instance()
        success = manager.load_file(file_location)
        
        if not success:
             raise HTTPException(status_code=500, detail="Failed to parse SF2 file.")
             
        return {
            "filename": file.filename, 
            "status": "loaded", 
            "size": os.path.getsize(file_location),
            "presets_count": len(manager.presets_cache)
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/map")
def get_sample_map(
    bank: int = Query(..., description="Bank"),
    program: int = Query(..., description="Program")
):
    manager = SF2Manager.get_instance()
    try:
        if not manager.current_sf2:
            # Try reload
            file_location = os.path.join(SF2_STORAGE_DIR, "current_input.sf2")
            if os.path.exists(file_location):
                manager.load_file(file_location)
            else:
                return {"status": "no_file", "map": []}

        return {"status": "ok", "map": manager.get_sample_map(bank, program)}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/simple_status")
def simple_status():
    return {"status": "ok"}


@router.get("/presets")
def get_presets():
    manager = SF2Manager.get_instance()
    if not manager.current_sf2:
        # If file exists on disk but not loaded (server restart), try loading default
        file_location = os.path.join(SF2_STORAGE_DIR, "current_input.sf2")
        if os.path.exists(file_location):
            manager.load_file(file_location)
        else:
            return {"status": "no_file", "presets": []}
            
    return {"status": "ready", "presets": manager.get_presets()}

@router.get("/sample")
def get_sample(
    bank: int = Query(..., description="Bank number"),
    program: int = Query(..., description="Program/Preset number"),
    note: int = Query(..., description="MIDI Note Number"),
    velocity: int = Query(100, description="Velocity")
):
    manager = SF2Manager.get_instance()
    if not manager.current_sf2:
         # Try reload
        file_location = os.path.join(SF2_STORAGE_DIR, "current_input.sf2")
        if os.path.exists(file_location):
            manager.load_file(file_location)
        else:
            raise HTTPException(status_code=404, detail="No SF2 loaded")

    wav_data = manager.get_sample_data(bank, program, note, velocity)
    
    if not wav_data:
        # Return 404 or maybe a silent empty buffer? 
        # 404 is better for debugging.
        raise HTTPException(status_code=404, detail="Sample not found for this note mapping")
        
    return Response(content=wav_data, media_type="audio/wav")
