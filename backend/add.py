# add_attendance_history.py
# Complete script - COPY EVERYTHING BELOW

import firebase_admin
from firebase_admin import credentials, db
import json

# STEP 1: Initialize Firebase
print("Initializing Firebase...")

# Use your existing credentials file
cred = credentials.Certificate('firebase-credentials.json')

# Initialize (if not already)
try:
    firebase_admin.initialize_app(cred, {
        'databaseURL': 'https://smart-campus-major-project-default-rtdb.firebaseio.com/'
    })
    print("✅ Firebase initialized!")
except ValueError:
    print("✅ Firebase already initialized!")

# STEP 2: Add attendance_history for Vansh
print("\nAdding attendance history for Vansh...")

vansh_ref = db.reference('attendance/students/2200331550125')

attendance_data = {
    'attendance_history': {
        '2025-10-19': {
            'status': 'Present',
            'timestamp': '2025-10-19T10:00:00Z'
        },
        '2025-10-20': {
            'status': 'Present',
            'timestamp': '2025-10-20T10:00:00Z'
        }
    }
}

vansh_ref.update(attendance_data)

print("✅ Attendance history added successfully!")
print("\n🎉 DONE! Reload your Faculty Dashboard now!")
