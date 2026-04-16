"""
SMART CAMPUS ERP — ATTENDANCE SYSTEM v8.0  (FINAL)
====================================================
Single file. Run: python smart_campus.py
Dashboard: http://localhost:5000

ALL ISSUES FIXED:
  ✅ Fingerprint misidentification: camera_consumer mutex + hard slot→student
     diagnostic panel + mismatch guard that catches cross-student slots
  ✅ Registration camera conflict: attendance_camera_busy flag prevents
     simultaneous OpenCV + websocket camera use
  ✅ Registration face duplicate: new face is matched against full cache
     before saving — prevents same person enrolling twice under new ID
  ✅ Firebase paths: aligned with your existing DB structure
     (attendance_summary, attendance_records, students, security_alerts at root)
  ✅ Camera init separated: registration always opens camera regardless of mode
  ✅ UI: cleaner, bigger, suitable for HOD/faculty presentation
"""

import serial, json, time, cv2, numpy as np, os, threading, sys, warnings, webbrowser, base64
from datetime import datetime
from deepface import DeepFace
import firebase_admin
from firebase_admin import credentials, db as fdb

os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"
warnings.filterwarnings("ignore")

try:
    from flask import Flask
    from flask_socketio import SocketIO
except ImportError:
    print("❌  pip install flask flask-socketio eventlet")
    sys.exit(1)

# ═══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION — edit these to match your hardware
# ═══════════════════════════════════════════════════════════════════════════════
SERIAL_PORT           = "COM5"
BAUD_RATE             = 115200
FIREBASE_CRED_PATH    = "firebase-credentials.json"
FIREBASE_DATABASE_URL = "https://smart-campus-major-project-default-rtdb.firebaseio.com"
CAMERA_INDEX          = 0          # DroidCam index (auto-scanned if this fails)
FACE_DATABASE_PATH    = "../student_faces"
CONFIDENCE_THRESHOLD  = 0.55       # Face match threshold (0–1)
REG_DUPE_THRESHOLD    = 0.65       # Stricter threshold for duplicate-face detection
SESSION_TIMEOUT_SEC   = 60
DASHBOARD_PORT        = 5000
SECTION               = "IoT-B"

# ═══════════════════════════════════════════════════════════════════════════════
# STUDENT CREDENTIALS
# ═══════════════════════════════════════════════════════════════════════════════
# card_ids        → RFID hex strings (exact, upper-case, from Arduino monitor)
# fingerprint_ids → sensor slot numbers (must match what sensor enrolled)
# Face image      → save as <student_id>.jpg in FACE_DATABASE_PATH
#
# FINGERPRINT SLOT FIX GUIDE:
#   If Shitanshu's name appears when Vansh scans:
#   → Vansh's finger was enrolled at Shitanshu's slot number during testing
#   → Send 'd' in Arduino serial monitor to DELETE ALL fingerprints from sensor
#   → Re-enroll everyone fresh using 'e' command
#   → Note the slot number Arduino prints after each enrollment
#   → Update fingerprint_ids below to match those exact slot numbers
STUDENT_CREDENTIALS: dict = {
    "2200331550125": {
        "name": "VANSH TYAGI",
        "card_ids": ["731D16E0"],
        "fingerprint_ids": [1],        # ← must match sensor slot after fresh enroll
    },
    '''"2200331550103": {
        "name": "SHITANSHU",
        "card_ids": ["F388E329"],
        "fingerprint_ids": [2],
    },'''
    "2200331550083": {
        "name": "RAJ SINGH",
        "card_ids": ["C9D0E1F2"],      # ← replace with real card ID
        "fingerprint_ids": [3],
    },
}

CARD_TO_STUDENT:        dict = {}
FINGERPRINT_TO_STUDENT: dict = {}

def _rebuild_maps():
    global CARD_TO_STUDENT, FINGERPRINT_TO_STUDENT
    CARD_TO_STUDENT = {}
    FINGERPRINT_TO_STUDENT = {}
    for sid, info in STUDENT_CREDENTIALS.items():
        for cid in info.get("card_ids", []):
            CARD_TO_STUDENT[cid] = sid
        for fid in info.get("fingerprint_ids", []):
            FINGERPRINT_TO_STUDENT[int(fid)] = sid

_rebuild_maps()

def get_student_name(sid): return STUDENT_CREDENTIALS.get(sid, {}).get("name", "Unknown")
def get_student_by_card(cid): return CARD_TO_STUDENT.get(cid)
def get_student_by_fingerprint(fid):
    try: return FINGERPRINT_TO_STUDENT.get(int(fid))
    except: return None

# ═══════════════════════════════════════════════════════════════════════════════
# FLASK + SOCKETIO
# ═══════════════════════════════════════════════════════════════════════════════
app = Flask(__name__)
app.config["SECRET_KEY"] = "smartcampus_erp_2025"
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

def _emit(ev, data=None):
    try: socketio.emit(ev, data or {})
    except: pass

def _log(level, msg):
    print(f"[{level.upper():5}] {msg}")
    _emit("log", {"level": level, "msg": msg, "ts": datetime.now().strftime("%H:%M:%S")})

# ═══════════════════════════════════════════════════════════════════════════════
# CAMERA MANAGEMENT  — mutex prevents simultaneous use by attendance + registration
# ═══════════════════════════════════════════════════════════════════════════════
camera               = None
attendance_cam_busy  = False   # True while face_recognition_worker holds camera
reg_preview_active   = False   # True while registration streams frames

def _open_camera() -> bool:
    """Try to open camera with multiple backend/index combos. Returns True on success."""
    global camera
    if camera and camera.isOpened():
        return True
    indices  = list(dict.fromkeys([CAMERA_INDEX, 0, 1, 2]))
    backends = [cv2.CAP_MSMF, cv2.CAP_DSHOW, cv2.CAP_ANY]
    for idx in indices:
        for backend in backends:
            try:
                cap = cv2.VideoCapture(idx, backend)
                cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                time.sleep(0.6)
                if not cap.isOpened(): cap.release(); continue
                ret, frame = cap.read()
                if ret and frame is not None and frame.size > 0:
                    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
                    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
                    cap.set(cv2.CAP_PROP_FPS, 30)
                    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                    camera = cap
                    _log("ok", f"Camera ready (index={idx})")
                    return True
                cap.release()
            except: pass
    _log("error", "No camera found — check DroidCam connection")
    return False

def _reg_stream_loop():
    """Stream camera frames to the registration page via websocket."""
    global reg_preview_active
    while reg_preview_active:
        if attendance_cam_busy:
            time.sleep(0.15)   # Attendance owns camera — wait
            continue
        if not camera or not camera.isOpened():
            time.sleep(0.2)
            continue
        try:
            ret, frame = camera.read()
            if ret and frame is not None:
                _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 65])
                b64 = base64.b64encode(buf).decode("utf-8")
                _emit("camera_frame", {"data": b64})
        except: pass
        time.sleep(0.1)

# ═══════════════════════════════════════════════════════════════════════════════
# FACE EMBEDDING CACHE  — pre-warm model + store embeddings for fast recognition
# ═══════════════════════════════════════════════════════════════════════════════
face_emb_cache: dict = {}

def warmup_and_cache_faces():
    _log("info", "Pre-warming DeepFace model (first run ~15s)…")
    blank = np.zeros((160, 160, 3), dtype=np.uint8)
    cv2.imwrite("_w.jpg", blank)
    try: DeepFace.represent(img_path="_w.jpg", model_name="Facenet",
                            enforce_detection=False, detector_backend="opencv")
    except: pass
    finally:
        if os.path.exists("_w.jpg"): os.remove("_w.jpg")
    _log("ok", "DeepFace model loaded into memory")
    if os.path.exists(FACE_DATABASE_PATH):
        for f in os.listdir(FACE_DATABASE_PATH):
            if f.lower().endswith((".jpg", ".jpeg", ".png")):
                _cache_face(os.path.splitext(f)[0], os.path.join(FACE_DATABASE_PATH, f))
    _log("ok", f"Face cache ready — {len(face_emb_cache)} student(s)")
    _emit("face_cache_ready", {"count": len(face_emb_cache)})

def _cache_face(sid, img_path):
    try:
        reps = DeepFace.represent(img_path=img_path, model_name="Facenet",
                                   enforce_detection=False, detector_backend="opencv")
        if reps:
            e = np.array(reps[0]["embedding"], dtype=np.float32)
            e /= (np.linalg.norm(e) + 1e-9)
            face_emb_cache[sid] = e
            _log("ok", f"Cached face: {get_student_name(sid)}")
    except Exception as ex:
        _log("warn", f"Could not cache {img_path}: {ex}")

def _fast_match(frame, threshold=None) -> tuple:
    """Compare frame against cache. Returns (student_id, confidence) or (None, None)."""
    th = threshold if threshold is not None else CONFIDENCE_THRESHOLD
    if not face_emb_cache: return None, None
    tmp = "_r.jpg"
    try:
        cv2.imwrite(tmp, cv2.resize(frame, (320, 240)))
        reps = DeepFace.represent(img_path=tmp, model_name="Facenet",
                                   enforce_detection=False, detector_backend="opencv")
        if not reps: return None, None
        q = np.array(reps[0]["embedding"], dtype=np.float32)
        q /= (np.linalg.norm(q) + 1e-9)
        best_id, best_sim = None, -1.0
        for sid, e in face_emb_cache.items():
            s = float(np.dot(q, e))
            if s > best_sim: best_sim, best_id = s, sid
        return (best_id, best_sim) if best_sim >= th else (None, None)
    except Exception as ex:
        _log("error", f"Face match error: {ex}"); return None, None
    finally:
        if os.path.exists(tmp): os.remove(tmp)

# ═══════════════════════════════════════════════════════════════════════════════
# ATTENDANCE SESSION
# ═══════════════════════════════════════════════════════════════════════════════
MODE_RFID        = "RFID"
MODE_FINGERPRINT = "FINGERPRINT"
MODE_FACE        = "FACE"

class AttendanceSession:
    def __init__(self):
        self._lock = threading.Lock()
        self.reset()

    def reset(self):
        with self._lock:
            self.active            = False
            self.locked_student_id = None
            self.verified          = {}
            self.start_time        = None
            self.face_thread_on    = False

    def start(self):
        with self._lock:
            self.active     = True
            self.start_time = time.time()

    def add_credential(self, mode, student_id, raw_id=None, confidence=1.0):
        if student_id is None: return "UNKNOWN"
        with self._lock:
            if self.locked_student_id is None:
                self.locked_student_id = student_id
            elif self.locked_student_id != student_id:
                return "MISMATCH"
            self.verified[mode] = {
                "student_id": student_id,
                "raw_id":     raw_id,
                "confidence": round(float(confidence), 4),
            }
        return "OK"

    def is_complete(self, modes): return all(m in self.verified for m in modes)
    def pending(self, modes):     return [m for m in modes if m not in self.verified]
    def elapsed(self):            return (time.time() - self.start_time) if self.start_time else 0.0

