import React, { useState, useRef } from 'react';
import api from './api';
import { useNavigate } from 'react-router-dom';
import { Camera, MapPin, Send, ArrowRight, ArrowLeft, LogOut } from 'lucide-react';
import './App.css';

export default function App() {
  const navigate = useNavigate();
  // Kiểm tra nếu là máy tính / màn hình rộng > 768px
  const isDesktop = window.innerWidth > 768;

  // Máy tính thì nhảy thẳng vào bước 2, điện thoại thì bắt đầu từ bước 1
  const [step, setStep] = useState(isDesktop ? 2 : 1);
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [pin, setPin] = useState(null);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const mapRef = useRef(null);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleMapClick = (e) => {
    if (!mapRef.current) return;
    const rect = mapRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPin({ x, y });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!pin) {
      alert('Vui lòng chạm vào sơ đồ để chọn vị trí sự cố!');
      return;
    }

    if (isDesktop && !description.trim()) {
      alert('Vui lòng nhập mô tả sự cố!');
      return;
    }
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    setLoading(true);

    const formData = new FormData();
    // Chỉ đính kèm file ảnh nếu có (học sinh dùng điện thoại chụp)
    if (image) {
      formData.append('image', image);
    }
    formData.append('coord_x', pin.x.toFixed(2));
    formData.append('coord_y', pin.y.toFixed(2));
    formData.append('description', description);
    formData.append('reporter_name', `${currentUser.full_name || 'Học sinh'} (${currentUser.class_name || '8/6'})`);
    formData.append('reporter_phone', currentUser.phone || 'Học sinh');

    try {
      await api.post('/reports', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      alert('Đã gửi báo cáo thành công!');

      // Nếu dùng trên máy tính công cộng: Tự động đăng xuất về trang đăng nhập
      if (isDesktop) {
        localStorage.removeItem('user');
        navigate('/login');
        return;
      }

      // Nếu dùng trên điện thoại cá nhân: Reset form về ban đầu
      setImage(null);
      setPreview(null);
      setPin(null);
      setDescription('');
      setStep(1);
    } catch (err) {
      console.error(err);
      alert('Chưa kết nối được Server backend.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="mobile-container">
      <div className="header">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <h2>AI GreenMap</h2>
        </div>
        <p>
          {isDesktop
            ? 'Xác định vị trí sự cố trên sơ đồ trường'
            : `Bước ${step}/2: ${step === 1 ? 'Chụp ảnh hiện trường' : 'Xác định vị trí trên sơ đồ'}`}
        </p>
      </div>

      {step === 1 ? (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div className="upload-box" onClick={() => document.getElementById('camera-input').click()} style={{ minHeight: 280 }}>
            {preview ? (
              <img src={preview} alt="Hiện trường" className="preview-img" style={{ maxHeight: 260 }} />
            ) : (
              <div style={{ padding: '40px 0' }}>
                <Camera size={48} color="#2e7d32" />
                <p style={{ marginTop: 12, fontSize: '0.95rem', color: '#444' }}>
                  Chạm để mở máy ảnh hoặc chọn ảnh
                </p>
              </div>
            )}
            <input
              id="camera-input"
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={handleImageChange}
            />
          </div>

          <button
            type="button"
            className="submit-btn"
            disabled={!image}
            onClick={() => setStep(2)}
            style={{ marginTop: 'auto' }}
          >
            Tiếp tục chọn vị trí <ArrowRight size={18} style={{ marginLeft: 6, verticalAlign: 'middle' }} />
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div className="form-group">
            <label>
              <MapPin size={16} style={{ verticalAlign: 'text-bottom' }} /> Chạm vào sơ đồ để ghim điểm nóng
            </label>
            <div className="map-wrapper" ref={mapRef} onClick={handleMapClick}>
              <img src="/map.jpg" alt="Sơ đồ trường" className="school-map" />
              {pin && (
                <div
                  className="pin-marker"
                  style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
                >
                  <div className="pin-head" />
                </div>
              )}
            </div>
          </div>

          <div className="form-group">
            <label>
              {isDesktop ? (
                <>
                  Mô tả sự cố <span style={{ color: '#ef4444' }}>(Bắt buộc)</span>
                </>
              ) : (
                'Ghi chú thêm (không bắt buộc)'
              )}
            </label>
            <input
              type="text"
              className="text-input"
              required={isDesktop} // Tự động bật required nếu là máy tính
              placeholder={
                isDesktop
                  ? 'Ví dụ: Thùng rác trước lớp 8/6 bị tràn, vòi nước rò rỉ...'
                  : 'Ví dụ: Rác nhiều sau giờ ra chơi...'
              }
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 'auto' }}>
            {!isDesktop ? (
              <button
                type="button"
                className="submit-btn"
                disabled={loading}
                onClick={() => setStep(1)}
                style={{
                  backgroundColor: '#757575',
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  whiteSpace: 'nowrap', // Ngăn chữ rớt dòng làm phình to nút
                  fontSize: '0.9rem',
                  padding: '12px 8px',
                  opacity: loading ? 0.6 : 1,
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                <ArrowLeft size={16} style={{ marginRight: 4, flexShrink: 0 }} /> Quay lại
              </button>
            ) : (
              <button
                type="button"
                className="submit-btn"
                disabled={loading}
                onClick={handleLogout}
                style={{
                  backgroundColor: '#4b5563',
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  whiteSpace: 'nowrap',
                  fontSize: '0.9rem',
                  padding: '12px 8px',
                  cursor: 'pointer'
                }}
              >
                Đăng Xuất
              </button>
            )}

            <button
              type="submit"
              className="submit-btn"
              disabled={loading || !pin || (isDesktop && !description.trim())}
              style={{
                flex: 1.6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                whiteSpace: 'nowrap',
                fontSize: '0.9rem',
                padding: '12px 8px',
                opacity: (loading || !pin || (isDesktop && !description.trim())) ? 0.6 : 1,
                cursor: (loading || !pin || (isDesktop && !description.trim())) ? 'not-allowed' : 'pointer'
              }}
            >
              <Send size={16} style={{ marginRight: 6, flexShrink: 0 }} />
              {loading ? 'Đang gửi...' : 'Gửi báo cáo'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}