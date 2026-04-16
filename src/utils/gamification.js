// Gamification System Utility
export const calculateStreak = (attendanceHistory) => {
  if (!attendanceHistory) return 0;

  const sortedDates = Object.keys(attendanceHistory)
    .sort((a, b) => new Date(b) - new Date(a));

  let streak = 0;
  for (const date of sortedDates) {
    if (attendanceHistory[date] === 'Present') {
      streak++;
    } else {
      break;
    }
  }
  return streak;
};

export const getBadges = (summary) => {
  const badges = [];

  // Perfect Attendance Badge
  if (summary.overall_percentage === 100) {
    badges.push({
      name: 'Perfect Attendance',
      icon: '🏆',
      color: 'gold',
      description: '100% Attendance - Legendary!'
    });
  }

  // Excellent Attendance Badge
  if (summary.overall_percentage >= 95 && summary.overall_percentage < 100) {
    badges.push({
      name: 'Excellence',
      icon: '⭐',
      color: 'purple',
      description: '95%+ Attendance - Outstanding!'
    });
  }

  // Good Attendance Badge
  if (summary.overall_percentage >= 85 && summary.overall_percentage < 95) {
    badges.push({
      name: 'Consistent',
      icon: '💪',
      color: 'blue',
      description: '85%+ Attendance - Great job!'
    });
  }

  // Streak Badges
  const streak = calculateStreak(summary.attendance_history);
  if (streak >= 30) {
    badges.push({
      name: '30-Day Streak',
      icon: '🔥',
      color: 'red',
      description: '30 days perfect attendance!'
    });
  } else if (streak >= 15) {
    badges.push({
      name: '15-Day Streak',
      icon: '✨',
      color: 'orange',
      description: '15 days streak!'
    });
  } else if (streak >= 7) {
    badges.push({
      name: '7-Day Streak',
      icon: '⚡',
      color: 'yellow',
      description: 'Weekly streak!'
    });
  }

  // Subject Master Badges
  if (summary.subjects) {
    Object.entries(summary.subjects).forEach(([subject, data]) => {
      if (data.percentage === 100) {
        badges.push({
          name: `${subject} Master`,
          icon: '🎯',
          color: 'green',
          description: `Perfect in ${subject}!`
        });
      }
    });
  }

  return badges;
};

export const getLeaderboardPosition = (userPercentage, allStudents) => {
  if (!allStudents) return { position: 0, total: 0 };

  const sorted = Object.values(allStudents)
    .map(s => s.overall_percentage)
    .sort((a, b) => b - a);

  const position = sorted.findIndex(p => p <= userPercentage) + 1;

  return {
    position: position || sorted.length + 1,
    total: sorted.length,
    percentile: ((1 - (position / sorted.length)) * 100).toFixed(1)
  };
};

export const getAchievementPoints = (summary) => {
  let points = 0;

  // Base points from attendance
  points += summary.present * 10;

  // Bonus for high percentage
  if (summary.overall_percentage >= 90) points += 500;
  else if (summary.overall_percentage >= 80) points += 300;
  else if (summary.overall_percentage >= 75) points += 100;

  // Streak bonus
  const streak = calculateStreak(summary.attendance_history);
  points += streak * 20;

  // Perfect subject bonus
  if (summary.subjects) {
    Object.values(summary.subjects).forEach(subject => {
      if (subject.percentage === 100) points += 200;
    });
  }

  return points;
};

export const getNextMilestone = (summary) => {
  const percentage = summary.overall_percentage;

  if (percentage >= 100) return null;
  if (percentage >= 95) return { target: 100, name: 'Perfect Attendance', points: 1000 };
  if (percentage >= 85) return { target: 95, name: 'Excellence Badge', points: 500 };
  if (percentage >= 75) return { target: 85, name: 'Consistency Badge', points: 300 };

  return { target: 75, name: 'Safe Zone', points: 100 };
};