import React, { useState } from 'react';
import api from './api';
import { useNavigate } from 'react-router-dom';
import { Phone, Lock, User, ShieldCheck } from 'lucide-react';
import './Auth.css';
export default function Auth() {
  const [isRegister, setIsRegister] = useState(false); // false: Đăng nhập, true: Đăng ký
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const staffRoles = ['guard', 'admin', 'teacher'];
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      if (isRegister) {
        // Đăng ký học sinh
        const res = await api.post('/auth/register-student', { phone, full_name: fullName, password });
        localStorage.setItem('user', JSON.stringify(res.data.user));
        alert('Đăng ký tài khoản học sinh thành công!');
        navigate('/report');
      } else {
        // Đăng nhập
        const res = await api.post('/auth/login', { phone, password });
        const user = res.data.user;
        localStorage.setItem('user', JSON.stringify(user));

        // Tự động điều hướng theo Role (sử dụng đúng biến user)
        if (staffRoles.includes(user.role)) {
          navigate('/dashboard');
        } else {
          navigate('/report');
        }
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || 'Có lỗi xảy ra, vui lòng thử lại!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-header">
          <ShieldCheck size={40} color="#2e7d32" />
          <h2>AI GreenMap</h2>
        </div>

        {errorMsg && <div className="auth-error-badge">{errorMsg}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          {isRegister && (
            <div className="input-group">
              <label><User size={16} /> Họ và tên học sinh</label>
              <input
                type="text"
                placeholder="Ví dụ: Nguyễn Văn A"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
          )}

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
            {loading ? 'Đang xử lý...' : (isRegister ? 'Tạo tài khoản học sinh' : 'Đăng nhập')}
          </button>
        </form>

        <div className="auth-footer">
          {isRegister ? (
            <p>Đã có tài khoản? <span onClick={() => { setIsRegister(false); setErrorMsg(''); }}>Đăng nhập</span></p>
          ) : (
            <p>Chưa có tài khoản học sinh? <span onClick={() => { setIsRegister(true); setErrorMsg(''); }}>Đăng ký</span></p>
          )}
          <small style={{ display: 'block', marginTop: 12, color: '#888' }}>
            {/* * Tài khoản Quản trị / Bảo vệ do nhà trường cấp. */}
          </small>
        </div>
      </div>
    </div>
  );
}