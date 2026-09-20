import React, { useState, useEffect } from 'react';
import api, { BASE_URL } from './api';
import { useNavigate } from 'react-router-dom';
import { Clock, RefreshCw, Eye, X, LogOut } from 'lucide-react';
import './Dashboard.css';

export default function Dashboard() {
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('pending');
  const [exportPeriod, setExportPeriod] = useState('week');
  const [showExportModal, setShowExportModal] = useState(false);

  const handleExportExcel = async (period = 'week') => {
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
      const apiUrl = `${baseUrl}/api/reports/export-excel?period=${period}`;

      const res = await fetch(apiUrl);

      if (!res.ok) {
        const errorData = await res.json();
        alert(errorData.detail || 'Không thể xuất dữ liệu!');
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `bao_cao_${period}_${new Date().toISOString().slice(0, 10)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Lỗi xuất Excel:', error);
      alert('Đã xảy ra lỗi khi kết nối tới máy chủ!');
    }
  };
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

  const total = reports.length;
  const pending = reports.filter((r) => r.status === 'pending').length;
  const resolved = reports.filter((r) => r.status === 'resolved').length;
  const highPriority = reports.filter((r) => r.ecoscore === 3 && r.status === 'pending').length;

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
    if (score === 3) return <span className="badge badge-red">🔴 Mức 3 (Ưu tiên)</span>;
    if (score === 2) return <span className="badge badge-yellow">🟡 Mức 2 (Theo dõi)</span>;
    return <span className="badge badge-green">🟢 Mức 1 (Thấp)</span>;
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div>
          <h2>AI GreenMap - Trung Tâm Điều Hành Giám Sát</h2>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {/* Nút mở popup Export */}
          <button
            onClick={() => setShowExportModal(true)}
            style={{
              padding: '8px 16px',
              height: '44px',
              backgroundColor: '#107c41',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#0b5a2f')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#107c41')}
          >
            Xuất File
          </button>

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
          <div
            className="modal-box"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: selectedReport.image_url ? '720px' : '480px' }}
          >
            <div className="modal-header">
              <div className="modal-header-left">
                <h3>Chi tiết điểm nóng</h3>
                {getEcoBadge(selectedReport.ecoscore)}
              </div>
              <button className="close-btn" onClick={() => setSelectedReport(null)}>
                <X size={20} />
              </button>
            </div>

            <div className={`modal-body ${!selectedReport.image_url ? 'no-image-layout' : ''}`}>
              {/* Cột ảnh nếu có */}
              {selectedReport.image_url && (
                <div className="modal-img-col">
                  <img src={`${BASE_URL}${selectedReport.image_url}`} alt="Hiện trường" />
                </div>
              )}

              {/* Cột thông tin được phân khối rõ ràng */}
              <div className="modal-info-col">
                <div className="info-row">
                  <span className="info-label">Người báo cáo</span>
                  <span className="info-val highlight">
                    {selectedReport.reporter_name || 'Học sinh ẩn danh'}
                    {selectedReport.reporter_phone && selectedReport.reporter_phone !== 'Không rõ'
                      ? ` (0${selectedReport.reporter_phone})`
                      : ''}
                  </span>
                </div>

                <div className="info-row">
                  <span className="info-label">Vấn đề</span>
                  <span className="info-val">{selectedReport.issue_group} &bull; {selectedReport.issue_detail}</span>
                </div>

                <div className="info-row">
                  <span className="info-label">Ghi chú</span>
                  <span className="info-val text-muted">{selectedReport.description || 'Không có ghi chú'}</span>
                </div>

                {/* Hộp đề xuất AI */}
                <div className="ai-suggestion-box">
                  <div className="ai-title">🤖 Đề xuất xử lý</div>
                  <p>{selectedReport.ai_suggestion || 'Cần kiểm tra trực tiếp hiện trường.'}</p>
                </div>

                <div className="modal-action-wrap">
                  <button
                    className={`btn-toggle-large ${selectedReport.status === 'resolved' ? 'resolved' : 'pending'}`}
                    onClick={() => toggleStatus(selectedReport.id)}
                  >
                    {selectedReport.status === 'resolved' ? 'Mở lại sự cố' : 'Đã xử lý xong'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {showExportModal && (
        <div
          className="modal-backdrop"
          onClick={() => setShowExportModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
          }}
        >
          <div
            className="modal-box"
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              width: '420px',
              padding: '20px 24px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
              color: '#1f2937'
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>Xuất báo cáo Excel</h3>
              <button
                onClick={() => setShowExportModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '14px', color: '#4b5563', marginBottom: '16px' }}>
              Chọn khoảng thời gian báo cáo cần kết xuất dữ liệu:
            </p>

            {/* Danh sách Radio Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px' }}>
                <input
                  type="radio"
                  name="exportPeriod"
                  value="week"
                  checked={exportPeriod === 'week'}
                  onChange={(e) => setExportPeriod(e.target.value)}
                  style={{ width: '16px', height: '16px', accentColor: '#107c41', cursor: 'pointer' }}
                />
                <span><strong>7 ngày gần nhất</strong> (Theo tuần)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px' }}>
                <input
                  type="radio"
                  name="exportPeriod"
                  value="month"
                  checked={exportPeriod === 'month'}
                  onChange={(e) => setExportPeriod(e.target.value)}
                  style={{ width: '16px', height: '16px', accentColor: '#107c41', cursor: 'pointer' }}
                />
                <span><strong>30 ngày gần nhất</strong> (Theo tháng)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px' }}>
                <input
                  type="radio"
                  name="exportPeriod"
                  value="all"
                  checked={exportPeriod === 'all'}
                  onChange={(e) => setExportPeriod(e.target.value)}
                  style={{ width: '16px', height: '16px', accentColor: '#107c41', cursor: 'pointer' }}
                />
                <span><strong>Toàn bộ dữ liệu</strong> (Tất cả)</span>
              </label>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setShowExportModal(false)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '500',
                  fontSize: '14px'
                }}
              >
                Hủy
              </button>

              <button
                onClick={async () => {
                  await handleExportExcel(exportPeriod);
                  setShowExportModal(false);
                }}
                style={{
                  padding: '8px 18px',
                  backgroundColor: '#107c41',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '14px'
                }}
              >
                Tải xuống
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}