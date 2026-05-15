import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { X, FileText, Clock, CheckCircle, XCircle, RefreshCw, Eye } from "lucide-react";
import { supabase } from "../../supabaseClient.js";
import { UserAuth } from "../../context/AuthContext.jsx";
import Navbar from "./ResearcherNavbar";
import "./ResearcherActivityLog.css";

const STATUS_STYLES = {
    'Pending':              { bg: '#fef9c3', text: '#854d0e' },
    'Approved':             { bg: '#dcfce7', text: '#166534' },
    'Rejected':             { bg: '#fee2e2', text: '#991b1b' },
    'With Minor Revisions': { bg: '#dbeafe', text: '#1e40af' },
    'With Major Revisions': { bg: '#ede9fe', text: '#5b21b6' },
};

const getActionConfig = (rawStatus) => {
    const status = rawStatus?.trim() ?? '';
    const s = status.toLowerCase();

    if (s === 'pending') {
        return { label: 'Waiting for Review', clickable: false, color: '#854d0e' };
    }
    if (s === 'approved') {
        return { label: 'View Details →', clickable: true, color: '#166534' };
    }
    if (s === 'rejected') {
        return { label: 'View Details →', clickable: true, color: '#991b1b' };
    }
    if (s.includes('minor')) {
        return { label: 'Submit Response →', clickable: true, color: '#1e40af' };
    }
    if (s.includes('major')) {
        return { label: 'Submit Revision →', clickable: true, color: '#5b21b6' };
    }

    console.warn("Still unmatched after normalize:", JSON.stringify(status));
    return { label: 'Waiting for Review', clickable: false, color: '#94a3b8' };
};

