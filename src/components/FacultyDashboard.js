import {
  Home, Users, Calendar, BookOpen, Award, Target, Clock, 
  TrendingUp, BarChart3, FileText, Settings, ChevronDown, 
  Download, Bell, Search, Filter, X, Plus, Edit, Trash2,
  CheckCircle, AlertCircle, Video, Mail, Phone, MessageCircle,
  ExternalLink, Menu, LogOut, User, Book, Activity, Star,
  ArrowUp, ArrowDown, Eye, RefreshCw, Save, Upload
} from 'lucide-react';

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { database } from '../firebase/config';
import { ref, onValue, update, get, set, push, remove } from 'firebase/database';
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';

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


const ACTUAL_SUBJECTS = ['IoT', 'Python', 'AI'];
const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
const AVATAR_COLORS = ['#f59e0b', '#8b5cf6', '#3b82f6', '#ec4899', '#14b8a6', '#f43f5e'];

// ==================== ANIMATED COUNTER COMPONENT ====================
const AnimatedCounter = ({ end, duration = 2000, suffix = '', className = '' }) => {
  const [count, setCount] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const prevEndRef = useRef(end);

  useEffect(() => {
    if (prevEndRef.current !== end) {
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), duration);
    }
    prevEndRef.current = end;

    let startTime;
    let animationFrame;
    const startValue = count;

    const easeOutBack = (x) => {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
    };

    const animate = (currentTime) => {
      if (!startTime) startTime = currentTime;
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutBack(progress);
      const currentValue = Math.floor(startValue + (end - startValue) * easedProgress);
      setCount(currentValue);

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [end, duration, count]);

  return (
    <span 
      className={`animated-counter ${isAnimating ? 'bouncing' : ''} ${className}`}
      style={{
        display: 'inline-block',
        transition: 'transform 0.3s ease'
      }}
    >
      {count}{suffix}
    </span>
  );
};

// ==================== CIRCULAR PROGRESS COMPONENT ====================
const CircularProgress = ({ percentage, size = 100, strokeWidth = 8, color = "#10b981" }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(0,0,0,0.1)" strokeWidth={strokeWidth} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={radius} stroke={color} strokeWidth={strokeWidth} fill="none" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-1000 ease-out" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xl font-bold">{percentage}%</span>
      </div>
    </div>
  );
};

