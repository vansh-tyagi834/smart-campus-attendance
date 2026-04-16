import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { Bell, Download, Mail, Phone, AlertTriangle, TrendingUp, TrendingDown, Calendar, BookOpen, Award, Target, Clock, Users, MessageSquare, Video, FileText, Settings, ChevronRight, X, Check, Home, BarChart3, GraduationCap, MessageCircle, Menu, Search, Filter, ChevronDown, ExternalLink, AlertCircle, CheckCircle, LogOut} from 'lucide-react';

import { database } from '../firebase/config';
import { ref, onValue, update } from 'firebase/database';
import { motion, AnimatePresence } from 'framer-motion';



function ParentDashboard() {
  const [childData, setChildData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [studentMarks, setStudentMarks] = useState([]);
  const [assignments, setAssignments] = useState([]);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeSection, setActiveSection] = useState('dashboard');
  const [notifications, setNotifications] = useState([]);
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(true);
  const [attendanceDates, setAttendanceDates] = useState({});
  const [selectedSubjectModal, setSelectedSubjectModal] = useState(null);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [contactType, setContactType] = useState(null); // 'faculty' or 'admin'
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  // Logout function
const handleLogout = () => {
  // Clear any stored user data
  localStorage.removeItem('parentAuth');
  sessionStorage.removeItem('parentSession');
  
  // Redirect to login page (replace with your actual login route)
  window.location.href = '/login';
  // If using React Router, you would use:
  // navigate('/login');
};
  

  const [notificationsList, setNotificationsList] = useState([
  { id: 1, type: 'warning', from: 'Prof. Sharma', subject: 'Python Attendance', message: 'Please ensure regular attendance in upcoming classes', time: '2 days ago', read: false },
  { id: 2, type: 'info', from: 'HOD - Computer Science', subject: 'Parent Meeting Scheduled', message: 'Meeting scheduled for Oct 25, 2025 at 10:00 AM', time: '5 days ago', read: false },
  { id: 3, type: 'success', from: 'Class Coordinator', subject: 'Mid-Term Results Available', message: 'Assessment results have been published', time: '1 week ago', read: true }
]);


const [eventsList, setEventsList] = useState([]);




  

  const childId = '2200331550125'; // Use full roll number for everything
  const fullRollNo = '2200331550125'; // Full roll number for attendance lookup
  const childName = 'Vansh Tyagi';
  const parentName = 'Parent';
  // Teacher contact information for each subject
const teacherContacts = {
  'AI': {
    name: 'Dr. Sharma',
    email: 'sharma@college.edu',
    phone: '+91 98765 43210',
    avatar: '👨‍🏫',
    department: 'Computer Science'
  },
  'IoT': {
    name: 'Prof. Kumar',
    email: 'kumar@college.edu',
    phone: '+91 98765 43211',
    avatar: '👨‍💻',
    department: 'Electronics & IoT'
  },
  'Python': {
    name: 'Dr. Patel',
    email: 'patel@college.edu',
    phone: '+91 98765 43212',
    avatar: '👩‍🏫',
    department: 'Computer Science'
  }
};

// HOD and Administration contacts
const hodContact = {
  name: 'Dr. Rajesh Verma',
  designation: 'HOD - Computer Science',
  email: 'hod.cs@college.edu',
  phone: '+91 98765 43220',
  avatar: '👨‍💼'
};

const adminContact = {
  name: 'Ms. Priya Sharma',
  designation: 'Administrative Officer',
  email: 'admin@college.edu',
  phone: '+91 98765 43221',
  avatar: '👩‍💼'
};

// Add this useEffect for fetching marks (place it after the attendance useEffect)
// Change this useEffect for fetching marks
useEffect(() => {
  const marksRef = ref(database, `classes/IoT-B/studentMarks/${fullRollNo}`);
  
  onValue(marksRef, (snapshot) => {
    const data = snapshot.val();
    console.log('Marks data from Firebase:', data);
    
    if (data && data.subjects) {
      // Convert object to array if needed
      const marksArray = Array.isArray(data.subjects) ? data.subjects : Object.values(data.subjects);
      console.log('Setting marks to:', marksArray);
      setStudentMarks(marksArray);
    } else {
      console.log('No marks found');
      setStudentMarks([]);
    }
  });
}, [fullRollNo]); // Change dependency to fullRollNo

// Load assignments from Firebase for child
useEffect(() => {
  const assignmentsRef = ref(database, 'classes/IoT-B/assignments');
  
  const unsubscribe = onValue(assignmentsRef, (snapshot) => {
    const data = snapshot.val();
    console.log('Assignments data from Firebase:', data);
    
    if (data) {
      const assignmentsList = Object.entries(data).map(([id, assignment]) => {
        // Check if child has submitted
        const submissions = assignment.submissions || {};
        const childSubmission = submissions[childId];
        
        return {
          id: id,
          title: assignment.title || 'Untitled Assignment',
          subject: assignment.subject || 'General',
          description: assignment.description || 'No description',
          dueDate: assignment.dueDate || 'No due date',
          createdAt: assignment.createdAt || Date.now(),
          totalSubmissions: Object.keys(submissions).length || 0,
          submitted: !!childSubmission,
          submittedAt: childSubmission?.submittedAt || null,
          submissionLink: childSubmission?.link || null
        };
      });
      
      // Sort by creation date (newest first)
      assignmentsList.sort((a, b) => b.createdAt - a.createdAt);
      
      setAssignments(assignmentsList);
      console.log('Processed assignments for child:', assignmentsList);
    } else {
      setAssignments([]);
    }
  });
  
  return () => unsubscribe();
}, [childId]);


// Load events from Firebase with response tracking
useEffect(() => {
  const eventsRef = ref(database, 'events');
  
  const unsubscribe = onValue(eventsRef, (snapshot) => {
    const data = snapshot.val();
    console.log('Events from Firebase:', data);
    
    if (data) {
      const eventsList = Object.entries(data).map(([id, event]) => {
        // Check if this parent has already responded
        const userResponse = event.responses && event.responses[childId] 
          ? event.responses[childId].status 
          : null;
        
        return {
          id: id,
          title: event.title || 'Untitled Event',
          date: event.date ? new Date(event.date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          }) : 'No date',
          time: event.time || 'No time',
          type: event.type || 'meeting',
          description: event.description || '',
          userResponse: userResponse, // Track user's response
          color: event.type === 'meeting' ? 'blue' : 
                 event.type === 'exam' ? 'purple' : 
                 event.type === 'holiday' ? 'emerald' : 'blue'
        };
      });
      
      // Sort by date (newest first)
      eventsList.sort((a, b) => new Date(b.date) - new Date(a.date));
      
      setEventsList(eventsList);
      console.log('Processed events for parent:', eventsList);
    } else {
      setEventsList([]);
    }
  });
  
  return () => unsubscribe();
}, [childId]);






  useEffect(() => {
  // Fetch attendance data from attendance/daily path
  const attendanceRef = ref(database, 'attendance/daily');
  
  onValue(attendanceRef, (snapshot) => {
    const attendanceData = snapshot.val();
    // Store actual attendance dates for calendar
    const dateRecords = {};
    Object.keys(attendanceData).forEach(date => {
      if (attendanceData[date][fullRollNo]) {
        dateRecords[date] = attendanceData[date][fullRollNo].status;
      }
    });
    setAttendanceDates(dateRecords);

    

    
    if (attendanceData) {
      let totalPresent = 0;
      let totalClasses = 0;
      const subjectStats = {};
      
      // Loop through all dates
      Object.keys(attendanceData).forEach(date => {
        const dateData = attendanceData[date];
        
        // Check if this student's data exists for this date
        if (dateData[fullRollNo]) {
          const studentRecord = dateData[fullRollNo];
          totalClasses++;
          
          if (studentRecord.status === 'Present') {
            totalPresent++;
          }
          
          // Process subjects
          if (studentRecord.subjects) {
            Object.keys(studentRecord.subjects).forEach(subject => {
              if (!subjectStats[subject]) {
                subjectStats[subject] = { present: 0, total: 0 };
              }
              
              subjectStats[subject].total++;
              if (studentRecord.subjects[subject] === 'Present') {
                subjectStats[subject].present++;
              }
            });
          }
        }
      });
      
      if (totalClasses > 0) {
        const overall_percentage = Math.round((totalPresent / totalClasses) * 100);
        
        // Convert subject stats to percentage
        const subjects = {};
        Object.keys(subjectStats).forEach(subject => {
          const stats = subjectStats[subject];
          subjects[subject] = {
            present: stats.present,
            total: stats.total,
            percentage: Math.round((stats.present / stats.total) * 100)
          };
        });
        
        // Calculate weekly trend from actual dates
const weeklyData = {};
const monthlyData = {};

Object.keys(attendanceData).forEach(date => {
  if (attendanceData[date][fullRollNo]) {
    const studentRecord = attendanceData[date][fullRollNo];
    
    // Parse date to get week and month
    const dateObj = new Date(date);
    const weekNum = Math.ceil(dateObj.getDate() / 7);
    const monthName = dateObj.toLocaleDateString('en-US', { month: 'short' });
    
    // Weekly tracking
    const weekKey = `Week ${weekNum}`;
    if (!weeklyData[weekKey]) {
      weeklyData[weekKey] = { present: 0, total: 0 };
    }
    weeklyData[weekKey].total++;
    if (studentRecord.status === 'Present') {
      weeklyData[weekKey].present++;
    }
    
    // Monthly tracking
    if (!monthlyData[monthName]) {
      monthlyData[monthName] = { present: 0, total: 0 };
    }
    monthlyData[monthName].total++;
    if (studentRecord.status === 'Present') {
      monthlyData[monthName].present++;
    }
  }
});

// Convert to chart format
const weeklyTrend = Object.keys(weeklyData).map(week => ({
  week,
  attendance: Math.round((weeklyData[week].present / weeklyData[week].total) * 100),
  target: 75
}));

const monthlyDataChart = Object.keys(monthlyData).map(month => ({
  month,
  student: Math.round((monthlyData[month].present / monthlyData[month].total) * 100),
  classAvg: 75, // You can calculate this from all students if needed
  required: 75
}));

setChildData({
  overall_percentage,
  present: totalPresent,
  absent: totalClasses - totalPresent,
  total_classes: totalClasses,
  subjects,
  weeklyTrend: weeklyTrend.length > 0 ? weeklyTrend : [
    { week: 'No Data', attendance: 0, target: 75 }
  ],
  monthlyData: monthlyDataChart.length > 0 ? monthlyDataChart : [
    { month: 'No Data', student: 0, classAvg: 75, required: 75 }
  ]
});

        
        setNotifications([
          { id: 1, type: 'warning', title: 'Low Attendance Alert', message: 'Check subjects below 75%', time: '2 hours ago', read: false },
          { id: 2, type: 'info', title: 'Assessment Results', message: 'Mid-term results available', time: '1 day ago', read: false },
          { id: 3, type: 'success', title: 'Perfect Week', message: 'Excellent attendance!', time: '2 days ago', read: true },
          { id: 4, type: 'info', title: 'Parent Meeting', message: 'Scheduled for Oct 25, 2025', time: '3 days ago', read: true }
        ]);
        
        setLoading(false);
      } else {
        setLoading(false);
        alert('No attendance records found for this student');
      }
    } else {
      setLoading(false);
      alert('No attendance data in database');
    }
  });
}, [fullRollNo]);








  const menuItems = [
  { id: 'dashboard', icon: Home, label: 'Dashboard' },
  { id: 'analytics', icon: BarChart3, label: 'Analytics' },
  { id: 'marks', label: 'Marks', icon: FileText },
  { id: 'subjects', icon: GraduationCap, label: 'Subjects' },
  { id: 'events', icon: Calendar, label: 'Events', badge: eventsList.length }, // NEW LINE
  { id: 'communication', icon: MessageCircle, label: 'Communication' }
];


  const getRiskLevel = (percentage) => {
    if (percentage >= 85) return { level: 'excellent', color: 'emerald', bgClass: 'bg-emerald-50', textClass: 'text-emerald-700', borderClass: 'border-emerald-200' };
    if (percentage >= 75) return { level: 'good', color: 'blue', bgClass: 'bg-blue-50', textClass: 'text-blue-700', borderClass: 'border-blue-200' };
    if (percentage >= 65) return { level: 'warning', color: 'amber', bgClass: 'bg-amber-50', textClass: 'text-amber-700', borderClass: 'border-amber-200' };
    return { level: 'critical', color: 'red', bgClass: 'bg-red-50', textClass: 'text-red-700', borderClass: 'border-red-200' };
  };

  const downloadReport = () => {
    const reportContent = `
ATTENDANCE REPORT
=====================================
Student: ${childName}
ID: ${childId}
Date: ${new Date().toLocaleDateString()}

OVERALL SUMMARY
-------------------------------------
Overall Attendance: ${childData.overall_percentage}%
Classes Attended: ${childData.present}
Classes Missed: ${childData.absent}
Total Classes: ${childData.total_classes}

SUBJECT-WISE BREAKDOWN
-------------------------------------
${Object.entries(childData.subjects).map(([subject, data]) => 
  `${subject}: ${data.percentage}% (${data.present}/${data.total})`
).join('\n')}
    `.trim();

    const blob = new Blob([reportContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Attendance_Report_${new Date().toISOString().split('T')[0]}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        {console.log("Current activeSection:", activeSection)} 
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto"></div>
          <p className="text-gray-600 text-lg mt-4 font-medium">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  const riskInfo = childData ? getRiskLevel(childData.overall_percentage) : { level: 'good', color: 'blue', bgClass: 'bg-blue-50', textClass: 'text-blue-700', borderClass: 'border-blue-200' };
  const atRiskCount = childData ? Object.values(childData.subjects).filter(s => s.percentage < 75).length : 0;

// Handle parent response to events
const handleEventResponse = async (eventId, responseType) => {
  try {
    const parentNameToUse = parentName || "Parent";
    const studentNameToUse = childData?.name || childName;
    
    const eventRef = ref(database, `events/${eventId}/responses/${childId}`);
    
    // Save to Firebase
    await update(eventRef, {
      status: responseType,
      respondedAt: new Date().toISOString(),
      parentName: parentNameToUse,
      studentId: childId,
      studentName: studentNameToUse
    });

    console.log(`✓ Response saved to Firebase: ${eventId} - ${responseType}`);
    alert(`✓ Response recorded: ${responseType === 'confirmed' ? 'Attendance Confirmed' : 'Declined'}`);
    
    // Don't manually update state - let Firebase listener handle it
    
  } catch (error) {
    console.error('Error recording response:', error);
    alert('❌ Failed to record response. Please try again.');
  }
};




  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-white border-r border-gray-200 transition-all duration-300 flex flex-col`}>
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            {sidebarOpen && (
              <div>
                <h2 className="text-xl font-bold text-gray-800">Parent Portal</h2>
                <p className="text-xs text-gray-500 mt-1">Attendance System</p>
              </div>
            )}
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <Menu className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {menuItems.map(item => (
  <button
    key={item.id}
    onClick={() => setActiveSection(item.id)}
    className={`w-full flex items-center ${sidebarOpen ? 'justify-between' : 'justify-center'} gap-3 px-4 py-3 rounded-lg transition ${
      activeSection === item.id ? 'bg-indigo-50 text-indigo-600' : 'text-gray-600 hover:bg-gray-50'
    }`}
  >
    <div className="flex items-center gap-3">
      <item.icon className="w-5 h-5 flex-shrink-0" />
      {sidebarOpen && <span className="font-medium">{item.label}</span>}
    </div>
    {/* Notification Badge */}
    {sidebarOpen && item.badge > 0 && (
      <span className="px-2 py-1 bg-red-500 text-white rounded-full text-xs font-bold">
        {item.badge}
      </span>
    )}
  </button>
))}

        </nav>

        {/* Logout Button */}
<div className="mt-auto p-4 border-t border-gray-200">
  <button
    onClick={handleLogout}
    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition text-red-600 hover:bg-red-50 hover:text-red-700"
  >
    <LogOut className="w-5 h-5 flex-shrink-0" />
    {sidebarOpen && <span className="font-medium">Log Out</span>}
  </button>
</div>

      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Welcome {parentName}</h1>
              <p className="text-sm text-gray-500 mt-1">Monitoring: {childName} • ID: {childId}</p>
            </div>
            <div className="flex items-center gap-4">
  {/* Search Bar */}
  <div className="relative">
    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
    <input
      type="text"
      placeholder="Search..."
      className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
    />
  </div>

  

  {/* Export Button */}
  <button 
    onClick={downloadReport}
    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
  >
    <Download className="w-4 h-4" />
    Export
  </button>
</div>

          </div>
        </header>

        {/* Notification Panel */}
        {showNotificationPanel && (
          <div className="absolute right-8 top-20 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">Notifications</h3>
              <button onClick={() => setShowNotificationPanel(false)}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notifications.map(notif => (
                <div 
                  key={notif.id}
                  className={`p-4 border-b border-gray-100 hover:bg-gray-50 transition ${!notif.read ? 'bg-blue-50/30' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${
                      notif.type === 'warning' ? 'bg-amber-100' :
                      notif.type === 'success' ? 'bg-emerald-100' : 'bg-blue-100'
                    }`}>
                      {notif.type === 'warning' ? <AlertCircle className="w-4 h-4 text-amber-600" /> :
                       notif.type === 'success' ? <CheckCircle className="w-4 h-4 text-emerald-600" /> :
                       <Bell className="w-4 h-4 text-blue-600" />}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-800 text-sm">{notif.title}</p>
                      <p className="text-gray-600 text-xs mt-1">{notif.message}</p>
                      <p className="text-gray-400 text-xs mt-1">{notif.time}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-8">
          {activeSection === 'dashboard' && (
            <div className="space-y-6">
              {/* Alert Banner */}
              {atRiskCount > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-red-100 rounded-lg">
                      <AlertTriangle className="w-6 h-6 text-red-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-red-900 mb-1">Attendance Alert</h3>
                      <p className="text-red-700 mb-3">
                        {atRiskCount} subject{atRiskCount > 1 ? 's are' : ' is'} below the required 75% attendance threshold. Immediate action recommended.
                      </p>
                      <div className="flex gap-3">
                        <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-medium">
                          Contact Faculty
                        </button>
                        <button className="px-4 py-2 bg-white text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition text-sm font-medium">
                          View Details
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`p-3 ${riskInfo.bgClass} rounded-lg`}>
                      <Target className={`w-6 h-6 ${riskInfo.textClass}`} />
                    </div>
                    {childData.overall_percentage >= 75 && (
                      <span className="text-emerald-600 text-sm font-medium flex items-center gap-1">
                        <TrendingUp className="w-4 h-4" /> +2%
                      </span>
                    )}
                  </div>
                  <p className="text-gray-500 text-sm mb-1">Overall Attendance</p>
                  <p className="text-3xl font-bold text-gray-800">{childData.overall_percentage}%</p>
                  <div className="mt-4 w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full bg-${riskInfo.color}-500`}
                      style={{width: `${childData.overall_percentage}%`}}
                    ></div>
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-emerald-50 rounded-lg">
                      <CheckCircle className="w-6 h-6 text-emerald-600" />
                    </div>
                  </div>
                  <p className="text-gray-500 text-sm mb-1">Classes Attended</p>
                  <p className="text-3xl font-bold text-gray-800">{childData.present}</p>
                  <p className="text-gray-400 text-sm mt-2">Out of {childData.total_classes} classes</p>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-red-50 rounded-lg">
                      <AlertCircle className="w-6 h-6 text-red-600" />
                    </div>
                    {atRiskCount > 0 && (
                      <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">
                        Action Needed
                      </span>
                    )}
                  </div>
                  <p className="text-gray-500 text-sm mb-1">At-Risk Subjects</p>
                  <p className="text-3xl font-bold text-gray-800">{atRiskCount}</p>
                  <p className="text-gray-400 text-sm mt-2">Below 75% threshold</p>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <Award className="w-6 h-6 text-blue-600" />
                    </div>
                  </div>
                  <p className="text-gray-500 text-sm mb-1">Perfect Attendance</p>
                  <p className="text-3xl font-bold text-gray-800">2</p>
                  <p className="text-gray-400 text-sm mt-2">Weeks this semester</p>
                </div>
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-gray-800">Attendance Trend</h3>
                    <button className="flex items-center gap-2 px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-sm">
                      <Filter className="w-4 h-4 text-gray-500" />
                      <span className="text-gray-600">This Month</span>
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={childData.weeklyTrend}>
                      <defs>
                        <linearGradient id="colorAtt" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="week" stroke="#9ca3af" style={{fontSize: '12px'}} />
                      <YAxis stroke="#9ca3af" style={{fontSize: '12px'}} />
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: '#fff',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                        }}
                      />
                      <Area type="monotone" dataKey="attendance" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorAtt)" />
                      <Line type="monotone" dataKey="target" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-gray-800">Performance Comparison</h3>
                  </div>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={childData.monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" stroke="#9ca3af" style={{fontSize: '12px'}} />
                      <YAxis stroke="#9ca3af" style={{fontSize: '12px'}} />
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: '#fff',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                        }}
                      />
                      <Legend />
                      <Bar dataKey="student" fill="#6366f1" name="Student" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="classAvg" fill="#94a3b8" name="Class Average" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Attendance Calendar - COLLAPSIBLE */}
