import React from 'react';
import { useDarkMode } from '../context/DarkModeContext';

function DarkModeToggle() {
  const { isDarkMode, toggleDarkMode } = useDarkMode();

  return (
    <button
      onClick={toggleDarkMode}
      className={`relative inline-flex items-center px-6 py-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg ${
        isDarkMode 
          ? 'bg-gradient-to-r from-gray-700 to-gray-900 text-yellow-300' 
          : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white'
      }`}
      title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
    >
      <span className="text-2xl mr-2">{isDarkMode ? '☀️' : '🌙'}</span>
      <span>{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
    </button>
  );
}

export default DarkModeToggle;