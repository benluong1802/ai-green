import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Auth from './Auth';
import StudentReport from './StudentReport';
import Dashboard from './Dashboard';

const getCurrentUser = () => {
  try {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  } catch (e) {
    return null;
  }
};

const ProtectedStudentRoute = () => {
  const user = getCurrentUser();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return (
    <div className="mobile-wrapper">
      <StudentReport />
    </div>
  );
};

const ProtectedDashboardRoute = () => {
  const user = getCurrentUser();
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const allowedRoles = ['guard', 'admin', 'teacher'];
  if (!allowedRoles.includes(user.role)) {
    alert('Tài khoản học sinh không có quyền truy cập trung tâm giám sát!');
    return <Navigate to="/report" replace />;
  }
  return <Dashboard />;
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Auth />} />

        <Route path="/" element={<ProtectedStudentRoute />} />
        <Route path="/report" element={<ProtectedStudentRoute />} />

        <Route path="/dashboard" element={<ProtectedDashboardRoute />} />
        <Route path="/admin" element={<ProtectedDashboardRoute />} />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}