// ==================== STUDENT DETAIL MODAL COMPONENT ====================
const StudentDetailModal = ({ student, isOpen, onClose, onUpdatePerformance }) => {
  const [editMode, setEditMode] = useState(false);
  const [performance, setPerformance] = useState({
    punctuality: 0,
    participation: 0,
    assignments: 0,
    overallScore: 0
  });

  const [studentNotes, setStudentNotes] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calendarOpen, setCalendarOpen] = useState(true);
  const [calendarDays, setCalendarDays] = useState([]);
  const [trendData, setTrendData] = useState([]);

  useEffect(() => {
    if (student && isOpen) {
      console.log('🔍 Opening modal for student:', student);
    
      const studentCalendarRef = ref(database, `attendance/students/${student.id}/calendar`);
      const summaryHistoryRef = ref(database, `attendance/summary/${student.id}/attendance_history`);
      const today = new Date().toISOString().split('T')[0];
      const todayDataRef = ref(database, `attendance/daily/${today}/${student.id}`);

    
      Promise.all([
        get(studentCalendarRef),
        get(summaryHistoryRef),
        get(todayDataRef)
      ]).then(([calendarSnapshot, historySnapshot, todaySnapshot]) => {

      
        const calendarData = calendarSnapshot.exists() ? calendarSnapshot.val() : {};
        const historyData = historySnapshot.exists() ? historySnapshot.val() : {};
      
        const mergedCalendar = { ...calendarData };
      
        Object.keys(historyData).forEach(date => {
          if (!mergedCalendar[date]) {
            const dayData = historyData[date];
    
            if (typeof dayData === 'string') {
              if (dayData === 'Present') {
                mergedCalendar[date] = {
                  percentage: 100,
                  status: 'Present',
                  timestamp: Date.now()
                };
              } else if (dayData === 'Absent') {
                mergedCalendar[date] = {
                  percentage: 0,
                  status: 'Absent',
                  timestamp: Date.now()
                };
              }
            } else if (typeof dayData === 'object' && dayData !== null) {
              mergedCalendar[date] = {
                percentage: dayData.percentage !== undefined ? dayData.percentage : 
                           (dayData.status === 'Present' || dayData === 'Present') ? 100 : 0,
                status: dayData.status || (dayData.percentage === 100 ? 'Present' : 'Absent'),
                timestamp: dayData.timestamp || Date.now(),
                ...dayData
              };
            } else if (dayData === true) {
              mergedCalendar[date] = {
                percentage: 100,
                status: 'Present',
                timestamp: Date.now()
              };
            }
          }
        });
                // Update student with today's subjects
        if (todaySnapshot.exists()) {
          const todayData = todaySnapshot.val();
          student.subjects = todayData.subjects || {};
        }


        const last30Days = [];
        const trendArray = [];

        for (let i = 29; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          const dateStr = date.toISOString().split('T')[0];
          last30Days.push(dateStr);
        }

        last30Days.forEach((dateStr) => {
          const dayData = mergedCalendar[dateStr];
          let percentage = 0;
  
          if (dayData) {
            if (typeof dayData === 'object' && dayData.percentage !== undefined) {
              percentage = dayData.percentage;
            } else if (dayData === true || dayData === 'Present' || dayData?.status === 'Present') {
              percentage = 100;
            } else if (dayData === false || dayData === 'Absent' || dayData?.status === 'Absent') {
              percentage = 0;
            }
          }

          trendArray.push({
            date: new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            attendance: percentage
          });
        });

        setTrendData(trendArray);

        const perfRef = ref(database, `attendance/students/${student.id}/performance`);
        get(perfRef).then((perfSnapshot) => {
          if (perfSnapshot.exists()) {
            const data = perfSnapshot.val();
            setPerformance({
              punctuality: data.punctuality || 0,
              participation: data.participation || 0,
              assignments: data.assignments || 0,
              overallScore: data.overallScore || 0
            });
          }
        });

        const notesRef = ref(database, `attendance/students/${student.id}/notes`);
        get(notesRef).then((notesSnapshot) => {
          if (notesSnapshot.exists()) {
            const notesData = notesSnapshot.val();
            if (Array.isArray(notesData)) {
              setStudentNotes(notesData);
            } else if (typeof notesData === 'object') {
              setStudentNotes(Object.values(notesData));
            } else {
              setStudentNotes([]);
            }
          } else {
            setStudentNotes([]);
          }
        });

        generateMonthCalendarWithData(currentMonth, mergedCalendar);

      }).catch((error) => {
        console.error('❌ Error fetching data:', error);
      });
    }
  }, [student, isOpen, currentMonth]);

  const generateMonthCalendarWithData = (date, calendarData) => {
    const year = date.getFullYear();
    const month = date.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();

    const days = [];

    for (let i = 0; i < startDayOfWeek; i++) {
      days.push({
        date: null,
        day: null,
        status: 'Empty'
      });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayDate = new Date(year, month, day);

      let status = 'Unknown';

      const dayData = calendarData[dateStr];
    
      if (dayData) {
        if (dayData === true || 
            dayData === 'Present' || 
            dayData?.status === 'Present' || 
            (typeof dayData === 'object' && dayData.percentage === 100)) {
          status = 'Present';
        } else if (dayData === false || 
                   dayData === 'Absent' || 
                   dayData?.status === 'Absent' || 
                   (typeof dayData === 'object' && dayData.percentage === 0)) {
          status = 'Absent';
        } else {
          status = 'Present';
        }
      } else if (dayDate < new Date()) {
        status = 'Absent';
      } else {
        status = 'Unknown';
      }

      days.push({
        date: dateStr,
        day: day,
        dayOfWeek: dayDate.toLocaleDateString('en-US', { weekday: 'short' }),
        status: status
      });
    }

    setCalendarDays(days);
  };

  const goToPreviousMonth = () => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(currentMonth.getMonth() - 1);
    setCurrentMonth(newMonth);
  };

  const goToNextMonth = () => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(currentMonth.getMonth() + 1);
    setCurrentMonth(newMonth);
  };

  const handleSavePerformance = async () => {
    try {
      const updates = {};
      updates[`attendance/students/${student.id}/performance`] = performance;

      await update(ref(database), updates);

      setEditMode(false);
      if (onUpdatePerformance) {
        onUpdatePerformance(student.id, performance);
      }

      alert('✅ Performance updated successfully!');
    } catch (error) {
      console.error('Error updating performance:', error);
      alert('❌ Failed to update performance');
    }
  };

  const handleAddNote = async () => {
    if (newNote.trim()) {
      const timestamp = new Date().toLocaleString('en-GB');
      const noteEntry = `${timestamp}: ${newNote}`;

      const updatedNotes = [...studentNotes, noteEntry];

      try {
        const updates = {};
        updates[`attendance/students/${student.id}/notes`] = updatedNotes;

        await update(ref(database), updates);

        setStudentNotes(updatedNotes);
        setNewNote('');
        alert('✅ Note added successfully!');
      } catch (error) {
        console.error('Error adding note:', error);
        alert('❌ Failed to add note');
      }
    }
  };

  const handleClose = () => {
    setStudentNotes([]);
    setNewNote('');
    setEditMode(false);
    setCurrentMonth(new Date());
    onClose();
  };

  if (!isOpen || !student) return null;

  const getInitials = (name) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const performanceMetrics = [
    { name: 'Attendance', value: student.overall, icon: '📊', color: '#10b981', editable: false },
    { name: 'Punctuality', value: performance.punctuality, icon: '⏰', color: '#3b82f6', editable: true },
    { name: 'Participation', value: performance.participation, icon: '🙋', color: '#f59e0b', editable: true },
    { name: 'Assignments', value: performance.assignments, icon: '📝', color: '#8b5cf6', editable: true },
    { name: 'Overall', value: performance.overallScore, icon: '⭐', color: '#ec4899', editable: true }
  ];

  const monthYearDisplay = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={handleClose}>
        <div className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>

          {/* Header */}
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-6 rounded-t-3xl sticky top-0 z-10">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-lg" style={{backgroundColor: '#3b82f6'}}>
                  {getInitials(student.name)}
                </div>
                <div>
                  <h2 className="text-3xl font-bold">{student.name}</h2>
                  <p className="text-blue-100 text-lg">ID: {student.id}</p>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="px-3 py-1 bg-white bg-opacity-20 rounded-full text-sm font-semibold">
                      Overall: {student.overall}%
                    </span>
                    {student.streak > 0 && (
                      <span className="px-3 py-1 bg-orange-500 bg-opacity-80 rounded-full text-sm font-semibold flex items-center gap-1">
                        🔥 {student.streak} Day Streak
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button onClick={handleClose} className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">

            {/* Performance Metrics Section */}
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-2xl font-bold flex items-center gap-2">
                  <span>📊</span> Performance Metrics
                </h3>
                <div className="flex gap-2">
                  {editMode ? (
                    <>
                      <button onClick={handleSavePerformance} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold transition">
                        💾 Save
                      </button>
                      <button onClick={() => setEditMode(false)} className="px-4 py-2 bg-gray-400 hover:bg-gray-500 text-white rounded-xl font-semibold transition">
                        ✖️ Cancel
                      </button>
                    </>
                  ) : (
                    <button onClick={() => setEditMode(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition">
                      ✏️ Edit
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-5 gap-3">
                {performanceMetrics.map((metric, index) => (
                  <div key={index} className="bg-white rounded-xl p-4 shadow-md hover-lift transition">
                    <div className="text-center">
                      <div className="text-3xl mb-2">{metric.icon}</div>
                      <h4 className="font-bold text-gray-700 text-sm mb-2">{metric.name}</h4>

                      {editMode && metric.editable ? (
                        <input 
                          type="number" 
                          min="0" 
                          max="100"
                          value={metric.name === 'Punctuality' ? performance.punctuality : metric.name === 'Participation' ? performance.participation : metric.name === 'Assignments' ? performance.assignments : performance.overallScore}
                          onChange={(e) => {
                            const value = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                            setPerformance({
                              ...performance,
                              [metric.name === 'Punctuality' ? 'punctuality' : metric.name === 'Participation' ? 'participation' : metric.name === 'Assignments' ? 'assignments' : 'overallScore']: value
                            });
                          }}
                          className="w-full px-2 py-1 border-2 border-blue-300 rounded-lg text-center font-bold text-lg"
                        />
                      ) : (
                        <div className="relative inline-flex">
                          <svg width="60" height="60" className="transform -rotate-90">
                            <circle cx="30" cy="30" r="25" stroke="#e5e7eb" strokeWidth="4" fill="none" />
                            <circle cx="30" cy="30" r="25" stroke={metric.color} strokeWidth="4" fill="none" strokeDasharray={157} strokeDashoffset={157 - (157 * metric.value / 100)} strokeLinecap="round" className="transition-all duration-500" />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-sm font-bold">{metric.value}%</span>
                          </div>
                        </div>
                      )}

                      {!editMode && (
                        <div className="mt-2 h-1 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500" style={{width: metric.value + '%', backgroundColor: metric.color}}></div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {!editMode && performanceMetrics.filter(m => m.editable).every(m => m.value === 0) && (
                <div className="mt-4 p-3 bg-yellow-100 border-l-4 border-yellow-500 rounded-lg">
                  <p className="text-yellow-800 text-sm font-medium">
                    ⚠️ No performance data entered yet. Click "Edit" to add scores for this student.
                  </p>
                </div>
              )}
            </div>

            {/* 30-Day Attendance Trend */}
            <div className="bg-white rounded-2xl p-6 shadow-lg">
              <h3 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <span>📈</span> 30-Day Attendance Trend
              </h3>
  
              {trendData && trendData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="colorTrend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="date" 
                      stroke="#6b7280"
                      style={{ fontSize: '12px' }}
                    />
                    <YAxis 
                      domain={[0, 100]} 
                      stroke="#6b7280" 
                      ticks={[0, 25, 50, 75, 100]}
                    />
                    <Tooltip
                      formatter={(value) => [`${value}%`, 'Attendance']}
                      labelFormatter={(label) => `Date: ${label}`}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="attendance" 
                      stroke="#3b82f6" 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorTrend)" 
                      dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <p>📊 Loading attendance data...</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-6">

              {/* Subject Breakdown */}
              <div className="bg-white rounded-2xl p-6 shadow-lg">
                <h3 className="text-2xl font-bold mb-4 flex items-center gap-2">
                  <span>📊</span> Subject Breakdown
                </h3>
                <div className="space-y-4">
                  {student.subjects && Object.keys(student.subjects).length > 0 ? (
                    Object.entries(student.subjects).map(([subject, status]) => (
                      <div key={subject} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <span className="font-medium text-gray-700">
                          {subject.replace(/_/g, ' ')}
                        </span>
                        <span className={`font-bold ${
                          status === 'Present' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {status}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-400 text-center py-4">No subject data available for today</p>
                  )}
                </div>
              </div>

              {/* Quick Stats */}
              <div className="bg-white rounded-2xl p-6 shadow-lg">
                <h3 className="text-2xl font-bold mb-4 flex items-center gap-2">
                  <span>📈</span> Quick Stats
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                    <span className="font-medium text-gray-700">Total Days Present</span>
                    <span className="text-2xl font-bold text-green-600">
                      {Object.keys(student.lastAttendance || {}).filter(date => {
                        const dayData = student.lastAttendance[date];
                        return dayData === 'Present' || 
                          dayData === true || 
                          dayData?.status === 'Present' || 
                          dayData?.percentage === 100;
                      }).length}
                    </span>
                  </div>

                  <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                    <span className="font-medium text-gray-700">Subjects Today</span>
                    <span className="text-2xl font-bold text-purple-600">
                      {Object.keys(student.subjects || {}).length} / {Object.keys(student.subjects || {}).length}
                    </span>
                  </div>

                  <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                    <span className="font-medium text-gray-700">Overall %</span>
                    <span className="text-2xl font-bold text-blue-600">
                      {student.overall || 0}%
                    </span>
                  </div>

                  <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                    <span className="font-medium text-gray-700">Status</span>
                    <span className={`px-4 py-2 rounded-full font-bold ${
                      student.status === 'Present' 
                        ? 'bg-green-500 text-white' 
                        : 'bg-red-500 text-white'
                      }`}>
                      {student.status}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Month Calendar with Navigation - COLLAPSIBLE */}
            <div className="bg-white rounded-2xl p-6 shadow-lg">
              <div className="flex items-center justify-between cursor-pointer mb-4" onClick={() => setCalendarOpen(!calendarOpen)}>
                <h3 className="text-2xl font-bold flex items-center gap-2">
                  <span>📅</span> Attendance Calendar
                </h3>
                <svg className={"w-8 h-8 text-blue-600 transition-transform duration-300 " + (calendarOpen ? "rotate-180" : "")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                </svg>
              </div>

              {calendarOpen && (
                <>
                  <div className="flex justify-between items-center mb-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white p-4 rounded-xl">
                    <button onClick={goToPreviousMonth} className="hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <h4 className="text-xl font-bold">{monthYearDisplay}</h4>
                    <button onClick={goToNextMonth} className="hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>

                  <div className="grid grid-cols-7 gap-2 mb-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                      <div key={index} className="text-center font-bold text-gray-700 text-sm py-2">
                        {day}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-2">
                    {calendarDays.map((day, index) => (
                      <div key={index} className="text-center">
                        {day.date ? (
                          <div className={"w-full aspect-square rounded-lg flex items-center justify-center text-sm font-bold transition cursor-pointer hover:scale-105 " + 
                            (day.status === 'Present' ? 'bg-green-500 text-white shadow-md' : 
                             day.status === 'Absent' ? 'bg-red-500 text-white shadow-md' : 
                             'bg-gray-200 text-gray-400')}>
                            {day.day}
                          </div>
                        ) : (
                          <div className="w-full aspect-square"></div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-center gap-6 mt-4 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-green-500 rounded"></div>
                      <span>Present</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-red-500 rounded"></div>
                      <span>Absent</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-gray-200 rounded"></div>
                      <span>Unknown</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Notes Section - Per Student */}
            <div className="bg-white rounded-2xl p-6 shadow-lg">
              <h3 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <span>📝</span> Teacher's Notes for {student.name}
              </h3>
              <div className="mb-4">
                <textarea 
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder={"Add a note about " + student.name + "..."}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none resize-none"
                  rows="3"
                />
                <button onClick={handleAddNote} className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition">
                  Add Note
                </button>
              </div>
              {studentNotes.length > 0 ? (
                <div className="bg-gray-50 rounded-xl p-4 space-y-2 max-h-64 overflow-y-auto">
                  {studentNotes.map((note, index) => (
                    <div key={index} className="bg-white p-3 rounded-lg shadow-sm border-l-4 border-blue-500">
                      <p className="text-sm text-gray-700">{note}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <p className="text-sm">No notes yet for this student</p>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </>
  );
};

// ==================== PERFORMANCE CARD COMPONENT ====================
const PerformanceCard = ({ title, score, icon, color, delay }) => {
  return (
    <div className="bg-white rounded-2xl p-4 border-2 border-gray-200 hover:border-blue-400 transition hover-lift slide-in" style={{animationDelay: delay}}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-3xl">{icon}</span>
        <CircularProgress percentage={score} size={70} strokeWidth={6} color={color} />
      </div>
      <h4 className="font-bold text-gray-800 text-sm">{title}</h4>
      <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-1000" style={{width: score + '%', backgroundColor: color}}></div>
      </div>
    </div>
  );
};


// ==================== MAIN FACULTY DASHBOARD COMPONENT ====================
function FacultyDashboard() {
  const navigate = useNavigate();

  // ==================== STATE MANAGEMENT ====================
  const [todayAttendance, setTodayAttendance] = useState([]);
  const [presentCount, setPresentCount] = useState(0);
  const [absentCount, setAbsentCount] = useState(0);
  const [atRiskStudents, setAtRiskStudents] = useState([]);
  const [showAtRisk, setShowAtRisk] = useState(true);
  const [showTopPerformers, setShowTopPerformers] = useState(true);

  const [studentMarks, setStudentMarks] = useState({});
  const [showMarksSection, setShowMarksSection] = useState(true);
  const [selectedStudentForMarks, setSelectedStudentForMarks] = useState(null);

  const [assignments, setAssignments] = useState([]);
  
  const [showAssignments, setShowAssignments] = useState(true);
  const [showAddAssignment, setShowAddAssignment] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [events, setEvents] = useState([]);
  const [showEventModal, setShowEventModal] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: '',
    date: '',
    time: '',
    type: 'meeting',
    description: ''
  });

  const [newAssignment, setNewAssignment] = useState({
    title: '',
    subject: 'IoT',
    dueDate: '',
    maxMarks: '',
    submissions: {}
  });

  const [isAddingMark, setIsAddingMark] = useState(false);
  const [newMark, setNewMark] = useState({ subject: '', marks: '' });

  const [absenceStreakStudents, setAbsenceStreakStudents] = useState([]);
  const [showAbsenceStreak, setShowAbsenceStreak] = useState(true);

  const [showStudentList, setShowStudentList] = useState(true);
  const [showMarkAttendance, setShowMarkAttendance] = useState(false);
  const [editableAttendance, setEditableAttendance] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  const [totalStudents, setTotalStudents] = useState(3);
  const [attendancePercentage, setAttendancePercentage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [subjectData, setSubjectData] = useState([]);
  const [selectedStudentTrend, setSelectedStudentTrend] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [performanceData, setPerformanceData] = useState([]);
  const [topPerformers, setTopPerformers] = useState([]);

  const [selectedStudent, setSelectedStudent] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  // ==================== SIDEBAR STATE ====================
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeSection, setActiveSection] = useState('dashboard');
  const [parentInfoData, setParentInfoData] = useState({});
  const [editingParent, setEditingParent] = useState(null);
  const [showParentModal, setShowParentModal] = useState(false);
  const [parentForm, setParentForm] = useState({
    fatherName: '',
    fatherPhone: '',
    fatherEmail: '',
    motherName: '',
    motherPhone: '',
    address: ''
  });
  const [isEditMode, setIsEditMode] = useState(false);




  // ==================== FIREBASE DATA LOADING ====================
  useEffect(() => {
    const summaryRef = ref(database, 'attendance/summary');
    const studentsRef = ref(database, 'attendance/students');
    const dailyRef = ref(database, 'attendance/daily');

    let summaryData = {};
    let studentsData = {};
    let dailyData = {};

    const mergeAndProcess = () => {
      const mergedData = {};
      
      Object.keys(IOT_B_STUDENTS).forEach(studentId => {
        mergedData[studentId] = {
          ...summaryData[studentId],
          attendance_history: studentsData[studentId]?.calendar || studentsData[studentId]?.attendance_history || {}
        };
      });

      const today = new Date().toISOString().split('T')[0];
      const todayDaily = dailyData[today] || {};

      processAllStudents({ summary: mergedData, daily: todayDaily });
      setTimeout(() => setLoading(false), 800);
    };

    const unsubscribeSummary = onValue(summaryRef, (snapshot) => {
      console.log('🔥 Firebase Summary Updated:', snapshot.val());
      summaryData = snapshot.val() || {};
      mergeAndProcess();
    });

    const unsubscribeStudents = onValue(studentsRef, (snapshot) => {
      console.log('🔥 Firebase Students Updated:', snapshot.val());
      studentsData = snapshot.val() || {};
      mergeAndProcess();
    });

    const unsubscribeDaily = onValue(dailyRef, (snapshot) => {
      console.log('🔥 Firebase Daily Updated:', snapshot.val());
      dailyData = snapshot.val() || {};
      mergeAndProcess();
    });

    return () => {
      unsubscribeSummary();
      unsubscribeStudents();
      unsubscribeDaily();
    };
  }, []);

  // Load events from Firebase
useEffect(() => {
  const eventsRef = ref(database, 'events');
  
  const unsubscribe = onValue(eventsRef, (snapshot) => {
    const data = snapshot.val();
    console.log('Events from Firebase:', data);
    
    if (data) {
      const eventsList = Object.entries(data).map(([id, event]) => ({
        id,
        ...event,
        responses: event.responses || {}
      }));
      
      // Sort by date (newest first)
      eventsList.sort((a, b) => new Date(b.date) - new Date(a.date));
      setEvents(eventsList);
    } else {
      setEvents([]);
    }
  });
  
  return () => unsubscribe();
}, []);


    useEffect(() => {
    loadStudentMarks();
    loadAssignments();
  }, []);


  // ==================== DATA PROCESSING FUNCTIONS ====================
  const processAllStudents = (firebaseData) => {
    const today = new Date().toISOString().split('T')[0];
    const attendanceList = [];
    let presentToday = 0;
    let absentToday = 0;

    const todayDaily = firebaseData?.daily || {};
    const summaryData = firebaseData?.summary || {};

    Object.keys(IOT_B_STUDENTS).forEach((studentId) => {
      const studentData = IOT_B_STUDENTS[studentId];
      const studentName = typeof studentData === 'string' ? studentData : studentData?.name;


      const firebaseStudent = summaryData[studentId];
      
      const studentInfo = {
        id: studentId,
        name: studentName,
        email: studentData?.email || 'N/A',
        phone: studentData?.phone || 'N/A',
        status: 'Absent',
        percentage: 0,
        overall: firebaseStudent?.overall_percentage || 0,
        timestamp: null,
        subjects: {},
        lastSeen: null,
        streak: 0,
        lastAttendance: firebaseStudent?.attendance_history || {}
      };

            const todayAttendance = todayDaily[studentId];
      
      // Check if attendance exists for today
      if (todayAttendance) {
        // Check the status field explicitly
        const status = todayAttendance.status;
        
        if (status === 'Present') {
          studentInfo.status = 'Present';
          studentInfo.percentage = 100;
          studentInfo.timestamp = todayAttendance.timestamp || Date.now();
          studentInfo.subjects = todayAttendance.subjects || {};
          presentToday++;
        } else {
          // Status is 'Absent' or anything else
          studentInfo.status = 'Absent';
          studentInfo.percentage = 0;
          absentToday++;
        }
      } else {
        // No record for today = Absent
        studentInfo.status = 'Absent';
        studentInfo.percentage = 0;
        absentToday++;
      }


      if (firebaseStudent?.attendance_history) {
        let streakCount = 0;
        const sortedDates = Object.keys(firebaseStudent.attendance_history).sort().reverse();
        
        for (let date of sortedDates) {
          if (firebaseStudent.attendance_history[date] === 'Present' || 
              firebaseStudent.attendance_history[date]?.status === 'Present') {
            streakCount++;
          } else {
            break;
          }
        }
        studentInfo.streak = streakCount;
      }

      attendanceList.push(studentInfo);
    });

    const percentage = totalStudents > 0 ? Math.round((presentToday / totalStudents) * 100) : 0;

    setTodayAttendance(attendanceList);
    setPresentCount(presentToday);
    setAbsentCount(absentToday);
    setAttendancePercentage(percentage);
    console.log('📊 Attendance List for Subject Data:', attendanceList);


    generateSubjectData(attendanceList);

    generateTrendData(summaryData);
    generatePerformanceData(percentage);
    identifyAtRiskStudents(attendanceList);
    identifyAbsenceStreaks();
    identifyTopPerformers(attendanceList);
  };

  const generateSubjectData = (attendanceList) => {
  
  
  const subjectStats = {};
  const totalStudents = Object.keys(IOT_B_STUDENTS).length; // Total = 3

  ACTUAL_SUBJECTS.forEach(subject => {
    subjectStats[subject] = { present: 0, total: totalStudents };
  });

  attendanceList.forEach(student => {
    // Extract subjects from lastAttendance (today's date)
    const today = new Date().toISOString().split('T')[0];
    const todayData = student.lastAttendance?.[today];
    const subjects = todayData?.subjects || student.subjects || {};
    
    
    if (subjects && Object.keys(subjects).length > 0) {
      ACTUAL_SUBJECTS.forEach(subject => {
        const status = subjects[subject];
        if (status === 'Present') {
          subjectStats[subject].present++;
        }
      });
    }
  });

  const chartData = ACTUAL_SUBJECTS.map(subject => {
    const stats = subjectStats[subject];
    const attendance = Math.round((stats.present / totalStudents) * 100);

    return {
      name: subject,
      attendance: attendance,
      target: 75,
      present: stats.present,
      absent: totalStudents - stats.present,
      students: totalStudents
    };
  });

  console.log('📊 Final Subject Chart Data:', chartData);
  setSubjectData(chartData);
};



  const generateTrendData = (summaryData) => {
  const last7Days = [];
  const trendArray = [];

  // Generate last 7 days dates
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    last7Days.push(dateStr);
  }

  // For each day, count how many students were present
  last7Days.forEach(dateStr => {
    let presentCount = 0;
    
      

    
    // Check each student's attendance for this date
    Object.keys(IOT_B_STUDENTS).forEach(studentId => {
      const student = summaryData[studentId];
      console.log(`  Student ${studentId}:`, student?.attendance_history?.[dateStr]);

      if (student && student.attendance_history) {
        const dayStatus = student.attendance_history[dateStr];
        if (dayStatus === 'Present' ||
            dayStatus === true || 
            dayStatus?.status === 'Present' ||
            dayStatus?.percentage === 100) {
          presentCount++;
        }
      }
    });
    


    const percentage = Math.round((presentCount / totalStudents) * 100);

    trendArray.push({
      date: new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      attendance: percentage,
      target: 75,
      present: presentCount,
      absent: totalStudents - presentCount
    });
  });

  setTrendData(trendArray);
};


    const generatePerformanceData = (attendancePercentage) => {
    // Calculate Punctuality (students arriving on time)
    // For now, we'll estimate based on attendance
    const punctuality = Math.min(100, attendancePercentage + Math.floor(Math.random() * 10));
    
    // Calculate Participation (from performance data if available)
    let totalParticipation = 0;
    let participationCount = 0;
    todayAttendance.forEach(student => {
      // If you have performance.participation in Firebase, use it
      // For now, using overall as estimate
      if (student.overall > 0) {
        totalParticipation += student.overall;
        participationCount++;
      }
    });
    const participation = participationCount > 0 
      ? Math.round(totalParticipation / participationCount) 
      : attendancePercentage;
    
    // Calculate Assignments completion (from assignments state)
    let assignmentsScore = 0;
    if (assignments.length > 0) {
      let totalSubmissions = 0;
      let totalPossible = 0;
      
      assignments.forEach(assignment => {
        const submissions = assignment.submissions || {};
        const submitted = Object.values(submissions).filter(Boolean).length;
        const total = Object.keys(submissions).length;
        
        totalSubmissions += submitted;
        totalPossible += total;
      });
      
      assignmentsScore = totalPossible > 0 
        ? Math.round((totalSubmissions / totalPossible) * 100) 
        : 0;
    } else {
      assignmentsScore = attendancePercentage; // Default to attendance if no assignments
    }
    
    // Calculate Overall (average of all metrics)
    const overall = Math.round(
      (attendancePercentage + punctuality + participation + assignmentsScore) / 4
    );
    
    const perfData = [
      { category: 'Attendance', score: attendancePercentage, icon: '📊', color: '#10b981' },
      { category: 'Punctuality', score: punctuality, icon: '⏰', color: '#3b82f6' },
      { category: 'Participation', score: participation, icon: '🙋', color: '#f59e0b' },
      { category: 'Assignments', score: assignmentsScore, icon: '📝', color: '#8b5cf6' },
      { category: 'Overall', score: overall, icon: '⭐', color: '#ec4899' }
    ];
    
    setPerformanceData(perfData);
  };


  const identifyAtRiskStudents = (studentsList) => {
    const atRisk = studentsList.filter(student => {
      return student.overall < 75;
    }).map(student => ({
      ...student,
      riskLevel: student.overall < 70 ? 'Critical' : 'Warning',
      riskColor: student.overall < 70 ? 'red' : 'orange'
    })).sort((a, b) => a.overall - b.overall);

    setAtRiskStudents(atRisk);
  };

  const identifyAbsenceStreaks = async () => {
    try {
      const streakStudents = [];
      const minStreakDays = 3;
    
      for (const studentId of Object.keys(IOT_B_STUDENTS)) {
        const calendarRef = ref(database, `attendance/students/${studentId}/calendar`);
        const snapshot = await get(calendarRef);
      
        if (snapshot.exists()) {
          const calendarData = snapshot.val();
        
          const sortedDates = Object.keys(calendarData).sort().reverse();
        
          let consecutiveAbsences = 0;
          let lastPresentDate = null;
          let streakDates = [];
        
          for (const date of sortedDates) {
            const dayData = calendarData[date];
            const status = dayData.status || (dayData.percentage === 0 ? 'Absent' : 'Present');
          
            if (status === 'Absent' || status === 'absent') {
              consecutiveAbsences++;
              streakDates.push(date);
            } else {
              lastPresentDate = date;
              break;
            }
          }
        
          if (consecutiveAbsences >= minStreakDays) {
            const studentInfo = todayAttendance.find(s => s.id === studentId);
          
            if (studentInfo) {
              streakStudents.push({
                ...studentInfo,
                streakDays: consecutiveAbsences,
                lastPresentDate: lastPresentDate,
                streakDates: streakDates,
                severity: consecutiveAbsences >= 5 ? 'Critical' : 'Warning'
              });
            }
          }
        }
      }
    
      streakStudents.sort((a, b) => b.streakDays - a.streakDays);
    
      setAbsenceStreakStudents(streakStudents);
    
    } catch (error) {
      console.error('❌ Error identifying absence streaks:', error);
    }
  };

  const identifyTopPerformers = (attendanceList) => {
    const topStudents = attendanceList.filter(s => s.overall >= 90).sort((a, b) => b.overall - a.overall).slice(0, 5);
    setTopPerformers(topStudents);
  };

  // ==================== MARKS AND ASSIGNMENTS FUNCTIONS ====================
  const loadStudentMarks = () => {
    try {
      const marksRef = ref(database, 'classes/IoT-B/studentMarks');
      onValue(marksRef, (snapshot) => {
        if (snapshot.exists()) {
          setStudentMarks(snapshot.val());
        } else {
          setStudentMarks({});
        }
      });
    } catch (error) {
      console.error('❌ Error loading marks:', error);
    }
  };

  const loadAssignments = () => {
    try {
      const assignmentsRef = ref(database, 'classes/IoT-B/assignments');
      onValue(assignmentsRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          const assignmentsArray = Object.values(data);
          setAssignments(assignmentsArray);
        } else {
          setAssignments([]);
        }
      });
    } catch (error) {
      console.error('❌ Error loading assignments:', error);
    }
  };

  const handleCreateAssignment = async () => {
    try {
      if (!newAssignment.title.trim()) {
        alert('Please enter assignment title');
        return;
      }
      
      if (!newAssignment.dueDate) {
        alert('Please select due date');
        return;
      }

      if (!newAssignment.maxMarks || newAssignment.maxMarks <= 0) {
        alert('Please enter valid max marks');
        return;
      }

      const initialSubmissions = {};
      todayAttendance.forEach(student => {
        initialSubmissions[student.id] = false;
      });

      const assignmentId = Date.now();
      const assignmentData = {
        id: assignmentId,
        title: newAssignment.title.trim(),
        subject: newAssignment.subject,
        dueDate: newAssignment.dueDate,
        maxMarks: parseInt(newAssignment.maxMarks),
        submissions: initialSubmissions,
        createdAt: new Date().toISOString(),
        createdBy: 'Prof. Sharma'
      };

      const assignmentRef = ref(database, `classes/IoT-B/assignments/${assignmentId}`);
      await set(assignmentRef, assignmentData);

      setAssignments([...assignments, assignmentData]);

      setNewAssignment({
        title: '',
        subject: 'IoT',
        dueDate: '',
        maxMarks: '',
        submissions: {}
      });
      setShowAddAssignment(false);

      alert('✅ Assignment created successfully!');

    } catch (error) {
      console.error('❌ Error creating assignment:', error);
      alert('Failed to create assignment. Please try again.');
    }
  };

  const handleToggleSubmission = async (assignmentId, studentId) => {
    try {
      const assignment = assignments.find(a => a.id === assignmentId);
      if (!assignment) return;

      const updatedSubmissions = {
        ...assignment.submissions,
        [studentId]: !assignment.submissions[studentId]
      };

      const submissionsRef = ref(database, `classes/IoT-B/assignments/${assignmentId}/submissions`);
      await set(submissionsRef, updatedSubmissions);

      const updatedAssignments = assignments.map(a => {
        if (a.id === assignmentId) {
          return { ...a, submissions: updatedSubmissions };
        }
        return a;
      });
      setAssignments(updatedAssignments);

    } catch (error) {
      console.error('❌ Error updating submission:', error);
      alert('Failed to update submission status.');
    }
  };

  const handleDeleteAssignment = async (assignmentId) => {
    try {
      if (!window.confirm('Are you sure you want to delete this assignment?')) {
        return;
      }

      const assignmentRef = ref(database, `classes/IoT-B/assignments/${assignmentId}`);
      await remove(assignmentRef);

      setAssignments(assignments.filter(a => a.id !== assignmentId));

      alert('✅ Assignment deleted successfully!');

    } catch (error) {
      console.error('❌ Error deleting assignment:', error);
      alert('Failed to delete assignment.');
    }
  };

  // Handle create new event
const handleCreateEvent = async () => {
  if (!newEvent.title || !newEvent.date || !newEvent.time) {
    alert('Please fill in all required fields');
    return;
  }

  try {
    const eventsRef = ref(database, 'events');
    const newEventRef = push(eventsRef);
    
    await set(newEventRef, {
      title: newEvent.title,
      date: newEvent.date,
      time: newEvent.time,
      type: newEvent.type,
      description: newEvent.description,
      createdBy: 'faculty',
      createdAt: Date.now(),
      responses: {}
    });

    alert('✅ Event created successfully!');
    setShowEventModal(false);
    setNewEvent({
      title: '',
      date: '',
      time: '',
      type: 'meeting',
      description: ''
    });
  } catch (error) {
    console.error('Error creating event:', error);
    alert('❌ Failed to create event');
  }
};

// Handle delete event
const handleDeleteEvent = async (eventId) => {
  if (!window.confirm('Are you sure you want to delete this event?')) {
    return;
  }

  try {
    const eventRef = ref(database, `events/${eventId}`);
    await remove(eventRef);
    alert('✅ Event deleted successfully!');
  } catch (error) {
    console.error('Error deleting event:', error);
    alert('❌ Failed to delete event');
  }
};


  const handleAddMarkForStudent = async (studentId, studentName) => {
    try {
      if (!newMark.subject.trim() || !newMark.marks) {
        alert('Please enter both subject name and marks');
        return;
      }

      const marks = parseInt(newMark.marks);
      if (marks < 0 || marks > 100) {
        alert('Marks must be between 0 and 100');
        return;
      }

      const markId = Date.now();
      const newMarkData = {
        id: markId,
        subject: newMark.subject.trim(),
        marks: marks,
        addedAt: new Date().toISOString()
      };

      const currentMarks = studentMarks[studentId]?.subjects || [];
      const updatedMarks = [...currentMarks, newMarkData];

      const studentMarksRef = ref(database, `classes/IoT-B/studentMarks/${studentId}`);
      await set(studentMarksRef, {
        studentId: studentId,
        studentName: studentName,
        subjects: updatedMarks
      });

      setStudentMarks({
        ...studentMarks,
        [studentId]: {
          studentId: studentId,
          studentName: studentName,
          subjects: updatedMarks
        }
      });

      setNewMark({ subject: '', marks: '' });
      setIsAddingMark(false);
      
    } catch (error) {
      console.error('❌ Error adding mark:', error);
      alert('Failed to add mark. Please try again.');
    }
  };

  const handleDeleteMarkForStudent = async (studentId, markId) => {
    try {
      if (!window.confirm('Are you sure you want to delete this mark?')) {
        return;
      }

      const currentMarks = studentMarks[studentId]?.subjects || [];
      const updatedMarks = currentMarks.filter(m => m.id !== markId);

      const studentMarksRef = ref(database, `classes/IoT-B/studentMarks/${studentId}/subjects`);
      await set(studentMarksRef, updatedMarks);

      setStudentMarks({
        ...studentMarks,
        [studentId]: {
          ...studentMarks[studentId],
          subjects: updatedMarks
        }
      });
      
    } catch (error) {
      console.error('❌ Error deleting mark:', error);
      alert('Failed to delete mark. Please try again.');
    }
  };

  // ==================== ATTENDANCE MARKING FUNCTIONS ====================
    const saveManualAttendance = async () => {
    setIsSaving(true);
  
    try {
      const today = new Date().toISOString().split('T')[0];
      const timestamp = Date.now();
    
      // Count present and absent BEFORE saving
      const presentCount = Object.values(editableAttendance).filter(v => v).length;
      const absentCount = Object.values(editableAttendance).filter(v => !v).length;
      const totalStudents = Object.keys(editableAttendance).length;

      // Loop through each student and save their attendance
      for (const studentId of Object.keys(editableAttendance)) {
        const isPresent = editableAttendance[studentId];
        const status = isPresent ? 'Present' : 'Absent';
        const studentName = IOT_B_STUDENTS[studentId] || 'Unknown';
      
        // Update daily attendance
        await update(ref(database, `attendance/daily/${today}/${studentId}`), {
          status: status,
          student_name: studentName,
          subjects: {
            IoT: status,
            Python: status,
            AI: status
          },
          timestamp: timestamp
        });
      
        // Update student's calendar
        await update(ref(database, `attendance/students/${studentId}/calendar/${today}`), {
          percentage: isPresent ? 100 : 0,
          status: status,
          subjects: {
            IoT: status,
            Python: status,
            AI: status
          },
          timestamp: timestamp
        });
      
        // Calculate overall percentage for this student
        const historyRef = ref(database, `attendance/students/${studentId}/calendar`);
        const historySnapshot = await get(historyRef);
      
        let studentTotalDays = 0;
        let studentPresentDays = 0;
      
        if (historySnapshot.exists()) {
          const calendarData = historySnapshot.val();
          Object.values(calendarData).forEach(dayData => {
            studentTotalDays++;
            if (dayData.percentage === 100 || dayData.status === 'Present') {
              studentPresentDays++;
            }
          });
        }
      
        const overallPercentage = studentTotalDays > 0 
          ? Math.round((studentPresentDays / studentTotalDays) * 100) 
          : 0;
      
        // Update summary for this student
        await update(ref(database, `attendance/summary/${studentId}`), {
          student_name: studentName,
          overall_percentage: overallPercentage,
          total_days: studentTotalDays,
          present_days: studentPresentDays,
          absent_days: studentTotalDays - studentPresentDays,
          last_updated: timestamp,
          status: status,
          subjects: {
            AI: status,
            IoT: status,
            Python: status
          },
          [`attendance_history/${today}`]: status
        });
      }
    
      // Update daily summary with correct counts
      await update(ref(database, `attendance/daily/${today}`), {
        present_count: presentCount,
        absent_count: absentCount,
        total_students: totalStudents,
        attendance_percentage: Math.round((presentCount / totalStudents) * 100),
        last_updated: timestamp
      });
    
            alert(`✅ Attendance saved successfully!\n📊 Present: ${presentCount}/${totalStudents}\n❌ Absent: ${absentCount}/${totalStudents}`);
      
      // Close the form
      setShowMarkAttendance(false);
      setEditableAttendance({});
      
      // Manually update the todayAttendance state with new data
      const updatedAttendance = todayAttendance.map(student => {
        if (editableAttendance[student.id] !== undefined) {
          return {
            ...student,
            status: editableAttendance[student.id] ? 'Present' : 'Absent',
            percentage: editableAttendance[student.id] ? 100 : 0
          };
        }
        return student;
      });
      
      setTodayAttendance(updatedAttendance);
      setPresentCount(presentCount);
      setAbsentCount(absentCount);
      const newPercentage = Math.round((presentCount / totalStudents) * 100);
      setAttendancePercentage(newPercentage);

      // Update performance data with new attendance
      generatePerformanceData(newPercentage);
    
    } catch (error) {
      console.error('❌ Error saving attendance:', error);
      alert('Error saving attendance: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };



  // ==================== UTILITY FUNCTIONS ====================
  const handleExport = () => {
    const today = new Date().toLocaleDateString();
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "IoT-B Attendance Report\n";
    csvContent += "Date: " + today + "\n";
    csvContent += "Total: " + totalStudents + ", Present: " + presentCount + ", Absent: " + absentCount + "\n\n";
    csvContent += "ID,Name,Status,Overall %,Streak,Subjects\n";

    todayAttendance.forEach(function(student) {
      const subjectsStr = Object.keys(student.subjects).map(s => s + ':' + student.subjects[s]).join(';');
      csvContent += student.id + "," + student.name + "," + student.status + "," + student.overall + "%," + student.streak + "," + subjectsStr + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "IoT-B_Attendance_" + today.replace(/\//g, '-') + ".csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getFilteredStudents = () => {
    let filtered = todayAttendance;
    if (filterStatus === 'present') filtered = filtered.filter(s => s.status === 'Present');
    else if (filterStatus === 'absent') filtered = filtered.filter(s => s.status === 'Absent');

    if (searchQuery) {
      filtered = filtered.filter(s => 
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.id.includes(searchQuery)
      );
    }

    return filtered;
  };

  const generateIndividualStudentTrend = (student) => {
    const last30Days = [];
    const trendArray = [];

    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      last30Days.push(dateStr);
    }

    last30Days.forEach((date) => {
      const dayData = student.lastAttendance?.[date];

      let percentage = 0;
      
      if (dayData) {
        if (dayData === 'Present' || dayData.status === 'Present') {
          percentage = 100;
        } else if (dayData === 'Absent' || dayData.status === 'Absent') {
          percentage = 0;
        }
      }

      trendArray.push({
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        attendance: percentage
      });
    });

    setSelectedStudentTrend(trendArray);
  };

  const handleStudentClick = (student) => {
    setSelectedStudent(student);
    generateIndividualStudentTrend(student);
    setModalOpen(true);
  };

  const handleUpdatePerformance = (studentId, performance) => {
    console.log('Performance updated for:', studentId, performance);
  };

  const filteredStudents = getFilteredStudents();

  const pieData = [
    { name: 'Present', value: presentCount },
    { name: 'Absent', value: absentCount }
  ];

  const getInitials = (name) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const getAvatarColor = (index) => {
    return AVATAR_COLORS[index % AVATAR_COLORS.length];
  };

  // ==================== RENDER CONTENT BASED ON ACTIVE SECTION ====================
  const renderContent = () => {
    switch(activeSection) {
      case 'dashboard':
        return renderDashboardContent();
      case 'students':
        return renderStudentsContent();
      case 'analytics':
        return renderAnalyticsContent();
      case 'assignments':
        return renderAssignmentsContent();
      case 'marks':
        return renderMarksContent();
      case 'attendance':
        return renderAttendanceContent();
      case 'parents':
        return renderParentsContent();
      case 'notifications': // ADD THIS CASE
        return renderNotificationsContent();

      default:
        return renderDashboardContent();
    }
  };

  // ==================== DASHBOARD CONTENT ====================
  const renderDashboardContent = () => (
    <>
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-400 via-green-500 to-emerald-600 rounded-3xl p-6 text-white shadow-2xl hover-lift premium-glow fade-in-up glow-animation">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full -mr-16 -mt-16"></div>
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-sm opacity-90 font-medium mb-1">Present Today</p>
                <p className="text-5xl font-bold"><AnimatedCounter end={presentCount} /></p>
              </div>
              <div className="text-5xl opacity-30">✅</div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="h-2 flex-1 bg-white bg-opacity-30 rounded-full overflow-hidden">
                <div className="h-full bg-white rounded-full transition-all duration-1000" style={{ width: presentCount > 0 ? (presentCount / totalStudents * 100) + '%' : '0%' }}></div>
              </div>
              <span className="font-semibold">{Math.round(presentCount / totalStudents * 100)}%</span>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden bg-gradient-to-br from-rose-400 via-red-500 to-rose-600 rounded-3xl p-6 text-white shadow-2xl hover-lift premium-glow fade-in-up pulse-animation" style={{animationDelay: '0.1s'}}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full -mr-16 -mt-16"></div>
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-sm opacity-90 font-medium mb-1">Absent Today</p>
                <p className="text-5xl font-bold"><AnimatedCounter end={absentCount} /></p>
              </div>
              <div className="text-5xl opacity-30">❌</div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="h-2 flex-1 bg-white bg-opacity-30 rounded-full overflow-hidden">
                <div className="h-full bg-white rounded-full transition-all duration-1000" style={{ width: absentCount > 0 ? (absentCount / totalStudents * 100) + '%' : '0%' }}></div>
              </div>
              <span className="font-semibold">{Math.round(absentCount / totalStudents * 100)}%</span>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden bg-gradient-to-br from-blue-400 via-blue-500 to-blue-600 rounded-3xl p-6 text-white shadow-2xl hover-lift premium-glow fade-in-up" style={{animationDelay: '0.2s'}}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full -mr-16 -mt-16"></div>
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-sm opacity-90 font-medium mb-1">Total Students</p>
                <p className="text-5xl font-bold"><AnimatedCounter end={totalStudents} /></p>
              </div>
              <div className="text-5xl opacity-30">👥</div>
            </div>
            <div className="flex items-center justify-between text-sm mt-2">
              <span>IoT-B Class</span>
              <span className="font-semibold">Section: B</span>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden bg-gradient-to-br from-purple-400 via-purple-500 to-purple-600 rounded-3xl p-6 text-white shadow-2xl hover-lift premium-glow fade-in-up" style={{animationDelay: '0.3s'}}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full -mr-16 -mt-16"></div>
          <div className="relative z-10">
            <p className="text-sm opacity-90 font-medium mb-2">Attendance Rate</p>
            <div className="flex items-center justify-center">
              <div className="relative">
                <svg width="100" height="100" className="transform -rotate-90">
                  <circle cx="50" cy="50" r="40" stroke="rgba(255,255,255,0.2)" strokeWidth="8" fill="none" />
                  <circle cx="50" cy="50" r="40" stroke="white" strokeWidth="8" fill="none" strokeDasharray={251.2} strokeDashoffset={251.2 - (251.2 * attendancePercentage / 100)} strokeLinecap="round" className="transition-all duration-1000" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold"><AnimatedCounter end={attendancePercentage} suffix="%" /></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Absence Streak Alert */}
      {absenceStreakStudents.length > 0 && (
        <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-2xl p-6 shadow-lg mb-6 border-2 border-red-300">
          <div 
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setShowAbsenceStreak(!showAbsenceStreak)}
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl animate-pulse">🔥</span>
              <h2 className="text-2xl font-bold text-red-700">
                Consecutive Absence Alert
              </h2>
              <span className="bg-red-600 text-white px-3 py-1 rounded-full text-sm font-bold animate-pulse">
                {absenceStreakStudents.length}
              </span>
            </div>
            <button className="text-2xl text-gray-400 hover:text-gray-600 transition-colors">
              {showAbsenceStreak ? '▼' : '▶'}
            </button>
          </div>

          {showAbsenceStreak && (
            <div className="mt-6 space-y-4">
              <div className="bg-red-100 border-l-4 border-red-600 p-4 rounded-lg mb-4">
                <p className="text-red-800 font-semibold">
                  ⚠️ <strong>Critical Alert:</strong> These students have been absent for multiple consecutive days. Immediate action required!
                </p>
              </div>

              <div className="space-y-3">
                {absenceStreakStudents.map((student) => (
                  <div 
                    key={student.id}
                    className={`p-4 rounded-xl border-2 ${
                      student.severity === 'Critical'
                        ? 'bg-red-100 border-red-400 shadow-red-200 shadow-lg' 
                        : 'bg-orange-100 border-orange-400'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                          <div className="relative">
                            <div className={`w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg ${
                              student.severity === 'Critical' ? 'bg-red-600' : 'bg-orange-600'
                            }`}>
                              {student.name.split(' ').map(n => n[0]).join('')}
                            </div>
                            <div className="absolute -top-1 -right-1 bg-yellow-400 rounded-full w-6 h-6 flex items-center justify-center">
                              <span className="text-xs font-bold">🔥</span>
                            </div>
                          </div>
                  
                          <div>
                            <h3 className="font-bold text-gray-800 text-lg">{student.name}</h3>
                            <p className="text-sm text-gray-600">ID: {student.id}</p>
                    
                            <div className="flex items-center gap-3 mt-2">
                              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                student.severity === 'Critical'
                                  ? 'bg-red-600 text-white' 
                                  : 'bg-orange-600 text-white'
                              }`}>
                                {student.streakDays} Days Absent
                              </span>
                      
                              {student.lastPresentDate && (
                                <span className="text-xs text-gray-600">
                                  Last present: <strong>{new Date(student.lastPresentDate).toLocaleDateString()}</strong>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                
                        <div className="flex flex-col gap-2">
                          <button 
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors font-bold"
                            onClick={() => handleStudentClick(student)}
                          >
                            📊 View Details
                          </button>
                          <button 
                            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors font-bold"
                            onClick={() => {
                              alert(`📧 Urgent notification sent to parent of ${student.name}\n\n⚠️ Student absent for ${student.streakDays} consecutive days!`);
                            }}
                          >
                            📧 Contact Parent
                          </button>
                        </div>
                      </div>
              
                      <div className="mt-3 flex items-center gap-2">
                        <span className="text-sm text-gray-700 font-semibold">Streak:</span>
                        {student.streakDates.slice(0, 5).reverse().map((date, idx) => (
                          <span 
                            key={idx}
                            className="px-2 py-1 bg-red-200 text-red-800 rounded text-xs font-mono"
                          >
                            {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        ))}
                        {student.streakDays > 5 && (
                          <span className="text-xs text-gray-600">
                            +{student.streakDays - 5} more
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 p-4 bg-white rounded-xl border border-red-200">
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <p className="text-3xl font-bold text-red-600">
                        {absenceStreakStudents.filter(s => s.severity === 'Critical').length}
                    </p>
                    <p className="text-sm text-gray-600">Critical (5+ days)</p>
                  </div>
                <div>
                  <p className="text-3xl font-bold text-orange-600">
                    {absenceStreakStudents.filter(s => s.severity === 'Warning').length}
                  </p>
                  <p className="text-sm text-gray-600">Warning (3-4 days)</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    )}

      {/* At-Risk Students */}
      {atRiskStudents.length > 0 && (
        <div className="bg-white rounded-2xl p-6 shadow-lg mb-6">
          <div 
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setShowAtRisk(!showAtRisk)}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <h2 className="text-2xl font-bold text-red-600">
                At-Risk Students
              </h2>
              <span className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                {atRiskStudents.length}
              </span>
            </div>
            <button className="text-2xl text-gray-400 hover:text-gray-600 transition-colors">
              {showAtRisk ? '▼' : '▶'}
            </button>
          </div>

          {showAtRisk && (
            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {atRiskStudents.map((student) => (
                  <div 
                    key={student.id}
                    className={`p-4 rounded-xl border-2 ${
                      student.riskLevel === 'Critical' 
                        ? 'bg-red-50 border-red-300' 
                        : 'bg-orange-50 border-orange-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg ${
                          student.riskLevel === 'Critical' ? 'bg-red-500' : 'bg-orange-500'
                        }`}>
                          {student.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-800">{student.name}</h3>
                          <p className="text-sm text-gray-600">ID: {student.id}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                              student.riskLevel === 'Critical' 
                                ? 'bg-red-200 text-red-800' 
                                : 'bg-orange-200 text-orange-800'
                            }`}>
                              {student.riskLevel}
                            </span>
                            <span className="text-lg font-bold text-gray-800">
                              {student.overall}%
                            </span>
                          </div>
                        </div>
                      </div>
                
                      <div className="flex flex-col gap-2">
                        <button 
                          className="px-3 py-1 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-colors"
                          onClick={() => {
                            const fullStudent = todayAttendance.find(s => s.id === student.id);
                            if (fullStudent) {
                              handleStudentClick(fullStudent);
                            }
                          }}
                        >
                          📊 View Details
                        </button>
                        <button 
                          className="px-3 py-1 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600 transition-colors"
                          onClick={() => {
                            alert(`📧 Email sent to parent of ${student.name}`);
                          }}
                        >
                          📧 Email Parent
                        </button>
                      </div>
                    </div>
              
                    <div className="mt-3">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-500 ${
                            student.riskLevel === 'Critical' ? 'bg-red-500' : 'bg-orange-500'
                          }`}
                          style={{ width: `${student.overall}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 p-4 bg-gray-50 rounded-xl">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-red-600">
                      {atRiskStudents.filter(s => s.overall < 70).length}
                    </p>
                    <p className="text-sm text-gray-600">Critical (&lt;70%)</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-orange-600">
                      {atRiskStudents.filter(s => s.overall >= 70 && s.overall < 75).length}
                    </p>
                    <p className="text-sm text-gray-600">Warning (70-74%)</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-600">
                      {atRiskStudents.length}
                    </p>
                    <p className="text-sm text-gray-600">Total At-Risk</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Performance Metrics */}
      <div className="bg-white rounded-2xl p-6 shadow-lg mb-6">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <span>⭐</span> Performance Overview
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {performanceData.map((perf, index) => (
            <PerformanceCard
              key={index}
              title={perf.category}
              score={perf.score}
              icon={perf.icon}
              color={perf.color}
              delay={`${index * 0.1}s`}
            />
          ))}
        </div>
      </div>
    </>
  );

  // ==================== STUDENTS CONTENT ====================
  const renderStudentsContent = () => (
    <div className="bg-white rounded-2xl p-6 shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <span>👥</span> Student List
        </h2>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Search students..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-4 py-2 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none"
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none"
          >
            <option value="all">All Students</option>
            <option value="present">Present Only</option>
            <option value="absent">Absent Only</option>
          </select>
        </div>
      </div>

      {/* Student Information Table */}
<div className="mb-6 overflow-x-auto">
  <table className="w-full border-collapse">
    <thead>
      <tr className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
        <th className="px-4 py-3 text-left font-semibold">Student ID</th>
        <th className="px-4 py-3 text-left font-semibold">Name</th>
        <th className="px-4 py-3 text-left font-semibold">Email</th>
        <th className="px-4 py-3 text-left font-semibold">Phone</th>
        <th className="px-4 py-3 text-left font-semibold">Attendance</th>
      </tr>
    </thead>
    <tbody>
      {getFilteredStudents().map((student, index) => (
        <tr 
          key={student.id} 
          className={`border-b hover:bg-gray-50 transition-colors ${
            index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
          }`}
        >
          <td className="px-4 py-3 font-mono text-sm">{student.id}</td>
          <td className="px-4 py-3 font-semibold">{student.name}</td>
          <td className="px-4 py-3">
            <a 
              href={`mailto:${student.email}`}
              className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
            >
               {student.email}
            </a>
          </td>
          <td className="px-4 py-3 text-gray-700">{student.phone}</td>
          <td className="px-4 py-3">
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
              student.overall >= 75 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {student.overall}%
            </span>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>


      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredStudents.map((student, index) => (
          <div
            key={student.id}
            className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-4 hover-lift cursor-pointer border-2 border-transparent hover:border-blue-300 transition"
            onClick={() => handleStudentClick(student)}
          >
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold"
                style={{ backgroundColor: getAvatarColor(index) }}
              >
                {getInitials(student.name)}
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-800">{student.name}</h3>
                <p className="text-sm text-gray-600">ID: {student.id}</p>
              </div>
              <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                student.status === 'Present' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
              }`}>
                {student.status}
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Attendance</span>
              <span className="font-bold text-lg">{student.overall}%</span>
            </div>
            <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full transition-all duration-500"
                style={{ width: `${student.overall}%` }}
              ></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const ParentCard = ({ studentId, studentData, onEdit }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [parentDetails, setParentDetails] = useState(null);

  const loadParentDetails = () => {
    const parentRef = ref(database, `students/${studentId}/parentInfo`);
    get(parentRef).then((snapshot) => {
      if (snapshot.exists()) {
        setParentDetails(snapshot.val());
      } else {
        setParentDetails({});
      }
    });
  };

  return (
    <div className="border rounded-xl overflow-hidden transition-all">
      <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-bold text-lg">{studentData.name}</h3>
            <p className="text-sm text-gray-600">ID: {studentId}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setIsExpanded(!isExpanded);
                if (!isExpanded && !parentDetails) {
                  loadParentDetails();
                }
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {isExpanded ? 'Hide' : 'View'}
            </button>
            <button
              onClick={() => onEdit(studentId)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              ✏️ Edit
            </button>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 bg-white border-t">
          {parentDetails && Object.keys(parentDetails).length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Father Name</p>
                <p className="font-semibold">{parentDetails.fatherName || 'Not provided'}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Father Phone</p>
                <p className="font-semibold">{parentDetails.fatherPhone || 'Not provided'}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Father Email</p>
                <a href={`mailto:${parentDetails.fatherEmail}`} className="font-semibold text-blue-600 hover:underline">
                  {parentDetails.fatherEmail || 'Not provided'}
                </a>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Mother Name</p>
                <p className="font-semibold">{parentDetails.motherName || 'Not provided'}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Mother Phone</p>
                <p className="font-semibold">{parentDetails.motherPhone || 'Not provided'}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg col-span-1 md:col-span-2">
                <p className="text-xs text-gray-500 mb-1">Address</p>
                <p className="font-semibold">{parentDetails.address || 'Not provided'}</p>
              </div>
            </div>
          ) : (
            <p className="text-center text-gray-500 py-4">
              ℹ️ No parent information saved yet.
            </p>
          )}
        </div>
      )}
    </div>
  );
};



  const renderParentsContent = () => {
  const handleEditParent = (studentId) => {
    setSelectedStudent(studentId);
    setIsEditMode(true);
    
    const parentRef = ref(database, `students/${studentId}/parentInfo`);
    get(parentRef).then((snapshot) => {
      if (snapshot.exists()) {
        setParentForm(snapshot.val());
      }
    });
  };

  const handleSaveParent = async () => {
    if (!selectedStudent) return;
    
    const parentRef = ref(database, `students/${selectedStudent}/parentInfo`);
    await set(parentRef, parentForm);
    
    alert('Parent information saved successfully!');
    setIsEditMode(false);
    setSelectedStudent(null);
    setParentForm({
      fatherName: '',
      fatherPhone: '',
      fatherEmail: '',
      motherName: '',
      motherPhone: '',
      address: ''
    });
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
          👨‍👩‍👧 Parents Information
        </h2>
      </div>

      <div className="space-y-4">
        {Object.entries(IOT_B_STUDENTS).map(([studentId, studentData]) => (
          <ParentCard 
            key={studentId}
            studentId={studentId}
            studentData={studentData}
            onEdit={handleEditParent}
          />
        ))}
      </div>

      {/* Edit Modal - KEEP THIS AS IS */}
      {isEditMode && selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold mb-6">Edit Parent Information</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block font-semibold mb-2">Father's Name</label>
                <input
                  type="text"
                  value={parentForm.fatherName}
                  onChange={(e) => setParentForm({...parentForm, fatherName: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="Enter father's name"
                />
              </div>

              <div>
                <label className="block font-semibold mb-2">Father's Phone</label>
                <input
                  type="tel"
                  value={parentForm.fatherPhone}
                  onChange={(e) => setParentForm({...parentForm, fatherPhone: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="+91-XXXXXXXXXX"
                />
              </div>

              <div>
                <label className="block font-semibold mb-2">Father's Email</label>
                <input
                  type="email"
                  value={parentForm.fatherEmail}
                  onChange={(e) => setParentForm({...parentForm, fatherEmail: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="father@example.com"
                />
              </div>

              <div>
                <label className="block font-semibold mb-2">Mother's Name</label>
                <input
                  type="text"
                  value={parentForm.motherName}
                  onChange={(e) => setParentForm({...parentForm, motherName: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="Enter mother's name"
                />
              </div>

              <div>
                <label className="block font-semibold mb-2">Mother's Phone</label>
                <input
                  type="tel"
                  value={parentForm.motherPhone}
                  onChange={(e) => setParentForm({...parentForm, motherPhone: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="+91-XXXXXXXXXX"
                />
              </div>

              <div>
                <label className="block font-semibold mb-2">Address</label>
                <textarea
                  value={parentForm.address}
                  onChange={(e) => setParentForm({...parentForm, address: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg"
                  rows="3"
                  placeholder="Enter complete address"
                />
              </div>
            </div>

            <div className="flex gap-4 mt-6">
              <button
                onClick={handleSaveParent}
                className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold"
              >
                💾 Save
              </button>
              <button
                onClick={() => {
                  setIsEditMode(false);
                  setSelectedStudent(null);
                }}
                className="flex-1 px-6 py-3 bg-gray-400 text-white rounded-lg hover:bg-gray-500 font-semibold"
              >
                ❌ Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ==================== NOTIFICATIONS CONTENT ====================
  const renderNotificationsContent = () => (
    <div className="space-y-6">
      {/* Header with Create Button */}
      <div className="bg-white rounded-2xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-6">
            <div>
            <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
              <Bell className="text-purple-600" size={32} />
              Parent Notifications
            </h2>
            <p className="text-gray-600 mt-1">Create and manage events for parents</p>
          </div>
          <button
            onClick={() => setShowEventModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:shadow-lg transition font-semibold"
           >
           <Plus size={20} />
            Create New Event
          </button>
        </div>

       {/* Events List */}
        {events && events.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 mt-6">
            {events.map((event, index) => (
              <div 
                key={event.id}
                className="border-2 border-purple-200 rounded-xl p-6 bg-gradient-to-br from-purple-50 to-pink-50 hover:shadow-lg transition"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="bg-purple-500 p-2 rounded-lg">
                        <Calendar className="text-white" size={20} />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">{event.title}</h3>
                        <p className="text-sm text-gray-600">{event.description}</p>
                      </div>
                    </div>
                  
                    <div className="flex items-center gap-6 text-sm mt-4">
                      <span className="flex items-center gap-2 text-gray-700 font-semibold">
                        <Calendar size={16} />
                        {new Date(event.date).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        })}
                      </span>
                      <span className="flex items-center gap-2 text-gray-700 font-semibold">
                        <Clock size={16} />
                        {event.time}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        event.type === 'meeting' ? 'bg-blue-100 text-blue-700' :
                        event.type === 'result' ? 'bg-green-100 text-green-700' :
                        'bg-orange-100 text-orange-700'
                      }`}>
                        {event.type.toUpperCase()}
                      </span>
                    </div>


                    {/* Parent Responses Section */}
<div className="mt-4 p-4 bg-white rounded-lg border border-gray-200">
  <p className="text-sm font-semibold text-gray-700 mb-3">Parent Responses:</p>
  
  {event.responses ? (
    <div className="space-y-2">
      {Object.entries(event.responses).map(([studentId, response]) => (
        <div 
          key={studentId}
          className={`flex items-center gap-2 p-2 rounded-lg ${
            response.status === 'confirmed' 
              ? 'bg-green-50 text-green-800' 
              : 'bg-red-50 text-red-800'
          }`}
        >
          {response.status === 'confirmed' ? (
            <CheckCircle className="w-4 h-4 text-green-600" />
          ) : (
            <X className="w-4 h-4 text-red-600" />
          )}
          <span className="text-sm font-medium">
            {response.status === 'confirmed' ? 'Confirmed' : 'Declined'} by {response.parentName} 
            <span className="text-gray-600"> (Parent of {response.studentName})</span>
          </span>
        </div>
      ))}
      
      {/* Summary */}
      <div className="flex gap-4 mt-3 text-sm">
        <span className="text-green-600 font-medium">
          ✓ Confirmed: {Object.values(event.responses).filter(r => r.status === 'confirmed').length}
        </span>
        <span className="text-red-600 font-medium">
          ✗ Declined: {Object.values(event.responses).filter(r => r.status === 'declined').length}
        </span>
      </div>
    </div>
  ) : (
    <div className="text-sm text-gray-500 flex gap-4">
      <span className="text-green-600">✓ Confirmed: 0</span>
      <span className="text-red-600">✗ Declined: 0</span>
      <span className="text-yellow-600">⏳ Pending: All</span>
    </div>
  )}
</div>

                  </div>

                  <button
                    onClick={() => handleDeleteEvent(event.id)}
                    className="ml-4 p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
                    title="Delete Event"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-blue-50 border-l-4 border-blue-500 p-6 rounded-lg flex items-center gap-3 mt-6">
            <span className="text-4xl">📅</span>
            <div>
              <p className="font-bold text-blue-800">No events created yet</p>
              <p className="text-sm text-blue-700 mt-1">Click "Create New Event" to notify parents about meetings, results, or announcements</p>
            </div>
          </div>
        )}
      </div>

      {/* Create Event Modal */}
      {showEventModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-2xl">
            <h3 className="text-2xl font-bold text-gray-900 mb-6">Create New Event</h3>
          
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Event Title *</label>
                <input
                  type="text"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({...newEvent, title: e.target.value})}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
                  placeholder="e.g., Parent-Teacher Meeting"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Date *</label>
                  <input
                    type="date"
                    value={newEvent.date}
                    onChange={(e) => setNewEvent({...newEvent, date: e.target.value})}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Time *</label>
                  <input
                    type="time"
                    value={newEvent.time}
                    onChange={(e) => setNewEvent({...newEvent, time: e.target.value})}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Event Type *</label>
                <select
                  value={newEvent.type}
                  onChange={(e) => setNewEvent({...newEvent, type: e.target.value})}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
                >
                  <option value="meeting">Meeting</option>
                  <option value="result">Result Declaration</option>
                  <option value="announcement">Announcement</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                <textarea
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({...newEvent, description: e.target.value})}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
                 rows="3"
                 placeholder="Event details..."
                ></textarea>
              </div>
            </div>

            <div className="flex gap-4 mt-6">
              <button
                onClick={handleCreateEvent}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:shadow-lg transition font-semibold"
             >
                Create Event
              </button>
              <button
                onClick={() => setShowEventModal(false)}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );



  // ==================== ANALYTICS CONTENT ====================
  const renderAnalyticsContent = () => (
    <>
      {/* 7-Day Attendance Trend */}
      <div className="bg-white rounded-2xl p-6 shadow-lg mb-6">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <span>📈</span> 7-Day Attendance Trend
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="date" stroke="#6b7280" />
            <YAxis domain={[0, 100]} stroke="#6b7280" />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="attendance" stroke="#3b82f6" strokeWidth={3} dot={{ r: 5 }} name="Attendance %" />
            <Line type="monotone" dataKey="target" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" name="Target (75%)" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Subject-wise Attendance */}
      <div className="bg-white rounded-2xl p-6 shadow-lg">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <span>📚</span> Subject-wise Attendance
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={subjectData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" stroke="#6b7280" />
            <YAxis domain={[0, 100]} stroke="#6b7280" />
            <Tooltip />
            <Legend />
            <Bar dataKey="attendance" fill="#3b82f6" name="Attendance %" />
            <Bar dataKey="target" fill="#10b981" name="Target (75%)" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );

  // ==================== ASSIGNMENTS CONTENT ====================
  const renderAssignmentsContent = () => (
    <div className="bg-white rounded-2xl p-6 shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <span>📝</span> Assignments
        </h2>
        {!showAddAssignment && (
          <button
            onClick={() => setShowAddAssignment(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
          >
            <span>➕</span>
            <span>Create New Assignment</span>
          </button>
        )}
      </div>

      {/* CREATE ASSIGNMENT FORM */}
      {showAddAssignment && (
        <div className="bg-white p-4 rounded-xl border-2 border-green-200 mb-6">
          <h3 className="font-bold text-gray-800 mb-3">Create New Assignment</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Assignment Title *
              </label>
              <input
                type="text"
                value={newAssignment.title}
                onChange={(e) => setNewAssignment({...newAssignment, title: e.target.value})}
                placeholder="e.g., IoT Project Report"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Subject *
              </label>
              <select
                value={newAssignment.subject}
                onChange={(e) => setNewAssignment({...newAssignment, subject: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="IoT">IoT</option>
                <option value="Python">Python</option>
                <option value="AI">AI</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Due Date *
              </label>
              <input
                type="date"
                value={newAssignment.dueDate}
                onChange={(e) => setNewAssignment({...newAssignment, dueDate: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Max Marks *
              </label>
              <input
                type="number"
                value={newAssignment.maxMarks}
                onChange={(e) => setNewAssignment({...newAssignment, maxMarks: e.target.value})}
                placeholder="20"
                min="1"
                max="100"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-4">
            <button
              onClick={handleCreateAssignment}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              ✓ Create Assignment
            </button>
            <button
              onClick={() => {
                setShowAddAssignment(false);
                setNewAssignment({ title: '', subject: 'IoT', dueDate: '', maxMarks: '', submissions: {} });
              }}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              ✕ Cancel
            </button>
          </div>
        </div>
      )}

      {/* ASSIGNMENTS LIST */}
      {assignments.length === 0 ? (
        <div className="bg-green-100 border-l-4 border-green-600 p-4 rounded-lg">
          <p className="text-green-800 font-semibold">
            📝 <strong>No assignments yet!</strong> Click "Create New Assignment" to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {assignments.map((assignment) => {
            const submittedCount = Object.values(assignment.submissions || {}).filter(Boolean).length;
            const totalStudents = Object.keys(assignment.submissions || {}).length;
            const submissionPercentage = totalStudents > 0 ? Math.round((submittedCount / totalStudents) * 100) : 0;
            const isOverdue = new Date(assignment.dueDate) < new Date();
            const isExpanded = selectedAssignment === assignment.id;

            return (
              <div 
                key={assignment.id}
                className="bg-white rounded-xl border-2 border-green-200 overflow-hidden transition-all hover:shadow-lg"
              >
                {/* COMPACT ROW */}
                <div 
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-green-50 transition-colors"
                  onClick={() => setSelectedAssignment(isExpanded ? null : assignment.id)}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-teal-600 flex items-center justify-center text-white font-bold">
                      📋
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-gray-800">{assignment.title}</h3>
                        {isOverdue && (
                          <span className="bg-red-500 text-white px-2 py-0.5 rounded text-xs font-bold">
                            OVERDUE
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">
                        📚 {assignment.subject} • 📅 {new Date(assignment.dueDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-bold text-green-700">{submittedCount}/{totalStudents}</p>
                      <p className="text-xs text-gray-600">{submissionPercentage}%</p>
                    </div>
                    <button className="text-xl text-gray-400 hover:text-gray-600">
                      {isExpanded ? '▼' : '▶'}
                    </button>
                  </div>
                </div>

                {/* EXPANDED DETAILS */}
                {isExpanded && (
                  <div className="border-t-2 border-green-100 p-5 bg-green-50">
                    {/* SUBMISSION STATS */}
                    <div className="mb-4 p-3 bg-white rounded-lg border border-green-200">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-semibold text-gray-700">Submission Progress</span>
                        <span className="font-bold text-green-700 text-lg">
                          {submittedCount}/{totalStudents} ({submissionPercentage}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div 
                          className="bg-gradient-to-r from-green-500 to-teal-600 h-3 rounded-full transition-all"
                          style={{ width: `${submissionPercentage}%` }}
                        ></div>
                      </div>
                      <div className="mt-2 text-xs text-gray-600 flex justify-between">
                        <span>💯 Max Marks: {assignment.maxMarks}</span>
                        <span>📅 Due: {new Date(assignment.dueDate).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {/* STUDENT SUBMISSION LIST */}
                    <div className="space-y-2">
                      <h4 className="font-bold text-gray-700 mb-2">Student Submissions</h4>
                      {todayAttendance.map((student) => {
                        const hasSubmitted = assignment.submissions[student.id];
                        return (
                          <div 
                            key={student.id}
                            className={`flex items-center justify-between p-3 rounded-lg border ${
                              hasSubmitted ? 'bg-green-100 border-green-300' : 'bg-red-100 border-red-300'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                                hasSubmitted ? 'bg-green-600' : 'bg-red-600'
                              }`}>
                                {getInitials(student.name)}
                              </div>
                              <div>
                                <p className="font-semibold text-gray-800">{student.name}</p>
                                <p className="text-xs text-gray-600">{student.id}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => handleToggleSubmission(assignment.id, student.id)}
                              className={`px-3 py-1 rounded-lg text-sm font-bold transition-colors ${
                                hasSubmitted
                                  ? 'bg-green-600 text-white hover:bg-green-700'
                                  : 'bg-red-600 text-white hover:bg-red-700'
                              }`}
                            >
                              {hasSubmitted ? '✓ Submitted' : '✗ Not Submitted'}
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    {/* DELETE BUTTON */}
                    <button
                      onClick={() => handleDeleteAssignment(assignment.id)}
                      className="mt-4 w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-bold"
                    >
                      🗑️ Delete Assignment
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // ==================== MARKS CONTENT ====================
  const renderMarksContent = () => (
    <div className="bg-white rounded-2xl p-6 shadow-lg">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <span>📊</span> Student Marks Management
      </h2>

      <div className="space-y-4">
        {todayAttendance.map((student) => {
          const marks = studentMarks[student.id]?.subjects || [];
          const isExpanded = selectedStudentForMarks === student.id;

          return (
            <div key={student.id} className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl border-2 border-blue-200">
              {/* Student Header */}
              <div 
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-blue-100 transition-colors"
                onClick={() => setSelectedStudentForMarks(isExpanded ? null : student.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                    {getInitials(student.name)}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800">{student.name}</h3>
                    <p className="text-sm text-gray-600">ID: {student.id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                    {marks.length} Subject{marks.length !== 1 ? 's' : ''}
                  </span>
                  <button className="text-xl text-gray-400 hover:text-gray-600">
                    {isExpanded ? '▼' : '▶'}
                  </button>
                </div>
              </div>

              {/* Expanded Marks Details */}
              {isExpanded && (
                <div className="border-t-2 border-blue-200 p-4 bg-white">
                                    {/* Marks List */}
                  {marks.length > 0 ? (
                    <div className="space-y-2 mb-4">
                      {marks.map((mark) => (
                        <div key={mark.id} className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
                          <div>
                            <p className="font-bold text-gray-800">{mark.subject}</p>
                            <p className="text-xs text-gray-600">
                              Added: {new Date(mark.addedAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-2xl font-bold text-blue-600">{mark.marks}/100</span>
                            <button
                              onClick={() => handleDeleteMarkForStudent(student.id, mark.id)}
                              className="px-3 py-1 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 transition-colors"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-yellow-100 border-l-4 border-yellow-500 p-3 rounded-lg mb-4">
                      <p className="text-yellow-800 text-sm">
                        📝 No marks recorded yet for this student
                      </p>
                    </div>
                  )}

                  {/* Add New Mark Form */}
                  {isAddingMark && selectedStudentForMarks === student.id ? (
                    <div className="bg-gradient-to-r from-green-50 to-teal-50 p-4 rounded-lg border-2 border-green-300">
                      <h4 className="font-bold text-gray-800 mb-3">Add New Mark</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="text"
                          placeholder="Subject name"
                          value={newMark.subject}
                          onChange={(e) => setNewMark({...newMark, subject: e.target.value})}
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                        <input
                          type="number"
                          placeholder="Marks (0-100)"
                          value={newMark.marks}
                          onChange={(e) => setNewMark({...newMark, marks: e.target.value})}
                          min="0"
                          max="100"
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => handleAddMarkForStudent(student.id, student.name)}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        >
                          ✓ Add Mark
                        </button>
                        <button
                          onClick={() => {
                            setIsAddingMark(false);
                            setNewMark({ subject: '', marks: '' });
                          }}
                          className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                        >
                          ✕ Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setIsAddingMark(true);
                        setSelectedStudentForMarks(student.id);
                      }}
                      className="w-full px-4 py-2 bg-gradient-to-r from-green-500 to-teal-600 text-white rounded-lg hover:from-green-600 hover:to-teal-700 transition-all font-bold"
                    >
                      ➕ Add New Mark
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  // ==================== ATTENDANCE MARKING CONTENT ====================
  const renderAttendanceContent = () => (
    <div className="bg-white rounded-2xl p-6 shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <span>✅</span> Mark Attendance
        </h2>
        {showMarkAttendance && (
          <button
            type="button"
            onClick={saveManualAttendance}
            disabled={isSaving}
            className="px-6 py-3 bg-gradient-to-r from-green-500 to-teal-600 text-white rounded-xl font-bold hover:from-green-600 hover:to-teal-700 transition-all shadow-lg disabled:opacity-50"
          >
            {isSaving ? '⏳ Saving...' : '💾 Save Attendance'}
          </button>
        )}
      </div>

      {!showMarkAttendance ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📋</div>
          <h3 className="text-2xl font-bold text-gray-800 mb-2">Ready to Mark Attendance?</h3>
          <p className="text-gray-600 mb-6">Click the button below to start marking today's attendance</p>
          <button
            onClick={() => {
              const initialAttendance = {};
              todayAttendance.forEach(student => {
                initialAttendance[student.id] = student.status === 'Present';
              });
              setEditableAttendance(initialAttendance);
              setShowMarkAttendance(true);
            }}
            className="px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-bold text-lg hover:from-blue-600 hover:to-purple-700 transition-all shadow-lg"
          >
            🎯 Start Marking Attendance
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg mb-4">
            <p className="text-blue-800 font-semibold">
              📌 Toggle attendance status for each student, then click "Save Attendance" when done
            </p>
          </div>

          {todayAttendance.map((student, index) => (
            <div
              key={student.id}
              className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border-2 border-blue-200 hover:border-blue-400 transition-all"
            >
              <div className="flex items-center gap-4">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
                  style={{ backgroundColor: getAvatarColor(index) }}
                >
                  {getInitials(student.name)}
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">{student.name}</h3>
                  <p className="text-sm text-gray-600">ID: {student.id}</p>
                </div>
              </div>
              
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setEditableAttendance({
                    ...editableAttendance,
                    [student.id]: !editableAttendance[student.id]
                  });
                }}
                className={`px-6 py-3 rounded-xl font-bold text-lg transition-all ${
                  editableAttendance[student.id]
                    ? 'bg-green-500 text-white hover:bg-green-600'
                    : 'bg-red-500 text-white hover:bg-red-600'
                }`}
              >
                {editableAttendance[student.id] ? '✅ Present' : '❌ Absent'}
              </button>
            </div>
          ))}

          <div className="mt-6 p-4 bg-gray-50 rounded-xl">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-3xl font-bold text-green-600">
                  {Object.values(editableAttendance).filter(v => v).length}
                </p>
                <p className="text-sm text-gray-600">Present</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-red-600">
                  {Object.values(editableAttendance).filter(v => !v).length}
                </p>
                <p className="text-sm text-gray-600">Absent</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ==================== LOADING STATE ====================
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="loading-spinner mx-auto mb-6"></div>
          <h2 className="text-3xl font-bold text-gray-800 mb-2">Loading Dashboard...</h2>
          <p className="text-gray-600">Please wait while we fetch the latest data</p>
        </div>
      </div>
    );
  }

  // ==================== MAIN RENDER ====================
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex">
      

      {/* ==================== SIDEBAR ==================== */}
      <aside className={`fixed left-0 top-0 h-screen bg-gradient-to-b from-blue-900 via-purple-900 to-indigo-900 text-white transition-all duration-300 z-50 ${
        sidebarOpen ? 'w-72' : 'w-20'
      }`}>
        
        {/* Logo & Toggle */}
        <div className="p-6 flex items-center justify-between border-b border-white border-opacity-20">
          {sidebarOpen && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center text-2xl">
                🎓
              </div>
              <div>
                <h1 className="text-xl font-bold">SmartCampus</h1>
                <p className="text-xs text-blue-200">Faculty Portal</p>
              </div>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-white hover:bg-opacity-10 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {sidebarOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              )}
            </svg>
          </button>
        </div>

        {/* Navigation Menu */}
        <nav className="p-4 space-y-2">
          <button
            onClick={() => setActiveSection('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              activeSection === 'dashboard'
                ? 'bg-white bg-opacity-20 shadow-lg'
                : 'hover:bg-white hover:bg-opacity-10'
            }`}
          >
            <span className="text-2xl">📊</span>
            {sidebarOpen && <span className="font-semibold">Dashboard</span>}
          </button>

          <button
            onClick={() => setActiveSection('students')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              activeSection === 'students'
                ? 'bg-white bg-opacity-20 shadow-lg'
                : 'hover:bg-white hover:bg-opacity-10'
            }`}
          >
            <span className="text-2xl">👥</span>
            {sidebarOpen && <span className="font-semibold">Students</span>}
          </button>

          <button onClick={() => setActiveSection('parents')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeSection === 'parents' ? 'bg-white bg-opacity-20 shadow-lg' : 'hover:bg-white hover:bg-opacity-10'}`}>
            <span className="text-2xl">👨‍👩‍👧</span>
            {sidebarOpen && <span className="font-semibold">Parents Info</span>}
          </button>


          <button
            onClick={() => setActiveSection('attendance')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              activeSection === 'attendance'
                ? 'bg-white bg-opacity-20 shadow-lg'
                : 'hover:bg-white hover:bg-opacity-10'
            }`}
          >
            <span className="text-2xl">✅</span>
            {sidebarOpen && <span className="font-semibold">Mark Attendance</span>}
          </button>

          <button
            onClick={() => setActiveSection('analytics')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              activeSection === 'analytics'
                ? 'bg-white bg-opacity-20 shadow-lg'
                : 'hover:bg-white hover:bg-opacity-10'
            }`}
          >
            <span className="text-2xl">📈</span>
            {sidebarOpen && <span className="font-semibold">Analytics</span>}
          </button>

          <button
            onClick={() => setActiveSection('assignments')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              activeSection === 'assignments'
                ? 'bg-white bg-opacity-20 shadow-lg'
                : 'hover:bg-white hover:bg-opacity-10'
            }`}
          >
            <span className="text-2xl">📝</span>
            {sidebarOpen && <span className="font-semibold">Assignments</span>}
          </button>

         {/* Parent Notifications Menu Item - FIXED */}
{/* Parent Notifications Menu Item - FIXED */}
<button
  onClick={() => setActiveSection('notifications')}
  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
    activeSection === 'notifications'
      ? 'bg-white bg-opacity-20 shadow-lg'
      : 'hover:bg-white hover:bg-opacity-10'
  }`}
>
  <span className="text-2xl">🔔</span>
  {sidebarOpen && <span className="font-semibold">Parent Notifications</span>}
  {sidebarOpen && events.length > 0 && (
    <span className="ml-auto bg-red-500 text-white text-xs px-2 py-1 rounded-full">
      {events.length}
    </span>
  )}
</button>



          <button
            onClick={() => setActiveSection('marks')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              activeSection === 'marks'
                ? 'bg-white bg-opacity-20 shadow-lg'
                : 'hover:bg-white hover:bg-opacity-10'
            }`}
          >
            <span className="text-2xl">📊</span>
            {sidebarOpen && <span className="font-semibold">Marks</span>}
          </button>
        </nav>

        {/* Quick Actions */}
        {sidebarOpen && (
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white border-opacity-20">
            <div className="space-y-2">
              <button
                onClick={handleExport}
                className="w-full flex items-center gap-3 px-4 py-3 bg-green-600 hover:bg-green-700 rounded-xl transition-all"
              >
                <span className="text-xl">📥</span>
                <span className="font-semibold">Export CSV</span>
              </button>

              <button
                onClick={() => navigate('/')}
                className="w-full flex items-center gap-3 px-4 py-3 bg-red-600 hover:bg-red-700 rounded-xl transition-all"
              >
                <span className="text-xl">🚪</span>
                <span className="font-semibold">Logout</span>
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* ==================== MAIN CONTENT ==================== */}
      <main className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'ml-72' : 'ml-20'}`}>
        
        {/* Header Bar */}
        <header className="bg-white shadow-lg sticky top-0 z-40 border-b-2 border-blue-200">
          <div className="px-6 py-4 flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                IoT-B Faculty Dashboard
              </h1>
              <p className="text-gray-600">Welcome back, <span className="font-semibold">Prof. Sharma</span></p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-gray-600">Today's Date</p>
                <p className="font-bold text-gray-800">{new Date().toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
                PS
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="p-6">
          {renderContent()}
        </div>

      </main>

      {/* ==================== STUDENT DETAIL MODAL ==================== */}
      <StudentDetailModal
        student={selectedStudent}
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedStudent(null);
        }}
        onUpdatePerformance={handleUpdatePerformance}
      />

      {/* ==================== INLINE STYLES ==================== */}
      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.8;
          }
        }

        @keyframes glow {
          0%, 100% {
            box-shadow: 0 0 20px rgba(59, 130, 246, 0.3);
          }
          50% {
            box-shadow: 0 0 40px rgba(59, 130, 246, 0.6);
          }
        }

        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-10px);
          }
        }

        .fade-in-up {
          animation: fadeInUp 0.6s ease-out forwards;
        }

        .slide-in {
          animation: slideIn 0.6s ease-out forwards;
        }

        .pulse-animation {
          animation: pulse 2s ease-in-out infinite;
        }

        .glow-animation {
          animation: glow 3s ease-in-out infinite;
        }

        .hover-lift {
          transition: all 0.3s ease;
        }

        .hover-lift:hover {
          transform: translateY(-5px);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
        }

        .premium-glow {
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
        }

        .loading-spinner {
          width: 60px;
          height: 60px;
          border: 6px solid #e5e7eb;
          border-top-color: #3b82f6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .particle-container {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          overflow: hidden;
          z-index: 0;
          pointer-events: none;
        }

        .particle {
          position: absolute;
          background: radial-gradient(circle, rgba(59, 130, 246, 0.6), rgba(147, 51, 234, 0.3));
          border-radius: 50%;
          animation: particleFloat linear infinite;
        }

        @keyframes particleFloat {
          0% {
            transform: translateY(0) translateX(0) scale(1);
            opacity: 0;
          }
          10% {
            opacity: 0.6;
          }
          90% {
            opacity: 0.6;
          }
          100% {
            transform: translateY(-100vh) translateX(50px) scale(0);
            opacity: 0;
          }
        }

        .animated-counter {
          display: inline-block;
        }

        .animated-counter.bouncing {
          animation: counterBounce 0.6s ease;
        }

        @keyframes counterBounce {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.15);
          }
        }

        /* Custom Scrollbar */
        ::-webkit-scrollbar {
          width: 10px;
        }

        ::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }

        ::-webkit-scrollbar-thumb {
          background: linear-gradient(to bottom, #3b82f6, #8b5cf6);
          border-radius: 10px;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(to bottom, #2563eb, #7c3aed);
        }
      `}</style>
    </div>
  );
};


export default FacultyDashboard;

