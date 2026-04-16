import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { database } from '../firebase/config';
import { ref, onValue, set } from 'firebase/database';
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// IoT Department Students (Same as Faculty Dashboard)
const IOT_B_STUDENTS = {
  '2200331550125': {
    name: 'VANSH TYAGI',
    email: '26iobrish@rkgit.edu.in',
    phone: '+91-9013187059'
  },
  '2200331550103': {
    name: 'SHITANSHU',
    email: 'shitanshu0821@gmail.com',
    phone: '+91-9355364964'
  },
  '2200331550083': {
    name: 'RAJ SINGH',
    email: '26ioparaj@rkgit.edu.in',
    phone: '+91-8957863867'
  }
};

// Animated Counter Component
const AnimatedCounter = ({ end, duration = 2000, suffix = '', className = '' }) => {
  const [count, setCount] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const prevEndRef = useRef(end);

  useEffect(() => {
    if (prevEndRef.current !== end) {
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), duration);
      prevEndRef.current = end;
    }

    const startTime = Date.now();
    const startValue = count;
    const endValue = parseFloat(end);

    const animate = () => {
      const now = Date.now();
      const progress = Math.min((now - startTime) / duration, 1);
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const current = startValue + (endValue - startValue) * easeOutQuart;

      setCount(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setCount(endValue);
      }
    };

    requestAnimationFrame(animate);
  }, [end, duration]);

  return (
    <span className={`${className} ${isAnimating ? 'scale-110' : ''} transition-transform duration-300`}>
      {Math.round(count)}{suffix}
    </span>
  );
};