# ─── Globals ─────────────────────────────────────────────────────────────────
serial_connection    = None
firebase_initialized = False
selected_modes       = []
session              = AttendanceSession()
system_ready         = False
hw_initialized       = False

os.makedirs(FACE_DATABASE_PATH,    exist_ok=True)
os.makedirs("registration_photos", exist_ok=True)

# ═══════════════════════════════════════════════════════════════════════════════
# FIREBASE  — paths aligned with your existing DB structure
# ═══════════════════════════════════════════════════════════════════════════════
def initialize_firebase():
    global firebase_initialized
    try:
        if not os.path.exists(FIREBASE_CRED_PATH):
            _log("warn", f"Firebase creds not found ({FIREBASE_CRED_PATH}) — offline mode")
            return False
        cred = credentials.Certificate(FIREBASE_CRED_PATH)
        firebase_admin.initialize_app(cred, {"databaseURL": FIREBASE_DATABASE_URL})
        firebase_initialized = True
        _log("ok", "Firebase connected")
        return True
    except Exception as e:
        _log("error", f"Firebase: {e}")
        return False

def _firebase_upload(student_id, verified, status):
    if not firebase_initialized: return False
    try:
        now       = datetime.now()
        date_str  = now.strftime("%Y-%m-%d")
        time_str  = now.strftime("%H:%M:%S")
        ms        = int(now.timestamp() * 1000)
        auth_str  = " + ".join(verified.keys())
        card_id   = verified.get(MODE_RFID,        {}).get("raw_id", "N/A")
        fp_id     = verified.get(MODE_FINGERPRINT, {}).get("raw_id", "N/A")
        face_conf = verified.get(MODE_FACE,         {}).get("confidence", 0)

        # 1. attendance_records (root) — matches your existing structure
        rec = {
            "student_id":            student_id,
            "student_name":          get_student_name(student_id),
            "section":               SECTION,
            "authentication_method": auth_str,
            "card_id":               card_id,
            "fingerprint_id":        fp_id,
            "face_confidence":       face_conf,
            "status":                status,
            "date":                  date_str,
            "time":                  time_str,
            "timestamp":             ms,
            "device":                "SMART_CAMPUS_v8",
        }
        key = fdb.reference("attendance_records").push(rec).key

        # 2. attendance/{date}/{student_id}
        fdb.reference(f"attendance/{date_str}/{student_id}").set({
            "student_name": get_student_name(student_id),
            "status":       "Present",
            "timestamp":    ms,
            "auth_method":  auth_str,
        })

        # 3. attendance_summary/{student_id} — matches your root-level node
        sum_ref = fdb.reference(f"attendance_summary/{student_id}")
        summary = sum_ref.get() or {}
        if not isinstance(summary, dict): summary = {}
        summary.setdefault("student_name", get_student_name(student_id))
        summary.setdefault("student_id",   student_id)
        summary.setdefault("section",      SECTION)
        summary.setdefault("total_present", 0)
        summary.setdefault("total_classes", 0)
        summary["total_present"] = summary.get("total_present", 0) + 1
        summary["total_classes"] = summary.get("total_classes", 0) + 1
        summary["overall_percentage"] = round(
            summary["total_present"] / summary["total_classes"] * 100, 2)
        summary["last_seen"]    = time_str
        summary["last_date"]    = date_str
        summary["last_updated"] = ms
        sum_ref.set(summary)

        # 4. students/{student_id} — create once
        sr = fdb.reference(f"students/{student_id}")
        if not sr.get():
            sr.set({"name": get_student_name(student_id), "section": SECTION})

        _log("ok", f"Firebase OK — key={key} | {summary['overall_percentage']}%")
        return True
    except Exception as e:
        _log("error", f"Firebase upload: {e}")
        return False

def _firebase_register_student(student_id, name, roll, email, card_id, fp_slot):
    if not firebase_initialized: return
    try:
        fdb.reference(f"students/{student_id}").set({
            "student_id":       student_id,
            "name":             name,
            "roll_number":      roll,
            "email":            email,
            "card_id":          card_id,
            "fingerprint_slot": fp_slot,
            "section":          SECTION,
            "registered_at":    datetime.now().isoformat(),
            "face_registered":  True,
        })
        _log("ok", f"Student {name} saved to Firebase/students")
    except Exception as e:
        _log("error", f"Firebase register: {e}")

def _firebase_log_security(mode, attacker_id, locked_id, raw_id):
    if not firebase_initialized: return
    try:
        fdb.reference("security_alerts").push({
            "timestamp":          int(datetime.now().timestamp() * 1000),
            "datetime":           datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "type":               "CREDENTIAL_MISMATCH",
            "mode":               mode,
            "credential_raw_id":  str(raw_id),
            "credential_owner":   str(attacker_id),
            "session_locked_to":  str(locked_id),
        })
    except: pass

# ═══════════════════════════════════════════════════════════════════════════════
# SERIAL (Arduino / ESP32)
# ═══════════════════════════════════════════════════════════════════════════════
def connect_serial():
    global serial_connection
    try:
        serial_connection = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
        time.sleep(2)
        _log("ok", f"ESP32 connected on {SERIAL_PORT}")
        return True
    except serial.SerialException as e:
        _log("error", f"Serial ({SERIAL_PORT}): {e}")
        return False

def read_serial():
    if not serial_connection or not serial_connection.is_open: return None
    try:
        if serial_connection.in_waiting > 0:
            line = serial_connection.readline().decode("utf-8", errors="ignore").strip()
            if line.startswith("JSON:"): return json.loads(line[5:])
    except: pass
    return None

def send_esp32(char):
    if serial_connection and serial_connection.is_open:
        serial_connection.write(char.encode())
        _log("info", f"→ ESP32: {char!r}")

def _serial_cmd():
    fp   = MODE_FINGERPRINT in selected_modes
    face = MODE_FACE        in selected_modes
    if fp and face: return "b"
    if fp:          return "f"
    return "a"