<div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
  {/* Calendar Header - Clickable */}
  <div 
    className="p-6 cursor-pointer hover:bg-gray-50 transition flex items-center justify-between"
    onClick={() => setCalendarOpen(!calendarOpen)}
  >
    <div className="flex items-center gap-3">
      <h3 className="text-lg font-semibold text-gray-800">📅 October 2025 - Attendance Calendar</h3>
      {!calendarOpen && (
        <span className="text-sm text-gray-500">
          ({childData?.present || 0} present, {childData?.absent || 0} absent)
        </span>
      )}
    </div>
    <div className="flex items-center gap-4">
      {calendarOpen && (
        <div className="flex gap-3 text-xs mr-4">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
            <span className="text-gray-600">Present</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span className="text-gray-600">Absent</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
            <span className="text-gray-600">No Class</span>
          </div>
        </div>
      )}
      <ChevronDown className={`w-5 h-5 text-gray-500 transition-transform ${calendarOpen ? 'rotate-180' : ''}`} />
    </div>
  </div>

  {/* Calendar Content - Collapsible */}
  {calendarOpen && (
    <div className="px-6 pb-6">
      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-2 mb-6">
        {/* Days of week header */}
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center text-xs font-semibold text-gray-600 py-2">
            {day}
          </div>
        ))}
        
        {/* Calendar dates */}
        {(() => {
          const dates = [];
          const daysInMonth = 31; // October has 31 days
          const startDay = 3; // October 2025 starts on Wednesday (index 3)
          
          // Empty cells before month starts
          for (let i = 0; i < startDay; i++) {
            dates.push(
              <div key={`empty-${i}`} className="aspect-square"></div>
            );
          }
          
          // Actual dates - CHECK REAL FIREBASE DATA
          for (let date = 1; date <= daysInMonth; date++) {
            const dateStr = `2025-10-${String(date).padStart(2, '0')}`;
            
            // Check if this date exists in Firebase attendance data
            const attendanceStatus = attendanceDates[dateStr];
            
            let status = 'no-class'; // default
            if (attendanceStatus === 'Present') {
              status = 'present';
            } else if (attendanceStatus === 'Absent') {
              status = 'absent';
            }
            
            dates.push(
              <div
                key={date}
                className={`aspect-square flex items-center justify-center text-sm rounded-lg border-2 transition-all cursor-pointer hover:shadow-md ${
                  status === 'present' 
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-700 font-semibold' 
                    : status === 'absent'
                    ? 'bg-red-50 border-red-500 text-red-700 font-semibold'
                    : 'bg-gray-50 border-gray-200 text-gray-400'
                }`}
                title={
                  status === 'present' ? `✅ Present on Oct ${date}` :
                  status === 'absent' ? `❌ Absent on Oct ${date}` :
                  'No class scheduled'
                }
              >
                {date}
              </div>
            );
          }
          
          return dates;
        })()}
      </div>

      {/* Quick Stats Below Calendar */}
      <div className="grid grid-cols-3 gap-4 pt-6 border-t border-gray-200">
        <div className="text-center p-3 bg-emerald-50 rounded-lg">
          <p className="text-2xl font-bold text-emerald-600">{childData?.present || 0}</p>
          <p className="text-xs text-gray-600 mt-1">Days Present</p>
        </div>
        <div className="text-center p-3 bg-red-50 rounded-lg">
          <p className="text-2xl font-bold text-red-600">{childData?.absent || 0}</p>
          <p className="text-xs text-gray-600 mt-1">Days Absent</p>
        </div>
        <div className="text-center p-3 bg-blue-50 rounded-lg">
          <p className="text-2xl font-bold text-blue-600">{childData?.total_classes || 0}</p>
          <p className="text-xs text-gray-600 mt-1">Total Classes</p>
        </div>
      </div>
    </div>
  )}
