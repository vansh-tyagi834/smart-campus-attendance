import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

function Login() {
  const navigate = useNavigate();
  const { role } = useParams();
  const [credentials, setCredentials] = useState({
    username: '',
    password: ''
  });
  const [error, setError] = useState('');

  // Role configuration
  const roleConfig = {
    student: {
      title: 'Student Portal',
      emoji: '👨‍🎓',
      color: 'purple',
      gradient: 'from-purple-600 to-purple-700',
      bgGradient: 'from-purple-500 to-purple-700',
      dashboard: '/student',
      description: 'Access your attendance records and academic progress'
    },
    faculty: {
      title: 'Faculty Dashboard',
      emoji: '👨‍🏫',
      color: 'blue',
      gradient: 'from-blue-600 to-blue-700',
      bgGradient: 'from-blue-500 to-blue-700',
      dashboard: '/faculty',
      description: 'Monitor student attendance and class analytics'
    },
    admin: {
      title: 'Admin Control Panel',
      emoji: '🛡️',
      color: 'green',
      gradient: 'from-green-600 to-green-700',
      bgGradient: 'from-green-500 to-green-700',
      dashboard: '/admin',
      description: 'Complete system overview and management'
    },
    parent: {
      title: 'Parent Portal',
      emoji: '👨‍👩‍👧',
      color: 'pink',
      gradient: 'from-pink-600 to-pink-700',
      bgGradient: 'from-pink-500 to-pink-700',
      dashboard: '/parent',
      description: "Track your child's attendance and performance"
    }
  };

  // ====== SECURE CREDENTIALS DATABASE ======
  const validCredentials = {
    student: {
      username: 'vansh@smartcampus.edu',
      password: 'vansh123'
    },
    faculty: {
      username: 'faculty@smartcampus.edu',
      password: 'faculty123'
    },
    admin: {
      username: 'admin@smartcampus.edu',
      password: 'admin123'
    },
    parent: {
      username: 'parent@smartcampus.edu',
      password: 'parent123'
    }
  };

  const config = roleConfig[role] || roleConfig.student;

  const handleLogin = (e) => {
    e.preventDefault();
    setError(''); // Clear previous errors

    // ====== STRICT VALIDATION ======
    if (!credentials.username || !credentials.password) {
      setError('Please enter both username and password');
      return;
    }

    // Get valid credentials for this role
    const validCreds = validCredentials[role];

    // Check if credentials match
    if (credentials.username === validCreds.username && 
        credentials.password === validCreds.password) {
      // SUCCESS - Navigate to dashboard
      navigate(config.dashboard);
    } else {
      // FAILED - Show error
      setError('Invalid username or password. Please try again.');
    }
  };

  return (
    <div className={`min-h-screen bg-gradient-to-br ${config.bgGradient} flex items-center justify-center p-6`}>
      <div className="max-w-md w-full">
        {/* Back Button */}
        <button
          onClick={() => navigate('/')}
          className="mb-6 text-white/80 hover:text-white transition flex items-center gap-2"
        >
          <span className="text-2xl">←</span>
          <span>Back to Home</span>
        </button>

        {/* Login Card */}
        <div className="bg-white rounded-3xl shadow-2xl p-8 transform hover:scale-105 transition-all duration-300">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="text-8xl mb-4 animate-bounce">{config.emoji}</div>
            <h1 className="text-4xl font-bold text-gray-800 mb-2">{config.title}</h1>
            <p className="text-gray-600">{config.description}</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 bg-red-50 border-2 border-red-200 text-red-700 px-4 py-3 rounded-xl">
              <div className="flex items-center gap-2">
                <span className="text-xl">❌</span>
                <span className="font-semibold">{error}</span>
              </div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-gray-700 font-semibold mb-2">
                Username / ID
              </label>
              <input
                type="text"
                value={credentials.username}
                onChange={(e) => setCredentials({...credentials, username: e.target.value})}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-purple-500 focus:outline-none transition"
                placeholder={`${role}@smartcampus.edu`}
              />
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-2">
                Password
              </label>
              <input
                type="password"
                value={credentials.password}
                onChange={(e) => setCredentials({...credentials, password: e.target.value})}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-purple-500 focus:outline-none transition"
                placeholder="Enter your password"
              />
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center">
                <input type="checkbox" className="mr-2" />
                <span className="text-gray-600">Remember me</span>
              </label>
              <a href="#" className="text-purple-600 hover:text-purple-700 font-semibold">
                Forgot Password?
              </a>
            </div>

            <button
              type="submit"
              className={`w-full bg-gradient-to-r ${config.gradient} text-white py-4 rounded-xl font-bold text-lg hover:opacity-90 transition shadow-lg`}
            >
              Login as {role.charAt(0).toUpperCase() + role.slice(1)} →
            </button>
          </form>

          {/* Demo Login Button REMOVED */}
          {/* Security notice instead */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🔒</span>
                <div className="flex-1">
                  <h3 className="font-bold text-purple-800 mb-1">Secure Login</h3>
                  <p className="text-sm text-purple-700">
                    Please use your registered credentials to access the system. 
                    Contact admin if you forgot your password.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Features */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-600 text-center mb-3">Access Features:</p>
            <div className="grid grid-cols-2 gap-3 text-xs text-gray-500">
              <div className="flex items-center">
                <span className="mr-2">✅</span>
                <span>Real-time data</span>
              </div>
              <div className="flex items-center">
                <span className="mr-2">✅</span>
                <span>Analytics</span>
              </div>
              <div className="flex items-center">
                <span className="mr-2">✅</span>
                <span>Reports</span>
              </div>
              <div className="flex items-center">
                <span className="mr-2">✅</span>
                <span>Export data</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-white/70 text-sm mt-6">
          Secure login powered by Firebase 🔒
        </p>
      </div>
    </div>
  );
}

export default Login;