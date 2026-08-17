import os
import io
import wave
import logging
from typing import Dict, List, Optional, Tuple
from sf2utils.sf2parse import Sf2File
import threading
import traceback

logger = logging.getLogger(__name__)

class SF2Manager:
    """
    Manages loading of SF2 files and extraction of samples on demand.
    This is a singleton-like service to hold the currently loaded heavy SF2 object in memory
    (or at least the parsed structure, sf2utils is lazy-ish).
    """
    _instance = None
    
    def __init__(self):
        self.current_sf2: Optional[Sf2File] = None
        self.sf2_file_handle = None
        self.filepath: Optional[str] = None
        self.presets_cache: List[Dict] = []
        self.lock = threading.Lock()

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = SF2Manager()
        return cls._instance

    def load_file(self, filepath: str) -> bool:
        """
        Loads an SF2 file and caches its presets.
        """
        with self.lock:
            if not os.path.exists(filepath):
                logger.error(f"SF2 file not found: {filepath}")
                return False

            try:
                # Cleanup previous handle if exists
                if self.sf2_file_handle:
                    try:
                        self.sf2_file_handle.close()
                    except:
                        pass
                    self.sf2_file_handle = None

                logger.info(f"Loading SF2: {filepath}")
                # Store the file handle instance to keep it open for lazy loading
                self.sf2_file_handle = open(filepath, 'rb')
                self.current_sf2 = Sf2File(self.sf2_file_handle)
                
                self.filepath = filepath
                # Pre-cache preset list
                self.presets_cache = []
                if self.current_sf2.presets:
                    for p in self.current_sf2.presets:
                        try:
                            # sf2utils includes EOP sentinel which has no bank/preset attributes
                            # Check attributes directly just in case name varies
                            if not hasattr(p, 'bank') or not hasattr(p, 'preset'):
                                 # specific check for EOP to reduce log noise
                                 if getattr(p, 'name', '') != 'EOP':
                                     logger.warning(f"Skipping malformed preset: {getattr(p, 'name', 'Unknown')}")
                                 continue

                            self.presets_cache.append({
                                "bank": p.bank,
                                "program": p.preset,
                                "name": p.name,
                                "preset_obj": p # keep reference if needed, or lookup later
                            })
                        except Exception as e:
                            logger.warning(f"Error processing preset {getattr(p, 'name', 'Unknown')}: {e}")
                            continue
                
                logger.info(f"SF2 Loaded. Found {len(self.presets_cache)} presets.")
                return True
            except Exception as e:
                logger.error(f"Failed to load SF2: {e}")
                self.current_sf2 = None
                self.presets_cache = []
                if self.sf2_file_handle: # Added this cleanup
                    self.sf2_file_handle.close()
                    self.sf2_file_handle = None
                return False

    def get_presets(self) -> List[Dict]:
        return [{"bank": p["bank"], "program": p["program"], "name": p["name"]} for p in self.presets_cache]

    def get_sample_data(self, bank: int, program: int, note: int, velocity: int = 100) -> Optional[bytes]:
        """
        Extracts the specific WAV audio data for a Note/Velocity.
        """
        with self.lock:
            if not self.current_sf2:
                return None

            try:
                sample, _ = self._find_preset_and_sample(bank, program, note, velocity)
                if sample:
                    return self._export_sample_wav(sample, note)
                return None

            except Exception as e:
                logger.error(f"Error extracting sample: {e}")
                import traceback # Added this import
                traceback.print_exc()
                return None

    def _find_preset_and_sample(self, bank: int, program: int, note: int, velocity: int) -> Tuple[Optional[object], Optional[object]]:
        """
        Helper to find the specific sample object for a note/velocity.
        Returns (sample_obj, preset_obj)
        """
        # Lock is held by caller
        if not self.current_sf2:
            return None, None

        preset = None
        for p in self.current_sf2.presets:
            if p.bank == bank and p.preset == program:
                preset = p
                break
        
        if not preset:
            return None, None

        # Preset -> Bags (Zones) -> Generators -> Instrument
        for bag in preset.bags:
            low_key, high_key = 0, 127
            low_vel, high_vel = 0, 127
            
            if bag.key_range:
                low_key, high_key = bag.key_range
            
            if bag.velocity_range:
                low_vel, high_vel = bag.velocity_range

            if not (low_key <= note <= high_key):
                continue
            if not (low_vel <= velocity <= high_vel):
                continue
                
            # Check if it points to an instrument
            if bag.instrument:
                inst = bag.instrument
                # Traverse Instrument Zones
                for ibag in inst.bags:
                    i_low_key, i_high_key = 0, 127
                    i_low_vel, i_high_vel = 0, 127
                        
                    if ibag.key_range:
                        i_low_key, i_high_key = ibag.key_range
                    if ibag.velocity_range:
                        i_low_vel, i_high_vel = ibag.velocity_range
                        
                    if not (i_low_key <= note <= i_high_key):
                        continue
                    if not (i_low_vel <= velocity <= i_high_vel):
                        continue
                        
                    if ibag.sample:
                        return ibag.sample, preset
        
        return None, preset

    def get_sample_map(self, bank: int, program: int) -> List[Dict]:
        """
        Returns a list of unique samples used by this instrument (at velocity 100).
        Optimized to iterate zones instead of scanning 128 notes.
        """
        with self.lock:
            if not self.current_sf2:
                return []

            unique_samples = {} # id -> data

            try:
                # 1. Find Preset
                preset = None
                for p in self.current_sf2.presets:
                    if p.bank == bank and p.preset == program:
                        preset = p
                        break
                
                if not preset:
                    logger.warning(f"Preset not found: {bank}:{program}")
                    return []

                # 2. Iterate Zones (Bags) with Global Zone Inheritance logic
                
                # Helper to check if a bag is global
                # Global bags must be the FIRST bag and have no target (instrument/sample) usually?
                # Actually, per spec: The first zone IS global if it does not have a generator referencing the next level.
                # But sf2utils represents everything as bags.
                
                # Preset Level
                global_p_gens = {}
                if preset.bags:
                    first_bag = preset.bags[0]
                    # If it has no instrument, it's global? 
                    # Or just rely on order. 
                    # Let's simple-check: check if it has key/vel range. 
                    # Global zones MUST NOT have key/vel ranges.
                    if not first_bag.key_range and not first_bag.velocity_range and not first_bag.instrument:
                         global_p_gens = getattr(first_bag, 'generators', {})

                for pbag in preset.bags:
                    # If this is the global bag, skip it (we already captured it, or it doesn't contain notes)
                    if pbag is preset.bags[0] and global_p_gens:
                        continue

                    # Filter Preset Velocity (approximate check for vel 100)
                    p_vel_low, p_vel_high = pbag.velocity_range or (0, 127)
                    if not (p_vel_low <= 100 <= p_vel_high):
                        continue

                    p_key_low, p_key_high = pbag.key_range or (0, 127)

                    inst = pbag.instrument
                    if not inst:
                        continue
                        
                    # Preset Generators (Local)
                    local_p_gens = getattr(pbag, 'generators', {})

                    # Instrument Level
                    global_i_gens = {}
                    if inst.bags:
                        first_ibag = inst.bags[0]
                        if not first_ibag.key_range and not first_ibag.velocity_range and not first_ibag.sample:
                            global_i_gens = getattr(first_ibag, 'generators', {})

                    for ibag in inst.bags:
                        # Skip global instrument bag
                        if ibag is inst.bags[0] and global_i_gens:
                            continue
                            
                        # Filter Instrument Velocity
                        i_vel_low, i_vel_high = ibag.velocity_range or (0, 127)
                        if not (i_vel_low <= 100 <= i_vel_high):
                            continue
                        
                        if not ibag.sample:
                            continue

                        i_key_low, i_key_high = ibag.key_range or (0, 127)

                        # Intersection of Key Ranges
                        start = max(p_key_low, i_key_low)
                        end = min(p_key_high, i_key_high)

                        if start <= end:
                            sample = ibag.sample
                            if not sample: 
                                continue
                                
                            local_i_gens = getattr(ibag, 'generators', {})

                            # --- Generator Resolution Helper ---
                            def get_gen_sum(gen_id):
                                # ID 51: Coarse Tune (Add all layers)
                                # P_Global + P_Local + I_Global + I_Local
                                val = 0
                                for g_set in [global_p_gens, local_p_gens, global_i_gens, local_i_gens]:
                                    if isinstance(g_set, dict):
                                        val += g_set.get(gen_id, 0)
                                    elif isinstance(g_set, list):
                                         for g in g_set:
                                            if getattr(g, 'oper', None) == gen_id:
                                                val += getattr(g, 'amount', getattr(g, 'val', 0))
                                return val

                            def get_gen_priority(gen_id, default=None):
                                # ID 58: Overriding Root Key (Last layer wins? Or Instrument level wins?)
                                # Spec: Instrument Generator overrides default.
                                # Priority: I_Local > I_Global. (Preset doesn't set root key usually)
                                
                                # Check I_Local
                                # Handle list or dict. Assuming dict.
                                if isinstance(local_i_gens, dict):
                                     if gen_id in local_i_gens: return local_i_gens[gen_id]
                                elif isinstance(local_i_gens, list):
                                     for g in local_i_gens:
                                        if getattr(g, 'oper', None) == gen_id:
                                            return getattr(g, 'amount', getattr(g, 'val', default))

                                # Check I_Global
                                if isinstance(global_i_gens, dict):
                                     if gen_id in global_i_gens: return global_i_gens[gen_id]
                                elif isinstance(global_i_gens, list):
                                     for g in global_i_gens:
                                        if getattr(g, 'oper', None) == gen_id:
                                            return getattr(g, 'amount', getattr(g, 'val', default))
                                
                                return default

                            # 1. Determine Root Key
                            # overridingRootKey (Gen 58)
                            root_key = get_gen_priority(58) # I_Local or I_Global
                            
                            if root_key is None:
                                root_key = getattr(sample, 'original_pitch', 60)
                                
                            # 2. Apply Coarse Tune (Gen 51)
                            coarse_tune = get_gen_sum(51)
                            root_key += coarse_tune

                            # 3. Determine Trigger Note
                            trigger_note = root_key
                            if not (start <= trigger_note <= end):
                                trigger_note = start
                            
                            # 4. Percussion Bank (128) - Force 1:1 playback
                            if bank == 128:
                                root_key = trigger_note

                            # Unique Identifier: SampleID + RootKey
                            s_id = f"{id(sample)}_{root_key}"
                            
                            if s_id not in unique_samples:
                                unique_samples[s_id] = {
                                    "root_key": int(root_key),
                                    "trigger_note": int(trigger_note),
                                    "name": str(getattr(sample, 'name', 'Unknown'))
                                }

            except Exception as e:
                logger.error(f"Error in get_sample_map: {e}")
                import traceback
                traceback.print_exc()
                return []
            
            return list(unique_samples.values())

    def _export_sample_wav(self, sample, original_pitch_override=None) -> bytes:
        """
        Converts an sf2utils sample object to WAV bytes.
        """
        # sample object has: .data (raw PCM 16-bit signed), .sample_rate, .original_pitch, .pitch_correction
        
        # Audio Data in SF2 is 16-bit little endian usually.
        # sf2utils .data returns raw bytes or array?
        # It usually provides a way to get data. sample.raw_sample_data is the property or sample.data?
        # Let's assume sample.data is a byte string of 16-bit PCM.
        
        # sf2utils 1.0.0+ 
        # sample.raw_data might be needed.
        # Let's wrap it in a WAV container.
        
        # Note: We need start/end loop points? 
        # For a simple "render" we might just want the whole sample or looped?
        # For this engine, let's just dump the raw full 1-shot buffer. 
        # The frontend can loop it if it reads loop points.
        # But for 'Offline Render', we actually usually want the 1-shot.
        
        # NOTE: Browser tone.js sampler will pitch shift it.
        # We need to send the Root Key in headers or metadata, 
        # OR we assume the frontend requests it knowing the mapping.
        # Actually standard SF2 mapping: The sample has an 'originalPitch'.
        
        data = sample.raw_sample_data # property in sf2utils
        
        # Write WAV
        buffer = io.BytesIO()
        with wave.open(buffer, 'wb') as wav_file:
            wav_file.setnchannels(1) # SF2 is mono samples usually (linked for stereo)
            wav_file.setsampwidth(2) # 16-bit
            wav_file.setframerate(sample.sample_rate)
            wav_file.writeframes(data)
            
        return buffer.getvalue()
