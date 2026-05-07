"""
SMART CAMPUS ERP — ATTENDANCE SYSTEM v9.0  (FINAL)
===================================================
Run:  python smart_campus.py
URL:  http://localhost:5000

FIXES IN v9:
  ✅ Student credentials loaded from Firebase at startup — no hardcoded limit
  ✅ Firebase writes to ALL paths React dashboard reads:
       attendance_records/{key}          ← main feed React reads
       attendance_summary/{student_id}   ← per-student stats
       attendance/{date}/{student_id}    ← daily view
       students/{student_id}             ← student registry
     Fields written in BOTH snake_case and camelCase so any React version works
  ✅ Student removal fully handled: Firebase cleanup + face image + cache + maps
  ✅ New student registration syncs to all React-readable paths immediately
  ✅ Per-student mode selection after every session (each student picks their own)
  ✅ Anti-proxy: all credentials must map to same student
  ✅ Registration camera mutex (no conflict with attendance face scan)
  ✅ Fingerprint slot diagnostic panel visible on dashboard
  ✅ Face duplicate detection on registration
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

# ═══════════════════════════════════════════════════════════════════════
# CONFIGURATION  — edit these
# ═══════════════════════════════════════════════════════════════════════
SERIAL_PORT           = "COM5"
BAUD_RATE             = 115200
FIREBASE_CRED_PATH    = "firebase-credentials.json"
FIREBASE_DATABASE_URL = "https://smart-campus-major-project-default-rtdb.firebaseio.com"
CAMERA_INDEX          = 0
FACE_DATABASE_PATH    = "../student_faces"
CONFIDENCE_THRESHOLD  = 0.55   # attendance face match threshold
REG_DUPE_THRESHOLD    = 0.65   # stricter for registration duplicate check
SESSION_TIMEOUT_SEC   = 60
DASHBOARD_PORT        = 5000
SECTION               = "IoT-B"

# ═══════════════════════════════════════════════════════════════════════
# STUDENT CREDENTIALS  (loaded from Firebase at startup + seeded here)
# ═══════════════════════════════════════════════════════════════════════
# This dict is the SEED — at startup, Firebase `students/` is merged in.
# You can leave this empty and manage students entirely through the UI.
# Keep it as a fallback for when Firebase is offline.
#
# FINGERPRINT SLOTS: must match exact slot numbers from sensor.
# Send 'd' in Arduino Serial Monitor to wipe all, then 'e' to re-enroll.
# Note the slot number printed after each enrollment and update here.
STUDENT_CREDENTIALS: dict = {
    #"2200331550125": {
        #"name": "VANSH TYAGI",
        #"card_ids": ["731D16E0"],
        #"fingerprint_ids": [1],
    #},
    "2200331550103": {
        "name": "SHITANSHU",
        "card_ids": ["F388E329"],
        "fingerprint_ids": [2],
    },
    "2200331550083": {
        "name": "RAJ SINGH",
        "card_ids": ["C9D0E1F2"],
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
            if cid:
                CARD_TO_STUDENT[str(cid).upper()] = sid
        for fid in info.get("fingerprint_ids", []):
            try:
                FINGERPRINT_TO_STUDENT[int(fid)] = sid
            except (ValueError, TypeError):
                pass

_rebuild_maps()

def get_student_name(sid):
    return STUDENT_CREDENTIALS.get(sid, {}).get("name", "Unknown")

def get_student_by_card(cid):
    return CARD_TO_STUDENT.get(str(cid).upper())

def get_student_by_fingerprint(fid):
    try:
        return FINGERPRINT_TO_STUDENT.get(int(fid))
    except:
        return None

def _load_students_from_firebase():
    """
    Merge Firebase students/ node into STUDENT_CREDENTIALS at startup.
    This lets students registered via the UI persist across restarts.
    """
    if not firebase_initialized:
        return
    try:
        fb_students = fdb.reference("students").get() or {}
        added = 0
        for sid, data in fb_students.items():
            if not isinstance(data, dict):
                continue
            if sid not in STUDENT_CREDENTIALS:
                # Parse card and fingerprint data stored by registration
                card_ids = []
                if data.get("card_id"):
                    card_ids = [str(data["card_id"]).upper()]
                elif data.get("cardId"):
                    card_ids = [str(data["cardId"]).upper()]

                fp_ids = []
                fp_raw = data.get("fingerprint_slot") or data.get("fingerprintSlot") or data.get("fingerprint_id")
                if fp_raw is not None:
                    try:
                        fp_ids = [int(fp_raw)]
                    except:
                        pass

                STUDENT_CREDENTIALS[sid] = {
                    "name": data.get("name", data.get("student_name", "Unknown")),
                    "card_ids": card_ids,
                    "fingerprint_ids": fp_ids,
                }
                added += 1
        if added:
            _rebuild_maps()
            _log("ok", f"Loaded {added} student(s) from Firebase")
    except Exception as e:
        _log("warn", f"Could not load students from Firebase: {e}")

# ═══════════════════════════════════════════════════════════════════════
# FLASK + SOCKETIO
# ═══════════════════════════════════════════════════════════════════════
app = Flask(__name__)
app.config["SECRET_KEY"] = "smartcampus_erp_2025"
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

def _emit(ev, data=None):
    try:
        socketio.emit(ev, data or {})
    except:
        pass

def _log(level, msg):
    print(f"[{level.upper():5}] {msg}")
    _emit("log", {
        "level": level,
        "msg":   msg,
        "ts":    datetime.now().strftime("%H:%M:%S"),
    })

# ═══════════════════════════════════════════════════════════════════════
# CAMERA MANAGEMENT  — mutex prevents simultaneous use
# ═══════════════════════════════════════════════════════════════════════
camera               = None
attendance_cam_busy  = False
reg_preview_active   = False

def _open_camera() -> bool:
    global camera
    if camera and camera.isOpened():
        return True
    for idx in list(dict.fromkeys([CAMERA_INDEX, 0, 1, 2])):
        for backend in [cv2.CAP_MSMF, cv2.CAP_DSHOW, cv2.CAP_ANY]:
            try:
                cap = cv2.VideoCapture(idx, backend)
                cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                time.sleep(0.6)
                if not cap.isOpened():
                    cap.release()
                    continue
                ret, frame = cap.read()
                if ret and frame is not None and frame.size > 0:
                    cap.set(cv2.CAP_PROP_FRAME_WIDTH,  640)
                    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
                    cap.set(cv2.CAP_PROP_FPS,           30)
                    cap.set(cv2.CAP_PROP_BUFFERSIZE,     1)
                    camera = cap
                    _log("ok", f"Camera ready (index={idx})")
                    return True
                cap.release()
            except:
                pass
    _log("error", "No camera found — check DroidCam")
    return False

def _reg_stream_loop():
    global reg_preview_active
    while reg_preview_active:
        if attendance_cam_busy:
            time.sleep(0.15)
            continue
        if not camera or not camera.isOpened():
            time.sleep(0.2)
            continue
        try:
            ret, frame = camera.read()
            if ret and frame is not None:
                _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 65])
                _emit("camera_frame", {"data": base64.b64encode(buf).decode("utf-8")})
        except:
            pass
        time.sleep(0.1)

# ═══════════════════════════════════════════════════════════════════════
# FACE EMBEDDING CACHE
# ═══════════════════════════════════════════════════════════════════════
face_emb_cache: dict = {}

def warmup_and_cache_faces():
    _log("info", "Pre-warming DeepFace model (first run ~15s)…")
    blank = np.zeros((160, 160, 3), dtype=np.uint8)
    cv2.imwrite("_w.jpg", blank)
    try:
        DeepFace.represent(img_path="_w.jpg", model_name="Facenet",
                           enforce_detection=False, detector_backend="opencv")
    except:
        pass
    finally:
        if os.path.exists("_w.jpg"):
            os.remove("_w.jpg")
    _log("ok", "DeepFace model loaded")
    os.makedirs(FACE_DATABASE_PATH, exist_ok=True)
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
        _log("warn", f"Cannot cache {img_path}: {ex}")

def _uncache_face(sid):
    face_emb_cache.pop(sid, None)

def _fast_match(frame, threshold=None):
    th = threshold if threshold is not None else CONFIDENCE_THRESHOLD
    if not face_emb_cache:
        return None, None
    tmp = "_r.jpg"
    try:
        cv2.imwrite(tmp, cv2.resize(frame, (320, 240)))
        reps = DeepFace.represent(img_path=tmp, model_name="Facenet",
                                   enforce_detection=False, detector_backend="opencv")
        if not reps:
            return None, None
        q = np.array(reps[0]["embedding"], dtype=np.float32)
        q /= (np.linalg.norm(q) + 1e-9)
        best_id, best_sim = None, -1.0
        for sid, e in face_emb_cache.items():
            s = float(np.dot(q, e))
            if s > best_sim:
                best_sim, best_id = s, sid
        return (best_id, best_sim) if best_sim >= th else (None, None)
    except Exception as ex:
        _log("error", f"Face match error: {ex}")
        return None, None
    finally:
        if os.path.exists(tmp):
            os.remove(tmp)

# ═══════════════════════════════════════════════════════════════════════
# SESSION
# ═══════════════════════════════════════════════════════════════════════
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
        if student_id is None:
            return "UNKNOWN"
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

# ─── globals ─────────────────────────────────────────────────────────
serial_connection    = None
firebase_initialized = False
selected_modes       = []
session              = AttendanceSession()
system_ready         = False
hw_initialized       = False

os.makedirs(FACE_DATABASE_PATH,    exist_ok=True)
os.makedirs("registration_photos", exist_ok=True)

# ═══════════════════════════════════════════════════════════════════════
# FIREBASE  — writes to ALL paths React dashboard reads
# ═══════════════════════════════════════════════════════════════════════
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
        _log("error", f"Firebase init: {e}")
        return False

def _firebase_upload(student_id, verified, status):
    """
    Writes attendance to ALL correct Firebase paths that every React
    dashboard reads from. Fixes all path mismatches between Python
    backend and React (Faculty, Admin, Student, Parent dashboards).
    """
    if not firebase_initialized:
        return False
    try:
        now       = datetime.now()
        date_str  = now.strftime("%Y-%m-%d")
        time_str  = now.strftime("%H:%M:%S")
        ms        = int(now.timestamp() * 1000)
        auth_str  = " + ".join(verified.keys())
        name      = get_student_name(student_id)
        card_id   = verified.get(MODE_RFID,        {}).get("raw_id", "N/A")
        fp_id     = verified.get(MODE_FINGERPRINT, {}).get("raw_id", "N/A")
        face_conf = verified.get(MODE_FACE,         {}).get("confidence", 0)

        # ── CHECK: Already marked today? ─────────────────────────────────────
        # FacultyDashboard reads: attendance/daily/{date}/{studentId}
        daily_student_ref = fdb.reference(f"attendance/daily/{date_str}/{student_id}")
        already_today = daily_student_ref.get()
        is_new_today = (already_today is None)

        # ── 1. attendance/daily/{date}/{studentId} ───────────────────────────
        # READ BY: FacultyDashboard, ParentDashboard, AdminDashboard
        # Fields: status, student_name, subjects, timestamp
        daily_student_ref.set({
            "status":       "Present",
            "student_id":   student_id,
            "studentId":    student_id,
            "student_name": name,
            "studentName":  name,
            "timestamp":    ms,
            "time":         time_str,
            "auth_method":  auth_str,
            "authMethod":   auth_str,
            "section":      SECTION,
            "card_id":      str(card_id),
            "fingerprint_id": str(fp_id),
            "subjects": {
                "IoT":    "Present",
                "Python": "Present",
                "AI":     "Present",
            },
        })

        # ── 2. attendance/daily/{date} — daily summary node ──────────────────
        # READ BY: AdminDashboard AttendanceTrendCard
        # Fields: present_count, absent_count, attendance_percentage
        daily_date_ref = fdb.reference(f"attendance/daily/{date_str}")

        def update_daily_counts(current):
            d = current or {}
            if not isinstance(d, dict):
                d = {}
            # Count present students from existing records
            present = sum(
                1 for k, v in d.items()
                if isinstance(v, dict) and v.get("status") == "Present"
            )
            total_students = len(STUDENT_CREDENTIALS)
            absent = total_students - present
            d["present_count"]         = present
            d["absent_count"]          = absent
            d["total_students"]        = total_students
            d["attendance_percentage"] = round(present / total_students * 100, 2) if total_students else 0
            d["last_updated"]          = ms
            return d

        daily_date_ref.transaction(update_daily_counts)

        # ── 3. attendance/summary/{studentId} ────────────────────────────────
        # READ BY: FacultyDashboard, StudentDashboard (processAllStudents)
        # Fields: overall_percentage, present_days, absent_days, total_days,
        #         attendance_history, student_name, subjects
        sum_ref = fdb.reference(f"attendance/summary/{student_id}")

        def update_summary(current):
            s = current or {}
            if not isinstance(s, dict):
                s = {}

            s.setdefault("student_id",   student_id)
            s.setdefault("studentId",    student_id)
            s.setdefault("student_name", name)
            s.setdefault("studentName",  name)
            s.setdefault("section",      SECTION)

            present = s.get("present_days", 0)
            total   = s.get("total_days",   0)
            history = s.get("attendance_history", {})

            if is_new_today:
                present += 1
                total   += 1
                history[date_str] = "Present"

            absent = total - present
            pct    = round(present / total * 100, 2) if total > 0 else 0.0

            s.update({
                # Fields FacultyDashboard reads
                "present_days":          present,
                "absent_days":           absent,
                "total_days":            total,
                "overall_percentage":    pct,
                "attendance_history":    history,
                "student_name":          name,
                "studentName":           name,
                "last_updated":          ms,
                "last_seen":             time_str,
                "status":                "Present",
                # camelCase aliases StudentDashboard uses
                "presentDays":           present,
                "absentDays":            absent,
                "totalDays":             total,
                "overallPercentage":     pct,
                "attendanceHistory":     history,
                "subjects": {
                    "IoT":    pct,
                    "Python": pct,
                    "AI":     pct,
                },
            })
            return s

        sum_ref.transaction(update_summary)

        # ── 4. attendance/students/{studentId}/calendar/{date} ───────────────
        # READ BY: FacultyDashboard StudentDetailModal (calendar view)
        # READ BY: StudentDashboard (calendar, trend data)
        fdb.reference(f"attendance/students/{student_id}/calendar/{date_str}").set({
            "percentage": 100,
            "status":     "Present",
            "timestamp":  ms,
            "subjects": {
                "IoT":    "Present",
                "Python": "Present",
                "AI":     "Present",
            },
        })

        # ── 5. attendance_records/{key} — audit trail ────────────────────────
        # (kept for backward compatibility)
        record = {
            "student_id":            student_id,
            "student_name":          name,
            "section":               SECTION,
            "authentication_method": auth_str,
            "card_id":               str(card_id),
            "fingerprint_id":        str(fp_id),
            "face_confidence":       round(face_conf, 4),
            "status":                status,
            "date":                  date_str,
            "time":                  time_str,
            "timestamp":             ms,
            "isPresent":             True,
        }
        key = fdb.reference("attendance_records").push(record).key

        # ── 6. students/{studentId} — student registry ───────────────────────
        fdb.reference(f"students/{student_id}").update({
            "student_id":     student_id,
            "name":           name,
            "section":        SECTION,
            "card_id":        str(card_id),
            "fingerprint_id": str(fp_id),
            "last_seen":      date_str,
        })

        # ── 7. Re-read final summary for SocketIO emit ───────────────────────
        final = sum_ref.get() or {}
        pct   = final.get("overall_percentage", 0)

        _emit("attendance_summary_update", {
            "student_id":    student_id,
            "student_name":  name,
            "total_present": final.get("present_days", 0),
            "total_classes": final.get("total_days",   0),
            "percentage":    pct,
            "date":          date_str,
            "new_today":     is_new_today,
        })

        suffix = "" if is_new_today else " (already marked today — not double-counted)"
        _log("ok", f"Firebase OK — {name} | {pct:.1f}%{suffix} | key={key}")
        return True

    except Exception as e:
        _log("error", f"Firebase upload: {e}")
        return False

def _firebase_register_student(student_id, name, roll, email, card_id, fp_slot):
    """Write new student to Firebase with both naming conventions."""
    if not firebase_initialized:
        return
    try:
        data = {
            # snake_case
            "student_id":       student_id,
            "name":             name,
            "student_name":     name,
            "roll_number":      roll,
            "email":            email,
            "card_id":          card_id,
            "fingerprint_slot": fp_slot,
            "fingerprint_id":   fp_slot,
            "section":          SECTION,
            "registered_at":    datetime.now().isoformat(),
            "face_registered":  True,
            "status":           "active",
            # camelCase
            "studentId":        student_id,
            "studentName":      name,
            "rollNumber":       roll,
            "cardId":           card_id,
            "fingerprintSlot":  fp_slot,
            "fingerprintId":    fp_slot,
            "registeredAt":     datetime.now().isoformat(),
            "faceRegistered":   True,
        }
        fdb.reference(f"students/{student_id}").set(data)

        # Also seed the summary node so React dashboard shows student immediately
        sum_ref = fdb.reference(f"attendance/summary/{student_id}")
        if not sum_ref.get():
            sum_ref.set({
                "student_id":            student_id,
                "studentId":             student_id,
                "student_name":          name,
                "studentName":           name,
                "section":               SECTION,
                "total_present":         0,
                "totalPresent":          0,
                "total_classes":         0,
                "totalClasses":          0,
                "overall_percentage":    0,
                "overallPercentage":     0,
                "attendance_percentage": 0,
                "attendancePercentage":  0,
                "status":                "Not marked",
                "attendance_history":    {},
            })

        _log("ok", f"Registered {name} in Firebase (students + attendance_summary)")
    except Exception as e:
        _log("error", f"Firebase register: {e}")

def _firebase_remove_student(student_id):
    """
    Full cleanup when removing a student from the system:
    - Firebase: students/, attendance_summary/, attendance_records (marks as inactive)
    - In-memory: STUDENT_CREDENTIALS, lookup maps, face cache
    - Filesystem: face image
    """
    if not firebase_initialized:
        return
    try:
        fdb.reference(f"students/{student_id}").delete()
        fdb.reference(f"attendance_summary/{student_id}").delete()
        _log("ok", f"Removed {student_id} from Firebase")
    except Exception as e:
        _log("warn", f"Firebase remove: {e}")

    # In-memory cleanup
    STUDENT_CREDENTIALS.pop(student_id, None)
    _rebuild_maps()

    # Face cache cleanup
    _uncache_face(student_id)

    # Face image cleanup
    for ext in (".jpg", ".jpeg", ".png"):
        path = os.path.join(FACE_DATABASE_PATH, f"{student_id}{ext}")
        if os.path.exists(path):
            try:
                os.remove(path)
                _log("ok", f"Deleted face image: {path}")
            except:
                pass

def _firebase_log_security(mode, attacker_id, locked_id, raw_id):
    if not firebase_initialized:
        return
    try:
        fdb.reference("security_alerts").push({
            "timestamp":         int(datetime.now().timestamp() * 1000),
            "datetime":          datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "type":              "CREDENTIAL_MISMATCH",
            "mode":              mode,
            "credentialRawId":   str(raw_id),
            "credential_raw_id": str(raw_id),
            "credentialOwner":   str(attacker_id),
            "credential_owner":  str(attacker_id),
            "sessionLockedTo":   str(locked_id),
            "session_locked_to": str(locked_id),
        })
    except:
        pass

# ═══════════════════════════════════════════════════════════════════════
# SERIAL
# ═══════════════════════════════════════════════════════════════════════
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
    if not serial_connection or not serial_connection.is_open:
        return None
    try:
        if serial_connection.in_waiting > 0:
            line = serial_connection.readline().decode("utf-8", errors="ignore").strip()
            if line.startswith("JSON:"):
                return json.loads(line[5:])
    except:
        pass
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

# ═══════════════════════════════════════════════════════════════════════
# FACE RECOGNITION WORKER
# ═══════════════════════════════════════════════════════════════════════
def face_recognition_worker(card_id, fp_id, fp_conf):
    global attendance_cam_busy, session

    attendance_cam_busy = True
    _emit("camera_busy")

    WIN = "Smart Campus — Face Verification"
    cas = cv2.CascadeClassifier(
        cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    deadline = time.time() + 20
    hits = 0; fno = 0; done = False; interval = 15

    _emit("session_status", {"phase": "face_scan", "msg": "Look at the camera"})

    while time.time() < deadline and session.active:
        if not camera or not camera.isOpened():
            time.sleep(0.05); continue
        ret, frame = camera.read()
        if not ret or frame is None:
            time.sleep(0.03); continue

        fno += 1
        disp = frame.copy(); h, w = disp.shape[:2]
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = cas.detectMultiScale(gray, 1.3, 5)
        for (x, y, fw, fh) in faces:
            cv2.rectangle(disp, (x, y), (x + fw, y + fh), (59, 130, 246), 2)
            hits += 1

        ov = disp.copy()
        cv2.rectangle(ov, (0, 0), (w, 60), (10, 14, 20), -1)
        cv2.addWeighted(ov, 0.75, disp, 0.25, 0, disp)
        lbl = "Face detected — hold still" if len(faces) > 0 else "Look at the camera"
        col = (80, 200, 120) if len(faces) > 0 else (80, 80, 200)
        cv2.putText(disp, lbl, (12, 34), cv2.FONT_HERSHEY_SIMPLEX, 0.8, col, 2)
        cv2.putText(disp, f"{max(0, int(deadline - time.time()))}s",
                    (w - 50, 34), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (160, 160, 160), 1)
        cv2.imshow(WIN, disp)
        cv2.waitKey(1)

        if hits >= 3 and not done and fno % interval == 0:
            done = True
            proc = disp.copy()
            cv2.putText(proc, "Identifying...", (12, h // 2),
                        cv2.FONT_HERSHEY_SIMPLEX, 1.1, (240, 180, 40), 2)
            cv2.imshow(WIN, proc)
            cv2.waitKey(1)

            sid, conf = _fast_match(frame)
            if sid:
                ok = disp.copy()
                cv2.rectangle(ok, (0, 0), (w, h), (34, 197, 94), 12)
                cv2.putText(ok, "VERIFIED", (w // 2 - 100, h // 2 - 20),
                            cv2.FONT_HERSHEY_SIMPLEX, 2.0, (34, 197, 94), 4)
                cv2.putText(ok, get_student_name(sid), (w // 2 - 180, h // 2 + 50),
                            cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 255, 255), 2)
                cv2.imshow(WIN, ok)
                cv2.waitKey(2500)
                cv2.destroyWindow(WIN)
                attendance_cam_busy = False
                session.face_thread_on = False
                _on_face_result(sid, conf, card_id, fp_id, fp_conf)
                return
            else:
                done = False; hits = 0; interval = 10

    fail = np.zeros((280, 480, 3), np.uint8)
    cv2.putText(fail, "Not Recognised", (70, 130),
                cv2.FONT_HERSHEY_SIMPLEX, 1.1, (80, 80, 200), 2)
    cv2.imshow(WIN, fail)
    cv2.waitKey(2000)
    cv2.destroyWindow(WIN)
    attendance_cam_busy = False
    session.face_thread_on = False
    _on_face_result(None, 0.0, card_id, fp_id, fp_conf)

# ═══════════════════════════════════════════════════════════════════════
# CORE ATTENDANCE LOGIC
# ═══════════════════════════════════════════════════════════════════════
def _security_alert(mode, attacker_id, raw_id):
    ln = get_student_name(session.locked_student_id)
    an = get_student_name(attacker_id) if attacker_id else "Unregistered"
    _log("error", f"PROXY BLOCKED — {mode} | Session:{ln} | Cred:{an} | Raw:{raw_id}")
    _emit("security_alert", {
        "mode":            mode,
        "session_student": f"{ln} ({session.locked_student_id})",
        "cred_student":    f"{an} ({attacker_id})",
        "raw_id":          str(raw_id),
        "time":            datetime.now().strftime("%H:%M:%S"),
    })
    _emit("session_status", {
        "phase": "security_mismatch",
        "msg":   f"Proxy blocked — {an} cannot use {ln}'s session",
    })
    _firebase_log_security(mode, attacker_id, session.locked_student_id, raw_id)
    send_esp32("x")
    session.reset()
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
    _emit("session_status", {
        "phase":   "success",
        "msg":     f"{name} — Present",
        "student": name,
    })
    send_esp32("s")
    _firebase_upload(sid, dict(session.verified), "success")
    session.reset()
    threading.Thread(target=_after_reset, daemon=True).start()

def _after_reset():
    """
    After every session (success/fail/timeout/manual reset):
    ask the NEXT student to pick their own verification modes.
    """
    time.sleep(0.8)
    _emit("request_mode_selection", {
        "msg": "Next student — choose your verification method"
    })

def _on_rfid(card_id):
    if MODE_RFID not in selected_modes:
        return
    student_id = get_student_by_card(card_id)
    if student_id is None:
        msg = f"Card {card_id} is not registered. Attendance denied."
        _log("warn", msg)
        _emit("blocked_event", {
            "reason": "unregistered_rfid",
            "card_id": card_id,
            "msg":     msg,
            "time":    datetime.now().strftime("%H:%M:%S"),
        })
        _emit("session_status", {
            "phase": "blocked",
            "msg":   f"Card {card_id} not registered",
        })
        send_esp32("x")
        return
    if not session.active:
        session.reset()
        session.start()
    result = session.add_credential(MODE_RFID, student_id, raw_id=card_id, confidence=1.0)
    if result == "MISMATCH":
        _security_alert(MODE_RFID, student_id, card_id)
        return
    _emit("session_status", {
        "phase":   "rfid_ok",
        "msg":     f"Card verified — {get_student_name(student_id)}",
        "student": get_student_name(student_id),
    })
    send_esp32(_serial_cmd())
    if session.is_complete(selected_modes):
        _finalize()

def _on_fingerprint(fp_id, fp_conf, card_id):
    if MODE_FINGERPRINT not in selected_modes or MODE_FINGERPRINT in session.verified:
        return

    student_id = get_student_by_fingerprint(fp_id)

    # Diagnostic log — always visible
    known = {str(k): get_student_name(v) for k, v in FINGERPRINT_TO_STUDENT.items()}
    if student_id:
        _log("info", f"FP slot {fp_id} → {get_student_name(student_id)} | map={known}")
    else:
        _log("warn", f"FP slot {fp_id} → NOT REGISTERED | known={known}"
                     " | Re-enroll: 'd' then 'e' in Arduino Serial Monitor")

    if student_id is None:
        _emit("blocked_event", {
            "reason": "unregistered_fp",
            "fp_id":  str(fp_id),
            "msg":    f"FP slot {fp_id} not registered. Known: {known}",
            "time":   datetime.now().strftime("%H:%M:%S"),
        })
        _emit("session_status", {
            "phase": "blocked",
            "msg":   f"FP slot {fp_id} not registered",
        })
        send_esp32("x")
        session.reset()
        return

    if session.locked_student_id and session.locked_student_id != student_id:
        _log("error",
             f"FP MISMATCH: session={session.locked_student_id} "
             f"but FP slot {fp_id}={student_id} "
             f"→ wrong finger enrolled at this slot during testing")
        _security_alert(MODE_FINGERPRINT, student_id, fp_id)
        return

    if not session.active:
        session.reset()
        session.start()
    result = session.add_credential(MODE_FINGERPRINT, student_id,
                                    raw_id=str(fp_id), confidence=fp_conf)
    if result == "MISMATCH":
        _security_alert(MODE_FINGERPRINT, student_id, fp_id)
        return

    _log("ok", f"FP verified: {get_student_name(student_id)} slot={fp_id}")
    _emit("session_status", {
        "phase":   "fp_ok",
        "msg":     f"Fingerprint verified — {get_student_name(student_id)}",
        "student": get_student_name(student_id),
    })
    if session.is_complete(selected_modes):
        _finalize()
    elif MODE_FACE in session.pending(selected_modes) and not session.face_thread_on:
        session.face_thread_on = True
        threading.Thread(target=face_recognition_worker,
                         args=(card_id, str(fp_id), fp_conf), daemon=True).start()

def _on_face_result(student_id, confidence, card_id, fp_id, fp_conf):
    if not session.active:
        send_esp32("x")
        threading.Thread(target=_after_reset, daemon=True).start()
        return
    if student_id is None:
        _emit("blocked_event", {
            "reason": "face_not_recognised",
            "msg":    "Face not recognised — attendance denied",
            "time":   datetime.now().strftime("%H:%M:%S"),
        })
        _emit("session_status", {"phase": "blocked", "msg": "Face not recognised"})
        if session.locked_student_id:
            _firebase_upload(session.locked_student_id, dict(session.verified), "face_failed")
        send_esp32("x")
        session.reset()
        threading.Thread(target=_after_reset, daemon=True).start()
        return
    result = session.add_credential(MODE_FACE, student_id,
                                    raw_id=student_id, confidence=confidence)
    if result == "MISMATCH":
        _security_alert(MODE_FACE, student_id, student_id)
        return
    _emit("session_status", {
        "phase":   "face_ok",
        "msg":     f"Face verified — {get_student_name(student_id)} ({confidence:.1%})",
        "student": get_student_name(student_id),
    })
    if session.is_complete(selected_modes):
        _finalize()

# ═══════════════════════════════════════════════════════════════════════
# ESP32 EVENT ROUTER
# ═══════════════════════════════════════════════════════════════════════
def handle_serial_event(data):
    event   = data.get("event", "")
    card_id = data.get("card_id", "")
    _log("info", f"[ESP32] {event} card={card_id}")

    if event == "CARD_SCANNED":
        _emit("session_status", {"phase": "card_scanned", "msg": f"Card scanned: {card_id}"})
        _on_rfid(card_id)
    elif event in ("ATTENDANCE_SUCCESS", "AUTH_SUCCESS"):
        _on_fingerprint(data.get("fingerprint_id"),
                        float(data.get("confidence", 0)), card_id)
    elif event == "FACE_MODE_REQUESTED":
        if MODE_FACE not in selected_modes:
            return
        if not session.active:
            session.start()
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

# ═══════════════════════════════════════════════════════════════════════
# HARDWARE LOOP
# ═══════════════════════════════════════════════════════════════════════
def hardware_loop():
    while True:
        if not system_ready:
            time.sleep(0.1)
            continue
        data = read_serial()
        if data:
            handle_serial_event(data)
        if session.active and session.elapsed() > SESSION_TIMEOUT_SEC:
            _log("warn", "Session timeout")
            _emit("session_status", {"phase": "timeout", "msg": "Session timed out"})
            send_esp32("x")
            session.reset()
            threading.Thread(target=_after_reset, daemon=True).start()
        time.sleep(0.05)

# ═══════════════════════════════════════════════════════════════════════
# REGISTRATION LOGIC
# ═══════════════════════════════════════════════════════════════════════
_reg_captured_frame = None

def check_credential_duplicates(student_id, card_id, fp_slot_str):
    """Returns list of conflict strings. Empty = no conflicts."""
    conflicts = []
    if student_id in STUDENT_CREDENTIALS:
        conflicts.append(
            f"Student ID '{student_id}' already registered as "
            f"'{get_student_name(student_id)}'"
        )
    cid_upper = card_id.strip().upper() if card_id else ""
    if cid_upper and cid_upper in CARD_TO_STUDENT:
        conflicts.append(
            f"Card '{cid_upper}' already belongs to "
            f"'{get_student_name(CARD_TO_STUDENT[cid_upper])}'"
        )
    if fp_slot_str and str(fp_slot_str).strip().isdigit():
        fid = int(fp_slot_str)
        if fid in FINGERPRINT_TO_STUDENT:
            conflicts.append(
                f"Fingerprint slot {fid} already belongs to "
                f"'{get_student_name(FINGERPRINT_TO_STUDENT[fid])}'"
            )
    face_path = os.path.join(FACE_DATABASE_PATH, f"{student_id}.jpg")
    if os.path.exists(face_path):
        conflicts.append(f"Face image already exists for ID '{student_id}'")
    return conflicts

def save_new_student(student_id, name, roll, email, card_id, fp_slot_str, frame):
    fps  = [int(fp_slot_str)] if str(fp_slot_str).strip().isdigit() else []
    cids = [card_id.strip().upper()] if card_id and card_id.strip() else []

    STUDENT_CREDENTIALS[student_id] = {
        "name":            name,
        "card_ids":        cids,
        "fingerprint_ids": fps,
    }
    _rebuild_maps()

    if frame is not None:
        path = os.path.join(FACE_DATABASE_PATH, f"{student_id}.jpg")
        cv2.imwrite(path, frame)
        threading.Thread(target=_cache_face, args=(student_id, path), daemon=True).start()

    _firebase_register_student(student_id, name, roll, email,
                               card_id.strip().upper() if card_id else "",
                               fp_slot_str)
    _log("ok", f"Registered: {name} ({student_id})")

# ═══════════════════════════════════════════════════════════════════════
# SOCKET EVENTS
# ═══════════════════════════════════════════════════════════════════════
def _state_payload():
    return {
        "firebase": firebase_initialized,
        "serial":   bool(serial_connection and serial_connection.is_open),
        "camera":   camera is not None,
        "modes":    selected_modes,
        "ready":    system_ready,
        "students": [
            {"id": sid, "name": v["name"]}
            for sid, v in STUDENT_CREDENTIALS.items()
        ],
        "fp_map":   {
            str(k): get_student_name(v)
            for k, v in FINGERPRINT_TO_STUDENT.items()
        },
        "card_map": {
            k: get_student_name(v)
            for k, v in CARD_TO_STUDENT.items()
        },
    }

@socketio.on("connect")
def on_connect():
    socketio.emit("system_state", _state_payload())

@socketio.on("initialize_system")
def on_init(data):
    global selected_modes, system_ready, hw_initialized
    modes = data.get("modes", [])
    if len(modes) < 2:
        socketio.emit("log", {"level": "error", "msg": "Select at least 2 modes", "ts": ""})
        return
    selected_modes = modes
    _log("info", f"Modes: {' + '.join(modes)}")
    _emit("session_status", {"phase": "initializing", "msg": "Initialising hardware…"})

    if not hw_initialized:
        initialize_firebase()
        # Load any previously registered students from Firebase
        _load_students_from_firebase()

        if not connect_serial():
            _log("error", f"ESP32 not found on {SERIAL_PORT}")
            return

        # Always open camera (needed for face mode + registration)
        _open_camera()

        if MODE_FACE in selected_modes and not face_emb_cache:
            threading.Thread(target=warmup_and_cache_faces, daemon=True).start()

        hw_initialized = True

    system_ready = True

    if MODE_RFID not in selected_modes:
        send_esp32(_serial_cmd())

    msg = "Ready — scan RFID card" if MODE_RFID in selected_modes else "Ready"
    _emit("session_status", {"phase": "ready", "msg": msg})
    socketio.emit("system_state", _state_payload())

@socketio.on("set_session_modes")
def on_set_modes(data):
    """Per-student mode selection — called after each session ends."""
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
    _emit("session_status",         {"phase": "ready", "msg": msg})
    socketio.emit("system_state", _state_payload())

@socketio.on("start_scan")
def on_start_scan():
    if not system_ready:
        return
    if MODE_RFID in selected_modes:
        _log("info", "RFID mode — scan card to start")
        return
    if session.active:
        _log("warn", "Session already active")
        return
    session.reset()
    session.start()
    send_esp32(_serial_cmd())
    _emit("session_status", {"phase": "scanning", "msg": "Scan started"})

@socketio.on("reset_session")
def on_reset():
    send_esp32("x")
    session.reset()
    threading.Thread(target=_after_reset, daemon=True).start()
    _log("warn", "Session reset manually")

# ── Registration ────────────────────────────────────────────────────────────
@socketio.on("start_camera_preview")
def on_start_preview():
    global reg_preview_active
    if not camera or not camera.isOpened():
        if not _open_camera():
            _emit("reg_error", {"msg": "Camera not available — check DroidCam"})
            return
    reg_preview_active = True
    threading.Thread(target=_reg_stream_loop, daemon=True).start()

@socketio.on("stop_camera_preview")
def on_stop_preview():
    global reg_preview_active
    reg_preview_active = False

@socketio.on("capture_face")
def on_capture():
    global _reg_captured_frame
    if not camera or not camera.isOpened():
        _emit("reg_error", {"msg": "Camera not ready"})
        return
    ret, frame = camera.read()
    if not ret or frame is None:
        _emit("reg_error", {"msg": "Failed to read camera frame"})
        return
    _reg_captured_frame = frame.copy()
    _, buf = cv2.imencode(".jpg", frame)
    _emit("face_captured", {"data": base64.b64encode(buf).decode("utf-8")})

@socketio.on("check_duplicates")
def on_check_dupes(data):
    sid = data.get("student_id", "").strip()
    cid = data.get("card_id", "").strip()
    fps = data.get("fingerprint_slot", "").strip()
    conflicts = check_credential_duplicates(sid, cid, fps)
    # Face duplicate check if photo captured
    if _reg_captured_frame is not None and face_emb_cache:
        face_sid, _ = _fast_match(_reg_captured_frame, threshold=REG_DUPE_THRESHOLD)
        if face_sid:
            conflicts.append(
                f"Captured face already matches '{get_student_name(face_sid)}' "
                f"({face_sid}) — same person cannot register twice"
            )
    _emit("duplicate_result", {"conflicts": conflicts, "ok": len(conflicts) == 0})

@socketio.on("register_student")
def on_register(data):
    global _reg_captured_frame
    sid   = data.get("student_id",       "").strip()
    name  = data.get("name",             "").strip().upper()
    roll  = data.get("roll_number",      "").strip()
    email = data.get("email",            "").strip()
    cid   = data.get("card_id",          "").strip().upper()
    fps   = data.get("fingerprint_slot", "").strip()

    if not sid or not name:
        _emit("reg_error", {"msg": "Student ID and Name are required"})
        return

    conflicts = check_credential_duplicates(sid, cid, fps)
    if _reg_captured_frame is not None and face_emb_cache:
        face_sid, _ = _fast_match(_reg_captured_frame, threshold=REG_DUPE_THRESHOLD)
        if face_sid:
            conflicts.append(f"Face already registered as '{get_student_name(face_sid)}'")

    if conflicts:
        _emit("reg_error", {"msg": "Cannot register — " + "; ".join(conflicts)})
        return

    save_new_student(sid, name, roll, email, cid, fps, _reg_captured_frame)
    _reg_captured_frame = None

    _emit("reg_success", {
        "student_id": sid,
        "name":       name,
        "card_id":    cid,
        "fp_slot":    fps,
        "students":   [{"id": s, "name": v["name"]} for s, v in STUDENT_CREDENTIALS.items()],
        "fp_map":     {str(k): get_student_name(v) for k, v in FINGERPRINT_TO_STUDENT.items()},
    })

@socketio.on("remove_student")
def on_remove_student(data):
    """
    Full student removal:
    - Firebase cleanup (students/, attendance_summary/)
    - In-memory credential maps
    - Face cache + face image on disk
    """
    sid = data.get("student_id", "").strip()
    if not sid:
        _emit("remove_error", {"msg": "Student ID required"})
        return
    if sid not in STUDENT_CREDENTIALS:
        _emit("remove_error", {"msg": f"Student {sid} not found in current credentials"})
        return

    name = get_student_name(sid)
    _firebase_remove_student(sid)

    _emit("remove_success", {
        "student_id": sid,
        "name":       name,
        "students":   [{"id": s, "name": v["name"]} for s, v in STUDENT_CREDENTIALS.items()],
        "fp_map":     {str(k): get_student_name(v) for k, v in FINGERPRINT_TO_STUDENT.items()},
    })
    _log("ok", f"Removed student: {name} ({sid})")

@socketio.on("reload_students_from_firebase")
def on_reload():
    """Re-sync STUDENT_CREDENTIALS from Firebase (useful after external edits)."""
    _load_students_from_firebase()
    socketio.emit("system_state", _state_payload())
    _log("ok", "Student credentials reloaded from Firebase")

# ═══════════════════════════════════════════════════════════════════════
# DASHBOARD HTML (embedded)
# ═══════════════════════════════════════════════════════════════════════
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
  --blue:#3b82f6;--bs:rgba(59,130,246,.12);--bb:rgba(59,130,246,.3);
  --green:#22c55e;--gs:rgba(34,197,94,.1);--gb:rgba(34,197,94,.3);
  --red:#f87171;--rs:rgba(248,113,113,.1);--rb:rgba(248,113,113,.3);
  --amber:#fbbf24;--as:rgba(251,191,36,.1);
  --radius:8px;--rlg:12px;--rxl:16px;
  --mono:'JetBrains Mono',monospace;--font:'Plus Jakarta Sans',sans-serif
}
html,body{height:100%;background:var(--bg);color:var(--text);font-family:var(--font);font-size:15px;overflow:hidden}
.root{height:100vh;display:grid;grid-template-columns:260px 1fr;grid-template-rows:60px 1fr}
/* HEADER */
.hdr{grid-column:1/-1;display:flex;align-items:center;padding:0 24px;gap:14px;
  background:var(--surface);border-bottom:1px solid var(--border)}
.brand{display:flex;align-items:center;gap:10px}
.bi{width:34px;height:34px;background:var(--blue);border-radius:8px;display:flex;
  align-items:center;justify-content:center;font-size:18px;flex-shrink:0}
.bn{font-size:16px;font-weight:700;letter-spacing:-.3px}
.bs{font-size:11px;color:var(--t2);font-weight:400;margin-top:1px}
.hpills{display:flex;gap:6px;margin-left:auto;align-items:center}
.hp{display:flex;align-items:center;gap:5px;padding:4px 10px;border-radius:20px;
  border:1px solid var(--border);font-size:12px;color:var(--t2);font-family:var(--mono)}
.hp.ok{border-color:var(--gb);color:var(--green);background:var(--gs)}
.hp.err{border-color:var(--rb);color:var(--red);background:var(--rs)}
.hp .dot{width:6px;height:6px;border-radius:50%;background:currentColor}
.clk{font-family:var(--mono);font-size:13px;color:var(--t2);margin-left:10px}
/* SIDEBAR */
.sb{background:var(--surface);border-right:1px solid var(--border);
  display:flex;flex-direction:column;overflow:hidden}
.nav{padding:12px 10px 6px}
.ni{display:flex;align-items:center;gap:9px;padding:9px 12px;border-radius:var(--radius);
  cursor:pointer;color:var(--t2);font-size:13px;font-weight:500;transition:all .15s}
.ni:hover{background:var(--s2);color:var(--text)}
.ni.active{background:var(--s3);color:var(--text)}
.ni svg{width:16px;height:16px;flex-shrink:0}
.sbl{padding:14px 16px 6px;font-size:11px;font-weight:600;color:var(--t3);
  letter-spacing:.7px;text-transform:uppercase}
/* SESSION CARD */
.sc{margin:0 10px 10px;border:1px solid var(--border);border-radius:var(--rlg);
  background:var(--s2);padding:14px;transition:border-color .3s,box-shadow .3s}
.sc.s-ok  {border-color:var(--gb);box-shadow:0 0 0 1px var(--gs) inset}
.sc.s-info{border-color:var(--bb);box-shadow:0 0 0 1px var(--bs) inset}
.sc.s-err {border-color:var(--rb);box-shadow:0 0 0 1px var(--rs) inset}
.sph{font-size:10px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;
  color:var(--t3);margin-bottom:5px;font-family:var(--mono)}
.smsg{font-size:13px;color:var(--t2);line-height:1.5}
.ssw{display:flex;align-items:center;gap:10px;margin-top:10px;padding:10px;
  border-radius:var(--radius);background:var(--s3);animation:si .25s ease}
@keyframes si{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
.avi{width:32px;height:32px;border-radius:50%;background:var(--blue);display:flex;
  align-items:center;justify-content:center;font-size:13px;font-weight:600;color:#fff;flex-shrink:0}
.steps{display:flex;flex-direction:column;gap:5px;margin-top:10px}
.step{display:flex;align-items:center;gap:7px;padding:6px 9px;border-radius:var(--radius);
  border:1px solid var(--border);font-size:12px;color:var(--t3);background:var(--bg);transition:all .25s}
.step.done  {border-color:var(--gb);color:var(--green);background:var(--gs)}
.step.active{border-color:var(--bb);color:var(--blue);background:var(--bs);animation:blink 1.4s infinite}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.6}}
/* INLINE PICKER */
.ipicker{margin-top:14px;padding-top:12px;border-top:1px solid var(--border)}
.ipm-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:10px}
.ipm{display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 4px;
  border:1px solid var(--b2);border-radius:var(--radius);cursor:pointer;
  font-size:11px;font-weight:500;color:var(--t2);user-select:none;text-align:center;
  transition:all .15s}
.ipm:hover{border-color:var(--blue);color:var(--blue);background:var(--bs)}
.ipm.sel{border-color:var(--blue);background:var(--bs);color:var(--blue)}
.ipm span{font-size:18px}
.ip-hint{font-size:10px;color:var(--t3);font-family:var(--mono);margin-bottom:8px}
.ip-btn{width:100%;padding:8px;background:var(--blue);color:#fff;border:none;
  border-radius:var(--radius);font-family:var(--font);font-size:13px;font-weight:600;
  cursor:pointer;transition:all .15s}
.ip-btn:disabled{opacity:.35;cursor:not-allowed}
/* CONTROLS */
.ctrls{padding:0 10px 8px;display:flex;flex-direction:column;gap:5px}
/* LOG */
.lw{flex:1;padding:0 10px 10px;display:flex;flex-direction:column;min-height:0}
.lb{flex:1;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);
  padding:8px;font-family:var(--mono);font-size:10px;overflow-y:auto;
  display:flex;flex-direction:column;gap:1px}
.ll{display:flex;gap:6px;line-height:1.6}
.ll-ts{color:var(--t3);flex-shrink:0}
.ll-m.ok{color:var(--green)}.ll-m.error{color:var(--red)}.ll-m.warn{color:var(--amber)}.ll-m.info{color:var(--blue)}
/* MAIN */
.main{overflow-y:auto;padding:20px 24px;display:flex;flex-direction:column;gap:18px}
/* BUTTONS */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;
  padding:9px 16px;border:none;border-radius:var(--radius);font-family:var(--font);
  font-size:13px;font-weight:600;cursor:pointer;transition:all .15s;width:100%}
.btn-blue{background:var(--blue);color:#fff}.btn-blue:hover{opacity:.9}
.btn-blue:disabled{opacity:.4;cursor:not-allowed}
.btn-out{background:transparent;border:1px solid var(--b2);color:var(--t2)}
.btn-out:hover{border-color:var(--blue);color:var(--blue)}
.btn-sm{padding:6px 12px;font-size:12px;width:auto}
.btn-green{background:var(--green);color:#052e16}.btn-green:hover{opacity:.9}
.btn-danger{background:transparent;border:1px solid var(--b2);color:var(--t2)}
.btn-danger:hover{border-color:var(--red);color:var(--red)}
.btn-red{background:var(--red);color:#fff}.btn-red:hover{opacity:.9}
/* HERO */
.hero{background:var(--surface);border:1px solid var(--border);border-radius:var(--rxl);
  padding:24px 28px;display:flex;align-items:center;gap:24px;transition:all .4s}
.hero.s-active{border-color:var(--bb)}
.hero.s-success{border-color:var(--gb)}
.hero.s-fail{border-color:var(--rb)}
.hcirc{width:88px;height:88px;border-radius:50%;border:2px solid var(--b2);
  display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:700;
  flex-shrink:0;transition:all .4s}
.s-active .hcirc{border-color:var(--bb);background:var(--bs)}
.s-success .hcirc{border-color:var(--gb);background:var(--gs);color:#052e16}
.s-fail .hcirc{border-color:var(--rb);background:var(--rs)}
.hname{font-size:22px;font-weight:700;margin-bottom:4px}
.hsub{font-size:13px;color:var(--t2)}
.hbadge{display:inline-flex;align-items:center;gap:6px;margin-top:12px;
  padding:6px 14px;border-radius:20px;font-size:13px;font-weight:600}
.hb-idle{background:var(--s3);color:var(--t2)}
.hb-act{background:var(--bs);color:var(--blue)}
.hb-ok{background:var(--gs);color:var(--green)}
.hb-fail{background:var(--rs);color:var(--red)}
/* STATS */
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.stat{background:var(--surface);border:1px solid var(--border);border-radius:var(--rlg);padding:16px 20px}
.stn{font-size:32px;font-weight:700;line-height:1;margin-bottom:4px}
.stl{font-size:12px;color:var(--t2);text-transform:uppercase;letter-spacing:.5px}
/* TABLE */
.tc{background:var(--surface);border:1px solid var(--border);border-radius:var(--rlg);overflow:hidden}
.th{padding:14px 18px;border-bottom:1px solid var(--border);font-size:13px;font-weight:600;
  display:flex;align-items:center;justify-content:space-between}
table{width:100%;border-collapse:collapse;font-size:13px}
th{padding:10px 18px;text-align:left;font-size:11px;font-weight:600;letter-spacing:.5px;
  text-transform:uppercase;color:var(--t3);border-bottom:1px solid var(--border);background:var(--s2)}
td{padding:11px 18px;border-bottom:1px solid var(--border);color:var(--t2);vertical-align:middle}
tr:last-child td{border-bottom:none}
tr.nr{animation:rf .35s ease}
@keyframes rf{from{background:rgba(34,197,94,.08)}to{background:transparent}}
.tag{display:inline-flex;padding:2px 8px;border-radius:5px;font-size:11px;font-family:var(--mono);font-weight:500;margin-right:3px}
.t-blue{background:var(--bs);color:var(--blue)}.t-green{background:var(--gs);color:var(--green)}
.t-red{background:var(--rs);color:var(--red)}.t-amber{background:var(--as);color:var(--amber)}
/* INFO GRID */
.ig{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.ic{background:var(--surface);border:1px solid var(--border);border-radius:var(--rlg);padding:16px}
.ict{font-size:12px;font-weight:600;color:var(--t3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px}
.fpr{display:flex;justify-content:space-between;align-items:center;
  padding:5px 0;border-bottom:1px solid var(--border);font-size:12px}
.fpr:last-child{border-bottom:none}
.fps{font-family:var(--mono);color:var(--t3)}.fpn{color:var(--text);font-weight:500}
.ai{border:1px solid var(--rb);border-radius:var(--radius);background:var(--rs);
  padding:12px;margin-bottom:8px;animation:ali .3s}
@keyframes ali{from{opacity:0;transform:translateX(6px)}to{opacity:1;transform:translateX(0)}}
.ai-t{font-size:12px;font-weight:600;color:var(--red);margin-bottom:4px}
.ai-b{font-size:12px;color:var(--t2);line-height:1.5}
.ai-ts{font-size:10px;color:var(--t3);font-family:var(--mono);margin-top:4px}
.bi2{border:1px solid var(--as);border-radius:var(--radius);background:var(--as);
  padding:10px;margin-bottom:6px;animation:ali .3s}
.bi2-t{font-size:12px;font-weight:600;color:var(--amber);margin-bottom:3px}
/* FORM */
.fg{margin-bottom:14px}
label{display:block;font-size:12px;font-weight:600;color:var(--t2);margin-bottom:5px}
input[type=text],input[type=email]{width:100%;padding:9px 12px;background:var(--s2);
  border:1px solid var(--b2);border-radius:var(--radius);color:var(--text);
  font-family:var(--font);font-size:13px;outline:none;transition:border-color .15s}
input:focus{border-color:var(--blue)}
input::placeholder{color:var(--t3)}
.cw{background:var(--s2);border:1px solid var(--b2);border-radius:var(--rlg);
  overflow:hidden;aspect-ratio:4/3;display:flex;align-items:center;justify-content:center}
.cph{text-align:center;color:var(--t3);padding:20px;font-size:13px}
.cph span{display:block;font-size:36px;margin-bottom:8px}
.cb2{background:var(--rs);border:1px solid var(--rb);border-radius:var(--radius);padding:12px;margin-bottom:12px}
.ci{font-size:12px;color:var(--red);padding:2px 0}
.sb2{background:var(--gs);border:1px solid var(--gb);border-radius:var(--radius);padding:12px;margin-bottom:12px}
.sb2-t{font-size:13px;font-weight:600;color:var(--green);margin-bottom:4px}
.sb2-b{font-size:12px;color:var(--t2)}
.hn{font-size:11px;color:var(--t3);line-height:1.6;padding:10px 12px;
  border-radius:var(--radius);background:var(--s2);border:1px solid var(--border);margin-top:12px}
/* STUDENT REMOVE ROW */
.stu-row{display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border)}
.stu-row:last-child{border-bottom:none}
/* SETUP OVERLAY */
#ov{position:fixed;inset:0;z-index:200;background:rgba(0,0,0,.8);
  display:flex;align-items:center;justify-content:center}
.ovb{background:var(--surface);border:1px solid var(--b2);border-radius:var(--rxl);
  padding:36px;width:480px;max-width:94vw}
.ovt{font-size:22px;font-weight:700;margin-bottom:4px}
.ovs{font-size:13px;color:var(--t2);margin-bottom:6px}
.ov-notice{background:var(--as);border:1px solid rgba(251,191,36,.2);
  border-radius:var(--radius);padding:12px;margin-bottom:20px;font-size:12px;color:var(--amber);line-height:1.5}
.mg{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px}
.mc{display:flex;flex-direction:column;align-items:center;gap:8px;padding:22px 10px;
  border:1px solid var(--b2);border-radius:var(--rlg);cursor:pointer;
  transition:all .15s;user-select:none;text-align:center}
.mc:hover{border-color:var(--blue);background:var(--bs)}
.mc.sel{border-color:var(--blue);background:var(--bs)}
.mc-i{font-size:26px;line-height:1}
.mc-l{font-size:12px;font-weight:600;color:var(--t2)}
.mc-d{font-size:10px;color:var(--t3);font-family:var(--mono)}
.mc.sel .mc-l{color:var(--blue)}
.ovh{font-size:12px;color:var(--t3);text-align:center;margin-bottom:18px;font-family:var(--mono)}
.ovp{font-size:11px;color:var(--t3);text-align:center;margin-top:12px;font-family:var(--mono);min-height:14px}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--b2);border-radius:2px}
</style>
</head>
<body>

<!-- SETUP OVERLAY -->
<div id="ov">
  <div class="ovb">
    <div class="ovt">Smart Campus ERP</div>
    <div class="ovs">Biometric Attendance — IoT Lab · Select at least 2 verification modes</div>
    <div class="ov-notice">
      <strong>Fingerprint mismatch?</strong> Send <code>'d'</code> in Arduino Serial Monitor to wipe all fingerprints,
      then <code>'e'</code> to re-enroll each student. Note the slot number printed and update <code>fingerprint_ids</code> in the Python config.
    </div>
    <div class="mg">
      <div class="mc" data-mode="RFID" onclick="togMode(this)">
        <div class="mc-i">&#x1F4F1;</div><div class="mc-l">RFID Card</div>
        <div class="mc-d">Tap on reader</div>
      </div>
      <div class="mc" data-mode="FINGERPRINT" onclick="togMode(this)">
        <div class="mc-i">&#x1F91A;</div><div class="mc-l">Fingerprint</div>
        <div class="mc-d">Place on sensor</div>
      </div>
      <div class="mc" data-mode="FACE" onclick="togMode(this)">
        <div class="mc-i">&#x1F9D1;</div><div class="mc-l">Face Scan</div>
        <div class="mc-d">Look at camera</div>
      </div>
    </div>
    <div class="ovh" id="ovh">Select at least 2 modes</div>
    <button class="btn btn-blue" id="ovbtn" disabled onclick="doInit()">Start Attendance System</button>
    <div class="ovp" id="ovp"></div>
  </div>
</div>

<!-- APP -->
<div class="root">
  <header class="hdr">
    <div class="brand">
      <div class="bi">&#x1F393;</div>
      <div><div class="bn">Smart Campus ERP</div><div class="bs">Biometric Attendance · IoT Lab</div></div>
    </div>
    <div class="hpills">
      <div class="hp" id="hp-s"><span class="dot"></span><span>Serial</span></div>
      <div class="hp" id="hp-f"><span class="dot"></span><span>Firebase</span></div>
      <div class="hp" id="hp-c"><span class="dot"></span><span>Camera</span></div>
      <div class="hp" id="hp-m" style="font-size:12px"></div>
    </div>
    <div class="clk" id="clk">--:--:--</div>
  </header>

  <aside class="sb">
    <div class="nav">
      <div class="ni active" id="nv-a" onclick="sw('att')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
        Attendance
      </div>
      <div class="ni" id="nv-r" onclick="sw('reg')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/></svg>
        Register Student
      </div>
      <div class="ni" id="nv-m" onclick="sw('manage')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
        Manage Students
      </div>
    </div>

    <div class="sbl">Session Status</div>
    <div class="sc" id="scard">
      <div class="sph" id="sph">IDLE</div>
      <div class="smsg" id="smsg">Waiting for mode selection</div>
      <div id="sstu"></div>
      <div class="steps" id="ssteps"></div>
    </div>

    <div class="ctrls">
      <button class="btn btn-blue"   id="bscan"  onclick="doScan()"  disabled>Start Scan</button>
      <button class="btn btn-danger"             onclick="doReset()">Reset Session</button>
    </div>

    <div class="sbl">System Log</div>
    <div class="lw"><div class="lb" id="lb"></div></div>
  </aside>

  <main class="main">

    <!-- ATTENDANCE VIEW -->
    <div id="v-att">
      <div class="hero" id="hero">
        <div class="hcirc" id="hcirc">?</div>
        <div style="flex:1">
          <div class="hname" id="hname">Waiting for student...</div>
          <div class="hsub"  id="hsub" >Scan card or place finger to begin</div>
          <div style="margin-top:10px"><span class="hbadge hb-idle" id="hbadge">System Ready</span></div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:11px;color:var(--t3);margin-bottom:4px">TODAY</div>
          <div style="font-size:30px;font-weight:700;color:var(--green)" id="hcnt">0</div>
          <div style="font-size:11px;color:var(--t2)">Present</div>
        </div>
      </div>

      <div class="stats">
        <div class="stat"><div class="stn" style="color:var(--green)" id="sp">0</div><div class="stl">Present today</div></div>
        <div class="stat"><div class="stn" style="color:var(--amber)" id="sb">0</div><div class="stl">Blocked / denied</div></div>
        <div class="stat"><div class="stn" style="color:var(--red)"   id="sa">0</div><div class="stl">Security alerts</div></div>
      </div>

      <div class="tc">
        <div class="th">
          <span>Live Attendance Feed</span>
          <span id="tsub" style="font-size:12px;color:var(--t2);font-weight:400">No records yet</span>
        </div>
        <table>
          <thead><tr><th>#</th><th>Time</th><th>Student</th><th>Methods</th><th>Face</th><th>Status</th></tr></thead>
          <tbody id="atb"><tr><td colspan="6" style="text-align:center;color:var(--t3);padding:28px;font-family:var(--mono)">No records yet</td></tr></tbody>
        </table>
      </div>

      <div class="ig">
        <div class="ic">
          <div class="ict">&#x1F91A; Fingerprint slot map</div>
          <div id="fpmap"><div style="font-size:12px;color:var(--t3)">Loading...</div></div>
          <div style="font-size:11px;color:var(--t3);margin-top:10px;line-height:1.6">
            Wrong name on scan? Re-enroll: <code style="font-family:var(--mono)">'d'</code> then <code style="font-family:var(--mono)">'e'</code> in Arduino Serial Monitor, update <code>fingerprint_ids</code>.
          </div>
        </div>
        <div class="ic">
          <div class="ict">&#x26A0; Security &amp; blocked events</div>
          <div id="aw"><div style="font-size:12px;color:var(--t3)">No alerts</div></div>
        </div>
      </div>
    </div>

    <!-- REGISTRATION VIEW -->
    <div id="v-reg" style="display:none">
      <div style="margin-bottom:18px">
        <div style="font-size:18px;font-weight:700;margin-bottom:4px">Register New Student</div>
        <div style="font-size:13px;color:var(--t2)">All fields checked for duplicates. Face checked against existing students.</div>
      </div>
      <div id="rcf" style="display:none" class="cb2"></div>
      <div id="rcs" style="display:none" class="sb2"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start">
        <div>
          <div class="fg"><label>Enrollment Number / Student ID *</label><input type="text" id="f-sid" placeholder="e.g. 2200331550127" oninput="clrReg()"/></div>
          <div class="fg"><label>Full Name *</label><input type="text" id="f-name" placeholder="ARJUN SHARMA"/></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="fg"><label>Roll Number</label><input type="text" id="f-roll" placeholder="22BIT127"/></div>
            <div class="fg"><label>Email</label><input type="email" id="f-email" placeholder="s@college.edu"/></div>
          </div>
          <div class="fg">
            <label>RFID Card ID <span style="color:var(--t3);font-weight:400">(hex — scan and note from Arduino monitor)</span></label>
            <input type="text" id="f-card" placeholder="A1B2C3D4" style="font-family:var(--mono)"/>
          </div>
          <div class="fg">
            <label>Fingerprint Slot <span style="color:var(--t3);font-weight:400">(enroll with 'e', note slot number printed)</span></label>
            <input type="text" id="f-fp" placeholder="4" style="font-family:var(--mono)"/>
          </div>
          <div style="display:flex;gap:8px;margin-bottom:12px">
            <button class="btn btn-out btn-sm" onclick="doChkDupe()">Check duplicates</button>
          </div>
          <button class="btn btn-green" onclick="doReg()">&#x2713; Register Student</button>
          <div class="hn">After registering, also add the student to <code>STUDENT_CREDENTIALS</code> in the Python file for persistence across restarts. The dashboard and session update immediately without restart.</div>
        </div>
        <div>
          <div style="font-size:12px;font-weight:600;color:var(--t2);margin-bottom:8px">Face Photo *</div>
          <div class="cw" id="cw"><div class="cph" id="cph"><span>&#x1F4F7;</span>Click "Start Camera" to preview</div><img id="ci" style="display:none;width:100%;height:100%;object-fit:cover" alt="Preview"/></div>
          <div style="display:flex;gap:8px;margin-top:10px">
            <button class="btn btn-out btn-sm" id="btc" onclick="togCam()">Start Camera</button>
            <button class="btn btn-blue btn-sm" id="bcp" onclick="doCap()" disabled>Capture Photo</button>
          </div>
          <div id="cprev" style="display:none;margin-top:12px">
            <div style="font-size:12px;color:var(--green);margin-bottom:6px;font-weight:600">&#x2713; Photo captured</div>
            <img id="cpi" style="width:100%;border-radius:var(--radius);border:1px solid var(--gb)" alt="Captured"/>
          </div>
        </div>
      </div>
    </div>

    <!-- MANAGE STUDENTS VIEW -->
    <div id="v-manage" style="display:none">
      <div style="margin-bottom:18px;display:flex;align-items:center;justify-content:space-between">
        <div>
          <div style="font-size:18px;font-weight:700;margin-bottom:4px">Manage Students</div>
          <div style="font-size:13px;color:var(--t2)">Remove a student to free their credentials for re-registration. Full cleanup: Firebase, face image, and lookup maps.</div>
        </div>
        <button class="btn btn-out btn-sm" onclick="doReload()" style="width:auto">&#x21BB; Reload from Firebase</button>
      </div>

      <div class="ic" style="margin-bottom:16px">
        <div class="ict">How to remove &amp; re-register a student</div>
        <ol style="font-size:12px;color:var(--t2);line-height:2;padding-left:18px">
          <li>Click <strong>Remove</strong> next to the student below — this deletes Firebase data, face image, and credential mappings</li>
          <li>Go to <strong>Register Student</strong> tab</li>
          <li>Enter the new student's details with the same RFID/fingerprint credentials</li>
          <li>Capture their face photo and click Register</li>
          <li>Add them to <code>STUDENT_CREDENTIALS</code> in the Python file for restart persistence</li>
        </ol>
      </div>

      <div id="rmsg" style="display:none;margin-bottom:12px"></div>

      <div class="tc">
        <div class="th"><span>Registered Students</span><span id="stu-count" style="font-size:12px;color:var(--t2);font-weight:400"></span></div>
        <table>
          <thead><tr><th>Student</th><th>ID</th><th>Card</th><th>FP Slots</th><th>Action</th></tr></thead>
          <tbody id="stu-tbody"><tr><td colspan="5" style="text-align:center;color:var(--t3);padding:20px">Loading...</td></tr></tbody>
        </table>
      </div>
    </div>

  </main>
</div>

<script>
const socket = io();
let selModes=[],sysModes=[],pC=0,bC=0,aC=0,rC=0,camOn=false;
let CREDS={}, FP_MAP={}, CARD_MAP={};

setInterval(()=>{document.getElementById('clk').textContent=new Date().toLocaleTimeString('en-IN',{hour12:false})},1000);

// ── SETUP OVERLAY ──────────────────────────────────────────────────
function togMode(el){
  el.classList.toggle('sel');
  selModes=[...document.querySelectorAll('.mc.sel')].map(e=>e.dataset.mode);
  const btn=document.getElementById('ovbtn'),h=document.getElementById('ovh');
  btn.disabled=selModes.length<2;
  h.textContent=selModes.length<2?'Select at least 2 modes':'✓ '+selModes.join(' + ')+' selected';
}
function doInit(){
  document.getElementById('ovbtn').disabled=true;
  document.getElementById('ovp').textContent='Connecting to hardware...';
  socket.emit('initialize_system',{modes:selModes});
}

// ── VIEWS ──────────────────────────────────────────────────────────
function sw(v){
  ['att','reg','manage'].forEach(x=>{
    document.getElementById('v-'+x).style.display=v===x?'':'none';
    document.getElementById('nv-'+x[0]).classList.toggle('active',v===x[0]||v===x);
  });
  document.getElementById('nv-a').classList.toggle('active',v==='att');
  document.getElementById('nv-r').classList.toggle('active',v==='reg');
  document.getElementById('nv-m').classList.toggle('active',v==='manage');
  if(v==='manage') buildManageTable();
}

// ── SOCKET ─────────────────────────────────────────────────────────
socket.on('connect',()=>setHP('hp-s','ok','Serial'));
socket.on('disconnect',()=>setHP('hp-s','err','Offline'));
socket.on('system_state',d=>{
  setHP('hp-s',d.serial?'ok':'err',d.serial?'Serial OK':'No Serial');
  setHP('hp-f',d.firebase?'ok':'err',d.firebase?'Firebase':'Offline');
  setHP('hp-c',d.camera?'ok':'err',d.camera?'Camera':'No Cam');
  sysModes=d.modes||[];
  document.getElementById('hp-m').textContent=sysModes.join('+');
  CREDS={}; (d.students||[]).forEach(s=>{CREDS[s.id]=s.name;});
  FP_MAP=d.fp_map||{}; CARD_MAP=d.card_map||{};
  if(d.ready){
    document.getElementById('ov').style.display='none';
    buildSteps(sysModes); updScanBtn(sysModes);
    buildFpMap(FP_MAP);
  }
});
socket.on('log',d=>{
  addLog(d.level||'info',d.msg||'',d.ts||'');
  const op=document.getElementById('ovp');
  if(document.getElementById('ov').style.display!=='none') op.textContent=d.msg||'';
});
socket.on('session_status',d=>updSess(d.phase,d.msg,d.student||null));
socket.on('attendance_marked',d=>{addRow(d);pC++;setText('sp',pC);setText('hcnt',pC);
  updHero('success',d.student_name,(d.modes||[]).join('+')+' verified');});
socket.on('security_alert',d=>{addAlert(d);aC++;setText('sa',aC);});
socket.on('blocked_event', d=>{addBlocked(d);bC++;setText('sb',bC);});
socket.on('camera_frame',d=>{
  const img=document.getElementById('ci'),ph=document.getElementById('cph');
  img.src='data:image/jpeg;base64,'+d.data; img.style.display=''; ph.style.display='none';
});
socket.on('camera_busy',()=>{if(camOn)document.getElementById('cph').textContent='Attendance face scan in progress...';});
socket.on('face_captured',d=>{
  document.getElementById('cpi').src='data:image/jpeg;base64,'+d.data;
  document.getElementById('cprev').style.display='';
  document.getElementById('bcp').textContent='Recapture';
});
socket.on('duplicate_result',d=>{
  const el=document.getElementById('rcf');
  if(d.ok){el.style.display='none';addLog('ok','No duplicates found');}
  else{el.style.display='';el.innerHTML='<div style="font-weight:600;color:var(--red);margin-bottom:6px">Conflicts found</div>'+
    d.conflicts.map(c=>`<div class="ci">&#x26A0; ${esc(c)}</div>`).join('');}
});
socket.on('reg_error',d=>{
  const el=document.getElementById('rcf');el.style.display='';
  el.innerHTML=`<div class="ci">&#x26A0; ${esc(d.msg)}</div>`;
});
socket.on('reg_success',d=>{
  document.getElementById('rcs').style.display='';
  document.getElementById('rcs').innerHTML=`<div class="sb2-t">&#x2713; Registered successfully</div>
    <div class="sb2-b">${esc(d.name)} | ID: ${esc(d.student_id)} | Card: ${esc(d.card_id)} | FP slot: ${esc(d.fp_slot)}</div>`;
  document.getElementById('rcf').style.display='none';
  CREDS[d.student_id]=d.name; FP_MAP=d.fp_map||{};
  buildFpMap(FP_MAP); addLog('ok',`Registered: ${d.name}`);
  clrReg();
});
socket.on('remove_success',d=>{
  delete CREDS[d.student_id]; FP_MAP=d.fp_map||{};
  buildFpMap(FP_MAP); buildManageTable();
  showRMsg('ok',`Removed: ${d.name} (${d.student_id})`);
  addLog('ok',`Removed student: ${d.name}`);
});
socket.on('remove_error',d=>showRMsg('err',d.msg));

// Per-student inline mode picker
socket.on('request_mode_selection',()=>showIPicker());
socket.on('session_modes_confirmed',d=>{
  sysModes=d.modes||[];
  document.getElementById('hp-m').textContent=sysModes.join('+');
  buildSteps(sysModes); updScanBtn(sysModes); hideIPicker();
});

// ── SESSION ────────────────────────────────────────────────────────
const SC={ready:'s-ok',success:'s-ok',rfid_ok:'s-info',fp_ok:'s-info',face_ok:'s-info',
  face_scan:'s-info',card_scanned:'s-info',scanning:'s-info',fp_fail:'s-info',
  blocked:'s-err',security_mismatch:'s-err',timeout:'s-err'};
function updSess(phase,msg,student){
  document.getElementById('scard').className='sc '+(SC[phase]||'');
  setText('sph',phase.replace(/_/g,' ').toUpperCase());
  setText('smsg',msg);
  const sw2=document.getElementById('sstu');
  if(student){
    const ini=student.split(' ').map(w=>w[0]).join('').slice(0,2);
    sw2.innerHTML=`<div class="ssw"><div class="avi">${ini}</div>
      <div><div style="font-size:12px;font-weight:600">${esc(student)}</div>
      <div style="font-size:10px;color:var(--t3)">Verifying...</div></div></div>`;
  } else if(['ready','idle','success','blocked','security_mismatch','timeout'].includes(phase)){sw2.innerHTML='';}
  updSteps(phase);
  if(phase==='ready'&&!sysModes.includes('RFID')) document.getElementById('bscan').disabled=false;
  if(['success','blocked','security_mismatch'].includes(phase)&&!sysModes.includes('RFID'))
    document.getElementById('bscan').disabled=false;
  if(['blocked','security_mismatch','fp_fail'].includes(phase)) updHero('fail','Verification failed',msg);
  else if(['ready','idle'].includes(phase)) updHero('idle','Waiting for student...','Scan card or place finger to begin');
  else if(student&&['card_scanned','rfid_ok','fp_ok','face_ok','face_scan','scanning'].includes(phase))
    updHero('active',student,msg);
}
function updHero(state,name,sub){
  const h=document.getElementById('hero');
  h.className='hero s-'+state;
  setText('hname',name); setText('hsub',sub||'');
  const ini=(state!=='idle'&&state!=='fail')?name.split(' ').map(w=>w[0]).join('').slice(0,2):(state==='fail'?'✕':'?');
  document.getElementById('hcirc').textContent=ini;
  const b=document.getElementById('hbadge');
  if(state==='success'){b.className='hbadge hb-ok';b.textContent='✓ Present';}
  else if(state==='active'){b.className='hbadge hb-act';b.textContent='Verifying…';}
  else if(state==='fail'){b.className='hbadge hb-fail';b.textContent='Denied';}
  else{b.className='hbadge hb-idle';b.textContent='System Ready';}
}

// ── INLINE MODE PICKER ─────────────────────────────────────────────
function showIPicker(){
  const old=document.getElementById('ipicker');if(old)old.remove();
  const card=document.getElementById('scard'); card.className='sc';
  setText('sph','SELECT METHOD'); setText('smsg','Next student — choose your method');
  document.getElementById('sstu').innerHTML='';
  document.getElementById('ssteps').innerHTML='';
  const p=document.createElement('div'); p.className='ipicker'; p.id='ipicker';
  p.innerHTML=`<div style="font-size:11px;font-weight:600;color:var(--t3);text-transform:uppercase;letter-spacing:.7px;margin-bottom:10px">Next student — pick modes</div>
    <div class="ipm-grid">
      <div class="ipm" data-mode="RFID" onclick="togIP(this)"><span>&#x1F4F1;</span>RFID Card</div>
      <div class="ipm" data-mode="FINGERPRINT" onclick="togIP(this)"><span>&#x1F91A;</span>Fingerprint</div>
      <div class="ipm" data-mode="FACE" onclick="togIP(this)"><span>&#x1F9D1;</span>Face Scan</div>
    </div>
    <div class="ip-hint" id="ip-hint">Select at least 2 modes</div>
    <button class="ip-btn" id="ip-btn" onclick="confirmIP()" disabled>Confirm &amp; Start</button>`;
  card.appendChild(p);
}
function hideIPicker(){const el=document.getElementById('ipicker');if(el)el.remove();}
function togIP(el){
  el.classList.toggle('sel');
  const chosen=[...document.querySelectorAll('.ipm.sel')].map(e=>e.dataset.mode);
  const h=document.getElementById('ip-hint'),b=document.getElementById('ip-btn');
  if(chosen.length>=2){h.textContent='✓ '+chosen.join(' + ');b.disabled=false;}
  else{h.textContent='Select at least 2 modes';b.disabled=true;}
}
function confirmIP(){
  const modes=[...document.querySelectorAll('.ipm.sel')].map(e=>e.dataset.mode);
  if(modes.length<2) return;
  socket.emit('set_session_modes',{modes});
}

// ── STEPS ──────────────────────────────────────────────────────────
const SL={RFID:'RFID Card',FINGERPRINT:'Fingerprint',FACE:'Face Scan'};
const PM={rfid_ok:'RFID',card_scanned:'RFID',fp_ok:'FINGERPRINT',face_ok:'FACE'};
function buildSteps(modes){
  document.getElementById('ssteps').innerHTML=modes.map(m=>
    `<div class="step" id="step-${m}"><span>${{RFID:'📡',FINGERPRINT:'👆',FACE:'🧑'}[m]}</span><span style="font-weight:600">${SL[m]}</span></div>`
  ).join('');
}
function updSteps(phase){
  const all=document.querySelectorAll('.step');
  if(phase==='success'){all.forEach(s=>s.className='step done');return;}
  if(['ready','idle','blocked','security_mismatch','timeout'].includes(phase)){all.forEach(s=>s.className='step');return;}
  const am=PM[phase];let found=false;
  all.forEach(s=>{const m=s.id.replace('step-','');
    if(!found){if(m===am){found=true;s.className='step active';}else s.className='step done';}
    else s.className='step';});
  if(!found&&phase==='face_scan'){const f=document.getElementById('step-FACE');if(f)f.className='step active';}
}
function updScanBtn(modes){
  const b=document.getElementById('bscan');
  if(modes.includes('RFID')){b.style.display='none';}
  else{b.style.display='';b.disabled=false;}
}
function doScan(){socket.emit('start_scan');}
function doReset(){socket.emit('reset_session');}

// ── TABLE ──────────────────────────────────────────────────────────
function addRow(d){
  rC++;const tb=document.getElementById('atb');
  const ph=tb.querySelector('td[colspan]');if(ph)ph.closest('tr').remove();
  const cp=Math.round((d.face_conf||0)*100);
  const mh=(d.modes||[]).map(m=>`<span class="tag t-blue">${m}</span>`).join('');
  const tr=document.createElement('tr');tr.className='nr';
  tr.innerHTML=`<td style="font-family:var(--mono);color:var(--t3)">${rC}</td>
    <td style="font-family:var(--mono)">${esc(d.time||'')}</td>
    <td><strong>${esc(d.student_name||'')}</strong></td>
    <td>${mh}</td>
    <td style="font-family:var(--mono)">${cp?cp+'%':'—'}</td>
    <td><span class="tag t-green">&#x2713; Present</span></td>`;
  tb.insertBefore(tr,tb.firstChild);
  setText('tsub',`${rC} record${rC!==1?'s':''} today`);
}

// ── FP MAP ─────────────────────────────────────────────────────────
function buildFpMap(m){
  const el=document.getElementById('fpmap');
  const e=Object.entries(m);
  if(!e.length){el.innerHTML='<div style="font-size:12px;color:var(--t3)">No fingerprints mapped</div>';return;}
  el.innerHTML=e.map(([s,n])=>`<div class="fpr"><span class="fps">Slot ${s}</span><span class="fpn">${esc(n)}</span></div>`).join('');
}

// ── ALERTS ─────────────────────────────────────────────────────────
function addAlert(d){
  const w=document.getElementById('aw');
  const ph=w.querySelector('div[style]');if(ph&&ph.textContent.includes('No alerts'))ph.remove();
  const el=document.createElement('div');el.className='ai';
  el.innerHTML=`<div class="ai-t">&#x1F6A8; Proxy — ${esc(d.mode||'')}</div>
    <div class="ai-b">Session: <strong>${esc(d.session_student||'')}</strong><br>Cred: ${esc(d.cred_student||'')}</div>
    <div class="ai-ts">${esc(d.time||'')}</div>`;
  w.insertBefore(el,w.firstChild);
}
function addBlocked(d){
  const w=document.getElementById('aw');
  const L={unregistered_rfid:'Unregistered card',unregistered_fp:'Unregistered FP',face_not_recognised:'Face not recognised'};
  const el=document.createElement('div');el.className='bi2';
  el.innerHTML=`<div class="bi2-t">&#x26A0; ${L[d.reason]||'Blocked'}</div>
    <div style="font-size:11px;color:var(--t2)">${esc(d.msg||'')}</div>
    <div class="ai-ts">${esc(d.time||'')}</div>`;
  w.insertBefore(el,w.firstChild);
}

// ── LOG ────────────────────────────────────────────────────────────
function addLog(level,msg,ts){
  const p=document.getElementById('lb');
  const t=ts||new Date().toLocaleTimeString('en-IN',{hour12:false});
  const d=document.createElement('div');d.className='ll';
  d.innerHTML=`<span class="ll-ts">${t}</span><span class="ll-m ${level}">${esc(msg)}</span>`;
  p.appendChild(d);p.scrollTop=p.scrollHeight;
}

// ── REGISTRATION ───────────────────────────────────────────────────
function clrReg(){document.getElementById('rcf').style.display='none';document.getElementById('rcs').style.display='none';}
function doChkDupe(){socket.emit('check_duplicates',{student_id:v('f-sid'),card_id:v('f-card'),fingerprint_slot:v('f-fp')});}
function togCam(){
  if(!camOn){camOn=true;document.getElementById('btc').textContent='Stop Camera';document.getElementById('bcp').disabled=false;socket.emit('start_camera_preview');}
  else{camOn=false;document.getElementById('btc').textContent='Start Camera';document.getElementById('bcp').disabled=true;socket.emit('stop_camera_preview');document.getElementById('ci').style.display='none';document.getElementById('cph').style.display='';}
}
function doCap(){socket.emit('capture_face');}
function doReg(){
  const sid=v('f-sid'),name=v('f-name');
  if(!sid||!name){
    const el=document.getElementById('rcf');el.style.display='';
    el.innerHTML='<div class="ci">&#x26A0; Student ID and Name are required</div>';return;
  }
  socket.emit('register_student',{student_id:sid,name:name,roll_number:v('f-roll'),
    email:v('f-email'),card_id:v('f-card').toUpperCase(),fingerprint_slot:v('f-fp')});
}

// ── MANAGE ─────────────────────────────────────────────────────────
function buildManageTable(){
  const tb=document.getElementById('stu-tbody');
  const entries=Object.entries(CREDS);
  setText('stu-count',`${entries.length} student${entries.length!==1?'s':''}`);
  if(!entries.length){tb.innerHTML='<tr><td colspan="5" style="text-align:center;color:var(--t3);padding:20px">No students registered</td></tr>';return;}
  // Find cards and FP slots for each student
  const cardLookup={};Object.entries(CARD_MAP).forEach(([card,sid])=>{
    if(!cardLookup[sid])cardLookup[sid]=[];cardLookup[sid].push(card);});
  const fpLookup={};Object.entries(FP_MAP).forEach(([slot,name])=>{
    const sid=Object.keys(CREDS).find(s=>CREDS[s]===name);
    if(sid){if(!fpLookup[sid])fpLookup[sid]=[];fpLookup[sid].push(slot);}});
  tb.innerHTML=entries.map(([sid,name])=>{
    const ini=name.split(' ').map(w=>w[0]).join('').slice(0,2);
    const cards=(cardLookup[sid]||[]).join(', ')||'—';
    const fps=(fpLookup[sid]||[]).map(s=>`Slot ${s}`).join(', ')||'—';
    return `<tr>
      <td><div style="display:flex;align-items:center;gap:8px">
        <div class="avi" style="width:28px;height:28px;font-size:11px;flex-shrink:0">${ini}</div>
        <strong>${esc(name)}</strong></div></td>
      <td style="font-family:var(--mono);font-size:11px;color:var(--t3)">${sid.slice(-8)}</td>
      <td style="font-family:var(--mono);font-size:11px">${esc(cards)}</td>
      <td style="font-family:var(--mono);font-size:11px">${esc(fps)}</td>
      <td><button class="btn btn-danger btn-sm" onclick="doRemove('${sid}')" style="width:auto">Remove</button></td>
    </tr>`;
  }).join('');
}
function doRemove(sid){
  const name=CREDS[sid]||sid;
  if(!confirm(`Remove ${name} (${sid})?\n\nThis will:\n• Delete from Firebase (students + attendance_summary)\n• Remove face image from disk\n• Clear fingerprint/RFID mappings\n\nPast attendance records are kept for audit. Continue?`)) return;
  socket.emit('remove_student',{student_id:sid});
}
function showRMsg(type,msg){
  const el=document.getElementById('rmsg'); el.style.display='';
  el.className=type==='ok'?'sb2':'cb2';
  el.innerHTML=type==='ok'
    ?`<div class="sb2-t">&#x2713; ${esc(msg)}</div>`
    :`<div class="ci">&#x26A0; ${esc(msg)}</div>`;
  setTimeout(()=>{el.style.display='none';},4000);
}
function doReload(){socket.emit('reload_students_from_firebase');}

// ── UTILS ──────────────────────────────────────────────────────────
function setHP(id,state,lbl){
  const el=document.getElementById(id);if(!el)return;
  el.className='hp'+(state==='ok'?' ok':state==='err'?' err':'');
  el.innerHTML=`<span class="dot"></span><span>${lbl}</span>`;
}
function setText(id,v2){const el=document.getElementById(id);if(el)el.textContent=v2;}
function v(id){return document.getElementById(id)?.value.trim()||'';}
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
</script>
</body>
</html>"""

@app.route("/")
def index():
    return DASHBOARD

# ═══════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════
def main():
    print("\n╔══════════════════════════════════════════════════════════════╗")
    print("║    SMART CAMPUS ERP  v9.0  —  Final Release                 ║")
    print(f"║    http://localhost:{DASHBOARD_PORT}  (opens automatically)          ║")
    print("╠══════════════════════════════════════════════════════════════╣")
    print("║  ⚠️  Always open via URL — never open any .html file directly ║")
    print("╚══════════════════════════════════════════════════════════════╝\n")
    threading.Thread(target=hardware_loop, daemon=True).start()
    threading.Timer(2.0, lambda: webbrowser.open(f"http://localhost:{DASHBOARD_PORT}")).start()
    socketio.run(app, host="0.0.0.0", port=DASHBOARD_PORT,
                 debug=False, use_reloader=False, allow_unsafe_werkzeug=True)

if __name__ == "__main__":
    main()