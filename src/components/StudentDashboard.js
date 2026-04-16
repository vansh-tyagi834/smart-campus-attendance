import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend, AreaChart, Area } from 'recharts';
import { AlertCircle, TrendingUp, TrendingDown, Calendar, Award, BookOpen, Users, Download, LogOut, Trophy, ChevronDown, ChevronUp, Home, BarChart3, Target, Menu, X, Zap, Star, CheckCircle, FileText } from 'lucide-react';
import { database } from '../firebase/config';
import { ref, onValue, update} from 'firebase/database';
import { motion, AnimatePresence } from 'framer-motion';
import { getBadges } from '../utils/gamification';
import { getPoints } from '../utils/gamification';
import { getStudentMarks } from '../utils/gamification';
import { getStudentName } from '../utils/gamification';

function StudentDashboard() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [calendarExpanded, setCalendarExpanded] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [calendarData, setCalendarData] = useState(null);
  const [trendData, setTrendData] = useState([]);
  const [badges, setBadges] = useState([]);
  const [points, setPoints] = useState(0);
  const [studentMarks, setStudentMarks] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [studentName, setStudentName] = useState('VANSH TYAGI');
  const [classData, setClassData] = useState(null);
  const [studentRank, setStudentRank] = useState(null);


  // IMPORTANT: Use the full student ID that matches Firebase structure
  const studentId = '2200331550125'; // Full roll number used in Firebase

  // Load attendance data from Firebase
  useEffect(() => {
    const summaryRef = ref(database, `attendance/summary/${studentId}`);
    const studentsRef = ref(database, `attendance/students/${studentId}`);
    const dailyRef = ref(database, 'attendance/daily');

    let summaryData = {};
    let studentsData = {};
    let dailyData = {};

    const processData = () => {
      try {
        // Get attendance history from students path
        const calendar = studentsData?.calendar || {};
        const attendanceHistory = {};
        
        // Process calendar data
        Object.keys(calendar).forEach(date => {
          const dayData = calendar[date];
          if (dayData && dayData.subjects) {
            Object.keys(dayData.subjects).forEach(subject => {
              const key = `${date}_${subject}`;
              attendanceHistory[key] = dayData.subjects[subject];
            });
          }
        });

        // Calculate subject-wise statistics
        const subjectStats = {};
        Object.keys(calendar).forEach(date => {
          const dayData = calendar[date];
          if (dayData && dayData.subjects) {
            Object.keys(dayData.subjects).forEach(subject => {
              if (!subjectStats[subject]) {
                subjectStats[subject] = { present: 0, total: 0 };
              }
              subjectStats[subject].total++;
              if (dayData.subjects[subject] === 'Present') {
                subjectStats[subject].present++;
              }
            });
          }
        });

        // Convert to subject format
        const subjects = {};
        Object.keys(subjectStats).forEach(subject => {
          const stats = subjectStats[subject];
          subjects[subject] = {
            percentage: stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0,
            present: stats.present,
            total: stats.total
          };
        });

        const mockSummary = {
          overall_percentage: summaryData?.overall_percentage || 0,
          total_classes: summaryData?.total_days || 0,
          total_present: summaryData?.present_days || 0,
          subjects: subjects,
          attendance_history: attendanceHistory
        };

        setSummary(mockSummary);
        setPoints(mockSummary.total_present * 10);

        // Process calendar data
        const calMap = {};
        Object.entries(attendanceHistory).forEach(([key, status]) => {
          const date = key.split('_')[0];
          if (!calMap[date]) {
            calMap[date] = { present: 0, absent: 0, total: 0, classes: [] };
          }
          calMap[date].total++;
          if (status === 'Present') calMap[date].present++;
          else calMap[date].absent++;
          calMap[date].classes.push({ subject: key.split('_')[1], status });
        });
        setCalendarData(calMap);

        // Generate trend data
        const dates = Object.keys(calMap).sort().slice(-7);
        const trend = dates.map(date => ({
          date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          percentage: Math.round((calMap[date].present / calMap[date].total) * 100)
        }));
        setTrendData(trend);

        // Generate badges
        const badgeList = [];
        if (mockSummary.overall_percentage >= 90) badgeList.push({ icon: '🌟', name: 'Excellence', description: '90%+ attendance' });
        if (mockSummary.total_present >= 40) badgeList.push({ icon: '🎯', name: 'Dedicated', description: '40+ classes attended' });
        
        // Check for perfect attendance in any subject
        Object.entries(subjects).forEach(([subject, data]) => {
          if (data.percentage === 100) {
            badgeList.push({ icon: '💯', name: `Perfect ${subject}`, description: `100% in ${subject}` });
          }
        });
        
        setBadges(badgeList);
        setLoading(false);
      } catch (error) {
        console.error('Error processing attendance data:', error);
        setLoading(false);
      }
    };

    const unsubscribeSummary = onValue(summaryRef, (snapshot) => {
      summaryData = snapshot.val() || {};
      processData();
    });

    const unsubscribeStudents = onValue(studentsRef, (snapshot) => {
      studentsData = snapshot.val() || {};
      processData();
    });

    const unsubscribeDaily = onValue(dailyRef, (snapshot) => {
      dailyData = snapshot.val() || {};
      processData();
    });

    return () => {
      unsubscribeSummary();
      unsubscribeStudents();
      unsubscribeDaily();
    };
  }, [studentId]);

  // Load marks from Firebase - ADDED THIS USEEFFECT
  useEffect(() => {
    const marksRef = ref(database, `classes/IoT-B/studentMarks/${studentId}`);
    const studentNameRef = ref(database, `students/125/name`);

    const unsubscribeMarks = onValue(marksRef, (snapshot) => {
      const data = snapshot.val();
      console.log('Marks data from Firebase:', data);

      if (data && data.subjects) {
        const marksArray = Array.isArray(data.subjects) 
          ? data.subjects 
          : Object.values(data.subjects);
      
        setStudentMarks(marksArray);
      } else {
        setStudentMarks([]);
      }
    });

    // Fetch student name from Firebase
    const unsubscribeStudent = onValue(studentNameRef, (snapshot) => {
      const nameData = snapshot.val();
      console.log('Student name from Firebase:', nameData);
    
      if (nameData) {
        if (typeof nameData === 'string') {
          setStudentName(nameData);
        } else if (typeof nameData === 'object' && nameData.name) {
          setStudentName(nameData.name);
        } else {
          setStudentName('VANSH TYAGI');
        }
      } else {
        setStudentName('VANSH TYAGI');
      }
    });

    return () => {
      unsubscribeMarks();
      unsubscribeStudent();
    };
  }, [studentId]);

  // Load assignments from Firebase