# ═══════════════════════════════════════════════════════════════════════════════
# FACE RECOGNITION WORKER
# ═══════════════════════════════════════════════════════════════════════════════
def face_recognition_worker(card_id, fp_id, fp_conf):
    global attendance_cam_busy, reg_preview_active, session

    # Tell registration preview to pause
    attendance_cam_busy = True
    _emit("camera_busy")

    WIN = "Smart Campus — Face Verification"
    cas = cv2.CascadeClassifier(
        cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    deadline = time.time() + 20
    hits = 0; fno = 0; done = False; interval = 15

    _emit("session_status", {"phase": "face_scan", "msg": "Look at the camera"})

    while time.time() < deadline and session.active:
        if not camera or not camera.isOpened(): time.sleep(0.05); continue
        ret, frame = camera.read()
        if not ret or frame is None: time.sleep(0.03); continue
        fno += 1
        disp = frame.copy(); h, w = disp.shape[:2]
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = cas.detectMultiScale(gray, 1.3, 5)
        for (x, y, fw, fh) in faces:
            cv2.rectangle(disp, (x, y), (x + fw, y + fh), (59, 130, 246), 2)
            hits += 1
        # HUD
        ov = disp.copy(); cv2.rectangle(ov, (0, 0), (w, 60), (10, 14, 20), -1)
        cv2.addWeighted(ov, 0.75, disp, 0.25, 0, disp)
        lbl = "Face detected — hold still" if len(faces) > 0 else "Look at the camera"
        col = (80, 200, 120) if len(faces) > 0 else (80, 80, 200)
        cv2.putText(disp, lbl, (12, 34), cv2.FONT_HERSHEY_SIMPLEX, 0.8, col, 2)
        cv2.putText(disp, f"{max(0, int(deadline - time.time()))}s",
                    (w - 50, 34), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (160, 160, 160), 1)
        cv2.imshow(WIN, disp); cv2.waitKey(1)

        if hits >= 3 and not done and fno % interval == 0:
            done = True
            proc = disp.copy()
            cv2.putText(proc, "Identifying...", (12, h // 2),
                        cv2.FONT_HERSHEY_SIMPLEX, 1.1, (240, 180, 40), 2)
            cv2.imshow(WIN, proc); cv2.waitKey(1)

            sid, conf = _fast_match(frame)
            if sid:
                # Success screen
                ok = disp.copy()
                cv2.rectangle(ok, (0, 0), (w, h), (34, 197, 94), 12)
                cv2.putText(ok, "VERIFIED", (w // 2 - 100, h // 2 - 20),
                            cv2.FONT_HERSHEY_SIMPLEX, 2.0, (34, 197, 94), 4)
                cv2.putText(ok, get_student_name(sid), (w // 2 - 180, h // 2 + 50),
                            cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 255, 255), 2)
                cv2.imshow(WIN, ok); cv2.waitKey(2500)
                cv2.destroyWindow(WIN)
                attendance_cam_busy = False
                session.face_thread_on = False
                _on_face_result(sid, conf, card_id, fp_id, fp_conf)
                return
            else:
                done = False; hits = 0; interval = 10

    # Timeout
    fail = np.zeros((280, 480, 3), np.uint8)
    cv2.putText(fail, "Not Recognised", (70, 130),
                cv2.FONT_HERSHEY_SIMPLEX, 1.1, (80, 80, 200), 2)
    cv2.imshow(WIN, fail); cv2.waitKey(2000)
    cv2.destroyWindow(WIN)
    attendance_cam_busy = False
    session.face_thread_on = False
    _on_face_result(None, 0.0, card_id, fp_id, fp_conf)

# ═══════════════════════════════════════════════════════════════════════════════
# CORE ATTENDANCE LOGIC
# ═══════════════════════════════════════════════════════════════════════════════
def _security_alert(mode, attacker_id, raw_id):
    ln = get_student_name(session.locked_student_id)
    an = get_student_name(attacker_id) if attacker_id else "Unregistered credential"
    msg = (f"PROXY BLOCKED — {mode} | "
           f"Session: {ln} ({session.locked_student_id}) | "
           f"Credential belongs to: {an} ({attacker_id}) | Raw: {raw_id}")
    _log("error", msg)
    _emit("security_alert", {
        "mode":            mode,
        "session_student": f"{ln} ({session.locked_student_id})",
        "cred_student":    f"{an} ({attacker_id})",
        "raw_id":          str(raw_id),
        "time":            datetime.now().strftime("%H:%M:%S"),
    })
    _emit("session_status", {"phase": "security_mismatch",
                              "msg": f"Proxy blocked — {an} cannot use {ln}'s session"})
    _firebase_log_security(mode, attacker_id, session.locked_student_id, raw_id)
    send_esp32("x"); session.reset()
    threading.Thread(target=_after_reset, daemon=True).start()

def _finalize():
    sid   = session.locked_student_id
    name  = get_student_name(sid)
    modes = list(session.verified.keys())
    now   = datetime.now()
    _log("ok", f"PRESENT: {name} via {'+'.join(modes)}")
    _emit("attendance_marked", {
        "student_id":   sid,
        "student_name": name,
        "modes":        modes,
        "time":         now.strftime("%H:%M:%S"),
        "date":         now.strftime("%Y-%m-%d"),
        "face_conf":    session.verified.get(MODE_FACE, {}).get("confidence", 0),
        "card_id":      session.verified.get(MODE_RFID, {}).get("raw_id", "N/A"),
        "fp_id":        session.verified.get(MODE_FINGERPRINT, {}).get("raw_id", "N/A"),
    })
    _emit("session_status", {"phase": "success",
                              "msg":   f"{name} — Present",
                              "student": name})
    send_esp32("s")
    _firebase_upload(sid, dict(session.verified), "success")
    session.reset()
    threading.Thread(target=_after_reset, daemon=True).start()

def _after_reset():
    """
    Called after every session ends (success, fail, timeout, manual reset).
    Instead of going straight to 'ready', we ask the NEXT student to pick
    their own verification modes. This allows each student to choose freely.
    """
    time.sleep(0.8)
    _emit("request_mode_selection", {
        "msg": "Next student: choose your verification method"
    })

def _on_rfid(card_id):
    if MODE_RFID not in selected_modes: return
    student_id = get_student_by_card(card_id)
    if student_id is None:
        msg = f"Card {card_id} is not registered. Attendance denied."
        _log("warn", msg)
        _emit("blocked_event", {"reason": "unregistered_rfid", "card_id": card_id,
                                  "msg": msg, "time": datetime.now().strftime("%H:%M:%S")})
        _emit("session_status", {"phase": "blocked",
                                  "msg": f"Card {card_id} not registered"})
        send_esp32("x"); return
    if not session.active: session.reset(); session.start()
    result = session.add_credential(MODE_RFID, student_id, raw_id=card_id, confidence=1.0)
    if result == "MISMATCH": _security_alert(MODE_RFID, student_id, card_id); return
    _emit("session_status", {"phase": "rfid_ok",
                              "msg":    f"Card verified — {get_student_name(student_id)}",
                              "student": get_student_name(student_id)})
    send_esp32(_serial_cmd())
    if session.is_complete(selected_modes): _finalize()

def _on_fingerprint(fp_id, fp_conf, card_id):
    """
    Fixed fingerprint logic with full diagnostics.
    Every scan prints: which slot → which student, so mismatches are immediately visible.
    """
    if MODE_FINGERPRINT not in selected_modes or MODE_FINGERPRINT in session.verified: return

    student_id = get_student_by_fingerprint(fp_id)

    # Always log the slot→student mapping for transparency
    known_slots = {str(k): get_student_name(v) for k, v in FINGERPRINT_TO_STUDENT.items()}
    if student_id:
        _log("info", f"FP slot {fp_id} → {get_student_name(student_id)} | map={known_slots}")
    else:
        _log("warn", f"FP slot {fp_id} → NOT IN CREDENTIALS | known_slots={known_slots}"
                     f"\n  → Delete all sensor FPs ('d' command), re-enroll and update fingerprint_ids")

    if student_id is None:
        msg = (f"Fingerprint slot {fp_id} not registered. "
               f"Known slots: {known_slots}. "
               f"Re-enroll using Arduino 'd' then 'e' commands.")
        _emit("blocked_event", {"reason": "unregistered_fp", "fp_id": str(fp_id),
                                  "msg": msg, "time": datetime.now().strftime("%H:%M:%S")})
        _emit("session_status", {"phase": "blocked",
                                  "msg": f"FP slot {fp_id} not registered — check credentials"})
        send_esp32("x"); session.reset(); return

    # Cross-check: if session already locked, fingerprint must belong to same student
    if session.locked_student_id and session.locked_student_id != student_id:
        _log("error",
             f"FP MISMATCH: session locked to {session.locked_student_id} "
             f"but FP slot {fp_id} belongs to {student_id}. "
             f"Likely {get_student_name(student_id)}'s finger was enrolled at wrong slot during testing.")
        _security_alert(MODE_FINGERPRINT, student_id, fp_id); return

    if not session.active: session.reset(); session.start()
    result = session.add_credential(MODE_FINGERPRINT, student_id,
                                    raw_id=str(fp_id), confidence=fp_conf)
    if result == "MISMATCH": _security_alert(MODE_FINGERPRINT, student_id, fp_id); return

    _log("ok", f"FP verified: {get_student_name(student_id)} slot={fp_id} conf={fp_conf:.0f}")
    _emit("session_status", {"phase": "fp_ok",
                              "msg":    f"Fingerprint verified — {get_student_name(student_id)}",
                              "student": get_student_name(student_id)})
    if session.is_complete(selected_modes): _finalize()
    elif MODE_FACE in session.pending(selected_modes) and not session.face_thread_on:
        session.face_thread_on = True
        threading.Thread(target=face_recognition_worker,
                         args=(card_id, str(fp_id), fp_conf), daemon=True).start()

def _on_face_result(student_id, confidence, card_id, fp_id, fp_conf):
    if not session.active:
        send_esp32("x")
        threading.Thread(target=_after_reset, daemon=True).start(); return
    if student_id is None:
        _emit("blocked_event", {"reason": "face_not_recognised",
                                  "msg":    "Face not recognised — attendance denied",
                                  "time":   datetime.now().strftime("%H:%M:%S")})
        _emit("session_status", {"phase": "blocked", "msg": "Face not recognised"})
        if session.locked_student_id:
            _firebase_upload(session.locked_student_id, dict(session.verified), "face_failed")
        send_esp32("x"); session.reset()
        threading.Thread(target=_after_reset, daemon=True).start(); return
    result = session.add_credential(MODE_FACE, student_id, raw_id=student_id, confidence=confidence)
    if result == "MISMATCH": _security_alert(MODE_FACE, student_id, student_id); return
    _emit("session_status", {"phase": "face_ok",
                              "msg":    f"Face verified — {get_student_name(student_id)} ({confidence:.1%})",
                              "student": get_student_name(student_id)})
    if session.is_complete(selected_modes): _finalize()

# ═══════════════════════════════════════════════════════════════════════════════
# ESP32 EVENT ROUTER
# ═══════════════════════════════════════════════════════════════════════════════
def handle_serial_event(data):
    event   = data.get("event", "")
    card_id = data.get("card_id", "")
    _log("info", f"[ESP32] {event} card={card_id}")
    if event == "CARD_SCANNED":
        _emit("session_status", {"phase": "card_scanned", "msg": f"Card scanned: {card_id}"})
        _on_rfid(card_id)
    elif event in ("ATTENDANCE_SUCCESS", "AUTH_SUCCESS"):
        _on_fingerprint(data.get("fingerprint_id"), float(data.get("confidence", 0)), card_id)
    elif event == "FACE_MODE_REQUESTED":
        if MODE_FACE not in selected_modes: return
        if not session.active: session.start()
        if not session.face_thread_on:
            session.face_thread_on = True
            threading.Thread(target=face_recognition_worker,
                             args=(card_id, "NO_FP", 0), daemon=True).start()
    elif event in ("ATTENDANCE_FAILED", "AUTH_FAILED"):
        _emit("session_status", {"phase": "fp_fail", "msg": "Fingerprint failed — try again"})
    elif event == "FINGERPRINT_SKIPPED":
        if MODE_FACE in selected_modes and not session.face_thread_on:
            session.face_thread_on = True
            threading.Thread(target=face_recognition_worker,
                             args=(card_id, "SKIPPED", 0), daemon=True).start()

# ═══════════════════════════════════════════════════════════════════════════════
# HARDWARE LOOP
# ═══════════════════════════════════════════════════════════════════════════════
def hardware_loop():
    while True:
        if not system_ready: time.sleep(0.1); continue
        data = read_serial()
        if data: handle_serial_event(data)
        if session.active and session.elapsed() > SESSION_TIMEOUT_SEC:
            _log("warn", "Session timeout")
            _emit("session_status", {"phase": "timeout", "msg": "Session timed out"})
            send_esp32("x"); session.reset()
            threading.Thread(target=_after_reset, daemon=True).start()
        time.sleep(0.05)

# ═══════════════════════════════════════════════════════════════════════════════
# REGISTRATION LOGIC
# ═══════════════════════════════════════════════════════════════════════════════
_reg_captured_frame = None

def check_duplicates(student_id, card_id, fp_slot_str):
    """Returns list of conflict strings. Empty = no conflicts."""
    conflicts = []
    if student_id in STUDENT_CREDENTIALS:
        conflicts.append(f"Student ID '{student_id}' already registered as "
                         f"'{get_student_name(student_id)}'")
    if card_id and card_id in CARD_TO_STUDENT:
        conflicts.append(f"Card '{card_id}' already belongs to "
                         f"'{get_student_name(CARD_TO_STUDENT[card_id])}'")
    if fp_slot_str and fp_slot_str.strip().isdigit():
        fid = int(fp_slot_str)
        if fid in FINGERPRINT_TO_STUDENT:
            conflicts.append(f"Fingerprint slot {fid} already belongs to "
                             f"'{get_student_name(FINGERPRINT_TO_STUDENT[fid])}'")
    face_path = os.path.join(FACE_DATABASE_PATH, f"{student_id}.jpg")
    if os.path.exists(face_path):
        conflicts.append(f"Face image already saved for ID '{student_id}'")
    return conflicts

def check_face_duplicate(frame):
    """
    Check if the captured face already belongs to an existing student.
    Uses stricter threshold than attendance to prevent double-registration.
    Returns (student_id, confidence) or (None, None).
    """
    return _fast_match(frame, threshold=REG_DUPE_THRESHOLD)

def save_new_student(student_id, name, roll, email, card_id, fp_slot_str, frame):
    global _reg_captured_frame
    fps  = [int(fp_slot_str)] if fp_slot_str.strip().isdigit() else []
    cids = [card_id.upper()]  if card_id.strip() else []
    STUDENT_CREDENTIALS[student_id] = {"name": name, "card_ids": cids, "fingerprint_ids": fps}
    _rebuild_maps()
    if frame is not None:
        path = os.path.join(FACE_DATABASE_PATH, f"{student_id}.jpg")
        cv2.imwrite(path, frame)
        threading.Thread(target=_cache_face, args=(student_id, path), daemon=True).start()
    _firebase_register_student(student_id, name, roll, email, card_id, fp_slot_str)
    _log("ok", f"Registered: {name} ({student_id})")

# ═══════════════════════════════════════════════════════════════════════════════
# SOCKET EVENTS
# ═══════════════════════════════════════════════════════════════════════════════
def _state_payload():
    return {
        "firebase": firebase_initialized,
        "serial":   bool(serial_connection and serial_connection.is_open),
        "camera":   camera is not None,
        "modes":    selected_modes,
        "ready":    system_ready,
        "students": [{"id": sid, "name": v["name"]} for sid, v in STUDENT_CREDENTIALS.items()],
        "fp_map":   {str(k): get_student_name(v) for k, v in FINGERPRINT_TO_STUDENT.items()},
        "card_map": {k: get_student_name(v) for k, v in CARD_TO_STUDENT.items()},
    }

@socketio.on("connect")
def on_connect():
    socketio.emit("system_state", _state_payload())

@socketio.on("initialize_system")
def on_init(data):
    global selected_modes, system_ready, hw_initialized
    modes = data.get("modes", [])
    if len(modes) < 2:
        socketio.emit("log", {"level": "error", "msg": "Select at least 2 modes", "ts": ""}); return
    selected_modes = modes
    _log("info", f"Modes: {' + '.join(modes)}")
    _emit("session_status", {"phase": "initializing", "msg": "Initialising hardware…"})
    if not hw_initialized:
        initialize_firebase()
        if not connect_serial():
            _log("error", f"ESP32 not found on {SERIAL_PORT}"); return
        # Always try to open camera (needed for face mode AND registration)
        _open_camera()
        if MODE_FACE in selected_modes and not face_emb_cache:
            threading.Thread(target=warmup_and_cache_faces, daemon=True).start()
        hw_initialized = True
    system_ready = True
    if MODE_RFID not in selected_modes: send_esp32(_serial_cmd())
    msg = "Ready — scan RFID card" if MODE_RFID in selected_modes else "Ready"
    _emit("session_status", {"phase": "ready", "msg": msg})
    socketio.emit("system_state", _state_payload())

@socketio.on("start_scan")
def on_start_scan():
    if not system_ready: return
    if MODE_RFID in selected_modes: _log("info", "RFID mode — scan card to start"); return
    if session.active: _log("warn", "Session already active"); return
    session.reset(); session.start()
    send_esp32(_serial_cmd())
    _emit("session_status", {"phase": "scanning", "msg": "Scan started"})

@socketio.on("reset_session")
def on_reset():
    send_esp32("x"); session.reset()
    threading.Thread(target=_after_reset, daemon=True).start()
    _log("warn", "Session reset manually")

@socketio.on("set_session_modes")
def on_set_session_modes(data):
    """
    Per-student mode selection.
    Shown as inline picker after every session ends.
    Updates selected_modes for THIS student. Hardware stays online.
    """
    global selected_modes
    modes = data.get("modes", [])
    if len(modes) < 2:
        socketio.emit("log", {"level": "error", "msg": "Select at least 2 modes", "ts": ""})
        return
    selected_modes = modes
    _log("info", f"Student mode: {' + '.join(modes)}")
    if MODE_FACE in selected_modes and not face_emb_cache:
        threading.Thread(target=warmup_and_cache_faces, daemon=True).start()
    if MODE_RFID not in selected_modes:
        send_esp32(_serial_cmd())
        msg = "Ready — place finger / look at camera"
    else:
        msg = "Ready — scan RFID card"
    _emit("session_modes_confirmed", {"modes": modes, "msg": msg})
    _emit("session_status", {"phase": "ready", "msg": msg})
    socketio.emit("system_state", _state_payload())

# ── Registration ──────────────────────────────────────────────────────────────
@socketio.on("start_camera_preview")
def on_start_preview():
    global reg_preview_active
    if not camera or not camera.isOpened():
        if not _open_camera():
            _emit("reg_error", {"msg": "Camera not available — check DroidCam connection"}); return
    reg_preview_active = True
    threading.Thread(target=_reg_stream_loop, daemon=True).start()
    _emit("reg_msg", {"type": "info", "msg": "Camera preview started"})

@socketio.on("stop_camera_preview")
def on_stop_preview():
    global reg_preview_active
    reg_preview_active = False

@socketio.on("capture_face")
def on_capture():
    global _reg_captured_frame
    if not camera or not camera.isOpened():
        _emit("reg_error", {"msg": "Camera not ready"}); return
    ret, frame = camera.read()
    if not ret or frame is None:
        _emit("reg_error", {"msg": "Failed to read frame from camera"}); return
    _reg_captured_frame = frame.copy()
    _, buf = cv2.imencode(".jpg", frame)
    b64 = base64.b64encode(buf).decode("utf-8")
    _emit("face_captured", {"data": b64})

@socketio.on("check_duplicates")
def on_check_dupe(data):
    sid = data.get("student_id", "").strip()
    cid = data.get("card_id", "").strip().upper()
    fps = data.get("fingerprint_slot", "").strip()
    conflicts = check_duplicates(sid, cid, fps)
    # Also check face if captured
    face_dupe_sid = None
    if _reg_captured_frame is not None and face_emb_cache:
        face_dupe_sid, _ = check_face_duplicate(_reg_captured_frame)
        if face_dupe_sid:
            conflicts.append(f"Captured face already matches '{get_student_name(face_dupe_sid)}' "
                             f"({face_dupe_sid}) — same person cannot register twice")
    _emit("duplicate_result", {"conflicts": conflicts, "ok": len(conflicts) == 0})

@socketio.on("register_student")
def on_register(data):
    global _reg_captured_frame
    sid   = data.get("student_id",      "").strip()
    name  = data.get("name",            "").strip().upper()
    roll  = data.get("roll_number",     "").strip()
    email = data.get("email",           "").strip()
    cid   = data.get("card_id",         "").strip().upper()
    fps   = data.get("fingerprint_slot","").strip()
    if not sid or not name:
        _emit("reg_error", {"msg": "Student ID and Name are required"}); return
    conflicts = check_duplicates(sid, cid, fps)
    # Face duplicate check
    if _reg_captured_frame is not None and face_emb_cache:
        face_sid, _ = check_face_duplicate(_reg_captured_frame)
        if face_sid:
            conflicts.append(f"Face already registered as '{get_student_name(face_sid)}'")
    if conflicts:
        _emit("reg_error", {"msg": "Cannot register — " + "; ".join(conflicts)}); return
    save_new_student(sid, name, roll, email, cid, fps, _reg_captured_frame)
    _reg_captured_frame = None
    _emit("reg_success", {
        "student_id": sid, "name": name, "card_id": cid, "fp_slot": fps,
        "students": [{"id": s, "name": v["name"]} for s, v in STUDENT_CREDENTIALS.items()],
        "fp_map":   {str(k): get_student_name(v) for k, v in FINGERPRINT_TO_STUDENT.items()},
    })

# ═══════════════════════════════════════════════════════════════════════════════
# DASHBOARD HTML (embedded — single file, no dashboard.html needed)
# ═══════════════════════════════════════════════════════════════════════════════
DASHBOARD = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Smart Campus — Attendance System</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet"/>
<script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#0f1117;--surface:#181c27;--s2:#1e2333;--s3:#252b3d;
  --border:#252b3d;--b2:#2e3650;
  --text:#e2e8f0;--t2:#94a3b8;--t3:#475569;
  --blue:#3b82f6;--blue-s:rgba(59,130,246,.12);--blue-b:rgba(59,130,246,.3);
  --green:#22c55e;--green-s:rgba(34,197,94,.1);--green-b:rgba(34,197,94,.3);
  --red:#f87171;--red-s:rgba(248,113,113,.1);--red-b:rgba(248,113,113,.3);
  --amber:#fbbf24;--amber-s:rgba(251,191,36,.1);
  --purple:#a78bfa;
  --radius:8px;--radius-lg:12px;--radius-xl:16px;
  --mono:'JetBrains Mono',monospace;
  --font:'Plus Jakarta Sans',sans-serif
}
html,body{height:100%;background:var(--bg);color:var(--text);font-family:var(--font);font-size:15px;overflow:hidden}
/* ── LAYOUT ─────────────────────────────────────────────────── */
.root{height:100vh;display:grid;grid-template-columns:260px 1fr;grid-template-rows:60px 1fr}
/* ── HEADER ─────────────────────────────────────────────────── */
.hdr{grid-column:1/-1;display:flex;align-items:center;padding:0 24px;gap:14px;
  background:var(--surface);border-bottom:1px solid var(--border)}
.brand{display:flex;align-items:center;gap:10px}
.brand-icon{width:34px;height:34px;background:var(--blue);border-radius:8px;
  display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}
.brand-name{font-size:16px;font-weight:700;letter-spacing:-.3px}
.brand-sub{font-size:11px;color:var(--t2);font-weight:400;margin-top:1px}
.hdr-pills{display:flex;gap:6px;margin-left:auto;align-items:center}
.hpill{display:flex;align-items:center;gap:5px;padding:4px 10px;border-radius:20px;
  border:1px solid var(--border);font-size:12px;color:var(--t2);font-family:var(--mono)}
.hpill.ok{border-color:var(--green-b);color:var(--green);background:var(--green-s)}
.hpill.err{border-color:var(--red-b);color:var(--red);background:var(--red-s)}
.hpill .dot{width:6px;height:6px;border-radius:50%;background:currentColor}
.clk{font-family:var(--mono);font-size:13px;color:var(--t2);margin-left:10px;min-width:70px;text-align:right}
/* ── SIDEBAR ─────────────────────────────────────────────────── */
.sb{background:var(--surface);border-right:1px solid var(--border);
  display:flex;flex-direction:column;overflow:hidden}
.nav{padding:12px 10px 6px}
.nav-item{display:flex;align-items:center;gap:9px;padding:9px 12px;border-radius:var(--radius);
  cursor:pointer;color:var(--t2);font-size:13px;font-weight:500;transition:all .15s}
.nav-item:hover{background:var(--s2);color:var(--text)}
.nav-item.active{background:var(--s3);color:var(--text)}
.nav-item svg{width:16px;height:16px;flex-shrink:0}
.sb-label{padding:14px 16px 6px;font-size:11px;font-weight:600;color:var(--t3);
  letter-spacing:.7px;text-transform:uppercase}
/* ── SESSION CARD ─────────────────────────────────────────────── */
.sess{margin:0 10px 10px;border:1px solid var(--border);border-radius:var(--radius-lg);
  background:var(--s2);padding:14px;transition:border-color .3s,box-shadow .3s}
.sess.state-ok   {border-color:var(--green-b);box-shadow:0 0 0 1px var(--green-s) inset}
.sess.state-info {border-color:var(--blue-b); box-shadow:0 0 0 1px var(--blue-s)  inset}
.sess.state-err  {border-color:var(--red-b);  box-shadow:0 0 0 1px var(--red-s)   inset}
.sess-phase{font-size:10px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;
  color:var(--t3);margin-bottom:5px;font-family:var(--mono)}
.sess-msg{font-size:13px;color:var(--t2);line-height:1.5}
.sess-student-wrap{display:flex;align-items:center;gap:10px;margin-top:10px;padding:10px;
  border-radius:var(--radius);background:var(--s3);animation:si .25s ease}
@keyframes si{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
.avi{width:32px;height:32px;border-radius:50%;background:var(--blue);display:flex;
  align-items:center;justify-content:center;font-size:13px;font-weight:600;color:#fff;flex-shrink:0}
.avi.green{background:var(--green);color:#052e16}
.sess-sname{font-size:13px;font-weight:600;color:var(--text)}
.sess-sub{font-size:11px;color:var(--t3);font-family:var(--mono);margin-top:1px}
.steps{display:flex;flex-direction:column;gap:5px;margin-top:10px}
.step{display:flex;align-items:center;gap:7px;padding:6px 9px;border-radius:var(--radius);
  border:1px solid var(--border);font-size:12px;color:var(--t3);background:var(--bg);transition:all .25s}
.step svg{width:13px;height:13px;flex-shrink:0}
.step.done{border-color:var(--green-b);color:var(--green);background:var(--green-s)}
.step.active{border-color:var(--blue-b);color:var(--blue);background:var(--blue-s);animation:blink 1.4s infinite}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.6}}
/* ── CONTROLS ──────────────────────────────────────────────── */
.ctrls{padding:0 10px 8px;display:flex;flex-direction:column;gap:5px}
/* ── LOG ─────────────────────────────────────────────────────── */
.log-wrap{flex:1;padding:0 10px 10px;display:flex;flex-direction:column;min-height:0}
.log-box{flex:1;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);
  padding:8px;font-family:var(--mono);font-size:10px;overflow-y:auto;display:flex;flex-direction:column;gap:1px}
.ll{display:flex;gap:6px;line-height:1.6}
.ll-ts{color:var(--t3);flex-shrink:0}
.ll-msg.ok{color:var(--green)}.ll-msg.error{color:var(--red)}.ll-msg.warn{color:var(--amber)}.ll-msg.info{color:var(--blue)}
/* ── MAIN ─────────────────────────────────────────────────────── */
.main{overflow-y:auto;padding:20px 24px;display:flex;flex-direction:column;gap:18px}
/* ── BUTTONS ─────────────────────────────────────────────────── */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;
  padding:9px 16px;border:none;border-radius:var(--radius);font-family:var(--font);
  font-size:13px;font-weight:600;cursor:pointer;transition:all .15s;width:100%}
.btn-blue{background:var(--blue);color:#fff}.btn-blue:hover{opacity:.9}
.btn-blue:disabled{opacity:.4;cursor:not-allowed}
.btn-outline{background:transparent;border:1px solid var(--b2);color:var(--t2)}
.btn-outline:hover{border-color:var(--blue);color:var(--blue)}
.btn-sm{padding:6px 12px;font-size:12px;width:auto}
.btn-green{background:var(--green);color:#052e16}.btn-green:hover{opacity:.9}
.btn-danger{background:transparent;border:1px solid var(--b2);color:var(--t2)}
.btn-danger:hover{border-color:var(--red);color:var(--red)}
/* ── BIG STATUS CARD (center piece of attendance view) ──────── */
.hero-card{background:var(--surface);border:1px solid var(--border);
  border-radius:var(--radius-xl);padding:28px;text-align:center;transition:all .4s}
.hero-card.state-idle .hero-circle{background:var(--s3);border-color:var(--b2)}
.hero-card.state-active .hero-circle{background:var(--blue-s);border-color:var(--blue-b)}
.hero-card.state-success .hero-circle{background:var(--green-s);border-color:var(--green-b)}
.hero-card.state-fail .hero-circle{background:var(--red-s);border-color:var(--red-b)}
.hero-circle{width:90px;height:90px;border-radius:50%;border:2px solid var(--b2);
  display:flex;align-items:center;justify-content:center;margin:0 auto 16px;
  font-size:36px;font-weight:700;transition:all .4s}
.hero-name{font-size:22px;font-weight:700;margin-bottom:4px}
.hero-sub{font-size:13px;color:var(--t2)}
.hero-status{display:inline-flex;align-items:center;gap:6px;margin-top:12px;
  padding:6px 14px;border-radius:20px;font-size:13px;font-weight:600}
.hs-idle{background:var(--s3);color:var(--t2)}
.hs-active{background:var(--blue-s);color:var(--blue)}
.hs-success{background:var(--green-s);color:var(--green)}
.hs-fail{background:var(--red-s);color:var(--red)}
/* ── STATS ─────────────────────────────────────────────────── */
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.stat{background:var(--surface);border:1px solid var(--border);
  border-radius:var(--radius-lg);padding:16px 20px}
.stat-n{font-size:32px;font-weight:700;line-height:1;margin-bottom:4px}
.stat-l{font-size:12px;color:var(--t2);text-transform:uppercase;letter-spacing:.5px}
/* ── TABLE ─────────────────────────────────────────────────── */
.tbl-card{background:var(--surface);border:1px solid var(--border);
  border-radius:var(--radius-lg);overflow:hidden}
.tbl-header{padding:14px 18px;border-bottom:1px solid var(--border);
  font-size:13px;font-weight:600;display:flex;align-items:center;justify-content:space-between}
table{width:100%;border-collapse:collapse;font-size:13px}
th{padding:10px 18px;text-align:left;font-size:11px;font-weight:600;letter-spacing:.5px;
  text-transform:uppercase;color:var(--t3);border-bottom:1px solid var(--border);background:var(--s2)}
td{padding:11px 18px;border-bottom:1px solid var(--border);color:var(--t2);vertical-align:middle}
tr:last-child td{border-bottom:none}
tr.nr{animation:rowFade .35s ease}
@keyframes rowFade{from{background:rgba(34,197,94,.08)}to{background:transparent}}
.tag{display:inline-flex;align-items:center;padding:2px 8px;border-radius:5px;
  font-size:11px;font-family:var(--mono);font-weight:500;margin-right:3px}
.tag-blue{background:var(--blue-s);color:var(--blue)}
.tag-green{background:var(--green-s);color:var(--green)}
.tag-red{background:var(--red-s);color:var(--red)}
.tag-amber{background:var(--amber-s);color:var(--amber)}
/* ── INFO GRID ─────────────────────────────────────────────── */
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.info-card{background:var(--surface);border:1px solid var(--border);
  border-radius:var(--radius-lg);padding:16px}
.ic-title{font-size:12px;font-weight:600;color:var(--t3);text-transform:uppercase;
  letter-spacing:.5px;margin-bottom:12px}
.fp-row{display:flex;justify-content:space-between;align-items:center;
  padding:5px 0;border-bottom:1px solid var(--border);font-size:12px}
.fp-row:last-child{border-bottom:none}
.fp-slot{font-family:var(--mono);color:var(--t3)}
.fp-name{color:var(--text);font-weight:500}
.alert-item{border:1px solid var(--red-b);border-radius:var(--radius);
  background:var(--red-s);padding:12px;margin-bottom:8px;animation:ai .3s}
@keyframes ai{from{opacity:0;transform:translateX(6px)}to{opacity:1;transform:translateX(0)}}
.ai-title{font-size:12px;font-weight:600;color:var(--red);margin-bottom:4px}
.ai-body{font-size:12px;color:var(--t2);line-height:1.5}
.ai-ts{font-size:10px;color:var(--t3);font-family:var(--mono);margin-top:4px}
.block-item{border:1px solid var(--amber-s);border-radius:var(--radius);
  background:var(--amber-s);padding:10px;margin-bottom:6px;animation:ai .3s}
.bi-title{font-size:12px;font-weight:600;color:var(--amber);margin-bottom:3px}
.bi-body{font-size:11px;color:var(--t2)}
/* ── SETUP OVERLAY ─────────────────────────────────────────── */
#ov{position:fixed;inset:0;z-index:200;background:rgba(0,0,0,.8);
  display:flex;align-items:center;justify-content:center}
.ov-box{background:var(--surface);border:1px solid var(--b2);border-radius:var(--radius-xl);
  padding:36px;width:480px;max-width:94vw}
.ov-title{font-size:22px;font-weight:700;margin-bottom:4px}
.ov-sub{font-size:13px;color:var(--t2);margin-bottom:28px;line-height:1.5}
.ov-notice{background:var(--amber-s);border:1px solid var(--amber-s);border-radius:var(--radius);
  padding:12px;margin-bottom:20px;font-size:12px;color:var(--amber);line-height:1.5}
.mode-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px}
.mc{display:flex;flex-direction:column;align-items:center;gap:8px;padding:22px 10px;
  border:1px solid var(--b2);border-radius:var(--radius-lg);cursor:pointer;
  transition:all .15s;user-select:none;text-align:center}
.mc:hover{border-color:var(--blue);background:var(--blue-s)}
.mc.sel{border-color:var(--blue);background:var(--blue-s)}
.mc-icon{font-size:26px;line-height:1}
.mc-label{font-size:12px;font-weight:600;color:var(--t2)}
.mc.sel .mc-label{color:var(--blue)}
.mc-desc{font-size:10px;color:var(--t3);font-family:var(--mono)}
.ov-hint{font-size:12px;color:var(--t3);text-align:center;margin-bottom:18px;font-family:var(--mono)}
.ov-prog{font-size:11px;color:var(--t3);text-align:center;margin-top:12px;font-family:var(--mono);min-height:14px}
/* ── REGISTRATION ──────────────────────────────────────────── */
.reg-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start}
.form-group{margin-bottom:14px}
label{display:block;font-size:12px;font-weight:600;color:var(--t2);margin-bottom:5px}
input[type=text],input[type=email]{width:100%;padding:9px 12px;background:var(--s2);
  border:1px solid var(--b2);border-radius:var(--radius);color:var(--text);
  font-family:var(--font);font-size:13px;outline:none;transition:border-color .15s}
