import React, { useState, useRef } from 'react';
import api from './api';
import { useNavigate } from 'react-router-dom';
import { Camera, MapPin, Send, ArrowRight, ArrowLeft, LogOut } from 'lucide-react';
import './App.css';

const ISSUE_CATEGORIES = [
  { id: 'waste', label: '🗑️ Rác', name: 'Rác thải' },
  { id: 'water', label: '🚰 Rò rỉ nước', name: 'Rò rỉ nước' },
  { id: 'power', label: '💡 Lãng phí điện', name: 'Lãng phí điện' },
  { id: 'clean', label: '🧹 Vệ sinh', name: 'Vệ sinh' },
  { id: 'heat', label: '🌡️ Khu vực nóng', name: 'Khu vực nóng' },
  { id: 'other', label: '🔔 Lựa chọn khác', name: 'Khác' },
];

export default function App() {
  const navigate = useNavigate();
  const isDesktop = window.innerWidth > 768;
  const [step, setStep] = useState(isDesktop ? 2 : 1);
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [pin, setPin] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(ISSUE_CATEGORIES[0].name);
  const [otherText, setOtherText] = useState('');
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
    if (selectedCategory === 'Khác' && !otherText.trim()) {
      alert('Vui lòng nhập chi tiết sự cố bạn muốn báo cáo!');
      return;
    }

    const finalDescription = selectedCategory === 'Khác' ? otherText.trim() : selectedCategory;
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    setLoading(true);

    const formData = new FormData();
    if (image) {
      formData.append('image', image);
    }
    formData.append('coord_x', pin.x.toFixed(2));
    formData.append('coord_y', pin.y.toFixed(2));
    formData.append('description', finalDescription);
    formData.append('issue_category', selectedCategory);
    formData.append('reporter_name', `${currentUser.full_name || 'Học sinh'} (${currentUser.class_name || '8/6'})`);
    formData.append('reporter_phone', currentUser.phone || 'Học sinh');

    try {
      await api.post('/reports', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      alert('Đã gửi báo cáo thành công!');

      if (isDesktop) {
        localStorage.removeItem('user');
        navigate('/login');
        return;
      }

      setImage(null);
      setPreview(null);
      setPin(null);
      setSelectedCategory(ISSUE_CATEGORIES[0].name);
      setOtherText('');
      setStep(1);
    } catch (err) {
      console.error(err);
      const detail = err.response?.data?.detail;
      alert(detail || 'Chưa kết nối được Server backend.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/login');
  };

  const isSubmitDisabled = loading || !pin || (selectedCategory === 'Khác' && !otherText.trim());

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

          <div className="form-group" style={{ marginBottom: 12 }}>
            <label style={{ fontSize: '0.88rem', fontWeight: 600, color: '#e4e4e7', marginBottom: 8, display: 'block' }}>
              Loại vấn đề
            </label>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 6
            }}>
              {ISSUE_CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat.name;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.name)}
                    style={{
                      padding: '9px 6px',
                      borderRadius: 8,
                      border: isSelected ? '2px solid #22c55e' : '1px solid rgba(255, 255, 255, 0.1)',
                      backgroundColor: isSelected ? 'rgba(34, 197, 94, 0.2)' : '#27272a',
                      color: isSelected ? '#4ade80' : '#d4d4d8',
                      fontSize: '0.82rem',
                      fontWeight: isSelected ? 600 : 500,
                      cursor: 'pointer',
                      textAlign: 'center',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>

            {selectedCategory === 'Khác' && (
              <input
                type="text"
                className="text-input"
                placeholder="Nhập chi tiết vấn đề khác..."
                value={otherText}
                onChange={(e) => setOtherText(e.target.value)}
                style={{ marginTop: 8 }}
                autoFocus
              />
            )}
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
                  whiteSpace: 'nowrap',
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
              disabled={isSubmitDisabled}
              style={{
                flex: 1.6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                whiteSpace: 'nowrap',
                fontSize: '0.9rem',
                padding: '12px 8px',
                opacity: isSubmitDisabled ? 0.6 : 1,
                cursor: isSubmitDisabled ? 'not-allowed' : 'pointer'
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