// Student Detail Modal Component
const StudentDetailModal = ({ isOpen, onClose, students, title, type }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-3xl text-gray-500 hover:text-red-600 transition-colors"
          >
            ×
          </button>
        </div>

        {students.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-xl text-gray-600">No students in this category</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {students.map((student) => (
              <div 
                key={student.id} 
                className={`p-6 rounded-xl border-2 hover:shadow-xl transition-all ${
                  type === 'present' ? 'border-green-200 bg-green-50' :
                  type === 'absent' ? 'border-red-200 bg-red-50' :
                  type === 'atrisk' ? 'border-orange-200 bg-orange-50' :
                  'border-gray-200'
                }`}
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold ${
                    type === 'present' ? 'bg-green-200 text-green-800' :
                    type === 'absent' ? 'bg-red-200 text-red-800' :
                    type === 'atrisk' ? 'bg-orange-200 text-orange-800' :
                    'bg-blue-200 text-blue-800'
                  }`}>
                    {student.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-800">{student.name}</h3>
                    <p className="text-sm text-gray-600 font-mono">{student.id}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-blue-600">📧</span>
                    <a href={`mailto:${student.email}`} className="text-sm text-blue-600 hover:underline">
                      {student.email}
                    </a>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-green-600">📞</span>
                    <span className="text-sm text-gray-700">{student.phone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-purple-600">📊</span>
                    <span className="text-sm font-semibold">
                      Attendance: <span className={student.overall >= 75 ? 'text-green-600' : 'text-red-600'}>
                        {student.overall}%
                      </span>
                    </span>
                  </div>
                </div>

                {student.subjects && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-xs text-gray-500 mb-2">Subject-wise Attendance:</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(student.subjects).map(([subject, percent]) => (
                        <span key={subject} className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          percent >= 75 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {subject}: {percent}%
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

function AdminDashboard() {
  const navigate = useNavigate();
  const [totalStudents, setTotalStudents] = useState(0);
  const [avgAttendance, setAvgAttendance] = useState(0);
  const [presentToday, setPresentToday] = useState(0);
  const [absentToday, setAbsentToday] = useState(0);
  const [atRiskCount, setAtRiskCount] = useState(0);
  const [safeCount, setSafeCount] = useState(0);
  const [studentDetails, setStudentDetails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeSection, setActiveSection] = useState('dashboard');

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [modalData, setModalData] = useState({ students: [], title: '', type: '' });
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showStudentModal, setShowStudentModal] = useState(false);
  // Faculty Management States
  const [facultyList, setFacultyList] = useState([]);
  const [showAddFacultyModal, setShowAddFacultyModal] = useState(false);
  const [showEditFacultyModal, setShowEditFacultyModal] = useState(false);
  const [selectedFaculty, setSelectedFaculty] = useState(null);
  const [showFacultyPerformance, setShowFacultyPerformance] = useState(false);
  const [facultyPerformanceData, setFacultyPerformanceData] = useState(null);

  // Settings States
  const [hodInfo, setHodInfo] = useState({
    name: 'Mr. Lalit Saraswat',
    email: 'lalit.saraswat@rkgit.edu.in',
    phone: '+91-9876543210',
    department: 'Internet of Things (IoT) Engineering',
    academicYear: '2024-25'
  });
  const [isEditingHod, setIsEditingHod] = useState(false);


  const [newFaculty, setNewFaculty] = useState({
    name: '',
    email: '',
    phone: '',
    subjects: [],
    semester: ''
  });



  useEffect(() => {
  // Fetch TODAY's attendance from attendance/daily/{today's date}
  const today = new Date().toISOString().split('T')[0]; // "2025-10-22"
  const todayAttendanceRef = ref(database, `attendance/daily/${today}`);
  const summaryRef = ref(database, 'attendance/summary');
  
  // Fetch today's attendance
  onValue(todayAttendanceRef, (snapshot) => {
    const todayData = snapshot.val();
    
    if (todayData) {
      // Use Firebase metadata if available
      const presentCount = todayData.present_count || 0;
      const absentCount = todayData.absent_count || 0;
      
      setPresentToday(presentCount);
      setAbsentToday(absentCount);
      
      console.log(`Today (${today}): ${presentCount} present, ${absentCount} absent`);
    } else {
      // No attendance data for today
      setPresentToday(0);
      setAbsentToday(3);
    }
  });
  
  // Fetch overall student data from attendance/summary
  onValue(summaryRef, (snapshot) => {
    const data = snapshot.val();
    
    if (data) {
      const students = Object.keys(IOT_B_STUDENTS).map(studentId => {
        const studentInfo = IOT_B_STUDENTS[studentId];
        const studentData = data[studentId];
        
        if (!studentData) {
          return {
            id: studentId,
            name: studentInfo.name,
            email: studentInfo.email,
            phone: studentInfo.phone,
            overall: 0,
            subjects: {},
            presentToday: false,
            present: 0,
            total: 0,
            absent: 0
          };
        }
        
        const overall = studentData.overall_percentage || 0;
        const present = studentData.present_days || 0;
        const absent = studentData.absent_days || 0;
        
        // Check if present today
        const attendanceHistory = studentData.attendance_history || {};
        const presentToday = attendanceHistory[today] === 'Present';
        
        return {
          id: studentId,
          name: studentInfo.name,
          email: studentInfo.email,
          phone: studentInfo.phone,
          overall,
          subjects: studentData.subjects || {},
          presentToday,
          present,
          total: present + absent,
          absent
        };
      });
      
      setStudentDetails(students);
      setTotalStudents(students.length);
      
      // Calculate stats
      const avgAtt = students.reduce((sum, s) => sum + s.overall, 0) / students.length;
      setAvgAttendance(avgAtt.toFixed(1));
      
      const atRisk = students.filter(s => s.overall < 75).length;
      setAtRiskCount(atRisk);
      setSafeCount(students.length - atRisk);
    }
    
    setLoading(false);
  });
}, []);

// Fetch Faculty List from Users (Auto-detect teachers)
useEffect(() => {
  const usersRef = ref(database, 'users');
  
  onValue(usersRef, (snapshot) => {
    const data = snapshot.val();
    
    if (data) {
      // Filter users with role='teacher' or role='faculty'
      const facultyArray = Object.entries(data)
        .filter(([id, user]) => user.role === 'teacher' || user.role === 'faculty')
        .map(([id, user]) => ({
          id,
          name: user.name || user.username || 'Faculty Member',
          email: user.email || 'N/A',
          phone: user.phone || 'N/A',
          subjects: user.subjects || [],
          semester: user.semester || 'N/A',
          department: user.department || 'N/A',
          role: user.role,
          status: user.status || 'active'
        }));
      
      setFacultyList(facultyArray);
      console.log('✅ Found faculty members:', facultyArray);
    } else {
      setFacultyList([]);
    }
  });
}, []);






  const COLORS = ['#10b981', '#ef4444'];

 



  const getDefaulterData = () => {
    return [
      { name: 'Safe (≥75%)', value: safeCount },
      { name: 'At Risk (<75%)', value: atRiskCount }
    ];
  };

  

  const openModal = (type) => {
    let filteredStudents = [];
    let title = '';
    
    switch(type) {
      case 'total':
        filteredStudents = studentDetails;
        title = `📊 All IoT Department Students (${totalStudents})`;
        break;
      case 'present':
        filteredStudents = studentDetails.filter(s => s.presentToday);
        title = `✅ Students Present Today (${presentToday})`;
        break;
      case 'absent':
        filteredStudents = studentDetails.filter(s => !s.presentToday);
        title = `❌ Students Absent Today (${absentToday})`;
        break;
      case 'atrisk':
        filteredStudents = studentDetails.filter(s => s.overall < 75);
        title = `⚠️ Students At Risk - Below 75% (${atRiskCount})`;
        break;
      case 'safe':
        filteredStudents = studentDetails.filter(s => s.overall >= 75);
        title = `✅ Safe Students - Above 75% (${safeCount})`;
        break;
      default:
        filteredStudents = studentDetails;
        title = 'Student Details';
    }
    
    setModalData({ students: filteredStudents, title, type });
    setShowModal(true);
  };

  // Faculty Management Handlers
const handleAddFaculty = async () => {
  if (!newFaculty.name || !newFaculty.email || !newFaculty.phone) {
    alert('Please fill all required fields!');
    return;
  }

  try {
    const facultyId = `faculty_${Date.now()}`;
    const facultyRef = ref(database, `faculty/${facultyId}`);
    
    await set(facultyRef, {
      name: newFaculty.name,
      email: newFaculty.email,
      phone: newFaculty.phone,
      subjects: newFaculty.subjects,
      semester: newFaculty.semester,
      createdAt: Date.now()
    });

    alert('✅ Faculty added successfully!');
    setShowAddFacultyModal(false);
    setNewFaculty({
      name: '',
      email: '',
      phone: '',
      subjects: [],
      semester: ''
    });
  } catch (error) {
    alert('❌ Error adding faculty: ' + error.message);
  }
};

const handleEditFaculty = async () => {
  if (!selectedFaculty) return;

  try {
    // Update in users collection (not faculty collection)
    const userRef = ref(database, `users/${selectedFaculty.id}`);
    
    await set(userRef, {
      name: selectedFaculty.name,
      email: selectedFaculty.email,
      phone: selectedFaculty.phone,
      subjects: selectedFaculty.subjects,
      semester: selectedFaculty.semester,
      department: selectedFaculty.department || 'Computer Science',
      role: selectedFaculty.role || 'teacher',
      status: selectedFaculty.status || 'active',
      username: selectedFaculty.name?.toLowerCase().replace(' ', '') || 'teacher',
      password: 'teacher123', // Keep existing password
      user_id: selectedFaculty.id,
      updated_at: new Date().toISOString()
    });

    alert('✅ Faculty updated successfully!');
    setShowEditFacultyModal(false);
    setSelectedFaculty(null);
  } catch (error) {
    alert('❌ Error updating faculty: ' + error.message);
  }
};


const handleDeleteFaculty = async (facultyId) => {
  try {
    const facultyRef = ref(database, `faculty/${facultyId}`);
    await set(facultyRef, null);
    
    alert('✅ Faculty removed successfully!');
  } catch (error) {
    alert('❌ Error removing faculty: ' + error.message);
  }
};

// Export Functions
const handleExportToPDF = () => {
  // Create a printable HTML for PDF
  const printContent = `
    <html>
      <head>
        <title>IoT Department - Attendance Report</title>
        <style>
          body { font-family: Arial; padding: 40px; }
          h1 { color: #3B82F6; text-align: center; }
          h2 { color: #6B7280; margin-top: 30px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
          th { background-color: #3B82F6; color: white; }
          .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin: 30px 0; }
          .stat-card { border: 2px solid #3B82F6; padding: 20px; border-radius: 10px; text-align: center; }
          .stat-value { font-size: 36px; font-weight: bold; color: #3B82F6; }
        </style>
      </head>
      <body>
        <h1>📊 IoT Department - Attendance Report</h1>
        <p style="text-align: center; color: #6B7280;">Generated on: ${new Date().toLocaleDateString()}</p>
        
        <div class="stats">
          <div class="stat-card">
            <div class="stat-value">${totalStudents}</div>
            <div>Total Students</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${presentToday}</div>
            <div>Present Today</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${absentToday}</div>
            <div>Absent Today</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${avgAttendance}%</div>
            <div>Average Attendance</div>
          </div>
        </div>

        <h2>📋 Student Attendance Details</h2>
        <table>
          <thead>
            <tr>
              <th>Student ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Overall %</th>
              <th>Today Status</th>
            </tr>
          </thead>
          <tbody>
            ${studentDetails.map(student => `
              <tr>
                <td>${student.id}</td>
                <td>${student.name}</td>
                <td>${student.email}</td>
                <td>${student.phone}</td>
                <td>${student.overall}%</td>
                <td>${student.presentToday ? '✅ Present' : '❌ Absent'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
    </html>
  `;

  // Open print dialog with the content
  const printWindow = window.open('', '', 'width=800,height=600');
  printWindow.document.write(printContent);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
  printWindow.close();
  
  alert('✅ PDF ready! Use "Save as PDF" in the print dialog.');
};


const handleExportToExcel = () => {
  // Create CSV data
  const csvData = [
    ['Student ID', 'Name', 'Email', 'Phone', 'Overall Attendance', 'Today Status'],
    ...studentDetails.map(student => [
      student.id,
      student.name,
      student.email,
      student.phone,
      `${student.overall}%`,
      student.presentToday ? 'Present' : 'Absent'
    ])
  ];

  // Convert to CSV string
  const csvContent = csvData.map(row => row.join(',')).join('\n');
  
  // Create download link
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `IoT_Attendance_Report_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  
  alert('✅ Excel/CSV file downloaded successfully!');
};

const handlePrintReport = () => {
  window.print();
};




    // Students View - Shows all IoT students with details
  


  // Add this BEFORE the renderDashboardContent function (around line 100)

// Advanced Attendance Trend Component
  // Advanced Attendance Trend Component
// Advanced Attendance Trend Component - COMPLETELY FIXED
const AttendanceTrendCard = ({ studentDetails }) => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear] = useState(new Date().getFullYear());
  const [viewMode, setViewMode] = useState('daily');
  const [showDetailModal, setShowDetailModal] = useState(false);

  const [dailyAttendanceData, setDailyAttendanceData] = useState({});

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Fetch REAL attendance data from Firebase - WITH DEBUG LOGS
useEffect(() => {
  const attendanceRef = ref(database, 'attendance/daily');
  
  const unsubscribe = onValue(attendanceRef, (snapshot) => {
    const data = snapshot.val();
    const dailyData = {};
    const today = new Date().toISOString().split('T')[0];
    
    console.log('TODAY IS:', today); // Should print "2025-10-22"
    
    if (data) {
      const totalStudents = 3;
      
      Object.entries(data).forEach(([date, dateData]) => {
        console.log(`Checking date: ${date}, Is past/today? ${date <= today}`);
        
        if (date.match(/^\d{4}-\d{2}-\d{2}$/) && date <= today) {
          if (dateData.present_count !== undefined && dateData.present_count !== null) {
            console.log(`✅ Adding ${date}: present=${dateData.present_count}`);
            dailyData[date] = {
              present: dateData.present_count,
              absent: dateData.absent_count || (totalStudents - dateData.present_count),
              percentage: dateData.attendance_percentage || Math.round((dateData.present_count / totalStudents) * 100)
            };
          }
        } else {
          console.log(`❌ Skipping ${date} (future date or invalid)`);
        }
      });
    }
    
    console.log('FINAL dailyData:', dailyData);
    setDailyAttendanceData(dailyData);
  });

  return () => unsubscribe();
}, []);




  // Get days in selected month (excluding Sat/Sun)
  // Get days in selected month excluding Sat/Sun - ONLY UP TO TODAY
const getDaysInMonth = () => {
  const year = selectedYear;
  const month = selectedMonth;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weekdayDates = [];
  
  // Get today's date for comparison
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset time to midnight for accurate comparison
  
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    date.setHours(0, 0, 0, 0); // Reset time
    
    const dayOfWeek = date.getDay();
    
    // Only include weekdays (Mon-Fri) AND dates <= today
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && date <= today) {
      weekdayDates.push({
        day,
        date: date.toISOString().split('T')[0],
        dayName: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek]
      });
    }
  }
  
  console.log('📅 getDaysInMonth - Valid dates:', weekdayDates.map(d => d.date));
  return weekdayDates;
};

// Calculate attendance for each day
const getAttendanceData = () => {
  const weekdays = getDaysInMonth(); // Already filtered to past dates only
  const totalStudents = 3;
  
  console.log('=== getAttendanceData DEBUG ===');
  console.log('📊 Processing dates:', weekdays.map(d => d.date));
  console.log('🔥 Firebase data keys:', Object.keys(dailyAttendanceData));
  
  const result = weekdays.map(({ day, date }) => {
    const dayData = dailyAttendanceData[date];
    
    console.log(`📌 Date ${date}:`, dayData ? `✅ ${dayData.present} present` : '❌ No data');
    
    if (!dayData || dayData.present === undefined) {
      return {
        day,
        date,
        attendance: 0,
        present: 0,
        absent: totalStudents,
        hasData: false
      };
    }
    
    return {
      day,
      date,
      attendance: dayData.percentage,
      present: dayData.present,
      absent: dayData.absent,
      hasData: true
    };
  });
  
  console.log('✅ Final result:', result);
  return result;
};



  // Group by week
  const getWeeklyData = () => {
    const dailyData = getAttendanceData().filter(d => d.hasData); // Only include dates with data
    const weeks = [];
    let currentWeek = [];
    let weekNumber = 1;
    
    dailyData.forEach((day, index) => {
      currentWeek.push(day);
      
      if (currentWeek.length === 5 || index === dailyData.length - 1) {
        const avgAttendance = Math.round(
          currentWeek.reduce((sum, d) => sum + d.attendance, 0) / currentWeek.length
        );
        
        weeks.push({
          week: `Week ${weekNumber}`,
          attendance: avgAttendance,
          days: currentWeek.length
        });
        
        currentWeek = [];
        weekNumber++;
      }
    });
    
    return weeks;
  };

  const chartData = viewMode === 'daily' ? getAttendanceData() : getWeeklyData();

  return (
    <>
      <div className="bg-white rounded-2xl shadow-2xl p-6 transform hover:shadow-3xl transition-all duration-300">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            📈 Attendance Trend
          </h2>
          <button
            onClick={() => setShowDetailModal(true)}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all text-sm font-semibold"
          >
            🔍 View Details
          </button>
        </div>

        {/* Month Selector */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          {months.map((month, index) => (
            <button
              key={month}
              onClick={() => setSelectedMonth(index)}
              className={`px-4 py-2 rounded-lg font-semibold text-sm whitespace-nowrap transition-all ${
                selectedMonth === index
                  ? 'bg-purple-600 text-white shadow-lg'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {month.slice(0, 3)}
            </button>
          ))}
        </div>

        {/* View Mode Toggle */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setViewMode('daily')}
            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
              viewMode === 'daily'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            📅 Daily View
          </button>
          <button
            onClick={() => setViewMode('weekly')}
            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
              viewMode === 'weekly'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            📊 Weekly View
          </button>
        </div>

        {/* Chart */}
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
            <XAxis 
              dataKey={viewMode === 'daily' ? 'day' : 'week'} 
              label={{ value: viewMode === 'daily' ? 'Date' : 'Week', position: 'insideBottom', offset: -5 }}
            />
            <YAxis label={{ value: 'Attendance %', angle: -90, position: 'insideLeft' }} domain={[0, 100]} />
            <Tooltip 
              contentStyle={{
                backgroundColor: '#1f2937',
                border: 'none',
                borderRadius: '8px',
                color: 'white'
              }}
              formatter={(value) => [`${value}%`, 'Attendance']}
            />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="attendance" 
              stroke="#8b5cf6" 
              strokeWidth={3} 
              name="Attendance %" 
              dot={(props) => {
                const { payload } = props;
                if (viewMode === 'daily') {
                  return (
                    <circle
                      {...props}
                      r={payload.hasData ? 6 : 3}
                      fill={payload.hasData ? '#8b5cf6' : '#d1d5db'}
                    />
                  );
                }
                return <circle {...props} r={6} fill="#8b5cf6" />;
              }}
              activeDot={{ r: 8 }}
            />
          </LineChart>
        </ResponsiveContainer>

        <p className="text-sm text-gray-500 mt-2 text-center">
          Showing {months[selectedMonth]} {selectedYear} • {viewMode === 'daily' ? 'Weekdays only' : 'Weekly average'} (Sat/Sun excluded)
        </p>
      </div>

      {/* Detailed Modal */}
      {showDetailModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                📊 Detailed Attendance Report - {months[selectedMonth]} {selectedYear}
              </h2>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-3xl text-gray-500 hover:text-red-600 transition-colors"
              >
                ×
              </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="p-4 bg-blue-50 rounded-xl border-2 border-blue-200">
                <p className="text-sm text-gray-600 mb-1">Total Days</p>
                <p className="text-3xl font-bold text-blue-600">{getDaysInMonth().length}</p>
                <p className="text-xs text-gray-500 mt-1">Working days</p>
              </div>
              <div className="p-4 bg-green-50 rounded-xl border-2 border-green-200">
                <p className="text-sm text-gray-600 mb-1">Avg Attendance</p>
                <p className="text-3xl font-bold text-green-600">
                  {getAttendanceData().filter(d => d.hasData).length > 0 
                    ? Math.round(getAttendanceData().filter(d => d.hasData).reduce((sum, d) => sum + d.attendance, 0) / getAttendanceData().filter(d => d.hasData).length)
                    : 0}%
                </p>
                <p className="text-xs text-gray-500 mt-1">This month</p>
              </div>
              <div className="p-4 bg-orange-50 rounded-xl border-2 border-orange-200">
                <p className="text-sm text-gray-600 mb-1">Peak Day</p>
                <p className="text-3xl font-bold text-orange-600">
                  {getAttendanceData().filter(d => d.hasData).length > 0 
                    ? Math.max(...getAttendanceData().filter(d => d.hasData).map(d => d.attendance))
                    : 0}%
                </p>
                <p className="text-xs text-gray-500 mt-1">Highest attendance</p>
              </div>
              <div className="p-4 bg-purple-50 rounded-xl border-2 border-purple-200">
                <p className="text-sm text-gray-600 mb-1">Days Recorded</p>
                <p className="text-3xl font-bold text-purple-600">
                  {getAttendanceData().filter(d => d.hasData).length}
                </p>
                <p className="text-xs text-gray-500 mt-1">Out of {getDaysInMonth().length}</p>
              </div>
            </div>

            {/* Daily Breakdown Table */}
            <div className="bg-gray-50 rounded-xl p-6">
              <h3 className="text-xl font-bold mb-4">📅 Day-by-Day Breakdown</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
                    <tr>
                      <th className="px-4 py-3 text-left rounded-tl-xl">Date</th>
                      <th className="px-4 py-3 text-center">Present</th>
                      <th className="px-4 py-3 text-center">Absent</th>
                      <th className="px-4 py-3 text-center">Attendance %</th>
                      <th className="px-4 py-3 text-center rounded-tr-xl">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getAttendanceData().map((day, index) => (


                      <tr 
                        key={day.day}
                        className={`border-b hover:bg-purple-50 transition-all ${
                          index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                        } ${!day.hasData ? 'opacity-40' : ''}`}
                      >
                        <td className="px-4 py-3 font-semibold">
                          {months[selectedMonth]} {day.day}, {selectedYear}
                          {!day.hasData && <span className="ml-2 text-xs text-gray-400">(No data)</span>}
                        </td>
                        <td className="px-4 py-3 text-center text-green-600 font-bold">
                          {day.present}
                        </td>
                        <td className="px-4 py-3 text-center text-red-600 font-bold">
                          {day.absent}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                            day.attendance >= 75 
                              ? 'bg-green-100 text-green-800' 
                              : day.attendance > 0
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {day.attendance}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {day.hasData 
                            ? (day.attendance >= 75 ? '✅ Good' : '⚠️ Low')
                            : '❌ No data'
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Export Buttons */}
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => alert('Export functionality coming soon')}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all font-semibold"
              >
                📊 Export to Excel
              </button>
              <button
                onClick={() => alert('Export functionality coming soon')}
                className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all font-semibold"
              >
                📄 Export to PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};


    const renderDashboardContent = () => (
    <>
      {/* Stats Cards - NOW CLICKABLE */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <div 
          onClick={() => openModal('total')}
          className="bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 text-white rounded-2xl p-6 shadow-2xl transform hover:scale-105 hover:shadow-3xl transition-all duration-300 cursor-pointer"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white/90 text-sm font-semibold uppercase tracking-wide">Total Students</h3>
            <span className="text-4xl">👥</span>
          </div>
          <AnimatedCounter 
            end={totalStudents} 
            className="text-6xl font-bold block mb-2"
          />
          <p className="text-white/80 text-sm">IoT Department (Click to view)</p>
          <div className="mt-4 h-1 bg-white/20 rounded-full">
            <div className="h-1 bg-white rounded-full w-full"></div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 via-green-600 to-green-700 text-white rounded-2xl p-6 shadow-2xl transform hover:scale-105 hover:shadow-3xl transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white/90 text-sm font-semibold uppercase tracking-wide">Avg Attendance</h3>
            <span className="text-4xl">📊</span>
          </div>
          <AnimatedCounter 
            end={avgAttendance} 
            suffix="%" 
            className="text-6xl font-bold block mb-2"
          />
          <p className="text-white/80 text-sm">
            {avgAttendance >= 75 ? '✅ Excellent' : '⚠️ Needs Improvement'}
          </p>
          <div className="mt-4 h-1 bg-white/20 rounded-full">
            <div className="h-1 bg-white rounded-full" style={{width: `${avgAttendance}%`}}></div>
          </div>
        </div>

        <div 
          onClick={() => openModal('atrisk')}
          className="bg-gradient-to-br from-orange-500 via-orange-600 to-red-600 text-white rounded-2xl p-6 shadow-2xl transform hover:scale-105 hover:shadow-3xl transition-all duration-300 cursor-pointer"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white/90 text-sm font-semibold uppercase tracking-wide">At Risk Students</h3>
            <span className="text-4xl">⚠️</span>
          </div>
          <AnimatedCounter 
            end={atRiskCount} 
            className="text-6xl font-bold block mb-2"
          />
          <p className="text-white/80 text-sm">Below 75% (Click to view)</p>
          <div className="mt-4 h-1 bg-white/20 rounded-full">
            <div className="h-1 bg-white rounded-full animate-pulse" style={{width: `${(atRiskCount/totalStudents)*100}%`}}></div>
          </div>
        </div>

        <div 
          onClick={() => openModal('safe')}
          className="bg-gradient-to-br from-purple-500 via-purple-600 to-indigo-600 text-white rounded-2xl p-6 shadow-2xl transform hover:scale-105 hover:shadow-3xl transition-all duration-300 cursor-pointer"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white/90 text-sm font-semibold uppercase tracking-wide">Safe Students</h3>
            <span className="text-4xl">✅</span>
          </div>
          <AnimatedCounter 
            end={safeCount} 
            className="text-6xl font-bold block mb-2"
          />
          <p className="text-white/80 text-sm">≥75% (Click to view)</p>
          <div className="mt-4 h-1 bg-white/20 rounded-full">
            <div className="h-1 bg-white rounded-full" style={{width: `${(safeCount/totalStudents)*100}%`}}></div>
          </div>
        </div>
      </div>

      {/* Today's Attendance Cards - CLICKABLE */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div 
          onClick={() => openModal('present')}
          className="bg-white rounded-2xl p-6 shadow-2xl hover:shadow-3xl transition-all cursor-pointer border-4 border-green-200"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-semibold mb-2">✅ Present Today</p>
              <AnimatedCounter 
                end={presentToday} 
                className="text-5xl font-bold text-green-600"
              />
              <p className="text-sm text-gray-500 mt-2">Click to view details</p>
            </div>
            <div className="text-6xl">✅</div>
          </div>
        </div>

        <div 
          onClick={() => openModal('absent')}
          className="bg-white rounded-2xl p-6 shadow-2xl hover:shadow-3xl transition-all cursor-pointer border-4 border-red-200"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-semibold mb-2">❌ Absent Today</p>
              <AnimatedCounter 
                end={absentToday} 
                className="text-5xl font-bold text-red-600"
              />
              <p className="text-sm text-gray-500 mt-2">Click to view details</p>
            </div>
            <div className="text-6xl">❌</div>
          </div>
        </div>
      </div>

      {/* Charts - Full Width */}
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
  <div className="bg-white rounded-2xl shadow-2xl p-6 transform hover:shadow-3xl transition-all duration-300">
    <h2 className="text-2xl font-bold mb-4 bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
      🥧 Risk Distribution
    </h2>
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={getDefaulterData()}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={(entry) => `${entry.name}: ${entry.value}`}
          outerRadius={100}
          fill="#8884d8"
          dataKey="value"
        >
          {getDefaulterData().map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  </div>

  <AttendanceTrendCard studentDetails={studentDetails} />
</div>


      {/* Quick Stats Summary */}
      <div className="bg-white rounded-2xl shadow-2xl p-6">
        <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
          📋 Quick Summary
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-blue-50 rounded-xl">
            <p className="text-3xl font-bold text-blue-600">{totalStudents}</p>
            <p className="text-sm text-gray-600 mt-2">Total Students</p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-xl">
            <p className="text-3xl font-bold text-green-600">{presentToday}</p>
            <p className="text-sm text-gray-600 mt-2">Present Today</p>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-xl">
            <p className="text-3xl font-bold text-red-600">{absentToday}</p>
            <p className="text-sm text-gray-600 mt-2">Absent Today</p>
          </div>
          <div className="text-center p-4 bg-orange-50 rounded-xl">
            <p className="text-3xl font-bold text-orange-600">{atRiskCount}</p>
            <p className="text-sm text-gray-600 mt-2">At Risk</p>
          </div>
        </div>
      </div>
    </>
  );

    // Students View - Shows all IoT students with details
  const renderStudentsView = () => {
    return (
      <div className="flex-1 p-8 bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 min-h-screen">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            👥 Students Management
          </h1>
          <p className="text-gray-600">IoT Department - B Section (2024-25)</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-xl p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm mb-1">Total Students</p>
                <p className="text-3xl font-bold text-blue-600">{totalStudents}</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-full">
                <span className="text-3xl">👥</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm mb-1">Present Today</p>
                <p className="text-3xl font-bold text-green-600">{presentToday}</p>
              </div>
              <div className="bg-green-100 p-3 rounded-full">
                <span className="text-3xl">✅</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-6 border-l-4 border-red-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm mb-1">Absent Today</p>
                <p className="text-3xl font-bold text-red-600">{absentToday}</p>
              </div>
              <div className="bg-red-100 p-3 rounded-full">
                <span className="text-3xl">❌</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-6 border-l-4 border-purple-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm mb-1">Avg Attendance</p>
                <p className="text-3xl font-bold text-purple-600">{avgAttendance}%</p>
              </div>
              <div className="bg-purple-100 p-3 rounded-full">
                <span className="text-3xl">📊</span>
              </div>
            </div>
          </div>
        </div>

        {/* Students Table */}
        <div className="bg-white rounded-2xl shadow-2xl p-6">
          <h2 className="text-2xl font-bold mb-6 text-gray-800">📋 Student List</h2>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                <tr>
                  <th className="px-6 py-4 text-left rounded-tl-xl">#</th>
                  <th className="px-6 py-4 text-left">Student ID</th>
                  <th className="px-6 py-4 text-left">Name</th>
                  <th className="px-6 py-4 text-left">Email</th>
                  <th className="px-6 py-4 text-left">Phone</th>
                  <th className="px-6 py-4 text-center">Overall %</th>
                  <th className="px-6 py-4 text-center">Today Status</th>
                  <th className="px-6 py-4 text-center rounded-tr-xl">Actions</th>
                </tr>
              </thead>
              <tbody>
                {studentDetails.map((student, index) => (
                  <tr 
                    key={student.id}
                    className={`border-b hover:bg-blue-50 transition-all ${
                      index % 2 === 0 ? 'bg-gray-50' : 'bg-white'
                    }`}
                  >
                    <td className="px-6 py-4 font-semibold">{index + 1}</td>
                    <td className="px-6 py-4 font-mono text-sm">{student.id}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                          {student.name.charAt(0)}
                        </div>
                        <span className="font-semibold">{student.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{student.email}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{student.phone}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                        student.overall >= 75 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {student.overall}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {student.presentToday ? (
                        <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold">
                          ✅ Present
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-semibold">
                          ❌ Absent
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button 
                        onClick={() => {
                          setSelectedStudent(student);
                          setShowStudentModal(true);
                        }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all text-sm font-semibold"
                      >
                        View Details
                      </button>

                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };


  // Faculty Management View
const renderFacultyView = () => {
  return (
    <>
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent mb-2">
              👨‍🏫 Faculty Management
            </h1>
            <p className="text-gray-600">IoT Department - Manage Teaching Staff</p>
          </div>
          <button
            onClick={() => setShowAddFacultyModal(true)}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all font-semibold flex items-center gap-2"
          >
            ➕ Add New Faculty
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-2xl shadow-xl p-6 border-l-4 border-orange-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm mb-1">Total Faculty</p>
              <p className="text-3xl font-bold text-orange-600">{facultyList.length}</p>
            </div>
            <div className="bg-orange-100 p-3 rounded-full">
              <span className="text-3xl">👨‍🏫</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm mb-1">Active Subjects</p>
              <p className="text-3xl font-bold text-blue-600">
                {[...new Set(facultyList.flatMap(f => f.subjects || []))].length}
              </p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <span className="text-3xl">📚</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm mb-1">Departments</p>
              <p className="text-3xl font-bold text-purple-600">1</p>
            </div>
            <div className="bg-purple-100 p-3 rounded-full">
              <span className="text-3xl">🏢</span>
            </div>
          </div>
        </div>
      </div>

      {/* Faculty Grid */}
      <div className="bg-white rounded-2xl shadow-2xl p-6">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">👥 Faculty Members</h2>
        
        {facultyList.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg mb-4">No faculty members yet</p>
            <button
              onClick={() => setShowAddFacultyModal(true)}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all font-semibold"
            >
              ➕ Add First Faculty
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {facultyList.map((faculty, index) => (
              <div
                key={faculty.id}
                className="bg-gradient-to-br from-orange-50 to-red-50 rounded-xl p-6 border-2 border-orange-200 hover:shadow-xl transition-all"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-red-500 rounded-full flex items-center justify-center text-white font-bold text-2xl">
                    {faculty.name?.charAt(0) || 'F'}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-800">{faculty.name}</h3>
                    <p className="text-sm text-gray-600">{faculty.email}</p>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-600">📱 Phone:</span>
                    <span className="font-semibold">{faculty.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-600">🎓 Semester:</span>
                    <span className="font-semibold">{faculty.semester || 'N/A'}</span>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-2">📚 Subjects:</p>
                  <div className="flex flex-wrap gap-2">
                    {faculty.subjects?.map((subject, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-semibold"
                      >
                        {subject}
                      </span>
                    )) || <span className="text-gray-400 text-xs">No subjects assigned</span>}
                  </div>
                </div>

                                <div className="flex flex-col gap-2">
                  {/* View Performance Button */}
                  <button
                    onClick={() => {
                      setFacultyPerformanceData(faculty);
                      setShowFacultyPerformance(true);
                    }}
                    className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all text-sm font-semibold"
                  >
                    📊 View Performance
                  </button>
                  
                  {/* Edit and Remove Buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSelectedFaculty(faculty);
                        setShowEditFacultyModal(true);
                      }}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all text-sm font-semibold"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`Are you sure you want to remove ${faculty.name}?`)) {
                          handleDeleteFaculty(faculty.id);
                        }
                      }}
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all text-sm font-semibold"
                    >
                      🗑️ Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};
// Analytics View - Comprehensive Analytics Dashboard
const renderAnalyticsView = () => {
  return (
    <>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-green-600 to-teal-600 bg-clip-text text-transparent mb-2">
          📊 Analytics Dashboard
        </h1>
        <p className="text-gray-600">Comprehensive IoT Department Analytics & Insights</p>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {/* Average Attendance */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-xl p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm opacity-90">Average Attendance</span>
            <span className="text-2xl">📈</span>
          </div>
          <p className="text-4xl font-bold">{avgAttendance}%</p>
          <p className="text-sm opacity-75 mt-2">This Month</p>
        </div>

        {/* Total Classes */}
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl shadow-xl p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm opacity-90">Total Classes</span>
            <span className="text-2xl">📚</span>
          </div>
          <p className="text-4xl font-bold">
            2

          </p>
          <p className="text-sm opacity-75 mt-2">Days Recorded</p>
        </div>

        {/* Active Students */}
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl shadow-xl p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm opacity-90">Active Students</span>
            <span className="text-2xl">👥</span>
          </div>
          <p className="text-4xl font-bold">{totalStudents}</p>
          <p className="text-sm opacity-75 mt-2">IoT Department</p>
        </div>

        {/* Success Rate */}
        <div className="bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl shadow-xl p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm opacity-90">Success Rate</span>
            <span className="text-2xl">🎯</span>
          </div>
          <p className="text-4xl font-bold">{safeCount}/{totalStudents}</p>
          <p className="text-sm opacity-75 mt-2">Above 75%</p>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Attendance Trend */}
        <div className="bg-white rounded-2xl shadow-2xl p-6">
          <h3 className="text-xl font-bold mb-4 text-gray-800">📈 Attendance Trend</h3>
          <div className="h-64 flex items-center justify-center text-gray-500">
            <p>Chart showing attendance over time</p>
          </div>
        </div>

        {/* Student Performance */}
        <div className="bg-white rounded-2xl shadow-2xl p-6">
          <h3 className="text-xl font-bold mb-4 text-gray-800">🎓 Student Performance</h3>
          <div className="space-y-3">
            {studentDetails.map((student, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                    {student.name.charAt(0)}
                  </div>
                  <span className="font-semibold">{student.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${
                        student.overall >= 75 ? 'bg-green-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${student.overall}%` }}
                    ></div>
                  </div>
                  <span className="font-bold text-sm">{student.overall}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

            {/* Department Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Top Performers */}
        <div className="bg-white rounded-2xl shadow-2xl p-6">
          <h3 className="text-xl font-bold mb-4 text-gray-800 flex items-center gap-2">
            🏆 Top Performers
          </h3>
          <div className="space-y-3">
            {studentDetails
              .sort((a, b) => b.overall - a.overall)
              .slice(0, 3)
              .map((student, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border-l-4 border-green-500">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold text-green-600">#{idx + 1}</span>
                    <div>
                      <p className="font-semibold text-gray-800">{student.name}</p>
                      <p className="text-xs text-gray-500">{student.id}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-green-600">{student.overall}%</p>
                    <p className="text-xs text-gray-500">Attendance</p>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* At Risk Students */}
        <div className="bg-white rounded-2xl shadow-2xl p-6">
          <h3 className="text-xl font-bold mb-4 text-gray-800 flex items-center gap-2">
            ⚠️ At Risk Students
          </h3>
          <div className="space-y-3">
            {studentDetails
              .filter(s => s.overall < 75)
              .map((student, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-gradient-to-r from-red-50 to-orange-50 rounded-lg border-l-4 border-red-500">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">⚠️</span>
                    <div>
                      <p className="font-semibold text-gray-800">{student.name}</p>
                      <p className="text-xs text-gray-500">{student.id}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-red-600">{student.overall}%</p>
                    <p className="text-xs text-gray-500">Needs Attention</p>
                  </div>
                </div>
              ))}
            {studentDetails.filter(s => s.overall < 75).length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <p className="text-4xl mb-2">🎉</p>
                <p>All students are doing well!</p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="bg-white rounded-2xl shadow-2xl p-6">
          <h3 className="text-xl font-bold mb-4 text-gray-800 flex items-center gap-2">
            📊 Quick Stats
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <span className="text-gray-700 font-semibold">Highest Attendance</span>
              <span className="text-2xl font-bold text-blue-600">
                {Math.max(...studentDetails.map(s => s.overall))}%
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
              <span className="text-gray-700 font-semibold">Lowest Attendance</span>
              <span className="text-2xl font-bold text-purple-600">
                {Math.min(...studentDetails.map(s => s.overall))}%
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <span className="text-gray-700 font-semibold">Total Faculty</span>
              <span className="text-2xl font-bold text-green-600">
                {facultyList.length}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
              <span className="text-gray-700 font-semibold">Classes Conducted</span>
              <span className="text-2xl font-bold text-orange-600">
                2

              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Export Options */}
      <div className="bg-white rounded-2xl shadow-2xl p-6">
        <h3 className="text-xl font-bold mb-4 text-gray-800">📥 Export Reports</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button 
            onClick={handleExportToPDF}
            className="px-6 py-4 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-all font-semibold flex items-center justify-center gap-2">
            📄 Export to PDF
          </button>
          <button
            onClick={handleExportToExcel}
            className="px-6 py-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition-all font-semibold flex items-center justify-center gap-2">
            📊 Export to Excel
          </button>
          <button
            onClick={handlePrintReport}
            className="px-6 py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all font-semibold flex items-center justify-center gap-2">
            🖨️ Print Report
          </button>
        </div>
      </div>

    </>
  );
};

// Reports View - Parent & Teacher Communication
const renderReportsView = () => {
  return (
    <>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent mb-2">
          📋 Reports & Communication
        </h1>
        <p className="text-gray-600">Contact Parents & Faculty for Performance Management</p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Contact Parents */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-2xl p-8 text-white">
          <div className="flex items-center gap-4 mb-4">
            <div className="text-5xl">👨‍👩‍👧‍👦</div>
            <div>
              <h2 className="text-2xl font-bold">Contact Parents</h2>
              <p className="text-blue-100">Send attendance reports to parents</p>
            </div>
          </div>
          <button 
            onClick={() => alert('📧 Parent contact feature!\n\nWill send attendance reports to all parents via email/SMS.')}
            className="w-full mt-4 px-6 py-3 bg-white text-blue-600 rounded-lg hover:bg-blue-50 transition-all font-semibold"
          >
            Send Reports to All Parents
          </button>
        </div>

        {/* Contact Faculty */}
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl shadow-2xl p-8 text-white">
          <div className="flex items-center gap-4 mb-4">
            <div className="text-5xl">👨‍🏫</div>
            <div>
              <h2 className="text-2xl font-bold">Contact Faculty</h2>
              <p className="text-purple-100">Discuss student performance</p>
            </div>
          </div>
          <button 
            onClick={() => {
              const choice = window.confirm('Schedule Faculty Meeting?\n\nOK = Google Meet\nCancel = Zoom');
              if (choice) {
                window.open('https://calendar.google.com/calendar/u/0/r/eventedit?text=Faculty%20Meeting%20-%20Performance%20Review', '_blank');
              } else {
                window.open('https://zoom.us/start/videomeeting', '_blank');
              }
            }}
            className="w-full mt-4 px-6 py-3 bg-white text-purple-600 rounded-lg hover:bg-purple-50 transition-all font-semibold"
          >
            Schedule Faculty Meeting
          </button>

        </div>
      </div>

      {/* At-Risk Students - Contact Parents */}
      <div className="bg-white rounded-2xl shadow-2xl p-6 mb-8">
        <h3 className="text-2xl font-bold mb-4 text-gray-800 flex items-center gap-2">
          ⚠️ At-Risk Students - Parent Contact Required
        </h3>
        <p className="text-gray-600 mb-4">Students below 75% attendance need immediate parent contact</p>
        
        <div className="space-y-3">
          {studentDetails.filter(s => s.overall < 75).length === 0 ? (
            <div className="text-center py-8 bg-green-50 rounded-lg">
              <p className="text-2xl mb-2">🎉</p>
              <p className="text-green-600 font-semibold">All students are performing well!</p>
            </div>
          ) : (
            studentDetails
              .filter(s => s.overall < 75)
              .map((student, idx) => (
                <div key={idx} className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center text-white font-bold text-xl">
                        {student.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-gray-800">{student.name}</p>
                        <p className="text-sm text-gray-600">{student.id}</p>
                        <p className="text-sm text-gray-600">📧 {student.email}</p>
                        <p className="text-sm text-gray-600">📱 {student.phone}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold text-red-600">{student.overall}%</p>
                      <p className="text-sm text-gray-600">Attendance</p>
                      <button 
                        onClick={() => {
                          const message = `Dear Parent,\n\nYour ward ${student.name} (${student.id}) has ${student.overall}% attendance which is below the required 75%.\n\nPlease contact HOD for discussion.\n\nContact: ${student.phone}\nEmail: ${student.email}`;
                          alert(message);
                          // In production: Send actual email/SMS
                        }}
                        className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all text-sm font-semibold"
                      >
                        📧 Contact Parent
                      </button>
                    </div>
                  </div>
                </div>
              ))
          )}
        </div>
      </div>

      {/* Faculty Consultation Requests */}
      <div className="bg-white rounded-2xl shadow-2xl p-6">
        <h3 className="text-2xl font-bold mb-4 text-gray-800 flex items-center gap-2">
          👨‍🏫 Faculty Subject Consultation
        </h3>
        <p className="text-gray-600 mb-4">Request consultations with faculty for subject-specific performance</p>
        
        <div className="space-y-3">
          {facultyList.map((faculty, idx) => (
            <div key={idx} className="bg-purple-50 border-2 border-purple-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold text-xl">
                    {faculty.name?.charAt(0) || 'F'}
                  </div>
                  <div>
                    <p className="font-bold text-gray-800">{faculty.name}</p>
                    <p className="text-sm text-gray-600">📧 {faculty.email}</p>
                    <p className="text-sm text-gray-600">📱 {faculty.phone}</p>
                    <div className="flex gap-2 mt-1">
                      {(faculty.subjects || []).map((subject, sidx) => (
                        <span key={sidx} className="px-2 py-1 bg-purple-200 text-purple-800 rounded text-xs font-semibold">
                          {subject}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      const choice = window.confirm(`Schedule meeting with ${faculty.name}?\n\nClick OK for Google Meet\nClick Cancel for Zoom Meeting`);
    
                      if (choice) {
                        // Google Meet
                        const googleMeetUrl = `https://meet.google.com/new`;
                        const subject = `Meeting with ${faculty.name} - Student Performance Review`;
                        const details = `Discuss student performance in subjects: ${(faculty.subjects || []).join(', ')}`;
      
                        // Open Google Calendar to create event
                        window.open(
                          `https://calendar.google.com/calendar/u/0/r/eventedit?text=${encodeURIComponent(subject)}&details=${encodeURIComponent(details)}`,
                          '_blank'
                        );
                      } else {
                        // Zoom
                        alert('📹 Zoom Meeting\n\nRedirecting to Zoom...\n\nCreate a meeting and share the link with:\n' + faculty.email);
                        window.open('https://zoom.us/start/videomeeting', '_blank');
                      }
                    }}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all text-sm font-semibold"
                  >
                    📅 Schedule Meeting
                  </button>

                  <button 
                    onClick={() => window.location.href = `mailto:${faculty.email}`}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all text-sm font-semibold"
                  >
                    📧 Send Email
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

// Settings View - System Configuration

  // Settings View - System Configuration
  const renderSettingsView = () => {
    const handleSaveHodInfo = () => {

    // Save to Firebase
    const hodRef = ref(database, 'hodInfo');
    set(hodRef, hodInfo)
      .then(() => {
        alert('✅ HOD information updated successfully!');
        setIsEditingHod(false);
      })
      .catch((error) => {
        alert('❌ Error updating: ' + error.message);
      });
  };

  return (
    <>
    

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-700 to-gray-900 bg-clip-text text-transparent mb-2">
          ⚙️ Settings
        </h1>
        <p className="text-gray-600">System Configuration & Preferences</p>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Department Information - EDITABLE */}
        <div className="bg-white rounded-2xl shadow-2xl p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              🏢 Department Information
            </h3>
            {!isEditingHod ? (
              <button
                onClick={() => setIsEditingHod(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all text-sm font-semibold"
              >
                ✏️ Edit
              </button>
            ) : (
              <button
                onClick={handleSaveHodInfo}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all text-sm font-semibold"
              >
                💾 Save
              </button>
            )}
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Department Name</label>
              <input
                type="text"
                value={hodInfo.department}
                onChange={(e) => setHodInfo({ ...hodInfo, department: e.target.value })}
                readOnly={!isEditingHod}
                className={`w-full px-4 py-3 border-2 border-gray-300 rounded-lg ${isEditingHod ? 'bg-white' : 'bg-gray-50'}`}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Academic Year</label>
              <input
                type="text"
                value={hodInfo.academicYear}
                onChange={(e) => setHodInfo({ ...hodInfo, academicYear: e.target.value })}
                readOnly={!isEditingHod}
                className={`w-full px-4 py-3 border-2 border-gray-300 rounded-lg ${isEditingHod ? 'bg-white' : 'bg-gray-50'}`}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">HOD Name</label>
              <input
                type="text"
                value={hodInfo.name}
                onChange={(e) => setHodInfo({ ...hodInfo, name: e.target.value })}
                readOnly={!isEditingHod}
                className={`w-full px-4 py-3 border-2 border-gray-300 rounded-lg ${isEditingHod ? 'bg-white' : 'bg-gray-50'}`}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">HOD Email</label>
              <input
                type="email"
                value={hodInfo.email}
                onChange={(e) => setHodInfo({ ...hodInfo, email: e.target.value })}
                readOnly={!isEditingHod}
                className={`w-full px-4 py-3 border-2 border-gray-300 rounded-lg ${isEditingHod ? 'bg-white' : 'bg-gray-50'}`}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">HOD Phone</label>
              <input
                type="tel"
                value={hodInfo.phone}
                onChange={(e) => setHodInfo({ ...hodInfo, phone: e.target.value })}
                readOnly={!isEditingHod}
                className={`w-full px-4 py-3 border-2 border-gray-300 rounded-lg ${isEditingHod ? 'bg-white' : 'bg-gray-50'}`}
              />
            </div>
          </div>
        </div>

        {/* System Preferences */}
        <div className="bg-white rounded-2xl shadow-2xl p-6">
          <h3 className="text-xl font-bold mb-4 text-gray-800 flex items-center gap-2">
            🎨 System Preferences
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-semibold text-gray-800">Email Notifications</p>
                <p className="text-sm text-gray-600">Receive attendance alerts</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-semibold text-gray-800">Auto Reports</p>
                <p className="text-sm text-gray-600">Weekly attendance reports</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-semibold text-gray-800">Dark Mode</p>
                <p className="text-sm text-gray-600">Enable dark theme</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  onChange={(e) => {
                    if (e.target.checked) {
                      alert('🌙 Dark Mode\n\nDark mode feature will be available in next update!');
                    }
                  }}
                  className="sr-only peer" 
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Account Management */}
        <div className="bg-white rounded-2xl shadow-2xl p-6">
          <h3 className="text-xl font-bold mb-4 text-gray-800 flex items-center gap-2">
            👤 Account Management
          </h3>
          <div className="space-y-3">
            <button 
              onClick={() => alert('🔑 Change Password\n\nRedirecting to password reset...')}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-semibold"
            >
              🔑 Change Password
            </button>
            <button 
              onClick={() => {
                const newEmail = prompt('Enter new email:', hodInfo.email);
                if (newEmail) {
                  setHodInfo({ ...hodInfo, email: newEmail });
                  handleSaveHodInfo();
                }
              }}
              className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all font-semibold"
            >
              📧 Update Email
            </button>
            <button 
              onClick={() => {
                const newPhone = prompt('Enter new phone:', hodInfo.phone);
                if (newPhone) {
                  setHodInfo({ ...hodInfo, phone: newPhone });
                  handleSaveHodInfo();
                }
              }}
              className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all font-semibold"
            >
              📱 Update Phone
            </button>
          </div>
        </div>

        {/* System Info */}
        <div className="bg-white rounded-2xl shadow-2xl p-6">
          <h3 className="text-xl font-bold mb-4 text-gray-800 flex items-center gap-2">
            ℹ️ System Information
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-600">Version</span>
              <span className="font-semibold">v1.0.0</span>
            </div>
            <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-600">Last Updated</span>
              <span className="font-semibold">Oct 23, 2025</span>
            </div>
            <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-600">Database</span>
              <span className="font-semibold text-green-600">● Connected</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};







  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500 mx-auto"></div>
          <p className="text-white text-2xl mt-4 font-bold">Loading HOD Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Sidebar - SAME AS BEFORE */}
      <div 
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-gray-900 text-white transition-all duration-300 ease-in-out shadow-2xl flex flex-col`}
      >
        <div className="p-6 flex items-center justify-between border-b border-gray-700">
          {sidebarOpen && (
            <div>
              <h2 className="text-2xl font-bold">🛡️ HOD Portal</h2>
              <p className="text-xs text-gray-400 mt-1">IoT Department</p>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-gray-800 rounded-lg transition-all"
          >
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => setActiveSection('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-semibold ${
              activeSection === 'dashboard'
                ? 'bg-blue-600 shadow-lg shadow-blue-500/50'
                : 'hover:bg-gray-800'
            }`}
          >
            <span className="text-2xl">📊</span>
            {sidebarOpen && <span>Dashboard</span>}
          </button>

          <button
            onClick={() => setActiveSection('students')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-semibold ${
              activeSection === 'students'
                ? 'bg-blue-600 shadow-lg shadow-blue-500/50'
                : 'hover:bg-gray-800'
            }`}
          >
            <span className="text-2xl">👥</span>
            {sidebarOpen && <span>Students</span>}
          </button>

          <button
            onClick={() => setActiveSection('faculty')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-semibold ${
              activeSection === 'faculty'
                ? 'bg-blue-600 shadow-lg shadow-blue-500/50'
                : 'hover:bg-gray-800'
            }`}
          >
            <span className="text-2xl">👨‍🏫</span>
            {sidebarOpen && <span>Faculty</span>}
          </button>

          <button
            onClick={() => setActiveSection('analytics')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-semibold ${
              activeSection === 'analytics'
                ? 'bg-blue-600 shadow-lg shadow-blue-500/50'
                : 'hover:bg-gray-800'
            }`}
          >
            <span className="text-2xl">📈</span>
            {sidebarOpen && <span>Analytics</span>}
          </button>

          <button
            onClick={() => setActiveSection('reports')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-semibold ${
              activeSection === 'reports'
                ? 'bg-blue-600 shadow-lg shadow-blue-500/50'
                : 'hover:bg-gray-800'
            }`}
          >
            <span className="text-2xl">📋</span>
            {sidebarOpen && <span>Reports</span>}
          </button>

          <button
            onClick={() => setActiveSection('settings')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-semibold ${
              activeSection === 'settings'
                ? 'bg-blue-600 shadow-lg shadow-blue-500/50'
                : 'hover:bg-gray-800'
            }`}
          >
            <span className="text-2xl">⚙️</span>
            {sidebarOpen && <span>Settings</span>}
          </button>
        </nav>

        <div className="p-4 border-t border-gray-700">
          <button
            onClick={() => navigate('/')}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-red-600 hover:bg-red-700 transition-all shadow-lg font-semibold"
          >
            <span className="text-2xl">🚪</span>
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="bg-white shadow-lg p-6 sticky top-0 z-10 border-b-4 border-blue-600">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                IoT Department - HOD Dashboard
              </h1>
              <p className="text-gray-600 mt-1">Internet of Things (IoT) Engineering</p>
              <p className="text-sm text-gray-500">📅 Academic Year 2024-25</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Welcome back,</p>
              <p className="text-2xl font-bold text-gray-800">Mr. Lalit Saraswat</p>
              <p className="text-sm text-blue-600 font-semibold">HOD - IoT Department</p>
            </div>
          </div>
        </div>

        <div className="p-6 max-w-7xl mx-auto">
          {activeSection === 'dashboard' && renderDashboardContent()}
          {activeSection === 'students' && renderStudentsView()}
          {activeSection === 'faculty' && renderFacultyView()}
          {activeSection === 'analytics' && renderAnalyticsView()}
          {activeSection === 'reports' && renderReportsView()}
          {activeSection === 'settings' && renderSettingsView()}

        </div>
      </div>

              {/* Student Detail Modal */}
        {showStudentModal && selectedStudent && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-8 max-w-2xl w-full">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Student Details
                </h2>
                <button
                  onClick={() => setShowStudentModal(false)}
                  className="text-3xl text-gray-500 hover:text-red-600 transition-colors"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-3xl">
                    {selectedStudent.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-800">{selectedStudent.name}</h3>
                    <p className="text-gray-600 font-mono">{selectedStudent.id}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-6">
                  <div className="bg-blue-50 p-4 rounded-xl">
                    <p className="text-sm text-gray-600 mb-1">📧 Email</p>
                    <p className="text-sm font-semibold text-gray-800">{selectedStudent.email}</p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-xl">
                    <p className="text-sm text-gray-600 mb-1">📱 Phone</p>
                    <p className="text-sm font-semibold text-gray-800">{selectedStudent.phone}</p>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-xl">
                    <p className="text-sm text-gray-600 mb-1">📊 Overall Attendance</p>
                    <p className="text-2xl font-bold text-purple-600">{selectedStudent.overall}%</p>
                  </div>
                  <div className={`p-4 rounded-xl ${selectedStudent.presentToday ? 'bg-green-50' : 'bg-red-50'}`}>
                    <p className="text-sm text-gray-600 mb-1">Today's Status</p>
                    <p className={`text-2xl font-bold ${selectedStudent.presentToday ? 'text-green-600' : 'text-red-600'}`}>
                      {selectedStudent.presentToday ? '✅ Present' : '❌ Absent'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowStudentModal(false)}
                  className="w-full mt-6 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-semibold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

                {/* Add Faculty Modal */}
        {showAddFacultyModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
                  ➕ Add New Faculty
                </h2>
                <button
                  onClick={() => {
                    setShowAddFacultyModal(false);
                    setNewFaculty({ name: '', email: '', phone: '', subjects: [], semester: '' });
                  }}
                  className="text-3xl text-gray-500 hover:text-red-600 transition-colors"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    👤 Faculty Name *
                  </label>
                  <input
                    type="text"
                    value={newFaculty.name}
                    onChange={(e) => setNewFaculty({ ...newFaculty, name: e.target.value })}
                    placeholder="Enter full name"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    📧 Email Address *
                  </label>
                  <input
                    type="email"
                    value={newFaculty.email}
                    onChange={(e) => setNewFaculty({ ...newFaculty, email: e.target.value })}
                    placeholder="faculty@rkgit.edu.in"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    📱 Phone Number *
                  </label>
                  <input
                    type="tel"
                    value={newFaculty.phone}
                    onChange={(e) => setNewFaculty({ ...newFaculty, phone: e.target.value })}
                    placeholder="+91-XXXXXXXXXX"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>

                {/* Semester */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    🎓 Semester
                  </label>
                  <select
                    value={newFaculty.semester}
                    onChange={(e) => setNewFaculty({ ...newFaculty, semester: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">Select Semester</option>
                    <option value="1">Semester 1</option>
                    <option value="2">Semester 2</option>
                    <option value="3">Semester 3</option>
                    <option value="4">Semester 4</option>
                    <option value="5">Semester 5</option>
                    <option value="6">Semester 6</option>
                    <option value="7">Semester 7</option>
                    <option value="8">Semester 8</option>
                  </select>
                </div>

                {/* Subjects */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    📚 Subjects (Enter one at a time)
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      id="subjectInput"
                      placeholder="e.g., IoT Fundamentals"
                      className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    />
                    <button
                      onClick={() => {
                        const input = document.getElementById('subjectInput');
                        if (input.value.trim()) {
                          setNewFaculty({
                            ...newFaculty,
                            subjects: [...newFaculty.subjects, input.value.trim()]
                          });
                          input.value = '';
                        }
                      }}
                      className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-semibold"
                    >
                      + Add
                    </button>
                  </div>
                  
                  {/* Display added subjects */}
                  <div className="flex flex-wrap gap-2">
                    {newFaculty.subjects.map((subject, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold flex items-center gap-2"
                      >
                        {subject}
                        <button
                          onClick={() => {
                            setNewFaculty({
                              ...newFaculty,
                              subjects: newFaculty.subjects.filter((_, i) => i !== idx)
                            });
                          }}
                          className="text-red-600 hover:text-red-800"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex gap-4 mt-6">
                  <button
                    onClick={() => {
                      setShowAddFacultyModal(false);
                      setNewFaculty({ name: '', email: '', phone: '', subjects: [], semester: '' });
                    }}
                    className="flex-1 px-6 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-all font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddFaculty}
                    className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all font-semibold"
                  >
                    ✅ Add Faculty
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

                {/* Edit Faculty Modal */}
        {showEditFacultyModal && selectedFaculty && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
                  ✏️ Edit Faculty Details
                </h2>
                <button
                  onClick={() => {
                    setShowEditFacultyModal(false);
                    setSelectedFaculty(null);
                  }}
                  className="text-3xl text-gray-500 hover:text-red-600 transition-colors"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    👤 Faculty Name *
                  </label>
                  <input
                    type="text"
                    value={selectedFaculty.name}
                    onChange={(e) => setSelectedFaculty({ ...selectedFaculty, name: e.target.value })}
                    placeholder="Enter full name"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    📧 Email Address *
                  </label>
                  <input
                    type="email"
                    value={selectedFaculty.email}
                    onChange={(e) => setSelectedFaculty({ ...selectedFaculty, email: e.target.value })}
                    placeholder="faculty@rkgit.edu.in"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    📱 Phone Number *
                  </label>
                  <input
                    type="tel"
                    value={selectedFaculty.phone}
                    onChange={(e) => setSelectedFaculty({ ...selectedFaculty, phone: e.target.value })}
                    placeholder="+91-XXXXXXXXXX"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>

                {/* Semester */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    🎓 Semester
                  </label>
                  <select
                    value={selectedFaculty.semester || ''}
                    onChange={(e) => setSelectedFaculty({ ...selectedFaculty, semester: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">Select Semester</option>
                    <option value="1">Semester 1</option>
                    <option value="2">Semester 2</option>
                    <option value="3">Semester 3</option>
                    <option value="4">Semester 4</option>
                    <option value="5">Semester 5</option>
                    <option value="6">Semester 6</option>
                    <option value="7">Semester 7</option>
                    <option value="8">Semester 8</option>
                  </select>
                </div>

                {/* Subjects */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    📚 Subjects (Enter one at a time)
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      id="editSubjectInput"
                      placeholder="e.g., IoT Fundamentals"
                      className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    />
                    <button
                      onClick={() => {
                        const input = document.getElementById('editSubjectInput');
                        if (input.value.trim()) {
                          setSelectedFaculty({
                            ...selectedFaculty,
                            subjects: [...(selectedFaculty.subjects || []), input.value.trim()]
                          });
                          input.value = '';
                        }
                      }}
                      className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-semibold"
                    >
                      + Add
                    </button>
                  </div>
                  
                  {/* Display added subjects */}
                  <div className="flex flex-wrap gap-2">
                    {(selectedFaculty.subjects || []).map((subject, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm font-semibold flex items-center gap-2"
                      >
                        {subject}
                        <button
                          onClick={() => {
                            setSelectedFaculty({
                              ...selectedFaculty,
                              subjects: selectedFaculty.subjects.filter((_, i) => i !== idx)
                            });
                          }}
                          className="text-red-600 hover:text-red-800"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex gap-4 mt-6">
                  <button
                    onClick={() => {
                      setShowEditFacultyModal(false);
                      setSelectedFaculty(null);
                    }}
                    className="flex-1 px-6 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-all font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleEditFaculty}
                    className="flex-1 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-all font-semibold"
                  >
                    ✅ Update Faculty
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

                {/* Faculty Performance Modal */}
        {showFacultyPerformance && facultyPerformanceData && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  📊 Faculty Performance Dashboard
                </h2>
                <button
                  onClick={() => {
                    setShowFacultyPerformance(false);
                    setFacultyPerformanceData(null);
                  }}
                  className="text-3xl text-gray-500 hover:text-red-600 transition-colors"
                >
                  ×
                </button>
              </div>

              {/* Faculty Info */}
              <div className="bg-gradient-to-r from-purple-100 to-pink-100 rounded-xl p-6 mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold text-3xl">
                    {facultyPerformanceData.name?.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-800">{facultyPerformanceData.name}</h3>
                    <p className="text-gray-600">{facultyPerformanceData.email}</p>
                    <p className="text-sm text-gray-500">📱 {facultyPerformanceData.phone}</p>
                  </div>
                </div>
              </div>

              {/* Performance Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-blue-50 rounded-xl p-4">
                  <p className="text-sm text-gray-600 mb-1">📚 Subjects Teaching</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {facultyPerformanceData.subjects?.length || 0}
                  </p>
                </div>
                <div className="bg-green-50 rounded-xl p-4">
                  <p className="text-sm text-gray-600 mb-1">👥 Total Students</p>
                  <p className="text-2xl font-bold text-green-600">{totalStudents}</p>
                </div>
                <div className="bg-purple-50 rounded-xl p-4">
                  <p className="text-sm text-gray-600 mb-1">🎓 Semester</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {facultyPerformanceData.semester ? `Sem ${facultyPerformanceData.semester}` : 'N/A'}
                  </p>
                </div>
              </div>

              {/* Subjects List */}
              <div className="mb-6">
                <h3 className="text-xl font-bold mb-3 text-gray-800">📖 Subjects Handling</h3>
                <div className="flex flex-wrap gap-2">
                  {facultyPerformanceData.subjects?.map((subject, idx) => (
                    <span
                      key={idx}
                      className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-full text-sm font-semibold"
                    >
                      {subject}
                    </span>
                  )) || <p className="text-gray-500">No subjects assigned</p>}
                </div>
              </div>

              {/* Student Attendance Overview */}
              <div className="mb-6">
                <h3 className="text-xl font-bold mb-3 text-gray-800">👥 Student Attendance Overview</h3>
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Present Today</p>
                      <p className="text-2xl font-bold text-green-600">{presentToday}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Absent Today</p>
                      <p className="text-2xl font-bold text-red-600">{absentToday}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Average Attendance</p>
                      <p className="text-2xl font-bold text-purple-600">{avgAttendance}%</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Students At Risk</p>
                      <p className="text-2xl font-bold text-orange-600">{atRiskCount}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Student List */}
              <div>
                <h3 className="text-xl font-bold mb-3 text-gray-800">📋 Student Details</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
                      <tr>
                        <th className="px-4 py-3 text-left rounded-tl-lg">Name</th>
                        <th className="px-4 py-3 text-center">Student ID</th>
                        <th className="px-4 py-3 text-center">Overall %</th>
                        <th className="px-4 py-3 text-center rounded-tr-lg">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentDetails.map((student, idx) => (
                        <tr 
                          key={idx}
                          className={`border-b ${idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}
                        >
                          <td className="px-4 py-3 font-semibold">{student.name}</td>
                          <td className="px-4 py-3 text-center text-sm text-gray-600">{student.id}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                              student.overall >= 75 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {student.overall}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {student.presentToday ? (
                              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold">
                                ✅ Present
                              </span>
                            ) : (
                              <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-semibold">
                                ❌ Absent
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <button
                onClick={() => {
                  setShowFacultyPerformance(false);
                  setFacultyPerformanceData(null);
                }}
                className="w-full mt-6 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        )}

              {/* Student Detail Modal */}
      <StudentDetailModal 
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        students={modalData.students}
        title={modalData.title}
        type={modalData.type}
      />
    </div>
  );
};

export default AdminDashboard;