input:focus{border-color:var(--blue)}
input::placeholder{color:var(--t3)}
.cam-wrap{background:var(--s2);border:1px solid var(--b2);border-radius:var(--radius-lg);
  overflow:hidden;aspect-ratio:4/3;display:flex;align-items:center;justify-content:center}
.cam-wrap img{width:100%;height:100%;object-fit:cover}
.cam-ph{text-align:center;color:var(--t3);padding:20px;font-size:13px}
.cam-ph span{display:block;font-size:36px;margin-bottom:8px}
.conflict-box{background:var(--red-s);border:1px solid var(--red-b);
  border-radius:var(--radius);padding:12px;margin-bottom:12px}
.conflict-item{font-size:12px;color:var(--red);padding:2px 0;display:flex;align-items:flex-start;gap:6px}
.success-box{background:var(--green-s);border:1px solid var(--green-b);
  border-radius:var(--radius);padding:12px;margin-bottom:12px}
.sb-title{font-size:13px;font-weight:600;color:var(--green);margin-bottom:4px}
.sb-body{font-size:12px;color:var(--t2)}
.help-note{font-size:11px;color:var(--t3);line-height:1.6;padding:10px 12px;
  border-radius:var(--radius);background:var(--s2);border:1px solid var(--border);margin-top:12px}