useEffect(() => {
  const assignmentsRef = ref(database, 'classes/IoT-B/assignments');
  
  const unsubscribe = onValue(assignmentsRef, (snapshot) => {
    const data = snapshot.val();
    console.log('Assignments data from Firebase:', data);
    
    if (data) {
      const assignmentsList = Object.entries(data).map(([id, assignment]) => {
        // Check if current student has submitted
        const submissions = assignment.submissions || {};
        const studentSubmission = submissions[studentId];
        
        return {
          id: id,
          title: assignment.title || 'Untitled Assignment',
          subject: assignment.subject || 'General',
          description: assignment.description || 'No description',
          dueDate: assignment.dueDate || 'No due date',
          createdAt: assignment.createdAt || Date.now(),
          totalSubmissions: Object.keys(submissions).length || 0,
          submitted: !!studentSubmission,
          submittedAt: studentSubmission?.submittedAt || null,
          submissionLink: studentSubmission?.link || null
        };
      });
      
      // Sort by creation date (newest first)
      assignmentsList.sort((a, b) => b.createdAt - a.createdAt);
      
      setAssignments(assignmentsList);
      console.log('Processed assignments:', assignmentsList);
    } else {
      setAssignments([]);
    }
  });
  
  return () => unsubscribe();
}, [studentId]);


  // Load all students data for comparison
