import firebase_admin
from firebase_admin import credentials, db

# Initialize Firebase (skip if already initialized)
try:
    cred = credentials.Certificate('firebase-credentials.json')
    firebase_admin.initialize_app(cred, {
        'databaseURL': 'https://smart-campus-major-project-default-rtdb.firebaseio.com'
    })
except:
    pass  # Already initialized

print("🔥 Adding attendance summary with RFID ID...")

# Sample data for RFID ID 731D16E0
summary_data = {
    '731D16E0': {
        'student_name': 'VANSH TYAGI',
        'roll_number': '01',
        'overall_percentage': 83.33,
        'present': 15,
        'absent': 3,
        'total_classes': 18,
        'subjects': {
            'Python': {
                'present': 5,
                'absent': 1,
                'total': 6,
                'percentage': 83.33
            },
            'AI': {
                'present': 5,
                'absent': 1,
                'total': 6,
                'percentage': 83.33
            },
            'IoT': {
                'present': 5,
                'absent': 1,
                'total': 6,
                'percentage': 83.33
            }
        },
        'attendance_history': {
            '2025-10-15': 'present',
            '2025-10-16': 'present',
            '2025-10-17': 'present'
        }
    }
}

# Add to Firebase
ref = db.reference('attendance_summary')
ref.update(summary_data)  # Use update to keep 125 data also

print("✅ Attendance summary added for RFID: 731D16E0!")
print("\nStudent: VANSH TYAGI")
print("  Present: 15 / 18 classes")
print("  Percentage: 83.33%")
print("  RFID ID: 731D16E0")