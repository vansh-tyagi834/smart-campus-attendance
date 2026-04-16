import firebase_admin
from firebase_admin import credentials, db
from datetime import datetime

# Initialize Firebase
cred = credentials.Certificate('firebase-credentials.json')
firebase_admin.initialize_app(cred, {
    'databaseURL': 'https://smart-campus-major-project-default-rtdb.firebaseio.com'
})

print("🔥 Adding users to Firebase...")

# Define users
users = {
    'admin_001': {
        'user_id': 'admin_001',
        'username': 'admin',
        'email': 'admin@smartcampus.edu',
        'password': 'admin123',
        'role': 'admin',
        'name': 'System Administrator',
        'department': 'Administration',
        'created_at': datetime.now().isoformat(),
        'status': 'active'
    },

    'teacher_001': {
        'user_id': 'teacher_001',
        'username': 'teacher',
        'email': 'teacher@smartcampus.edu',
        'password': 'teacher123',
        'role': 'teacher',
        'name': 'Prof. Sharma',
        'department': 'Computer Science',
        'subjects': ['Python', 'AI', 'IoT'],
        'created_at': datetime.now().isoformat(),
        'status': 'active'
    },

    'student_125': {
        'user_id': 'student_125',
        'username': 'vansh',
        'email': 'vansh@smartcampus.edu',
        'password': 'student123',
        'role': 'student',
        'student_id': '125',
        'name': 'VANSH TYAGI',
        'roll_number': '01',
        'class': 'BE CSE',
        'created_at': datetime.now().isoformat(),
        'status': 'active'
    },

    'parent_125': {
        'user_id': 'parent_125',
        'username': 'parent_vansh',
        'email': 'parent@smartcampus.edu',
        'password': 'parent123',
        'role': 'parent',
        'student_id': '125',
        'name': 'Mr. Tyagi',
        'phone': '+91-9876543210',
        'created_at': datetime.now().isoformat(),
        'status': 'active'
    }
}

# Add to Firebase
ref = db.reference('users')

for user_id, user_data in users.items():
    ref.child(user_id).set(user_data)
    print(f"✅ Added: {user_data['name']} ({user_data['role']})")

print("\n🎉 All users added successfully!")
print("\n📋 LOGIN CREDENTIALS:")
print("="*50)
print("\nAdmin:")
print("  Email: admin@smartcampus.edu")
print("  Password: admin123")
print("\nTeacher:")
print("  Email: teacher@smartcampus.edu")
print("  Password: teacher123")
print("\nStudent:")
print("  Email: vansh@smartcampus.edu")
print("  Password: student123")
print("\nParent:")
print("  Email: parent@smartcampus.edu")
print("  Password: parent123")