useEffect(() => {
  const summaryRef = ref(database, 'attendance/summary');
  
  const unsubscribe = onValue(summaryRef, (snapshot) => {
    const data = snapshot.val();
    console.log('All students data:', data);
    
    if (data) {
      // Filter only IoT-B students
      const iotBStudentIds = ['2200331550125', '2200331550103', '2200331550083'];
      const studentsArray = [];
      
      iotBStudentIds.forEach(id => {
        if (data[id]) {
          // Handle student_name which might be a string or object
          let studentName = 'Unknown';
          const nameData = data[id].student_name || data[id].studentname;
          
          if (typeof nameData === 'string') {
            studentName = nameData;
          } else if (nameData && typeof nameData === 'object' && nameData.name) {
            studentName = nameData.name;
          }
          
          studentsArray.push({
            id: id,
            name: studentName,
            attendance: data[id].overall_percentage || data[id].overallpercentage || 0,
            present: data[id].present_days || data[id].presentdays || 0,
            total: data[id].total_days || data[id].totaldays || 0
          });
        }
      });
      
      // Sort by attendance percentage (descending)
      studentsArray.sort((a, b) => b.attendance - a.attendance);
      
      // Calculate rank for current student
      const currentStudentIndex = studentsArray.findIndex(s => s.id === studentId);
      const rank = currentStudentIndex >= 0 ? currentStudentIndex + 1 : studentsArray.length;
      
      // Calculate class average
      const totalAttendance = studentsArray.reduce((sum, s) => sum + s.attendance, 0);
      const classAverage = studentsArray.length > 0 ? Math.round(totalAttendance / studentsArray.length) : 0;
      
      // Calculate percentile
      const currentStudentData = studentsArray[currentStudentIndex];
      const studentsBelow = currentStudentData 
        ? studentsArray.filter(s => s.attendance < currentStudentData.attendance).length
        : 0;
      const percentile = studentsArray.length > 1 ? Math.round((studentsBelow / (studentsArray.length - 1)) * 100) : 100;
      
      setClassData({
        students: studentsArray,
        totalStudents: studentsArray.length,
        classAverage: classAverage,
        currentStudent: currentStudentData || null,
        rank: rank,
        percentile: percentile,
        betterThan: studentsBelow
      });
      
      setStudentRank(rank);
      
      console.log('Processed class data:', {
        students: studentsArray,
        rank: rank,
        classAverage: classAverage,
        percentile: percentile
      });
    }
  });
  
  return () => unsubscribe();
}, [studentId]);





  const calculatePrediction = () => {
    if (!summary) return null;
    const totalSemester = 80;
    const current = summary.total_classes;
    const present = summary.total_present;
    const remaining = totalSemester - current;
    const projectedPercentage = ((present + remaining * 0.875) / totalSemester * 100).toFixed(1);
    const canMiss = Math.max(0, Math.floor((present + remaining - 0.75 * totalSemester)));
    const needToAttend = Math.max(0, Math.ceil(0.75 * totalSemester - present));

    return {
      currentPercentage: summary.overall_percentage.toFixed(1),
      projectedPercentage,
      canMiss,
      needToAttend,
      remainingClasses: remaining,
      isSafe: summary.overall_percentage >= 75
    };
  };

  const getSubjectData = () => {
    if (!summary?.subjects) return [];
    return Object.entries(summary.subjects).map(([name, data]) => ({
      name: name.replace(/_/g, ' '),
      attendance: data.percentage,
      present: data.present,
      total: data.total
    }));
  };

  const getPieData = () => {
    if (!summary) return [];
    return [
      { name: 'Present', value: summary.total_present },
      { name: 'Absent', value: summary.total_classes - summary.total_present }
    ];
  };

  const prediction = calculatePrediction();
  const classComparison = {
    yourAttendance: summary?.overall_percentage || 0,
    classAverage: 79,
    yourRank: 12,
    totalStudents: 120,
    percentile: 90,
    betterThan: 108,
    difference: (summary?.overall_percentage || 0) - 79
  };

  const menuItems = [
    { id: 'dashboard', icon: Home, label: 'Dashboard' },
    { id: 'subjects', icon: BookOpen, label: 'Subjects' },
    { id: 'marks', icon: FileText, label: 'Marks' }, // ADDED MARKS TAB
    { id: 'assignments', icon: CheckCircle, label: 'Assignments' },
    { id: 'analytics', icon: BarChart3, label: 'Analytics' },
    { id: 'comparison', icon: Users, label: 'Comparison' },
    { id: 'achievements', icon: Trophy, label: 'Achievements' },
  ];

  // Handler Functions
  const handleLeaderboard = () => {
    navigate('/leaderboard');
  };

  const handleExport = () => {
    if (!summary) {
      alert('No data to export');
      return;
    }

    // Create CSV data
    const csvData = [];
    csvData.push(['Student Attendance Report']);
    csvData.push(['Student Name', studentName]);
    csvData.push(['Student ID', studentId]);
    csvData.push(['Overall Attendance', `${summary.overall_percentage}%`]);
    csvData.push(['Total Classes', summary.total_classes]);
    csvData.push(['Present', summary.total_present]);
    csvData.push(['Absent', summary.total_classes - summary.total_present]);
    csvData.push([]);
    csvData.push(['Subject-wise Attendance']);
    csvData.push(['Subject', 'Attendance %', 'Present', 'Total']);
    
    Object.entries(summary.subjects).forEach(([subject, data]) => {
      csvData.push([subject.replace(/_/g, ' '), `${data.percentage}%`, data.present, data.total]);
    });

    // Convert to CSV string
    const csvString = csvData.map(row => row.join(',')).join('\n');
    
    // Create download
    const blob = new Blob([csvString], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${studentName}_Attendance_Report.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const handleLogout = () => {
    // Clear any stored data
    localStorage.removeItem('userToken');
    localStorage.removeItem('studentId');
    sessionStorage.clear();
    
    // Navigate to login page
    navigate('/login');
  };



  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-20 w-20 border-b-4 border-blue-600 mx-auto"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Zap className="text-blue-600 animate-pulse" size={32} />
            </div>
          </div>
          <p className="text-gray-700 text-lg mt-6 font-semibold">Loading Your Dashboard...</p>
          <p className="text-gray-500 text-sm mt-2">Preparing your attendance insights</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 h-full bg-white border-r border-gray-200 shadow-xl transition-all duration-300 z-40 ${sidebarOpen ? 'w-64' : 'w-20'}`}>
        {/* Logo Section */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-purple-600">
          {sidebarOpen && <h1 className="text-xl font-bold text-white">Student Portal</h1>}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 rounded-lg hover:bg-white/20 transition text-white">
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Student Info */}
        {sidebarOpen && (
          <div className="p-5 border-b border-gray-200 bg-gradient-to-br from-blue-50 to-purple-50">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                {studentName && typeof studentName === 'string' 
                  ? studentName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
                  : 'VT'}
                </div>
              <div>
                <p className="font-semibold text-gray-900">{studentName || 'VANSH TYAGI'}</p>
                <p className="text-xs text-gray-500">{studentId}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-white rounded-lg p-2 shadow-sm">
              <Zap className="text-yellow-500" size={16} />
              <span className="text-sm font-semibold text-gray-700">{points} Points</span>
            </div>
          </div>
        )}


        {/* Navigation */}
        <nav className="p-3 space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                activeTab === item.id
                  ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg shadow-blue-200'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <item.icon size={20} />
              {sidebarOpen && <span className="font-medium">{item.label}</span>}
            </button>
          ))}
        </nav>

        {/* Quick Stats */}
        {sidebarOpen && (
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-gradient-to-br from-green-50 to-blue-50">
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-1">Overall Attendance</p>
              <p className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                {summary?.overall_percentage}%
              </p>
              <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${summary?.overall_percentage}%` }}
                ></div>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <div className={`transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-20'}`}>
        {/* Header */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm backdrop-blur-lg bg-white/95">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  {menuItems.find(m => m.id === activeTab)?.label || 'Dashboard'}
                </h2>
                <p className="text-sm text-gray-500 mt-1">Welcome back! Here's your attendance overview</p>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={handleLeaderboard}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-lg hover:shadow-lg transition font-medium"
                >
                  <Trophy size={18} />
                  Leaderboard
                </button>
                <button 
                  onClick={handleExport}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-gray-300 rounded-lg hover:border-blue-500 hover:shadow-md transition font-medium text-gray-700"
                >
                <Download size={18} />
                Export
              </button>
              <button 
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:shadow-lg transition font-medium"
              >
                <LogOut size={18} />
                Logout
              </button>
            </div>

            </div>
          </div>
        </header>

        <div className="p-6">
          {/* Alert Banner */}
          {summary && summary.overall_percentage < 75 && (
            <div className="bg-gradient-to-r from-red-500 to-orange-500 rounded-xl shadow-xl p-5 mb-6 text-white animate-pulse">
              <div className="flex items-start">
                <div className="bg-white/20 rounded-full p-2 mr-4">
                  <AlertCircle size={24} />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold mb-1">⚠️ Attendance Below Required Threshold</h3>
                  <p className="text-white/90">Your current attendance is {summary.overall_percentage}%. You need to maintain at least 75% to meet requirements.</p>
                </div>
              </div>
            </div>
          )}

          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white rounded-xl border-2 border-blue-100 p-6 hover:shadow-xl hover:border-blue-300 transition-all transform hover:-translate-y-1">
                  <div className="flex items-center justify-between mb-4">
                    <div className="bg-gradient-to-br from-blue-100 to-blue-200 p-3 rounded-lg">
                      <Target className="text-blue-600" size={24} />
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-bold ${summary?.overall_percentage >= 75 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {summary?.overall_percentage >= 75 ? 'Safe' : 'At Risk'}
                    </div>
                  </div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Overall Attendance</p>
                  <p className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">{summary?.overall_percentage}%</p>
                  <p className="text-xs text-gray-500 mt-2">{summary?.total_present}/{summary?.total_classes} classes attended</p>
                </div>

                <div className="bg-white rounded-xl border-2 border-yellow-100 p-6 hover:shadow-xl hover:border-yellow-300 transition-all transform hover:-translate-y-1">
  <div className="flex items-center justify-between mb-4">
    <div className="bg-gradient-to-br from-yellow-100 to-yellow-200 p-3 rounded-lg">
      <Award className="text-yellow-600" size={24} />
    </div>
    <Star className="text-yellow-500" fill="currentColor" size={20} />
  </div>
  <p className="text-sm font-medium text-gray-500 mb-1">Class Rank</p>
  <p className="text-4xl font-bold bg-gradient-to-r from-yellow-600 to-orange-600 bg-clip-text text-transparent">#{classData?.rank || studentRank || '1'}</p>
  <p className="text-xs text-gray-500 mt-2">Top {classData ? Math.round((classData.rank / classData.totalStudents) * 100) : 33}% of class</p>
</div>


                <div className="bg-white rounded-xl border-2 border-green-100 p-6 hover:shadow-xl hover:border-green-300 transition-all transform hover:-translate-y-1">
  <div className="flex items-center justify-between mb-4">
    <div className="bg-gradient-to-br from-green-100 to-green-200 p-3 rounded-lg">
      <TrendingUp className="text-green-600" size={24} />
    </div>
    <CheckCircle className="text-green-500" size={20} />
  </div>
  <p className="text-sm font-medium text-gray-500 mb-1">vs Class Average</p>
  <p className="text-4xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
    +{classData ? ((classData.currentStudent?.attendance || 0) - classData.classAverage).toFixed(1) : '21.0'}%
  </p>
  <p className="text-xs text-gray-500 mt-2">Class avg: {classData?.classAverage || 79}%</p>
</div>


                <div className="bg-white rounded-xl border-2 border-purple-100 p-6 hover:shadow-xl hover:border-purple-300 transition-all transform hover:-translate-y-1">
                  <div className="flex items-center justify-between mb-4">
                    <div className="bg-gradient-to-br from-purple-100 to-purple-200 p-3 rounded-lg">
                      <BookOpen className="text-purple-600" size={24} />
                    </div>
                    <Zap className="text-purple-500" size={20} />
                  </div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Active Subjects</p>
                  <p className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">{summary?.subjects ? Object.keys(summary.subjects).length : 0}</p>
                  <p className="text-xs text-gray-500 mt-2">Current semester</p>
                </div>
              </div>

              {/* Prediction Card */}
              {prediction && (
                <div className="bg-white rounded-xl border-2 border-gray-100 p-6 shadow-lg hover:shadow-xl transition">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="bg-gradient-to-br from-blue-100 to-purple-100 p-3 rounded-lg">
                      <Target size={24} className="text-blue-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">Attendance Forecast</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-xl p-5 hover:shadow-lg transition">
                      <p className="text-xs font-semibold text-blue-600 mb-2">📍 Current Status</p>
                      <p className="text-3xl font-bold text-blue-900">{prediction.currentPercentage}%</p>
                      <p className="text-xs text-blue-600 mt-2">{summary.total_present}/{summary.total_classes} classes</p>
                    </div>

                    <div className={`border-2 rounded-xl p-5 hover:shadow-lg transition ${parseFloat(prediction.projectedPercentage) >= 75 ? 'bg-gradient-to-br from-green-50 to-green-100 border-green-200' : 'bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200'}`}>
                      <p className={`text-xs font-semibold mb-2 ${parseFloat(prediction.projectedPercentage) >= 75 ? 'text-green-600' : 'text-orange-600'}`}>🎯 Semester End</p>
                      <p className={`text-3xl font-bold ${parseFloat(prediction.projectedPercentage) >= 75 ? 'text-green-900' : 'text-orange-900'}`}>{prediction.projectedPercentage}%</p>
                      <p className={`text-xs mt-2 ${parseFloat(prediction.projectedPercentage) >= 75 ? 'text-green-600' : 'text-orange-600'}`}>Projected outcome</p>
                    </div>

                    {prediction.isSafe ? (
                      <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-2 border-emerald-200 rounded-xl p-5 hover:shadow-lg transition">
                        <p className="text-xs font-semibold text-emerald-600 mb-2">✅ Buffer Available</p>
                        <p className="text-3xl font-bold text-emerald-900">{prediction.canMiss}</p>
                        <p className="text-xs text-emerald-600 mt-2">classes can be missed</p>
                      </div>
                    ) : (
                      <div className="bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-200 rounded-xl p-5 hover:shadow-lg transition">
                        <p className="text-xs font-semibold text-red-600 mb-2">⚠️ Action Required</p>
                        <p className="text-3xl font-bold text-red-900">{prediction.needToAttend}</p>
                        <p className="text-xs text-red-600 mt-2">classes needed for 75%</p>
                      </div>
                    )}

                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-200 rounded-xl p-5 hover:shadow-lg transition">
                      <p className="text-xs font-semibold text-purple-600 mb-2">📚 Remaining</p>
                      <p className="text-3xl font-bold text-purple-900">{prediction.remainingClasses}</p>
                      <p className="text-xs text-purple-600 mt-2">classes this semester</p>
                    </div>
                  </div>

                  <div className={`mt-5 p-4 rounded-xl border-l-4 ${prediction.isSafe ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'}`}>
                    <p className={`text-sm font-semibold ${prediction.isSafe ? 'text-green-900' : 'text-red-900'}`}>
                      💡 {prediction.isSafe 
                        ? `Great job! You can miss up to ${prediction.canMiss} more classes while maintaining 75% attendance.`
                        : `Attend the next ${prediction.needToAttend} classes to reach 75% requirement.`
                      }
                    </p>
                  </div>
                </div>
              )}

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl border-2 border-gray-100 p-6 shadow-lg hover:shadow-xl transition">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <BarChart3 className="text-blue-600" size={20} />
                    Subject Performance
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={getSubjectData()}>
                      <defs>
                        <linearGradient id="colorBar" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity={1}/>
                          <stop offset="100%" stopColor="#8b5cf6" stopOpacity={1}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} style={{ fontSize: '11px', fontWeight: '500' }} />
                      <YAxis style={{ fontSize: '11px', fontWeight: '500' }} domain={[0, 100]} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: '2px solid #e5e7eb', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                        formatter={(value) => [`${value}%`, 'Attendance']}
                      />
                      <Bar dataKey="attendance" fill="url(#colorBar)" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white rounded-xl border-2 border-gray-100 p-6 shadow-lg hover:shadow-xl transition">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Calendar className="text-purple-600" size={20} />
                    Attendance Distribution
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <defs>
                        <linearGradient id="greenGrad" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor="#10b981" />
                          <stop offset="100%" stopColor="#059669" />
                        </linearGradient>
                        <linearGradient id="redGrad" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor="#ef4444" />
                          <stop offset="100%" stopColor="#dc2626" />
                        </linearGradient>
                      </defs>
                      <Pie 
                        data={getPieData()} 
                        cx="50%" 
                        cy="50%" 
                        labelLine={false} 
                        label={(entry) => `${entry.name}: ${entry.value}`}
                        outerRadius={100} 
                        dataKey="value"
                      >
                        {getPieData().map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={index === 0 ? 'url(#greenGrad)' : 'url(#redGrad)'} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Trend Chart */}
              {trendData.length > 0 && (
                <div className="bg-white rounded-xl border-2 border-gray-100 p-6 shadow-lg hover:shadow-xl transition">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <TrendingUp className="text-green-600" size={20} />
                    7-Day Attendance Trend
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={trendData}>
                      <defs>
                        <linearGradient id="colorTrend" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.1}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="date" style={{ fontSize: '11px', fontWeight: '500' }} />
                      <YAxis domain={[0, 100]} style={{ fontSize: '11px', fontWeight: '500' }} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: '2px solid #e5e7eb', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                        formatter={(value) => [`${value}%`, 'Attendance']}
                      />
                      <Area type="monotone" dataKey="percentage" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorTrend)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* Subjects Tab */}
          {activeTab === 'subjects' && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl border-2 border-gray-100 p-6 shadow-lg">
                <h3 className="text-xl font-bold text-gray-900 mb-6">Subject-wise Breakdown</h3>
                <div className="space-y-4">
                  {summary?.subjects && Object.entries(summary.subjects).map(([subject, data], index) => {
                    const colors = ['blue', 'purple', 'green', 'orange', 'pink'];
                    const color = colors[index % colors.length];
                    return (
                      <div key={subject} className={`border-2 rounded-xl p-5 hover:shadow-lg transition-all transform hover:-translate-y-1 ${
                        index === 0 ? 'border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100' :
                        index === 1 ? 'border-purple-200 bg-gradient-to-br from-purple-50 to-purple-100' :
                        index === 2 ? 'border-green-200 bg-gradient-to-br from-green-50 to-green-100' :
                        'border-orange-200 bg-gradient-to-br from-orange-50 to-orange-100'
                      }`}>
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-bold text-lg text-gray-900">{subject.replace(/_/g, ' ')}</h4>
                          <div className="flex items-center gap-3">
                            <span className={`text-3xl font-bold ${
                              index === 0 ? 'text-blue-600' :
                              index === 1 ? 'text-purple-600' :
                              index === 2 ? 'text-green-600' :
                              'text-orange-600'
                            }`}>{data.percentage}%</span>
                            <span className={`px-4 py-1.5 rounded-full text-xs font-bold ${
                              data.percentage >= 75 ? 'bg-green-100 text-green-800 border-2 border-green-300' : 'bg-red-100 text-red-800 border-2 border-red-300'
                            }`}>
                              {data.percentage >= 75 ? '✓ On Track' : '⚠ Below 75%'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-8 text-sm mb-4">
                          <span className="font-medium">Present: <strong className="text-green-600">{data.present}</strong></span>
                          <span className="font-medium">Absent: <strong className="text-red-600">{data.total - data.present}</strong></span>
                          <span className="font-medium">Total: <strong className="text-blue-600">{data.total}</strong></span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                          <div 
                            className={`h-3 rounded-full transition-all duration-1000 ${
                              index === 0 ? 'bg-gradient-to-r from-blue-500 to-blue-600' :
                              index === 1 ? 'bg-gradient-to-r from-purple-500 to-purple-600' :
                              index === 2 ? 'bg-gradient-to-r from-green-500 to-green-600' :
                              'bg-gradient-to-r from-orange-500 to-orange-600'
                            }`}
                            style={{ width: `${data.percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* MARKS TAB - NEW SECTION */}
          {activeTab === 'marks' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl p-6 shadow-lg">
                <h2 className="text-2xl font-bold mb-6 text-gray-800 flex items-center gap-2">
                  <FileText className="text-blue-600" size={24} />
                  Student Marks
                </h2>

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
                            style={{ width: `${mark.marks}%` }}
                          ></div>
                        </div>

                        <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            <span>{new Date(mark.addedAt).toLocaleDateString()}</span>
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


                {/* Marks Summary */}
                {studentMarks && studentMarks.length > 0 && (
                  <div className="mt-6 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-6 border-2 border-indigo-200">
                    <h3 className="text-lg font-bold text-gray-800 mb-4">Marks Summary</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-white rounded-lg p-4 text-center">
                        <p className="text-sm text-gray-600 mb-1">Total Subjects</p>
                        <p className="text-3xl font-bold text-indigo-600">{studentMarks.length}</p>
                      </div>
                      <div className="bg-white rounded-lg p-4 text-center">
                        <p className="text-sm text-gray-600 mb-1">Average Marks</p>
                        <p className="text-3xl font-bold text-green-600">
                          {Math.round(studentMarks.reduce((sum, mark) => sum + mark.marks, 0) / studentMarks.length)}
                        </p>
                      </div>
                      <div className="bg-white rounded-lg p-4 text-center">
                        <p className="text-sm text-gray-600 mb-1">Highest Score</p>
                        <p className="text-3xl font-bold text-purple-600">
                          {Math.max(...studentMarks.map(mark => mark.marks))}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ASSIGNMENTS TAB */}
{activeTab === 'assignments' && (
  <div className="space-y-6">
    <div className="bg-white rounded-2xl p-6 shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <CheckCircle className="text-blue-600" size={24} />
          Assignments
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
          ✓ Submitted successfully
        </p>
        <p className="text-xs text-gray-600">
          Submitted on: {new Date(assignment.submittedAt).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
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
          ⚠️ Assignment not submitted yet
        </p>
        <p className="text-xs text-gray-600 mt-1">
          Please submit your work to faculty for verification
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


          {/* Analytics Tab */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              {trendData.length > 0 ? (
                <>
                  <div className="bg-white rounded-xl border-2 border-gray-100 p-6 shadow-lg">
                    <h3 className="text-xl font-bold text-gray-900 mb-6">Attendance Trends & Insights</h3>
                    <ResponsiveContainer width="100%" height={350}>
                      <AreaChart data={trendData}>
                        <defs>
                          <linearGradient id="colorArea" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.1}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="date" style={{ fontSize: '12px', fontWeight: '500' }} />
                        <YAxis domain={[0, 100]} style={{ fontSize: '12px', fontWeight: '500' }} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '12px', border: '2px solid #e5e7eb', boxShadow: '0 8px 16px rgba(0,0,0,0.1)' }}
                          formatter={(value) => [`${value}%`, 'Daily Attendance']}
                        />
                        <Area type="monotone" dataKey="percentage" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorArea)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-xl p-6 hover:shadow-xl transition">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-blue-600">Best Day</h4>
                        <Star className="text-yellow-500" fill="currentColor" size={20} />
                      </div>
                      <p className="text-2xl font-bold text-blue-900">{trendData[0]?.date || 'N/A'}</p>
                      <p className="text-sm text-blue-600 mt-1">{trendData[0]?.percentage || 0}% attendance</p>
                    </div>

                    <div className="bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200 rounded-xl p-6 hover:shadow-xl transition">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-green-600">Average</h4>
                        <TrendingUp className="text-green-500" size={20} />
                      </div>
                      <p className="text-2xl font-bold text-green-900">
                        {Math.round(trendData.reduce((sum, day) => sum + day.percentage, 0) / trendData.length)}%
                      </p>
                      <p className="text-sm text-green-600 mt-1">Last 7 days</p>
                    </div>

                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-200 rounded-xl p-6 hover:shadow-xl transition">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-purple-600">Consistency</h4>
                        <CheckCircle className="text-purple-500" size={20} />
                      </div>
                      <p className="text-2xl font-bold text-purple-900">
                        {trendData.filter(d => d.percentage === 100).length}/{trendData.length}
                      </p>
                      <p className="text-sm text-purple-600 mt-1">Perfect days</p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-white rounded-xl border-2 border-gray-100 p-12 text-center shadow-lg">
                  <Calendar className="mx-auto text-gray-400 mb-4" size={64} />
                  <h3 className="text-xl font-bold text-gray-600 mb-2">No Analytics Data Yet</h3>
                  <p className="text-gray-500">Trend analysis will appear after more attendance records are collected.</p>
                </div>
              )}

              {/* Calendar */}
              {calendarData && Object.keys(calendarData).length > 0 && (
                <div className="bg-white rounded-xl border-2 border-gray-100 p-6 shadow-lg">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-gray-900">Attendance Calendar</h3>
                    <button
                      onClick={() => setCalendarExpanded(!calendarExpanded)}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:shadow-lg transition font-medium"
                    >
                      {calendarExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      {calendarExpanded ? 'Collapse' : 'Expand'}
                    </button>
                  </div>

                  {calendarExpanded && (
                    <div>
                      <div className="flex items-center justify-center gap-4 mb-6">
                        <button
                          onClick={() => {
                            const newDate = new Date(selectedMonth);
                            newDate.setMonth(newDate.getMonth() - 1);
                            setSelectedMonth(newDate);
                          }}
                          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition font-medium"
                        >
                          ← Previous
                        </button>
                        <span className="text-lg font-bold text-gray-900">
                          {selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                        </span>
                        <button
                          onClick={() => {
                            const newDate = new Date(selectedMonth);
                            newDate.setMonth(newDate.getMonth() + 1);
                            setSelectedMonth(newDate);
                          }}
                          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition font-medium"
                        >
                          Next →
                        </button>
                      </div>

                      <div className="flex gap-6 mb-6 justify-center flex-wrap">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-green-500 rounded"></div>
                          <span className="text-sm text-gray-600">100% Present</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                          <span className="text-sm text-gray-600">Partially Present</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-red-500 rounded"></div>
                          <span className="text-sm text-gray-600">Absent</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-7 gap-2">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                          <div key={day} className="text-center font-bold text-gray-600 py-3 text-sm">{day}</div>
                        ))}

                        {(() => {
                          const year = selectedMonth.getFullYear();
                          const month = selectedMonth.getMonth();
                          const firstDay = new Date(year, month, 1).getDay();
                          const daysInMonth = new Date(year, month + 1, 0).getDate();
                          const days = [];

                          for (let i = 0; i < firstDay; i++) {
                            days.push(<div key={`empty-${i}`} className="aspect-square"></div>);
                          }

                          for (let day = 1; day <= daysInMonth; day++) {
                            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                            const dayData = calendarData[dateStr];

                            let bgColor = 'bg-gray-100';
                            let textColor = 'text-gray-400';
                            let statusText = '';

                            if (dayData) {
                              const percentage = (dayData.present / dayData.total) * 100;
                              if (percentage === 100) {
                                bgColor = 'bg-green-100 border-2 border-green-400';
                                textColor = 'text-green-800';
                                statusText = `✓`;
                              } else if (percentage === 0) {
                                bgColor = 'bg-red-100 border-2 border-red-400';
                                textColor = 'text-red-800';
                                statusText = `✗`;
                              } else {
                                bgColor = 'bg-yellow-100 border-2 border-yellow-400';
                                textColor = 'text-yellow-800';
                                statusText = `${dayData.present}/${dayData.total}`;
                              }
                            }

                            days.push(
                              <div
                                key={day}
                                className={`aspect-square ${bgColor} ${textColor} rounded-lg p-2 flex flex-col items-center justify-center hover:scale-110 transition cursor-pointer font-semibold text-sm`}
                                title={dayData ? dayData.classes.map(c => `${c.subject}: ${c.status}`).join('\n') : 'No class'}
                              >
                                <div className="text-base">{day}</div>
                                {dayData && <div className="text-xs mt-1">{statusText}</div>}
                              </div>
                            );
                          }

                          return days;
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Comparison Tab */}
{activeTab === 'comparison' && (
  <div className="space-y-6">
    {classData ? (
      <>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl p-8 text-white shadow-2xl transform hover:scale-105 transition">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-blue-100 text-sm font-semibold mb-2">Your Attendance</p>
                <p className="text-6xl font-bold">{classData.currentStudent?.attendance || 0}%</p>
              </div>
              <div className="bg-white/20 p-4 rounded-full">
                <Target size={40} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-white/20 px-4 py-2 rounded-full text-sm font-semibold">
                Rank #{classData.rank}
              </div>
              <div className="bg-white/20 px-4 py-2 rounded-full text-sm font-semibold">
                Top {Math.round((classData.rank / classData.totalStudents) * 100)}%
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-gray-700 to-gray-900 rounded-xl p-8 text-white shadow-2xl transform hover:scale-105 transition">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-gray-300 text-sm font-semibold mb-2">Class Average</p>
                <p className="text-6xl font-bold">{classData.classAverage}%</p>
              </div>
              <div className="bg-white/20 p-4 rounded-full">
                <Users size={40} />
              </div>
            </div>
            <div className="bg-white/20 px-4 py-2 rounded-full text-sm font-semibold inline-block">
              {classData.totalStudents} Students
            </div>
          </div>
        </div>

        {(classData.currentStudent?.attendance || 0) > classData.classAverage ? (
          <div className="bg-gradient-to-r from-green-50 to-emerald-100 border-2 border-green-300 rounded-xl p-6 shadow-lg">
            <div className="flex items-center gap-4 mb-4">
              <div className="bg-green-500 p-3 rounded-full">
                <TrendingUp className="text-white" size={28} />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-green-900">
                  +{((classData.currentStudent?.attendance || 0) - classData.classAverage).toFixed(1)}% Above Average
                </h3>
                <p className="text-green-700 mt-1">You're performing better than {classData.betterThan} student{classData.betterThan !== 1 ? 's' : ''} in your class!</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-r from-orange-50 to-red-100 border-2 border-orange-300 rounded-xl p-6 shadow-lg">
            <div className="flex items-center gap-4 mb-4">
              <div className="bg-orange-500 p-3 rounded-full">
                <TrendingDown className="text-white" size={28} />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-orange-900">
                  {(classData.classAverage - (classData.currentStudent?.attendance || 0)).toFixed(1)}% Below Average
                </h3>
                <p className="text-orange-700 mt-1">Try to improve your attendance to match the class average!</p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border-2 border-gray-100 p-6 shadow-lg">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Class Ranking</h3>
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm text-gray-600 mb-3">
              <span className="font-semibold">Your Position</span>
              <span className="font-bold text-blue-600">#{classData.rank} of {classData.totalStudents}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 h-4 rounded-full transition-all duration-1000 relative"
                style={{ width: `${classData.percentile}%` }}
              >
                <div className="absolute right-2 top-0 bottom-0 flex items-center">
                  <span className="text-xs text-white font-bold">{classData.percentile}%</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">{classData.rank}</p>
              <p className="text-xs text-gray-600 mt-1">Your Rank</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{classData.betterThan}</p>
              <p className="text-xs text-gray-600 mt-1">Students Behind</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <p className="text-2xl font-bold text-purple-600">{classData.totalStudents}</p>
              <p className="text-xs text-gray-600 mt-1">Total Students</p>
            </div>
          </div>
        </div>

        {/* Class Leaderboard */}
        <div className="bg-white rounded-xl border-2 border-gray-100 p-6 shadow-lg">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Trophy className="text-yellow-500" size={24} />
            IoT-B Class Leaderboard
          </h3>
          <div className="space-y-3">
            {classData.students.map((student, index) => (
              <div 
                key={student.id}
                className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                  student.id === studentId
                    ? 'bg-blue-50 border-blue-400 shadow-lg'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-white ${
                  index === 0 ? 'bg-gradient-to-br from-yellow-400 to-orange-500' :
                  index === 1 ? 'bg-gradient-to-br from-gray-400 to-gray-500' :
                  'bg-gradient-to-br from-orange-400 to-red-500'
                }`}>
                  {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-gray-900">{student.name}</h4>
                    {student.id === studentId && (
                      <span className="bg-blue-500 text-white px-2 py-0.5 rounded-full text-xs font-bold">YOU</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">{student.present}/{student.total} classes</p>
                </div>
                
                <div className="text-right">
                  <p className="text-3xl font-bold text-blue-600">{student.attendance}%</p>
                  <p className="text-xs text-gray-500">Rank #{index + 1}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </>
    ) : (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-20 w-20 border-b-4 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading comparison data...</p>
      </div>
    )}
  </div>
)}


          {/* Achievements Tab */}
{activeTab === 'achievements' && (
  <div className="space-y-6">
    <div className="bg-white rounded-xl border-2 border-gray-100 p-6 shadow-lg">
      <h3 className="text-xl font-bold text-gray-900 mb-6">Your Achievements</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-2 border-yellow-300 rounded-xl p-6 text-center transform hover:scale-105 transition">
          <Zap className="mx-auto text-yellow-600 mb-3" size={40} />
          <p className="text-sm font-semibold text-yellow-600 mb-2">Total Points</p>
          <p className="text-4xl font-bold text-yellow-700">{points}</p>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-300 rounded-xl p-6 text-center transform hover:scale-105 transition">
          <Trophy className="mx-auto text-purple-600 mb-3" size={40} />
          <p className="text-sm font-semibold text-purple-600 mb-2">Badges Earned</p>
          <p className="text-4xl font-bold text-purple-700">{badges.length}</p>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-300 rounded-xl p-6 text-center transform hover:scale-105 transition">
          <Star className="mx-auto text-blue-600 mb-3" fill="currentColor" size={40} />
          <p className="text-sm font-semibold text-blue-600 mb-2">Class Rank</p>
          <p className="text-4xl font-bold text-blue-700">#{classData?.rank || studentRank || '1'}</p>
        </div>
      </div>


                {badges.length > 0 ? (
                  <div>
                    <h4 className="text-lg font-bold text-gray-900 mb-4">Earned Badges</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {badges.map((badge, index) => (
                        <div key={index} className="bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-300 rounded-xl p-5 text-center transform hover:scale-110 transition shadow-lg">
                          <div className="text-6xl mb-3">{badge.icon}</div>
                          <h5 className="font-bold text-gray-900 mb-1">{badge.name}</h5>
                          <p className="text-xs text-gray-600">{badge.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Trophy className="mx-auto text-gray-400 mb-4" size={64} />
                    <h3 className="text-xl font-bold text-gray-600 mb-2">No Badges Yet</h3>
                    <p className="text-gray-500">Keep attending classes to earn badges!</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default StudentDashboard;