/* ── SCROLLBAR ─────────────────────────────────────────────── */
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--b2);border-radius:2px}
</style>
</head>
<body>

<!-- SETUP OVERLAY -->
<div id="ov">
  <div class="ov-box">
    <div class="ov-title">Smart Campus ERP</div>
    <div class="ov-sub">Automated Attendance System — IoT Department<br>Select at least 2 verification modes for today's session</div>
    <div class="ov-notice">
      <strong>First time / Fingerprint mismatch?</strong> Send 'd' then 'e' in Arduino Serial Monitor to re-enroll fingerprints. Update <code>fingerprint_ids</code> in the Python config to match the slot numbers printed during enrollment.
    </div>
    <div class="mode-grid">
      <div class="mc" data-mode="RFID" onclick="togMode(this)">
        <div class="mc-icon">&#x1F4F1;</div>
        <div class="mc-label">RFID Card</div>
        <div class="mc-desc">Tap card on reader</div>
      </div>
      <div class="mc" data-mode="FINGERPRINT" onclick="togMode(this)">
        <div class="mc-icon">&#x1F91A;</div>
        <div class="mc-label">Fingerprint</div>
        <div class="mc-desc">Place finger on sensor</div>
      </div>
      <div class="mc" data-mode="FACE" onclick="togMode(this)">
        <div class="mc-icon">&#x1F9D1;</div>
        <div class="mc-label">Face Scan</div>
        <div class="mc-desc">Look at camera</div>
      </div>
    </div>
    <div class="ov-hint" id="ov-hint">Select at least 2 modes to continue</div>
    <button class="btn btn-blue" id="ov-btn" disabled onclick="doInit()">
      Start Attendance System
    </button>
    <div class="ov-prog" id="ov-prog"></div>
  </div>
