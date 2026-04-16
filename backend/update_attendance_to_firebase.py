# QUICK FIX - Update Firebase to 0%

import firebase_admin
from firebase_admin import db

# Update Shitanshu to 0%
db.reference('attendance/summary/2200331550103').update({
    'overall_percentage': 0
})

# Update Raj to 0%
db.reference('attendance/summary/2200331550083').update({
    'overall_percentage': 0
})

print("✅ Updated! Shitanshu and Raj now show 0%")
