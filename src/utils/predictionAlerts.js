// AI-Powered Attendance Prediction & Alert System
export const predictDetentionRisk = (summary) => {
  const percentage = summary.overall_percentage;
  const totalClasses = summary.total_classes;
  const present = summary.present;

  // Calculate classes needed to reach 75%
  const classesNeededFor75 = Math.ceil((0.75 * totalClasses - present) / 0.25);

  // Risk levels
  let riskLevel = 'safe';
  let alertType = 'success';
  let message = '';
  let action = '';

  if (percentage < 60) {
    riskLevel = 'critical';
    alertType = 'error';
    message = '🚨 CRITICAL: You are at HIGH RISK of detention!';
    action = `You need to attend ALL remaining ${classesNeededFor75} classes to reach 75%`;
  } else if (percentage < 65) {
    riskLevel = 'high';
    alertType = 'error';
    message = '⚠️ HIGH RISK: Your attendance is dangerously low!';
    action = `Attend at least ${classesNeededFor75} more classes to be safe`;
  } else if (percentage < 70) {
    riskLevel = 'medium';
    alertType = 'warning';
    message = '⚠️ WARNING: You are approaching detention threshold!';
    action = `Missing ${Math.floor((percentage - 75) / 100 * totalClasses)} more classes will put you at risk`;
  } else if (percentage < 75) {
    riskLevel = 'low';
    alertType = 'warning';
    message = '⚠️ CAUTION: You are below the 75% requirement!';
    action = `Improve attendance to avoid detention`;
  } else if (percentage < 80) {
    riskLevel = 'safe';
    alertType = 'info';
    message = '✅ SAFE: But maintain consistency!';
    action = 'Keep attending regularly to stay above 75%';
  } else {
    riskLevel = 'excellent';
    alertType = 'success';
    message = '🌟 EXCELLENT: Great attendance record!';
    action = 'Keep up the amazing work!';
  }

  return {
    riskLevel,
    alertType,
    message,
    action,
    percentage,
    classesNeededFor75: classesNeededFor75 > 0 ? classesNeededFor75 : 0,
    canMiss: Math.floor((percentage - 75) / 100 * totalClasses)
  };
};

export const getSubjectAlerts = (subjects) => {
  const alerts = [];

  Object.entries(subjects).forEach(([subject, data]) => {
    if (data.percentage < 75) {
      const classesNeeded = Math.ceil((0.75 * data.total - data.present) / 0.25);
      alerts.push({
        subject: subject.replace(/_/g, ' '),
        percentage: data.percentage,
        severity: data.percentage < 60 ? 'critical' : data.percentage < 70 ? 'high' : 'medium',
        message: `${subject.replace(/_/g, ' ')}: ${data.percentage}% (Need ${classesNeeded} more classes)`,
        classesNeeded
      });
    }
  });

  return alerts.sort((a, b) => a.percentage - b.percentage);
};

export const generateRecommendations = (summary) => {
  const recommendations = [];
  const percentage = summary.overall_percentage;

  if (percentage < 75) {
    recommendations.push({
      icon: '🎯',
      title: 'Priority Action',
      description: 'Attend ALL upcoming classes without fail'
    });
    recommendations.push({
      icon: '📞',
      title: 'Talk to Faculty',
      description: 'Discuss your situation with class teacher'
    });
    recommendations.push({
      icon: '📝',
      title: 'Medical Leave',
      description: 'Submit medical certificates for genuine absences'
    });
  }

  if (percentage >= 75 && percentage < 85) {
    recommendations.push({
      icon: '💪',
      title: 'Stay Consistent',
      description: 'Maintain regular attendance to build buffer'
    });
  }

  // Check for specific subject issues
  if (summary.subjects) {
    const lowSubjects = Object.entries(summary.subjects)
      .filter(([_, data]) => data.percentage < 75)
      .map(([subject]) => subject.replace(/_/g, ' '));

    if (lowSubjects.length > 0) {
      recommendations.push({
        icon: '📚',
        title: 'Focus on Subjects',
        description: `Priority: ${lowSubjects.join(', ')}`
      });
    }
  }

  return recommendations;
};

export const shouldSendAlert = (summary) => {
  // Send alert if below 75% or if crossed threshold recently
  return summary.overall_percentage < 75 || 
         (summary.overall_percentage >= 75 && summary.overall_percentage < 80);
};

export const getAlertColor = (riskLevel) => {
  const colors = {
    critical: 'from-red-500 to-red-700',
    high: 'from-orange-500 to-red-600',
    medium: 'from-yellow-500 to-orange-500',
    low: 'from-yellow-400 to-yellow-600',
    safe: 'from-green-400 to-green-600',
    excellent: 'from-blue-500 to-purple-600'
  };
  return colors[riskLevel] || colors.safe;
};