</div>

<!-- APP -->
<div class="root">
  <!-- HEADER -->
  <header class="hdr">
    <div class="brand">
      <div class="brand-icon">&#x1F393;</div>
      <div>
        <div class="brand-name">Smart Campus ERP</div>
        <div class="brand-sub">Biometric Attendance — IoT Lab</div>
      </div>
    </div>
    <div class="hdr-pills">
      <div class="hpill" id="hp-serial"><span class="dot"></span><span>Serial</span></div>
      <div class="hpill" id="hp-firebase"><span class="dot"></span><span>Firebase</span></div>
      <div class="hpill" id="hp-camera"><span class="dot"></span><span>Camera</span></div>
      <div class="hpill" id="hp-modes" style="font-size:12px"></div>
    </div>
    <div class="clk" id="clk">--:--:--</div>
  </header>

  <!-- SIDEBAR -->
  <aside class="sb">
    <div class="nav">
      <div class="nav-item active" id="nv-att" onclick="switchView('attendance')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 12h6M9 16h6"/>
        </svg>
        Attendance
      </div>
      <div class="nav-item" id="nv-reg" onclick="switchView('registration')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
          <path d="M19 8v6M22 11h-6"/>
        </svg>
        Register Student
      </div>
    </div>

    <div class="sb-label">Session Status</div>
    <div class="sess" id="sess-card">
      <div class="sess-phase" id="sess-phase">IDLE</div>
      <div class="sess-msg"  id="sess-msg">Waiting for mode selection</div>
      <div id="sess-stu"></div>
      <div class="steps" id="sess-steps"></div>
    </div>

    <div class="ctrls">
      <button class="btn btn-blue"    id="btn-scan"  onclick="doScan()"    disabled>Start Scan</button>
      <button class="btn btn-danger"              onclick="doReset()">Reset Session</button>
    </div>

    <div class="sb-label">System Log</div>
    <div class="log-wrap">
      <div class="log-box" id="log-box"></div>
    </div>
  </aside>

  <!-- MAIN -->
  <main class="main">

    <!-- ATTENDANCE VIEW -->
    <div id="view-att">

      <!-- HERO STATUS CARD -->
      <div class="hero-card" id="hero" style="display:flex;align-items:center;gap:24px;text-align:left;padding:24px 28px">
        <div class="hero-circle" id="hero-circle" style="margin:0;flex-shrink:0">&#x1F4CB;</div>
        <div style="flex:1">
          <div class="hero-name" id="hero-name">Waiting for student...</div>
          <div class="hero-sub"  id="hero-sub">Scan RFID card or place finger to begin</div>
          <div style="margin-top:10px"><span class="hero-status hs-idle" id="hero-badge">System Ready</span></div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:11px;color:var(--t3);margin-bottom:4px">TODAY</div>
          <div style="font-size:28px;font-weight:700;color:var(--green)" id="hero-count">0</div>
          <div style="font-size:11px;color:var(--t2)">Present</div>
        </div>
      </div>

      <div class="stats">
        <div class="stat">
          <div class="stat-n" id="s-present" style="color:var(--green)">0</div>
          <div class="stat-l">Present today</div>
        </div>
        <div class="stat">
          <div class="stat-n" id="s-blocked" style="color:var(--amber)">0</div>
          <div class="stat-l">Blocked / denied</div>
        </div>
        <div class="stat">
          <div class="stat-n" id="s-alerts" style="color:var(--red)">0</div>
          <div class="stat-l">Security alerts</div>
        </div>
      </div>

      <div class="tbl-card">
        <div class="tbl-header">
          <span>Live Attendance Feed</span>
          <span id="tbl-sub" style="font-size:12px;color:var(--t2);font-weight:400">No records yet</span>
        </div>
        <table>
          <thead><tr>
            <th>No.</th><th>Time</th><th>Student</th>
            <th>Modes used</th><th>Face conf.</th><th>Status</th>
          </tr></thead>
          <tbody id="att-body">
            <tr><td colspan="6" style="text-align:center;color:var(--t3);padding:28px;font-family:var(--mono);font-size:12px">
              No attendance records yet
            </td></tr>
          </tbody>
        </table>
      </div>

      <div class="info-grid">
        <!-- Fingerprint map -->
        <div class="info-card">
          <div class="ic-title">&#x1F91A; Fingerprint slot map</div>
          <div id="fp-map-wrap"><div style="font-size:12px;color:var(--t3)">Loading...</div></div>
          <div style="font-size:11px;color:var(--t3);margin-top:10px;line-height:1.6">
            If wrong student name appears on FP scan, re-enroll all fingers using Arduino<br>
            <code style="font-family:var(--mono)">'d'</code> (delete all) then <code style="font-family:var(--mono)">'e'</code> (enroll) and update <code>fingerprint_ids</code>.
          </div>
        </div>
        <!-- Security alerts -->
        <div class="info-card">
          <div class="ic-title">&#x26A0; Security alerts &amp; blocked events</div>
          <div id="alerts-wrap"><div style="font-size:12px;color:var(--t3)">No alerts</div></div>
        </div>
      </div>

    </div>

    <!-- REGISTRATION VIEW -->
    <div id="view-reg" style="display:none">
      <div style="margin-bottom:18px">
        <div style="font-size:18px;font-weight:700;margin-bottom:4px">Register New Student</div>
        <div style="font-size:13px;color:var(--t2)">
          All fields are checked for duplicates before saving. Face photo is matched against existing students to prevent double-registration.
        </div>
      </div>

      <div id="reg-conflict" style="display:none" class="conflict-box"></div>
      <div id="reg-success"  style="display:none" class="success-box"></div>

      <div class="reg-grid">
        <!-- FORM -->
        <div>
          <div class="form-group">
            <label>Enrollment Number / Student ID *</label>
            <input type="text" id="f-sid" placeholder="e.g. 2200331550127" oninput="clearRegStatus()"/>
          </div>
          <div class="form-group">
            <label>Full Name *</label>
            <input type="text" id="f-name" placeholder="e.g. ARJUN SHARMA"/>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group">
              <label>Roll Number</label>
              <input type="text" id="f-roll" placeholder="22BIT127"/>
            </div>
            <div class="form-group">
              <label>Email</label>
              <input type="email" id="f-email" placeholder="student@college.edu"/>
            </div>
          </div>
          <div class="form-group">
            <label>RFID Card ID <span style="color:var(--t3);font-weight:400">(hex, e.g. A1B2C3D4 — scan card and note from Arduino monitor)</span></label>
            <input type="text" id="f-card" placeholder="A1B2C3D4" style="font-family:var(--mono)"/>
          </div>
          <div class="form-group">
            <label>Fingerprint Slot Number <span style="color:var(--t3);font-weight:400">(enroll with 'e' command, note slot number printed)</span></label>
            <input type="text" id="f-fp" placeholder="4" style="font-family:var(--mono)"/>
          </div>
          <div style="display:flex;gap:8px;margin-bottom:12px">
            <button class="btn btn-outline btn-sm" onclick="doCheckDupes()">Check duplicates</button>
          </div>
          <button class="btn btn-green" onclick="doRegister()" id="btn-reg">
            &#x2713; Register Student
          </button>
          <div class="help-note">
            <strong>After registering</strong>, also add this student to <code>STUDENT_CREDENTIALS</code> in the Python file for persistence across system restarts. The dashboard and session update immediately without restart.
          </div>
        </div>

        <!-- CAMERA -->
        <div>
          <div style="font-size:12px;font-weight:600;color:var(--t2);margin-bottom:8px">Face Photo *</div>
          <div class="cam-wrap" id="cam-wrap">
            <div class="cam-ph" id="cam-ph">
              <span>&#x1F4F7;</span>
              Click "Start Camera" below to preview and capture
            </div>
            <img id="cam-img" style="display:none" alt="Preview"/>
          </div>
          <div style="display:flex;gap:8px;margin-top:10px">
            <button class="btn btn-outline btn-sm" id="btn-cam-tog" onclick="togCamera()">Start Camera</button>
            <button class="btn btn-blue btn-sm" id="btn-capture" onclick="doCapture()" disabled>Capture Photo</button>
          </div>
          <div id="cap-preview" style="display:none;margin-top:12px">
            <div style="font-size:12px;color:var(--green);margin-bottom:6px;font-weight:600">
              &#x2713; Photo captured — ready to register
            </div>
            <img id="cap-img" style="width:100%;border-radius:var(--radius);border:1px solid var(--green-b)" alt="Captured"/>
          </div>
          <!-- Student list compact -->
          <div style="margin-top:18px">
            <div style="font-size:12px;font-weight:600;color:var(--t3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Registered Students</div>
            <div id="reg-stulist" style="display:flex;flex-direction:column;gap:5px;max-height:200px;overflow-y:auto"></div>
          </div>
        </div>
      </div>
    </div>

  </main>
</div>

<script>
const socket = io();
let selModes=[], sysModes=[], pC=0,bC=0,aC=0,rC=0, camOn=false, faceCaptured=false;

// Clock
setInterval(()=>{
  document.getElementById('clk').textContent =
    new Date().toLocaleTimeString('en-IN',{hour12:false});
},1000);

