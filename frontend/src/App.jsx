import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Auth from './Auth';
import StudentReport from './StudentReport';
import Dashboard from './Dashboard';

// Hàm lấy thông tin tài khoản hiện tại từ localStorage
const getCurrentUser = () => {
  try {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  } catch (e) {
    return null;
  }
};

// Route bảo vệ cho học sinh (Chưa đăng nhập -> Đẩy về /login)
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

// Route bảo vệ cho Dashboard (Chỉ Guard hoặc Admin mới được vào)
const ProtectedDashboardRoute = () => {
  const user = getCurrentUser();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (user.role !== 'guard' && user.role !== 'admin') {
    alert('Tài khoản học sinh không có quyền truy cập trung tâm giám sát!');
    return <Navigate to="/report" replace />;
  }
  return <Dashboard />;
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Màn hình đăng nhập / đăng ký */}
        <Route path="/login" element={<Auth />} />

        {/* Trang chủ và trang report đều phải đăng nhập mới xem được */}
        <Route path="/" element={<ProtectedStudentRoute />} />
        <Route path="/report" element={<ProtectedStudentRoute />} />

        {/* Trang Dashboard cho bảo vệ / admin */}
        <Route path="/dashboard" element={<ProtectedDashboardRoute />} />
        <Route path="/admin" element={<ProtectedDashboardRoute />} />

        {/* Bất kỳ đường dẫn lạ nào cũng đẩy về /login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}