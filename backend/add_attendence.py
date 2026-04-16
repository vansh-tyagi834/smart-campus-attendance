import firebase_admin
from firebase_admin import credentials, db

# Initialize Firebase
cred = credentials.Certificate('firebase-credentials.json')
firebase_admin.initialize_app(cred, {
    'databaseURL': 'https://smart-campus-major-project-default-rtdb.firebaseio.com'
})

print("🔥 Adding attendance summary...")

# Sample attendance summary for student 125
summary_data = {
    '125': {
        'total_present': 15,
        'total_absent': 3,
        'total_classes': 18,
        'percentage': 83.33,
        'subjects': {
            'Python': {
                'present': 5,
                'absent': 1,
                'total': 6
            },
            'AI': {
                'present': 5,
                'absent': 1,
                'total': 6
            },
            'IoT': {
                'present': 5,
                'absent': 1,
                'total': 6
            }
        },
        'weekly_data': {
            'Mon': 3,
            'Tue': 2,
            'Wed': 3,
            'Thu': 2,
            'Fri': 3,
            'Sat': 2,
            'Sun': 0
        },
        'last_updated': '2025-10-17'
    }
}

# Add to Firebase
ref = db.reference('attendance_summary')
ref.set(summary_data)

print("✅ Attendance summary added!")
print("\nStudent 125 (VANSH TYAGI):")
print("  Present: 15 / 18 classes")
print("  Percentage: 83.33%")
print("  Subjects: Python, AI, IoT")