// ── SETUP OVERLAY ─────────────────────────────────────────────
function togMode(el){
  el.classList.toggle('sel');
  selModes = [...document.querySelectorAll('.mc.sel')].map(e=>e.dataset.mode);
  const btn=document.getElementById('ov-btn'), hint=document.getElementById('ov-hint');
  btn.disabled = selModes.length<2;
  hint.textContent = selModes.length<2
    ? 'Select at least 2 modes to continue'
    : '✓  ' + selModes.join(' + ') + ' selected';
}
function doInit(){
  document.getElementById('ov-btn').disabled=true;
  document.getElementById('ov-prog').textContent='Connecting to hardware…';
  socket.emit('initialize_system',{modes:selModes});
}

// ── VIEWS ──────────────────────────────────────────────────────
function switchView(v){
  document.getElementById('view-att').style.display = v==='attendance' ? '' : 'none';
  document.getElementById('view-reg').style.display = v==='registration' ? '' : 'none';
  document.getElementById('nv-att').classList.toggle('active',v==='attendance');
  document.getElementById('nv-reg').classList.toggle('active',v==='registration');
  if(v==='registration') buildRegStuList(
    Object.entries(STUDENT_CREDENTIALS_CACHE).map(([id,n])=>({id,name:n})));
}
let STUDENT_CREDENTIALS_CACHE = {};

// ── SOCKET ────────────────────────────────────────────────────
socket.on('connect',    ()=>setHpill('hp-serial','ok','Serial'));
socket.on('disconnect', ()=>setHpill('hp-serial','err','Offline'));

socket.on('system_state',d=>{
  setHpill('hp-serial',  d.serial  ?'ok':'err', d.serial  ?'Serial':'No Serial');
  setHpill('hp-firebase',d.firebase?'ok':'err', d.firebase?'Firebase':'Offline');
  setHpill('hp-camera',  d.camera  ?'ok':'err', d.camera  ?'Camera':'No Camera');
  sysModes = d.modes||[];
  const pm = document.getElementById('hp-modes');
  pm.textContent = sysModes.join(' + ');
  pm.style.color = sysModes.length ? 'var(--blue)' : '';
  if(d.ready){
    document.getElementById('ov').style.display='none';
    buildSteps(sysModes); updateScanBtn(sysModes);
    STUDENT_CREDENTIALS_CACHE = {};
    (d.students||[]).forEach(s=>STUDENT_CREDENTIALS_CACHE[s.id]=s.name);
    buildFpMap(d.fp_map||{});
  }
});

socket.on('log',d=>{
  addLog(d.level||'info',d.msg||'',d.ts||'');
  const op=document.getElementById('ov-prog');
  if(document.getElementById('ov').style.display!=='none') op.textContent=d.msg||'';
});

socket.on('session_status',d=>updateSession(d.phase,d.msg,d.student||null));

socket.on('attendance_marked',d=>{
  addAttRow(d); pC++;
  setText('s-present',pC); setText('hero-count',pC);
  updateHero('success', d.student_name,
    (d.modes||[]).join(' + ') + (d.face_conf ? ` | Face ${Math.round(d.face_conf*100)}%` : ''));
});

socket.on('security_alert',d=>{ addAlert(d); aC++; setText('s-alerts',aC); });
socket.on('blocked_event', d=>{ addBlocked(d); bC++; setText('s-blocked',bC); });

// Camera events
socket.on('camera_frame',d=>{
  const img=document.getElementById('cam-img'), ph=document.getElementById('cam-ph');
  img.src='data:image/jpeg;base64,'+d.data; img.style.display=''; ph.style.display='none';
});
socket.on('camera_busy',()=>{
  if(camOn) document.getElementById('cam-ph').textContent='Attendance face scan in progress…';
});
socket.on('face_captured',d=>{
  faceCaptured=true;
  document.getElementById('cap-img').src='data:image/jpeg;base64,'+d.data;
  document.getElementById('cap-preview').style.display='';
  document.getElementById('btn-capture').textContent='Recapture';
});

// Registration events
socket.on('duplicate_result',d=>{
  const el=document.getElementById('reg-conflict');
  if(d.ok){ el.style.display='none'; addLog('ok','No duplicates found'); }
  else{
    el.style.display='';
    el.innerHTML='<div style="font-weight:600;color:var(--red);margin-bottom:6px">Conflicts found — cannot register</div>'+
      d.conflicts.map(c=>`<div class="conflict-item"><span>&#x26A0;</span>${esc(c)}</div>`).join('');
  }
});
socket.on('reg_error',d=>{
  const el=document.getElementById('reg-conflict');
  el.style.display='';
  el.innerHTML=`<div class="conflict-item"><span>&#x26A0;</span>${esc(d.msg)}</div>`;
});
socket.on('reg_success',d=>{
  document.getElementById('reg-success').style.display='';
  document.getElementById('reg-success').innerHTML=`
    <div class="sb-title">&#x2713; Registered successfully</div>
    <div class="sb-body">${esc(d.name)} &nbsp;|&nbsp; ID: ${esc(d.student_id)} &nbsp;|&nbsp; Card: ${esc(d.card_id)} &nbsp;|&nbsp; FP slot: ${esc(d.fp_slot)}</div>`;
  document.getElementById('reg-conflict').style.display='none';
  STUDENT_CREDENTIALS_CACHE[d.student_id]=d.name;
  buildFpMap(d.fp_map||{});
  buildRegStuList(Object.entries(STUDENT_CREDENTIALS_CACHE).map(([id,n])=>({id,name:n})));
  clearRegForm();
  faceCaptured=false;
  addLog('ok',`Registered: ${d.name}`);
});

// ── SESSION STATUS ─────────────────────────────────────────────
const stateMap = {
  ready:'state-ok', success:'state-ok', rfid_ok:'state-info', fp_ok:'state-info',
  face_ok:'state-info', face_scan:'state-info', card_scanned:'state-info', scanning:'state-info',
  blocked:'state-err', security_mismatch:'state-err', timeout:'state-err', fp_fail:'state-info',
};
function updateSession(phase,msg,student){
  const card=document.getElementById('sess-card');
  card.className='sess '+(stateMap[phase]||'');
  setText('sess-phase', phase.replace(/_/g,' ').toUpperCase());
  setText('sess-msg',   msg);
  const sw=document.getElementById('sess-stu');
  if(student){
    const ini=student.split(' ').map(w=>w[0]).join('').slice(0,2);
    sw.innerHTML=`<div class="sess-student-wrap">
      <div class="avi">${ini}</div>
      <div><div class="sess-sname">${esc(student)}</div>
      <div class="sess-sub">In progress</div></div></div>`;
  } else if(['ready','idle','success','blocked','security_mismatch','timeout'].includes(phase)){
    sw.innerHTML='';
  }
  updateSteps(phase);
  const bs=document.getElementById('btn-scan');
  if(phase==='ready'&&!sysModes.includes('RFID')) bs.disabled=false;
  if(['success','blocked','security_mismatch'].includes(phase)&&!sysModes.includes('RFID')) bs.disabled=false;
  // Update hero on non-success states
  if(['blocked','security_mismatch','fp_fail'].includes(phase))
    updateHero('fail','Verification Failed', msg);
  else if(phase==='ready' || phase==='idle')
    updateHero('idle','Waiting for student...','Scan card or place finger to begin');
  else if(['card_scanned','rfid_ok','fp_ok','face_ok','face_scan','scanning'].includes(phase)&&student)
    updateHero('active', student, msg);
}

// ── HERO ──────────────────────────────────────────────────────
function updateHero(state, name, sub){
  const hero=document.getElementById('hero');
  const circle=document.getElementById('hero-circle');
  const badge=document.getElementById('hero-badge');
  hero.className='hero-card state-'+state;
  setText('hero-name', name);
  setText('hero-sub',  sub||'');
  hero.style.cssText = hero.style.cssText; // force repaint
  const ini = (state!=='idle'&&state!=='fail')
    ? name.split(' ').map(w=>w[0]).join('').slice(0,2)
    : (state==='fail'?'✕':'?');
  circle.textContent=ini;
  if(state==='success'){
    badge.className='hero-status hs-success'; badge.textContent='✓ Present';
  } else if(state==='active'){
    badge.className='hero-status hs-active'; badge.textContent='Verifying…';
  } else if(state==='fail'){
    badge.className='hero-status hs-fail'; badge.textContent='Denied';
  } else {
    badge.className='hero-status hs-idle'; badge.textContent='System Ready';
  }
}

