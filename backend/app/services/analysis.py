# backend/app/services/analysis.py
import musicpy as mp
import numpy as np
import mido
import io
import logging
import warnings
import pretty_midi
from typing import List, Dict, Optional
from scipy.stats import pearsonr
from scipy.ndimage import gaussian_filter1d
from collections import Counter
from ..schemas import NoteInput, ChordResponse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("midi_analyzer")
warnings.filterwarnings("ignore")


# PART 1: Real-time Chord Analyzer (Musicpy)

class ChordAnalyzer:
    def __init__(self):
        # 预定义音名列表，用于手动转换 MIDI
        self.NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

    def _midi_to_note_name(self, midi_number: int) -> str:
        """
        手动将 MIDI 数字转换为音名 (e.g. 60 -> C4)
        不依赖 musicpy.database，避免版本兼容性问题
        """
        try:
            octave = (midi_number // 12) - 1
            note_idx = midi_number % 12
            name = self.NOTE_NAMES[note_idx]
            return f"{name}{octave}"
        except Exception:
            return "C4"

    def analyze_realtime(self, notes: List[NoteInput]) -> ChordResponse:
        """
        增强版实时分析：包含旋律剥离与多重命名逻辑
        """
        if not notes or len(notes) < 2:
            return ChordResponse(
                root="", quality="", name="---", aliases=[],
                notes=[], type_code="none", confidence=0.0
            )

        try:
            # 1. 预处理：按音高排序 (低 -> 高)
            sorted_notes = sorted(notes, key=lambda n: n.pitch)
            note_names_all = [self._midi_to_note_name(n.pitch) for n in sorted_notes]

            def run_detect(n_names):
                if not n_names: return None
                # 使用 musicpy 的核心 detect 算法
                try:
                    return mp.alg.detect(
                        mp.chord(n_names),
                        change_from_first=True,
                        original_first=True,
                        same_note_special=True,
                        whole_detect=True
                    )
                except Exception as e:
                    logger.warning(f"Musicpy detect failed for {n_names}: {e}")
                    return None

            # 2. 策略 A: 完整检测
            res_full = run_detect(note_names_all)

            # 3. 策略 B: 旋律剥离
            res_peeled = None
            note_names_peeled = []

            # 只有当音符数量足够时才尝试剥离 (至少3个音，剥离后剩2个)
            if len(sorted_notes) >= 3:
                # 去除最高的一个音
                note_names_peeled = note_names_all[:-1]
                res_peeled = run_detect(note_names_peeled)

            # 4. 结果择优 (Selection Heuristic)
            final_res = res_full
            used_notes = note_names_all
            is_peeled = False

            str_full = str(res_full) if res_full else ""
            str_peeled = str(res_peeled) if res_peeled else ""

            # 简单启发式：
            # 如果完整结果包含 "polychord" 或者字符串很长，
            # 而剥离后的结果更简洁，则倾向于认为是带旋律的和弦，采用剥离结果。
            if str_peeled and len(str_peeled) > 0:
                is_complex_full = "poly" in str_full.lower() or len(str_full) > 15
                is_simple_peeled = "poly" not in str_peeled.lower() and len(str_peeled) < 10

                # 如果 Full 检测失败 (None/Empty) 而 Peeled 成功，也使用 Peeled
                if (not str_full) or (is_complex_full and is_simple_peeled):
                    final_res = res_peeled
                    used_notes = note_names_peeled
                    is_peeled = True

            # 5. 解析多重命名
            raw_result_str = str(final_res) if final_res else ""
            aliases = [s.strip() for s in raw_result_str.replace('\r', '\n').split('\n') if s.strip()]

            if not aliases:
                aliases = ["Unknown"]
                primary_name = "---"
            else:
                primary_name = aliases[0]

            # 6. 提取 Root 和 Quality
            root = used_notes[0][:-1] if used_notes else "C"
            if len(primary_name) > 1 and primary_name[1] in ['#', 'b']:
                root = primary_name[:2]
            elif len(primary_name) > 0:
                root = primary_name[0]

            quality = "major"
            lower_name = primary_name.lower()
            if "min" in lower_name or "m" in lower_name and "maj" not in lower_name:
                quality = "minor"
            elif "dim" in lower_name:
                quality = "diminished"
            elif "aug" in lower_name:
                quality = "augmented"
            elif "sus" in lower_name:
                quality = "suspended"

            return ChordResponse(
                root=root,
                quality=quality,
                name=primary_name,
                aliases=aliases,
                notes=used_notes,
                type_code=quality,
                confidence=0.9 if is_peeled else 0.95
            )

        except Exception as e:
            logger.error(f"Realtime analysis error: {e}")
            # 返回一个安全值而不是抛出 500
            return ChordResponse(root="", quality="", name="Error", aliases=[], notes=[], type_code="error",
                                 confidence=0.0)


# 实例化单例
analyzer = ChordAnalyzer()

# PART 2: Legacy Global Analysis (Preserved)
# 用于 MIDI 文件上传时的全局 Key/Timeline 分析

TEMP_MAJOR = np.array([5.0, 2.0, 3.5, 2.0, 4.5, 4.0, 2.0, 4.5, 2.0, 3.5, 1.5, 4.0])
TEMP_MINOR = np.array([5.0, 2.0, 3.5, 4.5, 2.0, 4.0, 2.0, 4.5, 3.5, 2.0, 1.5, 4.0])


def get_candidates(complexity='standard'):
    active_profiles = {'Major': TEMP_MAJOR, 'Minor': TEMP_MINOR}
    pitch_names = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
    candidates = []
    for i, root in enumerate(pitch_names):
        for mode, vec in active_profiles.items():
            shifted_vec = np.roll(vec, i)
            candidates.append({"name": f"{root} {mode}", "vec": shifted_vec, "root_idx": i, "mode": mode})
    return candidates


def smart_decode(bytes_obj):
    try:
        return bytes_obj.decode('utf-8')
    except:
        pass
    try:
        return bytes_obj.decode('shift-jis')
    except:
        pass
    try:
        return bytes_obj.decode('gb18030')
    except:
        pass
    return bytes_obj.decode('latin-1', errors='replace')


def format_tempo_map(times, tempos):
    return [{"time": float(t), "bpm": int(round(r))} for t, r in zip(times, tempos)]


def apply_majority_smoothing(timeline, window_size=5):
    if not timeline or len(timeline) < window_size: return timeline
    smoothed = []
    half = window_size // 2
    for i in range(len(timeline)):
        start = max(0, i - half)
        end = min(len(timeline), i + half + 1)
        slice_data = timeline[start:end]
        votes = Counter([item['main']['name'] for item in slice_data])
        if not votes:
            smoothed.append(timeline[i])
            continue
        winner_key = votes.most_common(1)[0][0]
        if winner_key != timeline[i]['main']['name']:
            best_entry = next((x for x in slice_data if x['main']['name'] == winner_key), None)
            if best_entry:
                new_entry = timeline[i].copy()
                new_entry['main'] = best_entry['main'].copy()
                smoothed.append(new_entry)
            else:
                smoothed.append(timeline[i])
        else:
            smoothed.append(timeline[i])
    return smoothed


def resolve_enharmonics(global_key_idx, global_mode, timeline):
    SHARP_ROOTS = [2, 4, 6, 7, 9, 11]
    FLAT_ROOTS = [5, 10, 3, 8]
    NAMES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    NAMES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
    use_sharps = True
    if global_key_idx == 1:
        use_sharps = (global_mode == 'Minor')
    elif global_key_idx in FLAT_ROOTS:
        use_sharps = False
    elif global_key_idx in SHARP_ROOTS:
        use_sharps = True
    target_names = NAMES_SHARP if use_sharps else NAMES_FLAT
    global_name = f"{target_names[global_key_idx]} {global_mode}"
    for entry in timeline:
        if 'root_idx' in entry['main']:
            idx = entry['main']['root_idx']
            mode = entry['main']['mode']
            entry['main']['name'] = f"{target_names[idx]} {mode}"
    return global_name


def analyze_midi_theory(file_content: bytes, track_indices: list[int] = None, complexity: str = 'standard',
                        window_size: float = 5.0):
    logger.info(f"--- START GLOBAL ANALYSIS ---")
    result = {"key": "Unknown", "time_signature": "4/4", "key_timeline": [], "bpm": 120, "track_metadata": [],
              "tempo_map": [], "meter_map": []}
    try:
        mid = mido.MidiFile(file=io.BytesIO(file_content))
        track_meta = []
        for i, track in enumerate(mid.tracks):
            name = f"Track {i + 1}"
            for msg in track:
                if msg.type == 'track_name':
                    try:
                        name = smart_decode(msg.name.encode('latin-1'))
                    except:
                        name = msg.name
                    break
            track_meta.append({"index": i, "name": name})
        result['track_metadata'] = track_meta
    except:
        pass

    try:
        midi_stream = io.BytesIO(file_content)
        pm = pretty_midi.PrettyMIDI(midi_file=midi_stream)
        try:
            est_tempo = pm.estimate_tempo()
            if est_tempo > 30: result['bpm'] = round(est_tempo)
            tempo_times, tempo_values = pm.get_tempo_changes()
            result['tempo_map'] = format_tempo_map(tempo_times, tempo_values)
        except:
            pass
        try:
            meter_map = []
            for ts in pm.time_signature_changes:
                meter_map.append({"time": float(ts.time), "numerator": ts.numerator, "denominator": ts.denominator,
                                  "str": f"{ts.numerator}/{ts.denominator}"})
            result['meter_map'] = meter_map
            if meter_map: result['time_signature'] = meter_map[0]['str']
        except:
            pass

        pitched_instruments = [i for i in pm.instruments if not i.is_drum]
        if len(pitched_instruments) > 0:
            original_instruments = pm.instruments
            pm.instruments = pitched_instruments
            fs = 10
            chroma = pm.get_chroma(fs=fs)
            pm.instruments = original_instruments
            chroma_context = gaussian_filter1d(chroma, sigma=40, axis=1)
            total_frames = chroma.shape[1]
            candidates = get_candidates(complexity)
            output_step = 5
            raw_timeline = []
            for i in range(0, total_frames, output_step):
                frame_vec = chroma_context[:, i]
                norm = np.linalg.norm(frame_vec)
                if norm > 0: frame_vec = frame_vec / norm
                entry = {"time": i / float(fs), "main": {"name": "---", "conf": 0.0}, "alts": []}
                if norm > 0.01:
                    scored = []
                    for cand in candidates:
                        try:
                            corr, _ = pearsonr(frame_vec, cand['vec'])
                            if not np.isnan(corr): scored.append(cand)
                        except:
                            pass
                    scored.sort(key=lambda x: pearsonr(frame_vec, x['vec'])[0], reverse=True)
                    if scored:
                        top = scored[0]
                        top_corr = pearsonr(frame_vec, top['vec'])[0]
                        entry["main"] = {"name": top['name'], "conf": float(top_corr), "root_idx": top['root_idx'],
                                         "mode": top['mode']}
                        entry["alts"] = []
                        for s in scored[1:4]:
                            s_corr = pearsonr(frame_vec, s['vec'])[0]
                            entry["alts"].append({"name": s['name'], "conf": float(s_corr)})
                raw_timeline.append(entry)
            smoothed_timeline = apply_majority_smoothing(raw_timeline, window_size=5)
            vote_pool = {}
            for item in smoothed_timeline:
                if item['main']['conf'] > 0:
                    k = (item['main']['root_idx'], item['main']['mode'])
                    w = item['main']['conf']
                    vote_pool[k] = vote_pool.get(k, 0) + (w ** 3)
            if vote_pool:
                winner = max(vote_pool, key=vote_pool.get)
                final_key_name = resolve_enharmonics(winner[0], winner[1], smoothed_timeline)
                result['key'] = final_key_name
            result['key_timeline'] = smoothed_timeline
        else:
            logger.info("No pitched instruments found for key analysis.")
    except Exception as e:
        logger.error(f"Analysis Failed: {e}")
    return result
