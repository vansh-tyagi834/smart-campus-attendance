import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { database } from '../firebase/config';
import { ref, onValue } from 'firebase/database';
import { getBadges } from '../utils/gamification';

function Leaderboard() {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterView, setFilterView] = useState('points'); // points, attendance, streaks

  useEffect(() => {
    const summaryRef = ref(database, 'attendance_summary');

    onValue(summaryRef, (snapshot) => {
      const data = snapshot.val();

      if (data) {
        const studentList = Object.entries(data).map(([id, summary]) => ({
          id,
          name: summary.student_name || id,  // ✅ FIX: Use student_name
          cardId: id,  // Store card ID separately
          attendance: summary.overall_percentage || 0,
          present: summary.total_present || 0,
          total: summary.total_classes || 0,
          points: (summary.total_present || 0) * 10,  // ✅ FIX: Calculate directly
          badges: getBadges(summary).length,
          streak: 0,  // For now, set to 0 (can calculate later)
          subjects: summary.subjects || {}
        }));

        setStudents(studentList);
      }
      setLoading(false);
    });
  }, []);

  const getSortedStudents = () => {
    switch(filterView) {
      case 'attendance':
        return [...students].sort((a, b) => b.attendance - a.attendance);
      case 'streaks':
        return [...students].sort((a, b) => b.streak - a.streak);
      case 'points':
      default:
        return [...students].sort((a, b) => b.points - a.points);
    }
  };

  const getMedalEmoji = (position) => {
    if (position === 0) return '🥇';
    if (position === 1) return '🥈';
    if (position === 2) return '🥉';
    return `#${position + 1}`;
  };

  const getRankColor = (position) => {
    if (position === 0) return 'from-yellow-400 to-yellow-600';
    if (position === 1) return 'from-gray-300 to-gray-500';
    if (position === 2) return 'from-orange-400 to-orange-600';
    return 'from-blue-400 to-blue-600';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-purple-700 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-4 border-white mx-auto"></div>
          <p className="text-white text-2xl mt-4">Loading Leaderboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-purple-700 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold text-gray-800">🏆 Leaderboard</h1>
              <p className="text-gray-600 mt-2">Compete with your classmates!</p>
            </div>
            <button 
              onClick={() => navigate(-1)}
              className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition transform hover:scale-105 shadow-lg"
            >
              ← Back
            </button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-xl p-6 shadow-lg text-center">
            <div className="text-4xl mb-2">👥</div>
            <h3 className="text-gray-600 text-sm font-semibold">Total Students</h3>
            <p className="text-3xl font-bold text-purple-600">{students.length}</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-lg text-center">
            <div className="text-4xl mb-2">🔥</div>
            <h3 className="text-gray-600 text-sm font-semibold">Highest Streak</h3>
            <p className="text-3xl font-bold text-red-600">
              {Math.max(...students.map(s => s.streak))} days
            </p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-lg text-center">
            <div className="text-4xl mb-2">⭐</div>
            <h3 className="text-gray-600 text-sm font-semibold">Avg Attendance</h3>
            <p className="text-3xl font-bold text-blue-600">
              {(students.reduce((sum, s) => sum + s.attendance, 0) / students.length).toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="bg-white rounded-2xl shadow-2xl p-4 mb-6 flex gap-4 justify-center flex-wrap">
          <button
            onClick={() => setFilterView('points')}
            className={`px-6 py-3 rounded-lg font-bold transition transform hover:scale-105 ${
              filterView === 'points' 
                ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white' 
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            🎯 By Points
          </button>
          <button
            onClick={() => setFilterView('attendance')}
            className={`px-6 py-3 rounded-lg font-bold transition transform hover:scale-105 ${
              filterView === 'attendance' 
                ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white' 
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            📊 By Attendance
          </button>
          <button
            onClick={() => setFilterView('streaks')}
            className={`px-6 py-3 rounded-lg font-bold transition transform hover:scale-105 ${
              filterView === 'streaks' 
                ? 'bg-gradient-to-r from-red-500 to-pink-500 text-white' 
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            🔥 By Streaks
          </button>
        </div>

        {/* Top 3 Podium */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {getSortedStudents().slice(0, 3).map((student, index) => (
            <div 
              key={student.id}
              className={`bg-gradient-to-br ${getRankColor(index)} rounded-2xl p-6 shadow-2xl text-white transform hover:scale-105 transition ${
                index === 0 ? 'md:col-span-3 md:order-first' : ''
              }`}
            >
              <div className="text-center">
                <div className="text-6xl mb-3">{getMedalEmoji(index)}</div>
                <h3 className="text-2xl font-bold">{student.name}</h3>
                <p className="text-white/80 text-sm mb-4">ID: {student.id}</p>

                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div>
                    <p className="text-white/70 text-xs">Points</p>
                    <p className="text-2xl font-bold">🎯 {student.points}</p>
                  </div>
                  <div>
                    <p className="text-white/70 text-xs">Attendance</p>
                    <p className="text-2xl font-bold">📊 {student.attendance}%</p>
                  </div>
                  <div>
                    <p className="text-white/70 text-xs">Streak</p>
                    <p className="text-2xl font-bold">🔥 {student.streak}</p>
                  </div>
                </div>

                <div className="mt-4 flex justify-center gap-2">
                  {[...Array(student.badges)].map((_, i) => (
                    <span key={i} className="text-2xl">🏆</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Full Leaderboard Table */}
        <div className="bg-white rounded-2xl shadow-2xl p-6">
          <h2 className="text-2xl font-bold mb-6 text-gray-800">📋 Full Rankings</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white">
                <tr>
                  <th className="px-4 py-3 text-left">Rank</th>
                  <th className="px-4 py-3 text-left">Student ID</th>
                  <th className="px-4 py-3 text-center">Points</th>
                  <th className="px-4 py-3 text-center">Attendance</th>
                  <th className="px-4 py-3 text-center">Streak</th>
                  <th className="px-4 py-3 text-center">Badges</th>
                </tr>
              </thead>
              <tbody>
                {getSortedStudents().map((student, index) => (
                  <tr 
                    key={student.id}
                    className={`border-b hover:bg-purple-50 transition ${
                      index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                    }`}
                  >
                    <td className="px-4 py-4 font-bold text-2xl">
                      {getMedalEmoji(index)}
                    </td>
                    <td className="px-4 py-4 font-bold text-gray-800">
                      <div>
                        <div className="font-bold text-gray-800">{student.name}</div>
                        <div className="text-sm text-gray-500">ID: {student.cardId}</div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="text-xl font-bold text-yellow-600">
                        🎯 {student.points}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`text-xl font-bold ${
                        student.attendance >= 75 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        📊 {student.attendance}%
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="text-xl font-bold text-red-600">
                        🔥 {student.streak}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="text-xl">
                        {[...Array(student.badges)].map((_, i) => (
                          <span key={i}>🏆</span>
                        ))}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Leaderboard;