export default function ResearcherActivityLog() {
    const navigate = useNavigate();
    const { openLogId } = useParams();
    const { dbId, firstName, lastName, session } = UserAuth();

    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [selectedLog, setSelectedLog] = useState(null);

    useEffect(() => {
        if (!dbId) return;

        async function fetchLogs() {
            // get all research IDs owned by this researcher
            const { data: researchRows, error: researchError } = await supabase
                .from('Research')
                .select('research_id')
                .eq('researcher_id', dbId);

            if (researchError || !researchRows || researchRows.length === 0) {
                setLoading(false);
                return;
            }

            const researchIds = researchRows.map(r => r.research_id);

            // GET ALL activity log entries for those research IDs
            const { data, error } = await supabase
                .from('ResearchActivityLog')
                .select(`
                    *,
                    Research (
                        research_id,
                        title,
                        hru_no,
                        status,
                        description,
                        research_files ( file_url, file_type )
                    )
                `)
                .in('research_id', researchIds)
                .order('created_at', { ascending: false });

            if (!error && data) {
                setLogs(data);

                if (openLogId) {
                    const target = data.find(l => String(l.log_id) === String(openLogId));
                    if (target) setSelectedLog(target);
                }
            }

            setLoading(false);
        }

        fetchLogs();
    }, [dbId, openLogId]);

    const filtered = logs.filter(log =>
        log.Research?.title?.toLowerCase().includes(search.toLowerCase()) ||
        log.Research?.hru_no?.toLowerCase().includes(search.toLowerCase())
    );

    const closeModal = () => {
        setSelectedLog(null);
        navigate('/researcher-activity-log', { replace: true });
    };

    return (
        <div className="dashboard-wrapper">
            <Navbar />
            <main className="dashboard-container">

                <div className="alog-page-header">
                    <h1>Activity Log</h1>
                    <p>Track all activity on your submitted researches.</p>
                </div>

                <div className="alog-card">
                    {/* Table header */}
                    <div className="alog-table-head">
                        <span>Status</span>
                        <span>HRU No.</span>
                        <span>Title</span>
                        <span>Date</span>
                        <span>Action</span>
                    </div>

                    {/* Rows */}
                    {loading ? (
                        <div className="alog-empty">Loading activity...</div>
                    ) : filtered.length === 0 ? (
                        <div className="alog-empty">No activity found.</div>
                    ) : filtered.map(log => {
                        const status = log.Research?.status.trim();
                        const statusStyle = STATUS_STYLES[status] || { bg: '#f1f5f9', text: '#475569' };
                        const { label, clickable, color } = getActionConfig(status);

                        return (
                            <div key={log.log_id} className="alog-row">
                                <div>
                                    <span
                                        className="alog-status-badge"
                                        style={{ background: statusStyle.bg, color: statusStyle.text }}
                                    >
                                        {status || 'Unknown'}
                                    </span>
                                </div>

                                <div>
                                    <span className="alog-hru">
                                        {log.Research?.hru_no || '—'}
                                    </span>
                                </div>

                                <div className="alog-title-cell">
                                    <span className="alog-research-title">
                                        {log.Research?.title || 'Untitled'}
                                    </span>
                                    <span className="alog-action-tag">
                                        {log.action?.replace(/_/g, ' ')}
                                    </span>
                                </div>

                                <div>
                                    <span className="alog-date">
                                        {new Date(log.created_at).toLocaleDateString('en-US', {
                                            year: 'numeric',
                                            month: 'short',
                                            day: 'numeric'
                                        })}
                                    </span>
                                </div>

                                <div>
                                    <button
                                        className={`alog-action-btn ${clickable ? 'alog-action-link' : ''}`}
                                        style={clickable ? { color } : {}}
                                        onClick={() => clickable && setSelectedLog(log)}
                                        disabled={!clickable}
                                    >
                                        {label}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </main>

            {/* DETAIL MODAL */}
            {selectedLog && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <h2>{selectedLog.Research?.title}</h2>
                                <span className="alog-hru" style={{ fontSize: '0.8rem' }}>
                                    {selectedLog.Research?.hru_no}
                                </span>
                            </div>
                            <button className="close-btn" onClick={closeModal}><X size={24} /></button>
                        </div>

                        <div className="modal-body">
                            {/* Status */}
                            <div className="detail-section">
                                <h3>Current Status</h3>
                                <span
                                    className="alog-status-badge"
                                    style={{
                                        ...STATUS_STYLES[selectedLog.Research?.status],
                                        padding: '6px 16px',
                                        fontSize: '0.8rem',
                                        display: 'inline-block'
                                    }}
                                >
                                    {selectedLog.Research?.status}
                                </span>
                            </div>

                            {/* Details grid */}
                            <div className="detail-section">
                                <h3>Details</h3>
                                <div className="detail-grid">
                                    <div className="detail-item">
                                        <label>HRU No.</label>
                                        <p>{selectedLog.Research?.hru_no}</p>
                                    </div>
                                    <div className="detail-item">
                                        <label>Evaluated On</label>
                                        <p>{new Date(selectedLog.created_at).toLocaleDateString('en-US', {
                                            year: 'numeric', month: 'long', day: 'numeric'
                                        })}</p>
                                    </div>
                                    <div className="detail-item">
                                        <label>Activity</label>
                                        <p style={{ textTransform: 'capitalize' }}>
                                            {selectedLog.action?.replace(/_/g, ' ')}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Evaluator notes */}
                            {selectedLog.action === 'evaluated' && (
                                <div className="detail-section">
                                    <h3>Evaluator's Notes</h3>
                                    <div className="evaluator-notes-box">
                                        {selectedLog.notes || 'No notes were provided.'}
                                    </div>
                                </div>
                            )}

                            {/* Approved message */}
                            {selectedLog.Research?.status === 'Approved' && (
                                <div className="detail-section">
                                    <div className="status-message approved">
                                        <CheckCircle size={20} />
                                        <p>This research has been approved. No further action is required.</p>
                                    </div>
                                </div>
                            )}

                            {/* Rejected message */}
                            {selectedLog.Research?.status === 'Rejected' && (
                                <div className="detail-section">
                                    <div className="status-message rejected">
                                        <XCircle size={20} />
                                        <p>This research has been rejected. No further submissions are accepted for this study.</p>
                                    </div>
                                </div>
                            )}

                            {/* Revision CTA */}
                            {(selectedLog.Research?.status === 'With Minor Revisions' ||
                                selectedLog.Research?.status === 'With Major Revisions') && (
                                <div className="detail-section">
                                    <h3>Next Step</h3>
                                    <p style={{ color: '#64748b', marginBottom: '12px', fontSize: '0.9rem' }}>
                                        {selectedLog.Research?.status === 'With Minor Revisions'
                                            ? 'The evaluator has requested minor revisions. Please address the notes above and submit your response.'
                                            : 'The evaluator has requested major revisions. Please substantially revise and resubmit your research.'}
                                    </p>
                                    <button
                                        className="edit-submission-btn"
                                        style={{ width: '100%', padding: '12px' }}
                                        onClick={() => {
                                            closeModal();
                                            navigate(`/researcher-revision/${selectedLog.research_id}`);
                                        }}
                                    >
                                        {selectedLog.Research?.status === 'With Minor Revisions'
                                            ? 'Submit Response'
                                            : 'Submit Revision'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}