import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { X, FileText, CheckCircle, XCircle } from "lucide-react";
import { supabase } from "../../supabaseClient.js";
import { UserAuth } from "../../context/AuthContext.jsx";
import Navbar from "./ResearcherNavbar";
import "./ResearcherActivityLog.css";

const STATUS_STYLES = {
    'Pending': { bg: '#fef9c3', text: '#854d0e' },
    'Approved': { bg: '#dcfce7', text: '#166534' },
    'Rejected': { bg: '#fee2e2', text: '#991b1b' },
    'With Minor Revisions': { bg: '#dbeafe', text: '#1e40af' },
    'With Major Revisions': { bg: '#ede9fe', text: '#5b21b6' },
};

const getActionConfig = (rawStatus) => {
    const status = rawStatus?.trim() ?? '';
    const s = status.toLowerCase();

    if (s === 'pending') return { label: 'Waiting for Review', clickable: false, color: '#854d0e' };
    if (s === 'approved') return { label: 'View Details →', clickable: true, color: '#166534' };
    if (s === 'rejected') return { label: 'View Details →', clickable: true, color: '#991b1b' };
    if (s.includes('minor')) return { label: 'Submit Response →', clickable: true, color: '#1e40af' };
    if (s.includes('major')) return { label: 'Submit Revision →', clickable: true, color: '#5b21b6' };

    console.warn("Unmatched status:", JSON.stringify(status));
    return { label: 'Waiting for Review', clickable: false, color: '#94a3b8' };
};

