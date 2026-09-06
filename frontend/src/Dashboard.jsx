import React, { useState, useEffect } from 'react';
import api, { BASE_URL } from './api';
import { useNavigate } from 'react-router-dom';
import { Clock, RefreshCw, Eye, X, LogOut } from 'lucide-react';
import './Dashboard.css';

export default function Dashboard() {
  // Toàn bộ Hooks BẮT BUỘC nằm bên trong thân component
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' hoặc 'resolved'

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await api.get('/reports');
      setReports(res.data);
    } catch (err) {
      console.error('Lỗi tải báo cáo:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
    const interval = setInterval(fetchReports, 10000);
    return () => clearInterval(interval);
  }, []);
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/login');
  };
  const toggleStatus = async (id) => {
    try {
      await api.patch(`/reports/${id}/status`);
      fetchReports();
      if (selectedReport && selectedReport.id === id) {
        setSelectedReport((prev) => ({
          ...prev,
          status: prev.status === 'pending' ? 'resolved' : 'pending',
        }));
      }
    } catch (err) {
      alert('Không thể đổi trạng thái!');
    }
  };

  // Thống kê số liệu
  const total = reports.length;
  const pending = reports.filter((r) => r.status === 'pending').length;
  const resolved = reports.filter((r) => r.status === 'resolved').length;
  const highPriority = reports.filter((r) => r.ecoscore === 3 && r.status === 'pending').length;

  // Lọc theo Tab và sắp xếp ưu tiên EcoScore 3 -> 2 -> 1
  const filteredReports = reports
    .filter((r) => r.status === activeTab)
    .sort((a, b) => {
      if (activeTab === 'pending') {
        if ((b.ecoscore || 0) !== (a.ecoscore || 0)) {
          return (b.ecoscore || 0) - (a.ecoscore || 0);
        }
      }
      return new Date(b.created_at) - new Date(a.created_at);
    });

  const getEcoBadge = (score) => {
    if (score === 3) return <span className="badge badge-red">🔴 Mức 3 (Ưu tiên cao)</span>;
    if (score === 2) return <span className="badge badge-yellow">🟡 Mức 2 (Theo dõi)</span>;
    return <span className="badge badge-green">🟢 Mức 1 (Thấp)</span>;
  };

  return (
    <div className="dashboard-container">
      {/* HEADER */}
      <header className="dashboard-header">
        <div>
          <h2>AI GreenMap - Trung Tâm Điều Hành Giám Sát</h2>
        </div>

        {/* Bọc 2 nút vào chung 1 div để đứng sát nhau */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {/* <button className="btn-refresh" onClick={fetchReports} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            {loading ? 'Đang cập nhật...' : 'Làm mới'}
          </button> */}
          <button className="btn-logout" onClick={handleLogout}>
            <LogOut size={16} />
            Đăng xuất
          </button>
        </div>
      </header>

      {/* THẺ THỐNG KÊ */}
      <div className="stats-grid">
        <div className="stat-card">
          <h4>Số báo cáo</h4>
          <span className="stat-num">{total}</span>
        </div>
        <div className="stat-card stat-pending">
          <h4>Chờ xử lý</h4>
          <span className="stat-num">{pending}</span>
        </div>
        <div className="stat-card stat-resolved">
          <h4>Đã xử lý</h4>
          <span className="stat-num">{resolved}</span>
        </div>
        <div className="stat-card stat-urgent">
          <h4>Điểm nóng</h4>
          <span className="stat-num">{highPriority}</span>
        </div>
      </div>

      {/* KHÔNG GIAN BẢN ĐỒ VÀ DANH SÁCH */}
      <div className="main-content-grid">
        {/* BẢN ĐỒ KHUÔN VIÊN TRƯỜNG */}
        <div className="map-section">
          <h3>Bản đồ điểm nóng</h3>
          <div className="dashboard-map-wrapper">
            <img src="/map.jpg" alt="Sơ đồ trường" className="dashboard-school-map" />
            {reports.map((item) => (
              <div
                key={item.id}
                className={`map-marker marker-score-${item.ecoscore} ${item.status === 'resolved' ? 'marker-resolved' : ''}`}
                style={{ left: `${item.coord_x}%`, top: `${item.coord_y}%` }}
                onClick={() => setSelectedReport(item)}
                title={item.issue_detail}
              >
                <div className="marker-pin" />
              </div>
            ))}
          </div>
          <div className="map-legend">
            <span><span className="legend-dot dot-red"></span> Ưu tiên cao (Mức 3)</span>
            <span><span className="legend-dot dot-yellow"></span> Cần theo dõi (Mức 2)</span>
            <span><span className="legend-dot dot-green"></span> Mức thấp (Mức 1)</span>
            <span><span className="legend-dot dot-gray"></span> Đã xử lý</span>
          </div>
        </div>

        {/* DANH SÁCH BÁO CÁO THEO TAB */}
        <div className="reports-list-section">
          <div className="tab-buttons-container">
            <button
              className={`tab-btn ${activeTab === 'pending' ? 'tab-btn-active' : ''}`}
              onClick={() => setActiveTab('pending')}
            >
              ⏳Xử lý({pending})
            </button>
            <button
              className={`tab-btn ${activeTab === 'resolved' ? 'tab-btn-active' : ''}`}
              onClick={() => setActiveTab('resolved')}
            >
              ✅ Xong({resolved})
            </button>
          </div>

          <div className="cards-scroll-container">
            {filteredReports.length === 0 ? (
              <p style={{ color: '#888', textAlign: 'center', marginTop: 40 }}>
                {activeTab === 'pending'
                  ? 'Tuyệt vời! Không còn sự cố nào tồn đọng.'
                  : 'Chưa có sự cố nào hoàn thành.'}
              </p>
            ) : (
              filteredReports.map((r) => (
                <div
                  key={r.id}
                  className={`report-item-card ${selectedReport?.id === r.id ? 'active-card' : ''}`}
                >
                  <div className="report-item-header">
                    {getEcoBadge(r.ecoscore)}
                    <span className={`status-pill ${r.status}`}>
                      {r.status === 'resolved' ? 'Đã xong' : 'Chờ xử lý'}
                    </span>
                  </div>

                  <div className="report-item-body" onClick={() => setSelectedReport(r)}>
                    <p className="issue-title"><strong>{r.issue_group}</strong></p>
                    <p className="issue-detail-text">{r.issue_detail}</p>
                    <p className="report-time">
                      <Clock size={14} /> {
                        (() => {
                          if (!r.created_at) return '';
                          const [datePart, timePart] = r.created_at.split('T');
                          const [year, month, day] = datePart.split('-');
                          const time = timePart ? timePart.split('.')[0] : '';
                          return `${time} - ${day}/${month}/${year}`;
                        })()
                      }
                    </p>
                  </div>

                  <div className="card-actions">
                    <button className="btn-view" onClick={() => setSelectedReport(r)}>
                      <Eye size={14} /> Chi tiết
                    </button>
                    <button
                      className={`btn-action-status ${r.status === 'resolved' ? 'btn-reopen' : 'btn-resolve'}`}
                      onClick={() => toggleStatus(r.id)}
                    >
                      {r.status === 'resolved' ? 'Mở lại' : 'Đã Xong'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* POPUP CHI TIẾT SỰ CỐ */}
      {selectedReport && (
        <div className="modal-backdrop" onClick={() => setSelectedReport(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Chi tiết điểm nóng</h3>
              <button className="close-btn" onClick={() => setSelectedReport(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="modal-img-col">
                <img src={`${BASE_URL}${selectedReport.image_url}`} alt="Hiện trường" />
              </div>
              <div className="modal-info-col">
                <div style={{ marginBottom: 12 }}>{getEcoBadge(selectedReport.ecoscore)}</div>
                <p><strong>Người báo cáo:</strong> {selectedReport.reporter_name || 'Học sinh ẩn danh'} {selectedReport.reporter_phone ? `(${selectedReport.reporter_phone})` : ''}</p>
                <p><strong>Loại vấn đề:</strong> {selectedReport.issue_group}</p>
                <p><strong>Chi tiết:</strong> {selectedReport.issue_detail}</p>
                <p><strong>Ghi chú từ học sinh:</strong> {selectedReport.description || 'Không có'}</p>
                <div className="ai-suggestion-box">
                  <strong>🤖 Đề xuất xử lý:</strong>
                  <p>{selectedReport.ai_suggestion || 'Chưa có gợi ý.'}</p>
                </div>
                <div style={{ marginTop: 20 }}>
                  <button
                    className={`btn-toggle-large ${selectedReport.status === 'resolved' ? 'resolved' : 'pending'}`}
                    onClick={() => toggleStatus(selectedReport.id)}
                  >
                    {selectedReport.status === 'resolved'
                      ? 'Đã giải quyết xong'
                      : 'Đã xử lý xong'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}