</div>
            </div>
          )}

          {activeSection === 'subjects' && (
  <div className="space-y-6">
    <div className="flex items-center justify-between">
      <h2 className="text-2xl font-bold text-gray-800">📚 Subject Performance</h2>
      <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
        <Filter className="w-4 h-4 text-gray-600" />
        <span className="text-gray-700 font-medium">Filter</span>
      </button>
    </div>

    {/* 3D Tilt Cards Grid */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Object.entries(childData.subjects).map(([subject, data]) => {
        const risk = getRiskLevel(data.percentage);
        const classesNeeded = Math.max(0, Math.ceil((0.75 * data.total - data.present) / 0.25));
        
        return (
          <motion.div
            key={subject}
            className="relative group cursor-pointer"
            whileHover={{ scale: 1.03, rotateY: 5 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setSelectedSubjectModal({ subject, data, risk, classesNeeded })}
          >
            <div className={`bg-gradient-to-br ${
              data.percentage >= 85 ? 'from-emerald-50 to-emerald-100' :
              data.percentage >= 75 ? 'from-blue-50 to-blue-100' :
              'from-red-50 to-red-100'
            } rounded-2xl shadow-xl border-2 ${risk.borderClass} p-6 transform transition-all duration-300 hover:shadow-2xl`}>
              
              {/* Subject Icon & Badge */}
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 ${risk.bgClass} rounded-xl`}>
                  <BookOpen className={`w-6 h-6 ${risk.textClass}`} />
                </div>
                <span className={`px-3 py-1 ${risk.bgClass} ${risk.textClass} rounded-full text-xs font-bold`}>
                  {data.percentage >= 75 ? '✓ Safe' : '⚠ Risk'}
                </span>
              </div>

              {/* Subject Name */}
              <h3 className="text-xl font-bold text-gray-800 mb-2">{subject}</h3>

              {/* Percentage - Big */}
              <div className="mb-4">
                <div className="flex items-end gap-2">
                  <span className="text-5xl font-black text-gray-800">{data.percentage}</span>
                  <span className="text-3xl font-bold text-gray-500 mb-1">%</span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-gray-200 rounded-full h-3 mb-4 overflow-hidden">
                <motion.div 
                  className={`h-3 rounded-full bg-gradient-to-r ${
                    data.percentage >= 85 ? 'from-emerald-400 to-emerald-600' :
                    data.percentage >= 75 ? 'from-blue-400 to-blue-600' :
                    'from-red-400 to-red-600'
                  }`}
                  initial={{ width: 0 }}
                  animate={{ width: `${data.percentage}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                />
              </div>

              {/* Stats */}
              <div className="flex justify-between text-sm mb-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-emerald-600">{data.present}</p>
                  <p className="text-xs text-gray-600">Present</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-600">{data.total - data.present}</p>
                  <p className="text-xs text-gray-600">Absent</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">{data.total}</p>
                  <p className="text-xs text-gray-600">Total</p>
                </div>
              </div>

              {/* Warning if below 75% */}
              {data.percentage < 75 && (
                <div className="flex items-center gap-2 p-3 bg-amber-100 rounded-lg border border-amber-300">
                  <AlertTriangle className="w-4 h-4 text-amber-700 flex-shrink-0" />
                  <p className="text-xs text-amber-800 font-semibold">
                    Need {classesNeeded} more classes
                  </p>
                </div>
              )}

              {/* Click to view hint */}
              <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  Click for details <ChevronRight className="w-3 h-3" />
                </p>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>

    {/* Modal for Detailed View */}
    <AnimatePresence>
      {selectedSubjectModal && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedSubjectModal(null)}
          />

          {/* Modal */}
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
          >
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">{selectedSubjectModal.subject}</h2>
                  <p className="text-sm text-gray-500 mt-1">Detailed Attendance Report</p>
                </div>
                <button
                  onClick={() => setSelectedSubjectModal(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition"
                >
                  <X className="w-6 h-6 text-gray-600" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-6">
                {/* Big Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-emerald-50 rounded-xl">
                    <p className="text-3xl font-bold text-emerald-600">{selectedSubjectModal.data.present}</p>
                    <p className="text-sm text-gray-600 mt-1">Classes Present</p>
                  </div>
                  <div className="text-center p-4 bg-red-50 rounded-xl">
                    <p className="text-3xl font-bold text-red-600">{selectedSubjectModal.data.total - selectedSubjectModal.data.present}</p>
                    <p className="text-sm text-gray-600 mt-1">Classes Absent</p>
                  </div>
                  <div className="text-center p-4 bg-blue-50 rounded-xl">
                    <p className="text-3xl font-bold text-blue-600">{selectedSubjectModal.data.total}</p>
                    <p className="text-sm text-gray-600 mt-1">Total Classes</p>
                  </div>
                </div>

                {/* Percentage Circle */}
                <div className="flex flex-col items-center py-6 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl">
                  <div className="relative w-48 h-48">
                    <svg className="transform -rotate-90 w-48 h-48">
                      <circle
                        cx="96"
                        cy="96"
                        r="88"
                        stroke="currentColor"
                        strokeWidth="12"
                        fill="transparent"
                        className="text-gray-200"
                      />
                      <circle
                        cx="96"
                        cy="96"
                        r="88"
                        stroke="currentColor"
                        strokeWidth="12"
                        fill="transparent"
                        strokeDasharray={`${2 * Math.PI * 88}`}
                        strokeDashoffset={`${2 * Math.PI * 88 * (1 - selectedSubjectModal.data.percentage / 100)}`}
                        className={selectedSubjectModal.data.percentage >= 75 ? 'text-emerald-500' : 'text-red-500'}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-5xl font-black text-gray-800">{selectedSubjectModal.data.percentage}%</span>
                    </div>
                  </div>
                  <p className="text-lg font-semibold text-gray-700 mt-4">Current Attendance</p>
                </div>

                {/* Warning/Success Message */}
                {selectedSubjectModal.data.percentage < 75 ? (
                  <div className="p-4 bg-red-50 border-2 border-red-200 rounded-xl">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
                      <div>
                        <p className="font-bold text-red-900 mb-1">⚠️ Action Required!</p>
                        <p className="text-sm text-red-700">
                          Your child needs to attend <strong>{selectedSubjectModal.classesNeeded} more consecutive classes</strong> to reach the required 75% attendance threshold.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-emerald-50 border-2 border-emerald-200 rounded-xl">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-1" />
                      <div>
                        <p className="font-bold text-emerald-900 mb-1">✅ Excellent Attendance!</p>
                        <p className="text-sm text-emerald-700">
                          Your child's attendance is above the required 75% threshold. Keep up the great work!
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Teacher Contact Information */}
<div className="space-y-4">
  <div className="flex items-center justify-between">
    <h3 className="text-lg font-semibold text-gray-800">👨‍🏫 Subject Teacher</h3>
  </div>
  
  {teacherContacts[selectedSubjectModal.subject] && (
    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-6 border-2 border-indigo-200">
      {/* Teacher Info */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center text-3xl">
          {teacherContacts[selectedSubjectModal.subject].avatar}
        </div>
        <div className="flex-1">
          <h4 className="text-xl font-bold text-gray-800">
            {teacherContacts[selectedSubjectModal.subject].name}
          </h4>
          <p className="text-sm text-gray-600">
            {teacherContacts[selectedSubjectModal.subject].department}
          </p>
        </div>
      </div>

      {/* Contact Methods */}
      <div className="space-y-3">
        {/* Email */}
        <a 
          href={`mailto:${teacherContacts[selectedSubjectModal.subject].email}?subject=Regarding ${selectedSubjectModal.subject} Attendance - ${childName}`}
          className="flex items-center gap-3 p-4 bg-white rounded-lg border border-indigo-200 hover:border-indigo-400 hover:shadow-md transition group"
        >
          <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition">
            <Mail className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-gray-500 font-semibold">Email</p>
            <p className="text-sm font-medium text-gray-800">
              {teacherContacts[selectedSubjectModal.subject].email}
            </p>
          </div>
          <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-indigo-600 transition" />
        </a>

        {/* Phone */}
        <a 
          href={`tel:${teacherContacts[selectedSubjectModal.subject].phone}`}
          className="flex items-center gap-3 p-4 bg-white rounded-lg border border-indigo-200 hover:border-indigo-400 hover:shadow-md transition group"
        >
          <div className="p-2 bg-emerald-100 rounded-lg group-hover:bg-emerald-200 transition">
            <Phone className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-gray-500 font-semibold">Phone</p>
            <p className="text-sm font-medium text-gray-800">
              {teacherContacts[selectedSubjectModal.subject].phone}
            </p>
          </div>
          <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-indigo-600 transition" />
        </a>

        {/* WhatsApp (Optional) */}
        <a 
          href={`https://wa.me/${teacherContacts[selectedSubjectModal.subject].phone.replace(/\D/g, '')}?text=Hello ${teacherContacts[selectedSubjectModal.subject].name}, I am ${parentName}, parent of ${childName}. I would like to discuss ${selectedSubjectModal.subject} attendance.`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 p-4 bg-white rounded-lg border border-indigo-200 hover:border-indigo-400 hover:shadow-md transition group"
        >
          <div className="p-2 bg-green-100 rounded-lg group-hover:bg-green-200 transition">
            <MessageCircle className="w-5 h-5 text-green-600" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-gray-500 font-semibold">WhatsApp</p>
            <p className="text-sm font-medium text-gray-800">Send Message</p>
          </div>
          <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-indigo-600 transition" />
        </a>
      </div>

      {/* Quick Action Buttons */}
      <div className="grid grid-cols-2 gap-3 mt-6">
        <button 
          onClick={() => {
            window.location.href = `mailto:${teacherContacts[selectedSubjectModal.subject].email}?subject=Urgent: ${selectedSubjectModal.subject} Attendance Issue - ${childName}&body=Dear ${teacherContacts[selectedSubjectModal.subject].name},%0D%0A%0D%0AI am writing to discuss my child ${childName}'s attendance in ${selectedSubjectModal.subject}.`;
          }}
          className="px-4 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition font-semibold text-sm"
        >
          📧 Send Email
        </button>
        <button 
          onClick={() => {
            const phoneNumber = teacherContacts[selectedSubjectModal.subject].phone.replace(/\D/g, '');
            window.open(`tel:${phoneNumber}`, '_self');
          }}
          className="px-4 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition font-semibold text-sm"
        >
          📞 Call Now
        </button>
      </div>
    </div>
  )}

  {/* Download Report Button */}
  <button className="w-full px-6 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition font-semibold flex items-center justify-center gap-2">
    <Download className="w-4 h-4" />
    Download Detailed Report
  </button>
</div>

              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  </div>
)}


          {activeSection === 'analytics' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-800">Detailed Analytics</h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Subject Comparison</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart 
                      data={Object.entries(childData.subjects).map(([name, data]) => ({
                        name: name,
                        attendance: data.percentage
                      }))}
                      layout="vertical"
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis type="number" stroke="#9ca3af" style={{fontSize: '12px'}} domain={[0, 100]} />
                      <YAxis dataKey="name" type="category" width={80} stroke="#9ca3af" style={{fontSize: '12px'}} />
                      <Tooltip />
                      <Bar dataKey="attendance" fill="#6366f1" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Attendance Distribution</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Present', value: childData.present, fill: '#10b981' },
                          { name: 'Absent', value: childData.absent, fill: '#ef4444' }
                        ]}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(entry) => `${entry.name}: ${entry.value}`}
                        outerRadius={100}
                        dataKey="value"
                      />
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-6 lg:col-span-2">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Performance Radar</h3>
                  <ResponsiveContainer width="100%" height={400}>
                    <RadarChart data={Object.entries(childData.subjects).map(([name, data]) => ({
                      subject: name,
                      attendance: data.percentage,
                      target: 75
                    }))}>
                      <PolarGrid stroke="#e5e7eb" />
                      <PolarAngleAxis dataKey="subject" stroke="#6b7280" style={{fontSize: '12px'}} />
                      <PolarRadiusAxis angle={90} domain={[0, 100]} stroke="#9ca3af" />
                      <Radar name="Attendance" dataKey="attendance" stroke="#6366f1" fill="#6366f1" fillOpacity={0.5} />
                      <Radar name="Target (75%)" dataKey="target" stroke="#ef4444" fill="#ef4444" fillOpacity={0.2} />
                      <Legend />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          
{activeSection === 'marks' && (
  <div className="space-y-6">
    <div className="bg-white rounded-2xl p-6 shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-gray-800 flex items-center gap-2">
        <span>📊</span> Student Marks - {childName}
      </h2>
      
      {console.log("🔍 Rendering marks, studentMarks =", studentMarks)}
      
      {studentMarks && Array.isArray(studentMarks) && studentMarks.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {studentMarks.map((mark, index) => (
            <div key={index} className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-6 border-2 border-blue-200 hover:shadow-xl transition-all">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-800">{mark.subject}</h3>
                <div className="text-right">
                  <span className="text-4xl font-bold text-blue-600">{mark.marks}</span>
                  <span className="text-sm text-gray-500">/100</span>
                </div>
              </div>
              
              <div className="mt-4 w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div 
                  className="h-3 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-500"
                  style={{width: `${mark.marks}%`}}
                ></div>
              </div>
              
              <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <span>📅</span>
                  {new Date(mark.addedAt).toLocaleDateString()}
                </span>
                <span className={`px-3 py-1 rounded-full font-semibold ${
                  mark.marks >= 75 ? 'bg-green-100 text-green-700' :
                  mark.marks >= 60 ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {mark.marks >= 75 ? 'Excellent' : mark.marks >= 60 ? 'Good' : 'Needs Improvement'}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-yellow-50 border-l-4 border-yellow-500 p-6 rounded-lg flex items-center gap-3">
          <span className="text-4xl">📝</span>
          <div>
            <p className="font-bold text-yellow-800">No marks recorded yet</p>
            <p className="text-sm text-yellow-700 mt-1">Marks will appear here once faculty uploads them</p>
          </div>
        </div>
      )}
    </div>
    {/* ASSIGNMENTS SECTION - ADD RIGHT AFTER MARKS */}
<div className="mt-8 bg-white rounded-2xl p-6 shadow-lg border-2 border-purple-100">
  <div className="flex items-center justify-between mb-6">
    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
      <CheckCircle className="text-purple-600" size={24} />
      Assignments Status
    </h2>
    <div className="flex gap-3">
      <div className="bg-green-100 px-4 py-2 rounded-lg">
        <span className="text-sm font-semibold text-green-700">
          ✓ {assignments.filter(a => a.submitted).length} Submitted
        </span>
      </div>
      <div className="bg-orange-100 px-4 py-2 rounded-lg">
        <span className="text-sm font-semibold text-orange-700">
          ⏳ {assignments.filter(a => !a.submitted).length} Pending
        </span>
      </div>
    </div>
  </div>

  {assignments && assignments.length > 0 ? (
    <div className="grid grid-cols-1 gap-4">
      {assignments.map((assignment, index) => (
        <div 
          key={assignment.id}
          className={`border-2 rounded-xl p-6 transition-all hover:shadow-lg ${
            assignment.submitted
              ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-300'
              : 'bg-gradient-to-br from-orange-50 to-yellow-50 border-orange-300'
          }`}
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-xl font-bold text-gray-900">{assignment.title}</h3>
                {assignment.submitted ? (
                  <span className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                    <CheckCircle size={14} />
                    Submitted
                  </span>
                ) : (
                  <span className="bg-orange-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                    <AlertCircle size={14} />
                    Pending
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 mb-3">{assignment.description}</p>
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1 text-blue-600 font-semibold">
                  <BookOpen size={16} />
                  {assignment.subject}
                </span>
                <span className="flex items-center gap-1 text-gray-600">
                  <Calendar size={16} />
                  Due: {new Date(assignment.dueDate).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  })}
                </span>
                <span className="flex items-center gap-1 text-gray-600">
                  <Users size={16} />
                  {assignment.totalSubmissions} submissions
                </span>
              </div>
            </div>
          </div>

          {assignment.submitted ? (
  <div className="bg-white rounded-lg p-4 border-2 border-green-200">
    <div className="flex items-center gap-3">
      <div className="bg-green-100 p-2 rounded-full">
        <CheckCircle className="text-green-600" size={20} />
      </div>
      <div>
        <p className="text-sm font-semibold text-green-700">
          ✓ Your child has submitted this assignment
        </p>
        <p className="text-xs text-gray-600">
          {assignment.submittedAt && assignment.submittedAt > 0
            ? `Verified on: ${new Date(assignment.submittedAt).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}`
            : 'Verified by faculty'}
        </p>

                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg p-4 border-2 border-orange-200">
              <div className="flex items-center gap-3">
                <div className="bg-orange-100 p-2 rounded-full">
                  <AlertCircle className="text-orange-600" size={20} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-orange-700">
                    ⚠️ Assignment not yet submitted
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    Please remind your child to complete and submit this assignment
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  ) : (
    <div className="bg-blue-50 border-l-4 border-blue-500 p-6 rounded-lg flex items-center gap-3">
      <span className="text-4xl">📚</span>
      <div>
        <p className="font-bold text-blue-800">No assignments yet</p>
        <p className="text-sm text-blue-700 mt-1">Assignments will appear here when faculty posts them</p>
      </div>
    </div>
  )}
</div>

  </div>
)}

  {activeSection === 'events' && (
  <div className="space-y-6">
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Events & Notifications</h2>
        <p className="text-sm text-gray-500 mt-1">Updates from faculty and administration</p>
      </div>
      <div className="flex items-center gap-2 px-4 py-2 bg-indigo-100 rounded-lg">
        <Bell className="w-5 h-5 text-indigo-600" />
        <span className="text-indigo-600 font-semibold">{eventsList.length} Total Events</span>
      </div>
    </div>

    {/* Events List */}
    <div className="space-y-4">
      {eventsList.length > 0 ? (
        eventsList.map((event) => (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-6 rounded-xl border-2 bg-gradient-to-br ${
              event.color === 'blue' 
                ? 'from-blue-50 to-blue-100 border-blue-300' 
                : event.color === 'purple'
                ? 'from-purple-50 to-purple-100 border-purple-300'
                : 'from-emerald-50 to-emerald-100 border-emerald-300'
            } hover:shadow-lg transition-all`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 rounded-lg ${
                    event.color === 'blue' ? 'bg-blue-500' :
                    event.color === 'purple' ? 'bg-purple-500' : 'bg-emerald-500'
                  }`}>
                    <Calendar className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-800">{event.title}</h3>
                    <p className="text-sm text-gray-600">{event.type || 'Event'}</p>
                  </div>
                </div>

                {event.description && (
                  <p className="text-gray-700 mb-4">{event.description}</p>
                )}

                <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span className="font-medium">{event.date}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span>{event.time}</span>
                  </div>
                </div>

               {/* Response Section - Shows buttons or status */}
<div className="mt-4">
  {event.userResponse ? (
    // Show response status if already responded
    <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border-2 ${
      event.userResponse === 'confirmed' 
        ? 'bg-green-50 border-green-300' 
        : 'bg-red-50 border-red-300'
    }`}>
      {event.userResponse === 'confirmed' ? (
        <>
          <CheckCircle className="w-5 h-5 text-green-600" />
          <div>
            <p className="text-green-800 font-bold">Attendance Confirmed ✓</p>
            <p className="text-green-600 text-sm">You have confirmed your attendance for this event</p>
          </div>
        </>
      ) : (
        <>
          <X className="w-5 h-5 text-red-600" />
          <div>
            <p className="text-red-800 font-bold">Declined ✗</p>
            <p className="text-red-600 text-sm">You have declined this event</p>
          </div>
        </>
      )}
    </div>
  ) : (
    // Show action buttons if not responded yet
    <div className="flex gap-3">
      <button
        onClick={() => handleEventResponse(event.id, 'confirmed')}
        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition"
      >
        <CheckCircle className="w-4 h-4" />
        Confirm Attendance
      </button>
      <button
        onClick={() => handleEventResponse(event.id, 'declined')}
        className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition"
      >
        <X className="w-4 h-4" />
        Decline
      </button>
    </div>
  )}
</div>

              </div>

              <div className="text-right">
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                  event.color === 'blue' ? 'bg-blue-200 text-blue-800' :
                  event.color === 'purple' ? 'bg-purple-200 text-purple-800' :
                  'bg-emerald-200 text-emerald-800'
                }`}>
                  New
                </span>
              </div>
            </div>
          </motion.div>
        ))
      ) : (
        <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-12 text-center">
          <Bell className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-600 mb-2">No Events Yet</h3>
          <p className="text-sm text-gray-500">Events created by faculty will appear here</p>
        </div>
      )}
    </div>
  </div>
)}


          {activeSection === 'communication' && (
  <div className="space-y-6">
    <h2 className="text-2xl font-bold text-gray-800">💬 Communication Center</h2>

    {/* Quick Action Cards */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Email Faculty/Administration */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => {
          setContactType('email');
          setShowContactModal(true);
        }}
        className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border-2 border-blue-200 p-6 hover:shadow-xl transition text-left group"
      >
        <div className="flex items-center gap-4 mb-3">
          <div className="p-3 bg-blue-500 rounded-lg group-hover:bg-blue-600 transition">
            <Mail className="w-6 h-6 text-white" />
          </div>
          <ExternalLink className="w-5 h-5 text-gray-400 ml-auto" />
        </div>
        <h4 className="text-lg font-semibold text-gray-800 mb-1">Email Faculty</h4>
        <p className="text-sm text-gray-600">Send email to teachers or HOD</p>
      </motion.button>

      {/* Call Administration */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => {
          setContactType('call');
          setShowContactModal(true);
        }}
        className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl border-2 border-emerald-200 p-6 hover:shadow-xl transition text-left group"
      >
        <div className="flex items-center gap-4 mb-3">
          <div className="p-3 bg-emerald-500 rounded-lg group-hover:bg-emerald-600 transition">
            <Phone className="w-6 h-6 text-white" />
          </div>
          <ExternalLink className="w-5 h-5 text-gray-400 ml-auto" />
        </div>
        <h4 className="text-lg font-semibold text-gray-800 mb-1">Call Administration</h4>
        <p className="text-sm text-gray-600">Contact HOD or college office</p>
      </motion.button>

      {/* Schedule Meeting */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setShowMeetingModal(true)}
        className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border-2 border-purple-200 p-6 hover:shadow-xl transition text-left group"
      >
        <div className="flex items-center gap-4 mb-3">
          <div className="p-3 bg-purple-500 rounded-lg group-hover:bg-purple-600 transition">
            <Video className="w-6 h-6 text-white" />
          </div>
          <ExternalLink className="w-5 h-5 text-gray-400 ml-auto" />
        </div>
        <h4 className="text-lg font-semibold text-gray-800 mb-1">Schedule Meeting</h4>
        <p className="text-sm text-gray-600">Zoom or Google Meet consultation</p>
      </motion.button>
    </div>


    {/* Contact Selection Modal */}
    <AnimatePresence>
      {showContactModal && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowContactModal(false)}
          />
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
          >
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-800">
                  {contactType === 'email' ? '📧 Select Contact' : '📞 Select Contact'}
                </h2>
                <button
                  onClick={() => setShowContactModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition"
                >
                  <X className="w-6 h-6 text-gray-600" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {/* HOD Card */}
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-6 border-2 border-indigo-200">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center text-3xl">
                      {hodContact.avatar}
                    </div>
                    <div className="flex-1">
                      <h4 className="text-xl font-bold text-gray-800">{hodContact.name}</h4>
                      <p className="text-sm text-gray-600">{hodContact.designation}</p>
                    </div>
                  </div>
                  {contactType === 'email' ? (
                    <a
                      href={`mailto:${hodContact.email}?subject=Regarding Attendance - ${childName}`}
                      className="flex items-center justify-center gap-2 w-full px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition font-semibold"
                    >
                      <Mail className="w-5 h-5" />
                      Email {hodContact.name}
                    </a>
                  ) : (
                    <a
                      href={`tel:${hodContact.phone}`}
                      className="flex items-center justify-center gap-2 w-full px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition font-semibold"
                    >
                      <Phone className="w-5 h-5" />
                      Call {hodContact.name}
                    </a>
                  )}
                </div>

                {/* Subject Teachers */}
                <h3 className="text-lg font-semibold text-gray-800 mt-6">Subject Teachers</h3>
                {Object.entries(teacherContacts).map(([subject, teacher]) => (
                  <div key={subject} className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border-2 border-blue-200">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-2xl">
                        {teacher.avatar}
                      </div>
                      <div className="flex-1">
                        <h4 className="text-lg font-bold text-gray-800">{teacher.name}</h4>
                        <p className="text-sm text-gray-600">{subject} - {teacher.department}</p>
                      </div>
                    </div>
                    {contactType === 'email' ? (
                      <a
                        href={`mailto:${teacher.email}?subject=Regarding ${subject} Attendance - ${childName}`}
                        className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold text-sm"
                      >
                        <Mail className="w-4 h-4" />
                        Email {teacher.name}
                      </a>
                    ) : (
                      <a
                        href={`tel:${teacher.phone}`}
                        className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-semibold text-sm"
                      >
                        <Phone className="w-4 h-4" />
                        Call {teacher.name}
                      </a>
                    )}
                  </div>
                ))}


                {/* Administration */}
                <h3 className="text-lg font-semibold text-gray-800 mt-6">Administration</h3>
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6 border-2 border-gray-200">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-gray-600 rounded-full flex items-center justify-center text-2xl">
                      {adminContact.avatar}
                    </div>
                    <div className="flex-1">
                      <h4 className="text-lg font-bold text-gray-800">{adminContact.name}</h4>
                      <p className="text-sm text-gray-600">{adminContact.designation}</p>
                    </div>
                  </div>
                  {contactType === 'email' ? (
                    <a
                      href={`mailto:${adminContact.email}?subject=General Inquiry - ${childName}`}
                      className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition font-semibold text-sm"
                    >
                      <Mail className="w-4 h-4" />
                      Email {adminContact.name}
                    </a>
                  ) : (
                    <a
                      href={`tel:${adminContact.phone}`}
                      className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-semibold text-sm"
                    >
                      <Phone className="w-4 h-4" />
                      Call {adminContact.name}
                    </a>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>

    {/* Meeting Platform Modal */}
    <AnimatePresence>
      {showMeetingModal && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowMeetingModal(false)}
          />
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
          >
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
              <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-800">🎥 Schedule Meeting</h2>
                <button
                  onClick={() => setShowMeetingModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition"
                >
                  <X className="w-6 h-6 text-gray-600" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <p className="text-gray-600 text-center mb-6">Choose your preferred meeting platform</p>
                
                {/* Zoom Option */}
                <a
                  href="https://zoom.us/start/videomeeting"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border-2 border-blue-200 hover:border-blue-400 hover:shadow-lg transition group"
                >
                  <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center">
                    <Video className="w-8 h-8 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-800 mb-1">Zoom Meeting</h3>
                    <p className="text-sm text-gray-600">Start instant Zoom call</p>
                  </div>
                  <ExternalLink className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition" />
                </a>

                {/* Google Meet Option */}
                <a
                  href="https://meet.google.com/new"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 p-6 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl border-2 border-emerald-200 hover:border-emerald-400 hover:shadow-lg transition group"
                >
                  <div className="w-16 h-16 bg-emerald-600 rounded-xl flex items-center justify-center">
                    <Video className="w-8 h-8 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-800 mb-1">Google Meet</h3>
                    <p className="text-sm text-gray-600">Create Google Meet link</p>
                  </div>
                  <ExternalLink className="w-5 h-5 text-gray-400 group-hover:text-emerald-600 transition" />
                </a>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  

  {/* Interactive Events Calendar */}
  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
    <div className="p-6 border-b border-gray-200">
      <h3 className="text-lg font-semibold text-gray-800">📅 Upcoming Events</h3>
      <p className="text-xs text-gray-500 mt-1">
        {eventsList.filter(e => e.status === 'pending').length} events pending

      </p>
    </div>

    <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
      {eventsList.map((event) => (
 
        <motion.div
          key={event.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-5 border-l-4 ${
            event.color === 'blue' ? 'border-blue-500 bg-blue-50' :
            event.color === 'purple' ? 'border-purple-500 bg-purple-50' :
            'border-emerald-500 bg-emerald-50'
          }`}
        >
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex-1">
              <h4 className="font-bold text-gray-800 mb-2">{event.title}</h4>
              <div className="flex flex-wrap gap-3 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  <span>{event.date}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span>{event.time}</span>
                </div>
              </div>
            </div>
            {event.status === 'pending' && (
              <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">
                Pending
              </span>
            )}
            {event.status === 'confirmed' && (
              <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full">
                Confirmed
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            {event.status === 'pending' && (
              <>
                <button
                  onClick={() => {
                    setEventsList(eventsList.map(e =>
 
                      e.id === event.id ? { ...e, status: 'confirmed' } : e
                    ));
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-xs font-semibold"
                >
                  <CheckCircle className="w-3 h-3" />
                  Confirm RSVP
                </button>
                <button
                  onClick={() => {
                    setEventsList(eventsList.map(e =>
 
                      e.id === event.id ? { ...e, status: 'declined' } : e
                    ));
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition text-xs font-semibold"
                >
                  <X className="w-3 h-3" />
                  Decline
                </button>
              </>
            )}
            <a
              href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${event.date.replace(/,/g, '').replace(/ /g, '')}/${event.date.replace(/,/g, '').replace(/ /g, '')}&details=${encodeURIComponent(`Event at ${event.time}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition text-xs font-semibold"
            >
              <Calendar className="w-3 h-3" />
              Add to Calendar
            </a>
            <button
              className="flex items-center gap-1 px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition text-xs font-semibold"
            >
              <Bell className="w-3 h-3" />
              Set Reminder
            </button>
          </div>
        </motion.div>
      ))}
    </div>
  </div>
</div>


              <div className="bg-white rounded-lg border border-gray-200 p-6">
  <div className="flex items-center justify-between mb-6">
    <div>
      <h3 className="text-lg font-semibold text-gray-800">⚡ Quick Actions</h3>
      <p className="text-sm text-gray-600 mt-1">One-click message templates for common requests</p>
    </div>
  </div>

  {/* Quick Action Template Cards */}
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    {/* Template 1: Request Attendance Meeting */}
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => setSelectedTemplate({
        title: '📅 Request Attendance Meeting',
        recipient: 'HOD / Class Teacher',
        subject: `Request for Attendance Discussion - ${childName}`,
        body: `Dear Sir/Madam,\n\nI am ${parentName}, parent of ${childName} (ID: ${childId}).\n\nI would like to request a meeting to discuss my child's attendance performance. Current attendance: ${childData?.overall_percentage}%.\n\nPlease let me know your available time slots.\n\nThank you,\n${parentName}`
      })}
      className="text-left p-5 bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-xl hover:shadow-lg transition group"
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="p-2 bg-blue-500 rounded-lg">
          <Calendar className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h4 className="font-bold text-gray-800 mb-1">Request Attendance Meeting</h4>
          <p className="text-xs text-gray-600">Schedule meeting with HOD or teacher</p>
        </div>
        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition" />
      </div>
    </motion.button>

    {/* Template 2: Report Child Absence */}
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => setSelectedTemplate({
        title: '🏥 Report Child Absence',
        recipient: 'Class Teacher',
        subject: `Absence Notification - ${childName}`,
        body: `Dear Teacher,\n\nThis is to inform you that my child ${childName} (ID: ${childId}) will be absent from classes due to [health/personal/family reasons].\n\nAbsence Duration: [Start Date] to [End Date]\n\nKindly mark this as an informed absence.\n\nThank you for your understanding,\n${parentName}\nContact: [Your Phone Number]`
      })}
      className="text-left p-5 bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-200 rounded-xl hover:shadow-lg transition group"
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="p-2 bg-red-500 rounded-lg">
          <AlertCircle className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h4 className="font-bold text-gray-800 mb-1">Report Child Absence</h4>
          <p className="text-xs text-gray-600">Notify about planned or emergency leave</p>
        </div>
        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-red-600 transition" />
      </div>
    </motion.button>

    {/* Template 3: Request Leave Application */}
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => setSelectedTemplate({
        title: '📝 Request Leave Application',
        recipient: 'HOD / Administration',
        subject: `Leave Application Request - ${childName}`,
        body: `Dear Sir/Madam,\n\nI am writing to request a leave of absence for my child ${childName} (ID: ${childId}).\n\nLeave Period: [Start Date] to [End Date]\nReason: [Specify reason - Medical/Family Event/Personal]\n\nI request you to kindly approve this leave and provide any necessary documentation requirements.\n\nThank you,\n${parentName}\nContact: [Your Phone Number]`
      })}
      className="text-left p-5 bg-gradient-to-br from-amber-50 to-amber-100 border-2 border-amber-200 rounded-xl hover:shadow-lg transition group"
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="p-2 bg-amber-500 rounded-lg">
          <FileText className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h4 className="font-bold text-gray-800 mb-1">Request Leave Application</h4>
          <p className="text-xs text-gray-600">Formal leave request for extended absence</p>
        </div>
        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-amber-600 transition" />
      </div>
    </motion.button>

    {/* Template 4: Ask About Performance */}
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => setSelectedTemplate({
        title: '📊 Ask About Performance',
        recipient: 'Subject Teacher',
        subject: `Inquiry About Academic Performance - ${childName}`,
        body: `Dear Teacher,\n\nI am ${parentName}, parent of ${childName} (ID: ${childId}).\n\nI would like to inquire about my child's academic performance and attendance in your subject.\n\nCurrent Overall Attendance: ${childData?.overall_percentage}%\n\nPlease share:\n- Subject-wise performance details\n- Areas needing improvement\n- Your recommendations\n\nThank you for your guidance,\n${parentName}`
      })}
      className="text-left p-5 bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-200 rounded-xl hover:shadow-lg transition group"
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="p-2 bg-purple-500 rounded-lg">
          <Target className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h4 className="font-bold text-gray-800 mb-1">Ask About Performance</h4>
          <p className="text-xs text-gray-600">Get detailed academic progress report</p>
        </div>
        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-purple-600 transition" />
      </div>
    </motion.button>

    {/* Template 5: Request Progress Report */}
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => setSelectedTemplate({
        title: '📈 Request Progress Report',
        recipient: 'Class Coordinator',
        subject: `Progress Report Request - ${childName}`,
        body: `Dear Coordinator,\n\nI am ${parentName}, parent of ${childName} (ID: ${childId}).\n\nI would like to request a comprehensive progress report including:\n\n- Attendance summary (Current: ${childData?.overall_percentage}%)\n- Academic performance across all subjects\n- Behavioral assessment\n- Teacher recommendations\n\nPlease share the report at your earliest convenience.\n\nThank you,\n${parentName}\nContact: [Your Phone Number]`
      })}
      className="text-left p-5 bg-gradient-to-br from-emerald-50 to-emerald-100 border-2 border-emerald-200 rounded-xl hover:shadow-lg transition group"
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="p-2 bg-emerald-500 rounded-lg">
          <Award className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h4 className="font-bold text-gray-800 mb-1">Request Progress Report</h4>
          <p className="text-xs text-gray-600">Get comprehensive student report</p>
        </div>
        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-emerald-600 transition" />
      </div>
    </motion.button>

    {/* Template 6: Emergency Contact */}
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => setSelectedTemplate({
        title: '🚨 Emergency Contact',
        recipient: 'Administration / HOD',
        subject: `URGENT: Emergency Contact Required - ${childName}`,
        body: `Dear Sir/Madam,\n\nThis is an URGENT message regarding ${childName} (ID: ${childId}).\n\n[Describe emergency situation]\n\nPlease contact me immediately at:\nPhone: [Your Phone Number]\nAlternate: [Alternate Contact]\n\nThank you,\n${parentName}`
      })}
      className="text-left p-5 bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-300 rounded-xl hover:shadow-lg transition group"
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="p-2 bg-red-600 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h4 className="font-bold text-gray-800 mb-1">Emergency Contact</h4>
          <p className="text-xs text-gray-600">Urgent communication required</p>
        </div>
        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-red-600 transition" />
      </div>
    </motion.button>
  </div>

  {/* Template Preview Modal */}
  <AnimatePresence>
    {selectedTemplate && (
      <>
        <motion.div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setSelectedTemplate(null)}
        />
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-800">{selectedTemplate.title}</h2>
              <button
                onClick={() => setSelectedTemplate(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <X className="w-6 h-6 text-gray-600" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Recipient */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Send To:</label>
                <div className="p-3 bg-gray-100 rounded-lg">
                  <p className="text-gray-800 font-medium">{selectedTemplate.recipient}</p>
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Subject:</label>
                <div className="p-3 bg-gray-100 rounded-lg">
                  <p className="text-gray-800">{selectedTemplate.subject}</p>
                </div>
              </div>

              {/* Message Body */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Message:</label>
                <div className="p-4 bg-gray-100 rounded-lg border-2 border-gray-200">
                  <p className="text-gray-800 whitespace-pre-line text-sm leading-relaxed">
                    {selectedTemplate.body}
                  </p>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  💡 Tip: You can customize this message when sending via email
                </p>
              </div>

              {/* Send Options */}
              <div className="border-t pt-6">
                <p className="text-sm font-semibold text-gray-700 mb-4">Choose How to Send:</p>
                <div className="grid grid-cols-1 gap-3">
                  {/* Email Option */}
                  <a
                    href={`mailto:${hodContact.email}?subject=${encodeURIComponent(selectedTemplate.subject)}&body=${encodeURIComponent(selectedTemplate.body)}`}
                    className="flex items-center gap-4 p-4 bg-blue-50 border-2 border-blue-200 rounded-xl hover:border-blue-400 hover:shadow-md transition group"
                  >
                    <div className="p-3 bg-blue-600 rounded-lg">
                      <Mail className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-800">Send via Email</h4>
                      <p className="text-xs text-gray-600">Opens your email app with pre-filled message</p>
                    </div>
                    <ExternalLink className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition" />
                  </a>

                  {/* WhatsApp Option */}
                  <a
                    href={`https://wa.me/${hodContact.phone.replace(/\D/g, '')}?text=${encodeURIComponent(selectedTemplate.body)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-4 p-4 bg-green-50 border-2 border-green-200 rounded-xl hover:border-green-400 hover:shadow-md transition group"
                  >
                    <div className="p-3 bg-green-600 rounded-lg">
                      <MessageCircle className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-800">Send via WhatsApp</h4>
                      <p className="text-xs text-gray-600">Opens WhatsApp with pre-filled message</p>
                    </div>
                    <ExternalLink className="w-5 h-5 text-gray-400 group-hover:text-green-600 transition" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </>
    )}
  </AnimatePresence>
</div>


            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-gray-200 px-8 py-4">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center gap-6">
              <span>Last Updated: {new Date().toLocaleString()}</span>
              <span>•</span>
              <span>Academic Year: 2025-2026</span>
              <span>•</span>
              <span>Semester 7</span>
            </div>
            <div className="flex items-center gap-2">
              <span>IoT Attendance System v2.0</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default ParentDashboard;