export default function ResearcherActivityLog() {
    const navigate = useNavigate();
    const { openLogId } = useParams();
    const { dbId } = UserAuth();

    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [selectedLog, setSelectedLog] = useState(null);

    const [revisionFile, setRevisionFile] = useState(null);
    const [revisionComment, setRevisionComment] = useState('');
    const [isSubmittingRevision, setIsSubmittingRevision] = useState(false);
    const [revisionSubmitted, setRevisionSubmitted] = useState(false);

    useEffect(() => {
        console.log('dbId value:', dbId);
        if (!dbId) return;

        async function fetchLogs() {
            const { data: researchRows, error: researchError } = await supabase
                .from('Research')
                .select('research_id')
                .eq('researcher_id', dbId);

            if (researchError || !researchRows || researchRows.length === 0) {
                setLoading(false);
                return;
            }

            const researchIds = researchRows.map(r => r.research_id);

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

    const closeModal = () => {
        setSelectedLog(null);
        setRevisionFile(null);
        setRevisionComment('');
        setRevisionSubmitted(false);
        navigate('/researcher-activity-log', { replace: true });
    };

    const handleRevisionSubmit = async () => {
        if (!revisionFile) {
            alert('Please attach a revised file before submitting.');
            return;
        }

        setIsSubmittingRevision(true);

        try {
            const researchId = selectedLog.research_id;
            const status = selectedLog.Research?.status?.trim();
            const revisionType = status?.toLowerCase().includes('minor') ? 'minor' : 'major';

            // 1. Upload file to storage
            const filePath = `public/${researchId}/revision_${Date.now()}_${revisionFile.name}`;
            const { error: uploadError } = await supabase.storage
                .from('research-files')
                .upload(filePath, revisionFile);
            if (uploadError) throw uploadError;

            const { data: urlObj } = supabase.storage
                .from('research-files')
                .getPublicUrl(filePath);

            const fileUrl = urlObj.publicUrl;

            // 2. Insert into ResearchRevisions
            const { error: revError } = await supabase
                .from('ResearchRevisions')
                .insert([{
                    research_id: researchId,
                    revision_type: revisionType,
                    researcher_comment: revisionComment.trim() || null,
                    new_file_url: fileUrl,
                    status: 'Pending'
                }]);
            if (revError) throw revError;

            // 3. Insert into ResearchActivityLog
            const { data: logData, error: logError } = await supabase
                .from('ResearchActivityLog')
                .insert([{
                    research_id: researchId,
                    actor_id: dbId,
                    actor_role: 'researcher',
                    action: 'revision_submitted',
                    notes: revisionComment.trim() || null,
                }])
                .select()
                .single();
            if (logError) throw logError;

            // 4. Notify all evaluators
            const { data: evaluators } = await supabase
                .from('Users')
                .select('user_id')
                .eq('role', 'Evaluator');

            if (evaluators && evaluators.length > 0) {
                const title = selectedLog.Research?.title;
                await supabase.from('evaluator_notifications').insert(
                    evaluators.map(ev => ({
                        recipient_id: ev.user_id,
                        research_id: researchId,
                        log_id: logData.log_id,
                        message: `A revision has been submitted for "${title}". Please review.`,
                    }))
                );
            }

            setRevisionSubmitted(true);

            // Optimistically add the new log entry to the list
            setLogs(prev => [{
                ...logData,
                Research: selectedLog.Research
            }, ...prev]);

        } catch (err) {
            console.error('Revision submit error:', err);
            alert('Error submitting revision: ' + err.message);
        } finally {
            setIsSubmittingRevision(false);
        }
    };

    const filtered = logs.filter(log =>
        log.Research?.title?.toLowerCase().includes(search.toLowerCase()) ||
        log.Research?.hru_no?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="dashboard-wrapper">
            <Navbar />
            <main className="dashboard-container">

                <div className="alog-page-header">
                    <h1>Activity Log</h1>
                    <p>Track all activity on your submitted researches.</p>
                </div>

                <div className="alog-card">
                    <div className="alog-toolbar">
                        <input
                            className="alog-search"
                            placeholder="Search by title or HRU number..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>

                    <div className="alog-table-head">
                        <span>Status</span>
                        <span>HRU No.</span>
                        <span>Title</span>
                        <span>Date</span>
                        <span>Action</span>
                    </div>

                    {loading ? (
                        <div className="alog-empty">Loading activity...</div>
                    ) : filtered.length === 0 ? (
                        <div className="alog-empty">No activity found.</div>
                    ) : filtered.map(log => {
                        const rawStatus = log.Research?.status;
                        const status = rawStatus?.trim() ?? '';
                        const statusStyle = STATUS_STYLES[status] || { bg: '#f1f5f9', text: '#475569' };
                        const { label, clickable, color } = getActionConfig(status);

                        return (
                            <div key={log.log_id} className="alog-row">
                                <div>
                                    <span className="alog-status-badge" style={{ background: statusStyle.bg, color: statusStyle.text }}>
                                        {status || 'Unknown'}
                                    </span>
                                </div>
                                <div>
                                    <span className="alog-hru">{log.Research?.hru_no || '—'}</span>
                                </div>
                                <div className="alog-title-cell">
                                    <span className="alog-research-title">{log.Research?.title || 'Untitled'}</span>
                                    <span className="alog-action-tag">{log.action?.replace(/_/g, ' ')}</span>
                                </div>
                                <div>
                                    <span className="alog-date">
                                        {new Date(log.created_at).toLocaleDateString('en-US', {
                                            year: 'numeric', month: 'short', day: 'numeric'
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
                                        ...(STATUS_STYLES[selectedLog.Research?.status?.trim()] || { bg: '#f1f5f9', text: '#475569' }),
                                        padding: '6px 16px',
                                        fontSize: '0.8rem',
                                        display: 'inline-block'
                                    }}
                                >
                                    {selectedLog.Research?.status?.trim()}
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

                            {/* Approved */}
                            {selectedLog.Research?.status?.trim() === 'Approved' && (
                                <div className="detail-section">
                                    <div className="status-message approved">
                                        <CheckCircle size={20} />
                                        <p>This research has been approved. No further action is required.</p>
                                    </div>
                                </div>
                            )}

                            {/* Rejected */}
                            {selectedLog.Research?.status?.trim() === 'Rejected' && (
                                <div className="detail-section">
                                    <div className="status-message rejected">
                                        <XCircle size={20} />
                                        <p>This research has been rejected. No further submissions are accepted for this study.</p>
                                    </div>
                                </div>
                            )}

                            {/* Revision submission area */}
                            {(selectedLog.Research?.status?.toLowerCase().includes('minor') ||
                                selectedLog.Research?.status?.toLowerCase().includes('major')) && (
                                    <div className="detail-section">
                                        <h3>Revision Submission</h3>

                                        {revisionSubmitted ? (
                                            <div className="status-message approved">
                                                <CheckCircle size={20} />
                                                <p>Your revision has been submitted successfully. The evaluator will be notified.</p>
                                            </div>
                                        ) : (
                                            <>
                                                <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.25rem', lineHeight: '1.5' }}>
                                                    {selectedLog.Research?.status?.toLowerCase().includes('minor')
                                                        ? "Address the evaluator's notes and upload your revised document below."
                                                        : 'Substantially revise your research and upload the revised document below.'}
                                                </p>

                                                {/* File upload */}
                                                <div className="revision-upload-area">
                                                    <input
                                                        type="file"
                                                        id="revision-file-input"
                                                        style={{ display: 'none' }}
                                                        accept=".pdf,.docx,.pptx,.jpg,.png"
                                                        onChange={(e) => setRevisionFile(e.target.files[0] || null)}
                                                    />

                                                    {!revisionFile ? (
                                                        <button
                                                            className="revision-upload-btn"
                                                            onClick={() => document.getElementById('revision-file-input').click()}
                                                            type="button"
                                                        >
                                                            <span className="revision-upload-icon">📎</span>
                                                            <span>Attach Revised File</span>
                                                            <small>PDF, DOCX, PPTX, JPG, PNG accepted</small>
                                                        </button>
                                                    ) : (
                                                        <div className="revision-file-preview">
                                                            <div className="revision-file-info">
                                                                <FileText size={20} color="#031640" />
                                                                <div>
                                                                    <span className="revision-file-name">{revisionFile.name}</span>
                                                                    <span className="revision-file-size">
                                                                        {(revisionFile.size / 1024 / 1024).toFixed(2)} MB · Research Paper
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <button
                                                                className="revision-file-remove"
                                                                onClick={() => setRevisionFile(null)}
                                                                type="button"
                                                            >
                                                                <X size={16} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Comment */}
                                                <div style={{ marginTop: '1rem' }}>
                                                    <label style={{
                                                        display: 'block',
                                                        fontSize: '0.8rem',
                                                        fontWeight: 700,
                                                        color: '#475569',
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '0.05em',
                                                        marginBottom: '8px'
                                                    }}>
                                                        Comments for the Evaluator
                                                        <span style={{ color: '#94a3b8', fontWeight: 400, textTransform: 'none', marginLeft: '6px' }}>
                                                            (optional)
                                                        </span>
                                                    </label>
                                                    <textarea
                                                        rows={4}
                                                        placeholder="Describe the changes you made and how you addressed the evaluator's feedback..."
                                                        value={revisionComment}
                                                        onChange={(e) => setRevisionComment(e.target.value)}
                                                        style={{
                                                            width: '100%',
                                                            padding: '10px 14px',
                                                            border: '1px solid #e2e8f0',
                                                            borderRadius: '8px',
                                                            fontSize: '0.875rem',
                                                            color: '#0f172a',
                                                            resize: 'vertical',
                                                            outline: 'none',
                                                            fontFamily: 'Inter, sans-serif',
                                                            lineHeight: '1.5',
                                                            boxSizing: 'border-box'
                                                        }}
                                                    />
                                                </div>

                                                {/* Submit */}
                                                <button
                                                    className="edit-submission-btn"
                                                    style={{
                                                        width: '100%',
                                                        padding: '12px',
                                                        marginTop: '1rem',
                                                        opacity: isSubmittingRevision ? 0.6 : 1,
                                                        cursor: isSubmittingRevision ? 'not-allowed' : 'pointer'
                                                    }}
                                                    onClick={handleRevisionSubmit}
                                                    disabled={isSubmittingRevision}
                                                    type="button"
                                                >
                                                    {isSubmittingRevision
                                                        ? 'Submitting...'
                                                        : selectedLog.Research?.status?.toLowerCase().includes('minor')
                                                            ? 'Submit Response'
                                                            : 'Submit Revision'}
                                                </button>
                                            </>
                                        )}
                                    </div>
                                )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}