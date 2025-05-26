import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

const SecretStats = () => {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const secretKey = localStorage.getItem('secretKey');
    if (!secretKey) {
      setError('You need a secret key to access this page');
      return;
    }
    fetch(`/api/secret-stats?key=${secretKey}`)
      .then(response => {
        if (!response.ok) {
          throw new Error('Unauthorized');
        }
        return response.json();
      })
      .then(data => {
        setStats(data);
      })
      .catch(error => {
        setError('Unauthorized access');
      });
  }, []);

  const handleBack = () => {
    localStorage.removeItem('secretKey');
    navigate('/');
  };

  const renderCountryStats = () => {
    if (!stats?.countryStats) return null;
    const data = Object.entries(stats.countryStats)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([country, count]) => ({ country, visitors: count }));
    return (
      <div className="country-stats">
        <h3>Top Countries (Last 24 Hours)</h3>
        <BarChart width={600} height={300} data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="country" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="visitors" fill="#8884d8" />
        </BarChart>
      </div>
    );
  };

  return (
    <div className="secret-stats-container">
      <h2>Secret Statistics</h2>
      {error ? (
        <div className="error-message">{error}</div>
      ) : stats ? (
        <div className="stats-content">
          <p>Total Visitors: {stats.totalVisitors.toLocaleString()}</p>
          <p>Last Updated: {new Date(stats.lastUpdated).toLocaleString()}</p>
          {renderCountryStats()}
          <button onClick={handleBack}>Back to Chat</button>
        </div>
      ) : (
        <div className="loading">Loading statistics...</div>
      )}
    </div>
  );
};

export default SecretStats;
