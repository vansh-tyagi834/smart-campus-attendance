import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

function LandingPage() {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-700 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500/30 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/30 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 w-60 h-60 bg-indigo-500/20 rounded-full blur-2xl animate-pulse delay-500"></div>
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center p-8">
        <div className="max-w-7xl w-full">
          {/* Header */}
          <div className={`text-center mb-12 transition-all duration-1000 transform ${
            mounted ? 'translate-y-0 opacity-100' : '-translate-y-10 opacity-0'
          }`}>
            <div className="inline-block mb-6">
              <div className="text-8xl animate-bounce">🎓</div>
            </div>
            <h1 className="text-7xl font-bold text-white mb-6 tracking-tight">
              Smart Campus ERP
            </h1>
            <div className="flex items-center justify-center gap-3 mb-4">
              <span className="text-3xl">🤖</span>
              <p className="text-3xl text-white/90 font-semibold">Complete Education Management System</p>
              <span className="text-3xl">📊</span>
            </div>
            <p className="text-xl text-white/80 max-w-3xl mx-auto mt-4">
              AI-Powered Attendance • Student Management • Academic Analytics • Complete ERP Solution
            </p>

            {/* LEADERBOARD BUTTON */}
            <div className="mt-8">
              <button
                onClick={() => navigate('/leaderboard')}
                className="bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 text-white px-16 py-6 rounded-2xl font-bold text-2xl transform hover:scale-110 transition shadow-2xl hover:shadow-yellow-500/50"
              >
                🏆 View Leaderboard 🏆
              </button>
            </div>
          </div>

          {/* Feature Highlights */}
          <div className={`grid grid-cols-1 md:grid-cols-4 gap-6 mb-12 transition-all duration-1000 delay-200 transform ${
            mounted ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
          }`}>
            <div className="bg-white/10 backdrop-blur-lg p-6 rounded-xl text-center transform hover:scale-105 transition">
              <div className="text-5xl mb-3">⚡</div>
              <h3 className="text-white font-bold text-lg mb-2">AI Recognition</h3>
              <p className="text-white/70 text-sm">Face detection & marking</p>
            </div>
            <div className="bg-white/10 backdrop-blur-lg p-6 rounded-xl text-center transform hover:scale-105 transition">
              <div className="text-5xl mb-3">📊</div>
              <h3 className="text-white font-bold text-lg mb-2">Live Analytics</h3>
              <p className="text-white/70 text-sm">Real-time insights</p>
            </div>
            <div className="bg-white/10 backdrop-blur-lg p-6 rounded-xl text-center transform hover:scale-105 transition">
              <div className="text-5xl mb-3">🎮</div>
              <h3 className="text-white font-bold text-lg mb-2">Gamification</h3>
              <p className="text-white/70 text-sm">Badges & leaderboards</p>
            </div>
            <div className="bg-white/10 backdrop-blur-lg p-6 rounded-xl text-center transform hover:scale-105 transition">
              <div className="text-5xl mb-3">🔒</div>
              <h3 className="text-white font-bold text-lg mb-2">Secure</h3>
              <p className="text-white/70 text-sm">Enterprise-grade security</p>
            </div>
          </div>

          {/* Login Cards - BIGGER & BETTER */}
          <div className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8 transition-all duration-1000 delay-300 transform ${
            mounted ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
          }`}>
            {/* Student Card */}
            <div 
              onClick={() => navigate('/login/student')}
              className="group bg-white/95 backdrop-blur-xl p-8 rounded-3xl shadow-2xl cursor-pointer transform hover:scale-110 hover:-rotate-2 transition-all duration-300 hover:shadow-purple-500/50 border-2 border-transparent hover:border-purple-400"
            >
              <div className="text-center">
                <div className="text-8xl mb-6 group-hover:scale-125 transition-transform duration-300">👨‍🎓</div>
                <h3 className="text-3xl font-bold mb-3 text-gray-800">Student Portal</h3>
                <p className="text-gray-600 mb-2 text-sm">View attendance records</p>
                <p className="text-gray-600 mb-6 text-sm">Subject-wise stats & analytics</p>
                <div className="space-y-2 mb-6 text-left text-xs text-gray-500">
                  <div className="flex items-center">
                    <span className="mr-2">📊</span>
                    <span>Interactive charts & graphs</span>
                  </div>
                  <div className="flex items-center">
                    <span className="mr-2">🎯</span>
                    <span>Track your progress</span>
                  </div>
                  <div className="flex items-center">
                    <span className="mr-2">📥</span>
                    <span>Export attendance data</span>
                  </div>
                </div>
                <button className="bg-gradient-to-r from-purple-600 to-purple-700 text-white px-8 py-4 rounded-xl font-bold w-full group-hover:from-purple-700 group-hover:to-purple-800 transition shadow-lg text-lg">
                  Login as Student →
                </button>
              </div>
            </div>

            {/* Faculty Card */}
            <div 
              onClick={() => navigate('/login/faculty')}
              className="group bg-white/95 backdrop-blur-xl p-8 rounded-3xl shadow-2xl cursor-pointer transform hover:scale-110 hover:-rotate-2 transition-all duration-300 hover:shadow-blue-500/50 border-2 border-transparent hover:border-blue-400"
            >
              <div className="text-center">
                <div className="text-8xl mb-6 group-hover:scale-125 transition-transform duration-300">👨‍🏫</div>
                <h3 className="text-3xl font-bold mb-3 text-gray-800">Faculty Dashboard</h3>
                <p className="text-gray-600 mb-2 text-sm">Monitor class attendance</p>
                <p className="text-gray-600 mb-6 text-sm">Track student performance</p>
                <div className="space-y-2 mb-6 text-left text-xs text-gray-500">
                  <div className="flex items-center">
                    <span className="mr-2">👥</span>
                    <span>View present/absent lists</span>
                  </div>
                  <div className="flex items-center">
                    <span className="mr-2">📊</span>
                    <span>Class statistics & trends</span>
                  </div>
                  <div className="flex items-center">
                    <span className="mr-2">📥</span>
                    <span>Export reports</span>
                  </div>
                </div>
                <button className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-4 rounded-xl font-bold w-full group-hover:from-blue-700 group-hover:to-blue-800 transition shadow-lg text-lg">
                  Login as Faculty →
                </button>
              </div>
            </div>

            {/* Admin Card */}
            <div 
              onClick={() => navigate('/login/admin')}
              className="group bg-white/95 backdrop-blur-xl p-8 rounded-3xl shadow-2xl cursor-pointer transform hover:scale-110 hover:-rotate-2 transition-all duration-300 hover:shadow-green-500/50 border-2 border-transparent hover:border-green-400"
            >
              <div className="text-center">
                <div className="text-8xl mb-6 group-hover:scale-125 transition-transform duration-300">🛡️</div>
                <h3 className="text-3xl font-bold mb-3 text-gray-800">Admin Control</h3>
                <p className="text-gray-600 mb-2 text-sm">System overview</p>
                <p className="text-gray-600 mb-6 text-sm">Complete analytics & management</p>
                <div className="space-y-2 mb-6 text-left text-xs text-gray-500">
                  <div className="flex items-center">
                    <span className="mr-2">📊</span>
                    <span>Department-wide analytics</span>
                  </div>
                  <div className="flex items-center">
                    <span className="mr-2">🔍</span>
                    <span>Search & filter students</span>
                  </div>
                  <div className="flex items-center">
                    <span className="mr-2">⚠️</span>
                    <span>Identify at-risk students</span>
                  </div>
                </div>
                <button className="bg-gradient-to-r from-green-600 to-green-700 text-white px-8 py-4 rounded-xl font-bold w-full group-hover:from-green-700 group-hover:to-green-800 transition shadow-lg text-lg">
                  Login as Admin →
                </button>
              </div>
            </div>

            {/* PARENT CARD */}
            <div 
              onClick={() => navigate('/login/parent')}
              className="group bg-white/95 backdrop-blur-xl p-8 rounded-3xl shadow-2xl cursor-pointer transform hover:scale-110 hover:-rotate-2 transition-all duration-300 hover:shadow-pink-500/50 border-2 border-transparent hover:border-pink-400"
            >
              <div className="text-center">
                <div className="text-8xl mb-6 group-hover:scale-125 transition-transform duration-300">👨‍👩‍👧</div>
                <h3 className="text-3xl font-bold mb-3 text-gray-800">Parent Portal</h3>
                <p className="text-gray-600 mb-2 text-sm">Track child's attendance</p>
                <p className="text-gray-600 mb-6 text-sm">Get instant alerts & reports</p>
                <div className="space-y-2 mb-6 text-left text-xs text-gray-500">
                  <div className="flex items-center">
                    <span className="mr-2">📧</span>
                    <span>Contact faculty directly</span>
                  </div>
                  <div className="flex items-center">
                    <span className="mr-2">📊</span>
                    <span>View detailed reports</span>
                  </div>
                  <div className="flex items-center">
                    <span className="mr-2">⚠️</span>
                    <span>Get risk alerts</span>
                  </div>
                </div>
                <button className="bg-gradient-to-r from-pink-600 to-pink-700 text-white px-8 py-4 rounded-xl font-bold w-full group-hover:from-pink-700 group-hover:to-pink-800 transition shadow-lg text-lg">
                  Login as Parent →
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className={`text-center mt-16 transition-all duration-1000 delay-500 transform ${
            mounted ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
          }`}>
            <p className="text-white/60 text-sm">
              Powered by React ⚛️ • Firebase 🔥 • TailwindCSS 🎨 • AI/ML 🤖
            </p>
            <p className="text-white/50 text-xs mt-2">
              Enterprise-Grade ERP System • Built with ❤️ for modern education
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LandingPage;