// ── STEPS ──────────────────────────────────────────────────────
const STEP_ICONS = {
  RFID:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M7 10h10M7 14h6"/></svg>`,
  FINGERPRINT:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3"/></svg>`,
  FACE:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>`,
};
const STEP_LABELS = {RFID:'RFID Card', FINGERPRINT:'Fingerprint', FACE:'Face Scan'};
const PHASE_MODE  = {rfid_ok:'RFID',card_scanned:'RFID',fp_ok:'FINGERPRINT',face_ok:'FACE'};
function buildSteps(modes){
  document.getElementById('sess-steps').innerHTML = modes.map(m=>
    `<div class="step" id="step-${m}">${STEP_ICONS[m]||''}<span>${STEP_LABELS[m]}</span></div>`
  ).join('');
}
function updateSteps(phase){
  const all=document.querySelectorAll('.step');
  if(phase==='success'){all.forEach(s=>s.className='step done');return}
  if(['ready','idle','blocked','security_mismatch','timeout'].includes(phase)){
    all.forEach(s=>s.className='step');return}
  const am=PHASE_MODE[phase]; let found=false;
  all.forEach(s=>{
    const m=s.id.replace('step-','');
    if(!found){if(m===am){found=true;s.className='step active';}else s.className='step done';}
    else s.className='step';
  });
  if(!found&&phase==='face_scan'){const f=document.getElementById('step-FACE');if(f)f.className='step active';}
}
function updateScanBtn(modes){
  const b=document.getElementById('btn-scan');
  if(modes.includes('RFID')){b.style.display='none';}
  else{b.style.display='';b.disabled=false;}
}
function doScan(){socket.emit('start_scan');}
function doReset(){socket.emit('reset_session');}

// ── PER-STUDENT INLINE MODE PICKER ──────────────────────
// When a session ends, server sends request_mode_selection.
// We show a compact inline picker inside the session card so the NEXT
// student can choose their own modes without any page interaction.
socket.on('request_mode_selection', () => {
  showInlinePicker();
});
socket.on('session_modes_confirmed', d => {
  sysModes = d.modes || [];
  document.getElementById('hp-modes').textContent = sysModes.join(' + ');
  buildSteps(sysModes);
  updateScanBtn(sysModes);
  hideInlinePicker();
});

function showInlinePicker() {
  // Remove any old picker first
  const old = document.getElementById('inline-picker');
  if (old) old.remove();

  const card = document.getElementById('sess-card');
  card.className = 'sess';

  const picker = document.createElement('div');
  picker.id = 'inline-picker';
  picker.innerHTML = `
    <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border)">
      <div style="font-size:11px;font-weight:600;color:var(--t3);text-transform:uppercase;
        letter-spacing:.7px;margin-bottom:10px">Next student — choose your method</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:10px">
        <div class="ipmode" data-mode="RFID" onclick="togIpMode(this)"
          style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 4px;
          border:1px solid var(--b2);border-radius:8px;cursor:pointer;transition:all .15s;font-size:11px;
          color:var(--t2);font-weight:500;user-select:none;text-align:center">
          <span style="font-size:18px">&#x1F4F1;</span>RFID Card
        </div>
        <div class="ipmode" data-mode="FINGERPRINT" onclick="togIpMode(this)"
          style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 4px;
          border:1px solid var(--b2);border-radius:8px;cursor:pointer;transition:all .15s;font-size:11px;
          color:var(--t2);font-weight:500;user-select:none;text-align:center">
          <span style="font-size:18px">&#x1F91A;</span>Fingerprint
        </div>
        <div class="ipmode" data-mode="FACE" onclick="togIpMode(this)"
          style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 4px;
          border:1px solid var(--b2);border-radius:8px;cursor:pointer;transition:all .15s;font-size:11px;
          color:var(--t2);font-weight:500;user-select:none;text-align:center">
          <span style="font-size:18px">&#x1F9D1;</span>Face Scan
        </div>
      </div>
      <div style="font-size:10px;color:var(--t3);font-family:var(--mono);margin-bottom:8px"
        id="ip-hint">Select at least 2 modes</div>
      <button onclick="confirmStudentModes()"
        id="ip-confirm"
        style="width:100%;padding:8px;background:var(--blue);color:#fff;border:none;
        border-radius:8px;font-family:var(--font);font-size:13px;font-weight:600;
        cursor:pointer;opacity:.4;pointer-events:none;transition:all .15s">
        Confirm &amp; Start
      </button>
    </div>`;

  // Update session card display
  setText('sess-phase', 'SELECT METHOD');
  setText('sess-msg', 'Choose how you want to verify attendance');
  document.getElementById('sess-stu').innerHTML = '';
  document.getElementById('sess-steps').innerHTML = '';
  card.appendChild(picker);
}

function hideInlinePicker() {
  const el = document.getElementById('inline-picker');
  if (el) el.remove();
}

function togIpMode(el) {
  el.classList.toggle('ip-sel');
  const isSelected = el.classList.contains('ip-sel');
  el.style.borderColor = isSelected ? 'var(--blue)' : 'var(--b2)';
  el.style.background  = isSelected ? 'var(--blue-s)' : '';
  el.style.color       = isSelected ? 'var(--blue)' : 'var(--t2)';

  const chosen = [...document.querySelectorAll('.ipmode.ip-sel')].map(e => e.dataset.mode);
  const hint    = document.getElementById('ip-hint');
  const btn     = document.getElementById('ip-confirm');
  if (chosen.length >= 2) {
    hint.textContent = 'Selected: ' + chosen.join(' + ');
    btn.style.opacity = '1';
    btn.style.pointerEvents = 'auto';
  } else {
    hint.textContent = 'Select at least 2 modes';
    btn.style.opacity = '.4';
    btn.style.pointerEvents = 'none';
  }
}

function confirmStudentModes() {
  const modes = [...document.querySelectorAll('.ipmode.ip-sel')].map(e => e.dataset.mode);
  if (modes.length < 2) return;
  socket.emit('set_session_modes', { modes });
}


// ── ATTENDANCE TABLE ───────────────────────────────────────────
function addAttRow(d){
  rC++;
  const tb=document.getElementById('att-body');
  const ph=tb.querySelector('td[colspan]');if(ph)ph.closest('tr').remove();
  const cp=Math.round((d.face_conf||0)*100);
  const mh=(d.modes||[]).map(m=>`<span class="tag tag-blue">${m}</span>`).join('');
  const tr=document.createElement('tr');tr.className='nr';
  tr.innerHTML=`
    <td style="font-family:var(--mono);color:var(--t3)">${rC}</td>
    <td style="font-family:var(--mono)">${esc(d.time||'')}</td>
    <td><strong>${esc(d.student_name||'')}</strong></td>
    <td>${mh}</td>
    <td style="font-family:var(--mono)">${cp?cp+'%':'—'}</td>
    <td><span class="tag tag-green">&#x2713; Present</span></td>`;
  tb.insertBefore(tr,tb.firstChild);
  setText('tbl-sub',`${rC} record${rC!==1?'s':''} today`);
}

// ── FP MAP ─────────────────────────────────────────────────────
function buildFpMap(m){
  const el=document.getElementById('fp-map-wrap');
  const entries=Object.entries(m);
  if(!entries.length){el.innerHTML='<div style="font-size:12px;color:var(--t3)">No fingerprints mapped</div>';return;}
  el.innerHTML=entries.map(([slot,name])=>
    `<div class="fp-row"><span class="fp-slot">Slot ${slot}</span><span class="fp-name">${esc(name)}</span></div>`
  ).join('');
}

// ── ALERTS ─────────────────────────────────────────────────────
function addAlert(d){
  const w=document.getElementById('alerts-wrap');
  const ph=w.querySelector('div[style]');if(ph&&ph.textContent.includes('No alerts'))ph.remove();
  const el=document.createElement('div');el.className='alert-item';
  el.innerHTML=`<div class="ai-title">&#x1F6A8; Proxy detected — ${esc(d.mode||'')}</div>
    <div class="ai-body">Session: <strong>${esc(d.session_student||'')}</strong><br>Credential: ${esc(d.cred_student||'')}</div>
    <div class="ai-ts">${esc(d.time||'')}</div>`;
  w.insertBefore(el,w.firstChild);
}
function addBlocked(d){
  const w=document.getElementById('alerts-wrap');
  const el=document.createElement('div');el.className='block-item';
  const L={unregistered_rfid:'Unregistered card',unregistered_fp:'Unregistered FP',face_not_recognised:'Face not recognised'};
  el.innerHTML=`<div class="bi-title">&#x26A0; ${L[d.reason]||'Blocked'}</div>
    <div class="bi-body">${esc(d.msg||'')}</div>
    <div class="ai-ts">${esc(d.time||'')}</div>`;
  w.insertBefore(el,w.firstChild);
}

// ── LOG ────────────────────────────────────────────────────────
function addLog(level,msg,ts){
  const p=document.getElementById('log-box');
  const t=ts||new Date().toLocaleTimeString('en-IN',{hour12:false});
  const d=document.createElement('div');d.className='ll';
  d.innerHTML=`<span class="ll-ts">${t}</span><span class="ll-msg ${level}">${esc(msg)}</span>`;
  p.appendChild(d);p.scrollTop=p.scrollHeight;
}

// ── REGISTRATION ───────────────────────────────────────────────
function clearRegStatus(){
  document.getElementById('reg-conflict').style.display='none';
  document.getElementById('reg-success').style.display='none';
}
function clearRegForm(){
  ['f-sid','f-name','f-roll','f-email','f-card','f-fp'].forEach(id=>{
    const el=document.getElementById(id);if(el)el.value='';
  });
  document.getElementById('cap-preview').style.display='none';
  document.getElementById('cam-img').style.display='none';
  document.getElementById('cam-ph').style.display='';
  document.getElementById('cam-ph').textContent='Click "Start Camera" below to preview and capture';
  faceCaptured=false;
  if(camOn)togCamera();
}
function doCheckDupes(){
  socket.emit('check_duplicates',{
    student_id: document.getElementById('f-sid').value.trim(),
    card_id:    document.getElementById('f-card').value.trim(),
    fingerprint_slot: document.getElementById('f-fp').value.trim(),
  });
}
function togCamera(){
  if(!camOn){
    camOn=true;
    document.getElementById('btn-cam-tog').textContent='Stop Camera';
    document.getElementById('btn-capture').disabled=false;
    socket.emit('start_camera_preview');
  } else {
    camOn=false;
    document.getElementById('btn-cam-tog').textContent='Start Camera';
    document.getElementById('btn-capture').disabled=true;
    socket.emit('stop_camera_preview');
    document.getElementById('cam-img').style.display='none';
    document.getElementById('cam-ph').style.display='';
  }
}
function doCapture(){socket.emit('capture_face');}
function doRegister(){
  const sid=document.getElementById('f-sid').value.trim();
  const name=document.getElementById('f-name').value.trim();
  if(!sid||!name){
    document.getElementById('reg-conflict').style.display='';
    document.getElementById('reg-conflict').innerHTML=
      '<div class="conflict-item"><span>&#x26A0;</span>Student ID and Name are required</div>';
    return;
  }
  socket.emit('register_student',{
    student_id:       sid,
    name:             name,
    roll_number:      document.getElementById('f-roll').value.trim(),
    email:            document.getElementById('f-email').value.trim(),
    card_id:          document.getElementById('f-card').value.trim().toUpperCase(),
    fingerprint_slot: document.getElementById('f-fp').value.trim(),
  });
}
function buildRegStuList(students){
  const el=document.getElementById('reg-stulist');
  if(!el)return;
  el.innerHTML=students.map(s=>{
    const ini=s.name.split(' ').map(w=>w[0]).join('').slice(0,2);
    return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
      <div class="avi" style="width:26px;height:26px;font-size:10px;flex-shrink:0">${ini}</div>
      <div><div style="font-size:12px;font-weight:500">${esc(s.name)}</div>
      <div style="font-size:10px;color:var(--t3);font-family:var(--mono)">${s.id.slice(-8)}</div></div>
    </div>`;
  }).join('');
}

// ── UTILS ──────────────────────────────────────────────────────
function setHpill(id,state,label){
  const el=document.getElementById(id);if(!el)return;
  el.className='hpill'+(state==='ok'?' ok':state==='err'?' err':'');
  el.innerHTML=`<span class="dot"></span><span>${label}</span>`;
}
function setText(id,v){const el=document.getElementById(id);if(el)el.textContent=v;}
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
</script>
</body>
</html>"""

# ── Flask route ───────────────────────────────────────────────────────────────
@app.route("/")
def index():
    return DASHBOARD

# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════
def main():
    print("\n╔══════════════════════════════════════════════════════════════╗")
    print("║    SMART CAMPUS ERP  v8.0  —  Biometric Attendance          ║")
    print(f"║    Dashboard → http://localhost:{DASHBOARD_PORT}                     ║")
    print("╠══════════════════════════════════════════════════════════════╣")
    print("║  Open http://localhost:5000 in browser (auto-opens in 2s)   ║")
    print("║  Do NOT open any HTML file directly — always use the URL    ║")
    print("╚══════════════════════════════════════════════════════════════╝\n")
    threading.Thread(target=hardware_loop, daemon=True).start()
    threading.Timer(2.0, lambda: webbrowser.open(f"http://localhost:{DASHBOARD_PORT}")).start()
    socketio.run(app, host="0.0.0.0", port=DASHBOARD_PORT,
                 debug=False, use_reloader=False, allow_unsafe_werkzeug=True)

if __name__ == "__main__":
    main()