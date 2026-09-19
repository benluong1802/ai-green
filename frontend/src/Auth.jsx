import React, { useState } from 'react';
import api from './api';
import { useNavigate } from 'react-router-dom';
import { Phone, Lock, Hash, ShieldCheck, UserCheck, Shield } from 'lucide-react';
import './Auth.css';

export default function Auth() {
  const [activeTab, setActiveTab] = useState('student'); // 'student' | 'staff'
  const [studentCode, setStudentCode] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const staffRoles = ['guard', 'admin', 'teacher'];
  const navigate = useNavigate();

  // 1. Xử lý Đăng nhập Học sinh (Chỉ cần mã số)
  const handleStudentSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!studentCode.trim()) {
      setErrorMsg('Vui lòng nhập mã số học sinh!');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/student-login', {
        student_code: studentCode.trim()
      });
      localStorage.setItem('user', JSON.stringify(res.data.user));
      navigate('/report');
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || 'Mã học sinh không tồn tại trong hệ thống!');
    } finally {
      setLoading(false);
    }
  };

  // 2. Xử lý Đăng nhập Cán bộ / Bảo vệ (SĐT + Mật khẩu)
  const handleStaffSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!phone.trim() || !password) {
      setErrorMsg('Vui lòng nhập đầy đủ số điện thoại và mật khẩu!');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/login', { phone, password });
      const user = res.data.user;
      localStorage.setItem('user', JSON.stringify(user));

      if (staffRoles.includes(user.role)) {
        navigate('/dashboard');
      } else {
        navigate('/report');
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || 'Số điện thoại hoặc mật khẩu không chính xác!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-header">
          <ShieldCheck size={40} color="#4ade80" />
          <h2>AI GreenMap</h2>
        </div>

        {/* CỤM CHUYỂN ĐỔI 2 TAB */}
        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab-btn ${activeTab === 'student' ? 'active' : ''}`}
            onClick={() => { setActiveTab('student'); setErrorMsg(''); }}
          >
            <UserCheck size={16} />
            Học sinh
          </button>
          <button
            type="button"
            className={`auth-tab-btn ${activeTab === 'staff' ? 'active' : ''}`}
            onClick={() => { setActiveTab('staff'); setErrorMsg(''); }}
          >
            <Shield size={16} />
            Cán bộ
          </button>
        </div>

        {errorMsg && <div className="auth-error-badge">{errorMsg}</div>}

        {/* TAB 1: FORM HỌC SINH (CHỈ 1 Ô NHẬP DUY NHẤT) */}
        {activeTab === 'student' ? (
          <form onSubmit={handleStudentSubmit} className="auth-form">
            <div className="input-group">
              <label><UserCheck size={16} /> Mã học sinh</label>
              <input
                type="text"
                placeholder="Nhập mã học sinh..."
                required
                value={studentCode}
                onChange={(e) => setStudentCode(e.target.value)}
                autoFocus
              />
            </div>

            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? 'Đang kiểm tra...' : 'Đăng nhập'}
            </button>
          </form>
        ) : (
          /* TAB 2: FORM BẢO VỆ / CÁN BỘ (GIỮ NGUYÊN FORM CŨ) */
          <form onSubmit={handleStaffSubmit} className="auth-form">
            <div className="input-group">
              <label><Phone size={16} /> Số điện thoại</label>
              <input
                type="tel"
                placeholder="Nhập số điện thoại..."
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div className="input-group">
              <label><Lock size={16} /> Mật khẩu</label>
              <input
                type="password"
                placeholder="Nhập mật khẩu..."
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? 'Đang xử lý...' : 'Đăng nhập'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}