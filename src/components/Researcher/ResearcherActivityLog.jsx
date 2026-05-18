import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { X, FileText, CheckCircle, XCircle } from "lucide-react";
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
    if (s === 'pending')        return { label: 'Waiting for Review',  clickable: false, color: '#854d0e' };
    if (s === 'approved')       return { label: 'View Details →',      clickable: true,  color: '#166534' };
    if (s === 'rejected')       return { label: 'View Details →',      clickable: true,  color: '#991b1b' };
    if (s.includes('minor'))    return { label: 'Submit Response →',   clickable: true,  color: '#1e40af' };
    if (s.includes('major'))    return { label: 'Submit Revision →',   clickable: true,  color: '#5b21b6' };
    return { label: 'Waiting for Review', clickable: false, color: '#94a3b8' };
};

export default function ResearcherActivityLog() {
    const navigate= useNavigate();
    const { openLogId } = useParams();
    const { dbId }    = UserAuth();

    // one Research row per table row
    const [researches, setResearches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    // modal
    const [selectedLog, setSelectedLog] = useState(null); // shape: { log_id, research_id, action, notes, created_at, Research }

    // revision form
    const [revisionFile, setRevisionFile] = useState(null);
    const [revisionComment, setRevisionComment] = useState('');
    const [isSubmittingRevision, setIsSubmittingRevision] = useState(false);
    const [revisionSubmitted, setRevisionSubmitted] = useState(false);

    // revision history + lock
    const [revisionHistory, setRevisionHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [hasPendingRevision, setHasPendingRevision] = useState(false);
    const [evaluationHistory, setEvaluationHistory] = useState([]);

    useEffect(() => {
        const originalBodyOverflow = document.body.style.overflow;
        const originalHtmlOverflow = document.documentElement.style.overflow;
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = originalBodyOverflow;
            document.documentElement.style.overflow = originalHtmlOverflow;
        };
    }, []);


    // ── fetch one Research row per study ─────────────────────────
    useEffect(() => {
        if (!dbId) return;

        async function fetchResearches() {
            const { data, error } = await supabase
                .from('Research')
                .select(`
                    *,
                    research_files ( file_url, file_type )
                `)
                .eq('researcher_id', dbId)
                .order('created_at', { ascending: false });

            if (!error && data) {
                setResearches(data);

                // Deep-link from notification: openLogId is a log_id
                if (openLogId) {
                    const { data: logRow } = await supabase
                        .from('ResearchActivityLog')
                        .select('*')
                        .eq('log_id', openLogId)
                        .single();

                    if (logRow) {
                        const target = data.find(r => r.research_id === logRow.research_id);
                        if (target) {
                            setSelectedLog({ ...logRow, Research: target });
                        }
                    }
                }
            }
            setLoading(false);
        }

        fetchResearches();
    }, [dbId, openLogId]);

    // ── fetch revision history whenever modal opens ───────────────
    useEffect(() => {
        if (!selectedLog) {
            setRevisionHistory([]);
            setHasPendingRevision(false);
            return;
        }

        async function fetchRevisionHistory() {
            setLoadingHistory(true);
            const { data } = await supabase
                .from('ResearchRevisions')
                .select('*')
                .eq('research_id', selectedLog.research_id)
                .order('submitted_at', { ascending: false });

            const history = data || [];
            setRevisionHistory(history);

            // LOCK: latest revision still Pending → block new submission
            const latest = history[0];
            setHasPendingRevision(latest?.status === 'Pending');
            setLoadingHistory(false);
        }

        fetchRevisionHistory();
    }, [selectedLog]);

    // ── open modal: fetch latest evaluated log for notes ─────────
    const handleOpenModal = async (research) => {
        // Fetch ALL evaluated log entries for this research (not just latest)
        const { data: allLogs } = await supabase
            .from('ResearchActivityLog')
            .select('*')
            .eq('research_id', research.research_id)
            .eq('action', 'evaluated')
            .order('created_at', { ascending: false });

        const latestLog = allLogs?.[0];

        setEvaluationHistory(allLogs || []);

        setSelectedLog({
            log_id:      latestLog?.log_id      ?? research.research_id,
            research_id: research.research_id,
            action:      latestLog?.action      ?? 'evaluated',
            notes:       latestLog?.notes       ?? null,
            created_at:  latestLog?.created_at  ?? research.created_at,
            Research:    research,
        });
    };

    // ── close modal ──────────────────────────────────────────────
    const closeModal = () => {
        setSelectedLog(null);
        setRevisionFile(null);
        setRevisionComment('');
        setRevisionSubmitted(false);
        setRevisionHistory([]);
        setHasPendingRevision(false);
        setEvaluationHistory([]);
        navigate('/researcher-activity-log', { replace: true });
    };

    // ── submit revision ──────────────────────────────────────────
    const handleRevisionSubmit = async () => {
        if (!revisionFile) {
            alert('Please attach a revised file before submitting.');
            return;
        }
        if (hasPendingRevision) {
            alert('You already have a revision pending review.');
            return;
        }

        setIsSubmittingRevision(true);

        try {
            const researchId   = selectedLog.research_id;
            const status       = selectedLog.Research?.status?.trim();
            const revisionType = status?.toLowerCase().includes('minor') ? 'minor' : 'major';

            // 1. Upload file
            const filePath = `public/${researchId}/revision_${Date.now()}_${revisionFile.name}`;
            const { error: uploadError } = await supabase.storage
                .from('research-files')
                .upload(filePath, revisionFile);
            if (uploadError) throw uploadError;

            const { data: urlObj } = supabase.storage
                .from('research-files')
                .getPublicUrl(filePath);
            const fileUrl = urlObj.publicUrl;

            // 2. Insert revision (DB trigger blocks double-submit)
            const { error: revError } = await supabase
                .from('ResearchRevisions')
                .insert([{
                    research_id:        researchId,
                    revision_type:      revisionType,
                    researcher_comment: revisionComment.trim() || null,
                    new_file_url:       fileUrl,
                    status:             'Pending'
                }]);
            if (revError) throw revError;

            // 3. Reset Research status to Pending
            const { error: statusError } = await supabase
                .from('Research')
                .update({ status: 'Pending' })
                .eq('research_id', researchId);
            if (statusError) throw statusError;

            // 4. Log activity
            const { data: logData, error: logError } = await supabase
                .from('ResearchActivityLog')
                .insert([{
                    research_id: researchId,
                    actor_id:    dbId,
                    actor_role:  'researcher',
                    action:      'revision_submitted',
                    notes:       revisionComment.trim() || null,
                    status_snapshot: 'Pending',
                }])
                .select()
                .single();
            if (logError) throw logError;

            // 5. Notify assigned evaluator only
            const { data: queueRow } = await supabase
                .from('Research_Queue')
                .select('evaluator_id')
                .eq('research_id', researchId)
                .single();

            if (queueRow?.evaluator_id) {
                const { data: evalUser } = await supabase
                    .from('Evaluator')
                    .select('user_id')
                    .eq('evaluator_id', queueRow.evaluator_id)
                    .single();

                if (evalUser?.user_id) {
                    await supabase.from('evaluator_notifications').insert([{
                        recipient_id: evalUser.user_id,
                        research_id:  researchId,
                        log_id:       logData.log_id,
                        message:      `A revision has been submitted for "${selectedLog.Research?.title}". Please review.`,
                    }]);
                }
            }

            setRevisionSubmitted(true);
            setHasPendingRevision(true); // immediately lock

            // Update the research status in local state
            setResearches(prev =>
                prev.map(r => r.research_id === researchId ? { ...r, status: 'Pending' } : r)
            );

        } catch (err) {
            console.error('Revision submit error:', err);
            alert('Error submitting revision: ' + (err.message || 'Unknown error'));
        } finally {
            setIsSubmittingRevision(false);
        }
    };

    // ── filter ───────────────────────────────────────────────────
    const filtered = researches.filter(r =>
        r.title?.toLowerCase().includes(search.toLowerCase()) ||
        r.hru_no?.toLowerCase().includes(search.toLowerCase())
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
                    ) : filtered.map(research => {
                        const rawStatus   = research.status;
                        const status      = rawStatus?.trim() ?? '';
                        const statusStyle = STATUS_STYLES[status] || { bg: '#f1f5f9', text: '#475569' };
                        const { label, clickable, color } = getActionConfig(status);

                        return (
                            <div key={research.research_id} className="alog-row">
                                <div>
                                    <span className="alog-status-badge" style={{ background: statusStyle.bg, color: statusStyle.text }}>
                                        {status || 'Unknown'}
                                    </span>
                                </div>
                                <div>
                                    <span className="alog-hru">{research.hru_no || '—'}</span>
                                </div>
                                <div className="alog-title-cell">
                                    <span className="alog-research-title">{research.title || 'Untitled'}</span>
                                    <span className="alog-action-tag">
                                        Submitted {new Date(research.created_at).toLocaleDateString('en-US', {
                                        month: 'short', day: 'numeric', year: 'numeric'
                                    })}
                                    </span>
                                </div>
                                <div>
                                    <span className="alog-date">
                                        {new Date(research.created_at).toLocaleDateString('en-US', {
                                            year: 'numeric', month: 'short', day: 'numeric'
                                        })}
                                    </span>
                                </div>
                                <div>
                                    <button
                                        className={`alog-action-btn ${clickable ? 'alog-action-link' : ''}`}
                                        style={clickable ? { color } : {}}
                                        onClick={() => clickable && handleOpenModal(research)}
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

            {/* ── DETAIL MODAL ─────────────────────────────────── */}
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

                            {/* Current Status */}
                            <div className="detail-section">
                                <h3>Current Status</h3>
                                <span
                                    className="alog-status-badge"
                                    style={{
                                        ...(STATUS_STYLES[selectedLog.Research?.status?.trim()] || { bg: '#f1f5f9', text: '#475569' }),
                                        padding: '6px 16px', fontSize: '0.8rem', display: 'inline-block'
                                    }}
                                >
                                    {selectedLog.Research?.status?.trim()}
                                </span>
                            </div>

                            {/* Details */}
                            <div className="detail-section">
                                <h3>Details</h3>
                                <div className="detail-grid">
                                    <div className="detail-item">
                                        <label>HRU No.</label>
                                        <p>{selectedLog.Research?.hru_no}</p>
                                    </div>
                                    <div className="detail-item">
                                        <label>Submitted</label>
                                        <p>{new Date(selectedLog.Research?.created_at ?? selectedLog.created_at).toLocaleDateString('en-US', {
                                            year: 'numeric', month: 'long', day: 'numeric'
                                        })}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Final status message for approved/rejected */}
                            {selectedLog.Research?.status?.trim() === 'Approved' && (
                                <div className="detail-section">
                                    <div className="status-message approved">
                                        <CheckCircle size={20} />
                                        <p>This research has been approved. No further action is required.</p>
                                    </div>
                                </div>
                            )}
                            {selectedLog.Research?.status?.trim() === 'Rejected' && (
                                <div className="detail-section">
                                    <div className="status-message rejected">
                                        <XCircle size={20} />
                                        <p>This research has been rejected. No further submissions are accepted for this study.</p>
                                    </div>
                                </div>
                            )}

                            {/* ── FULL HISTORY TIMELINE ── always shown if there's any history */}
                            {(evaluationHistory.length > 0 || revisionHistory.length > 0) && (
                                <div className="detail-section">
                                    <h3>Full Submission History</h3>

                                    {loadingHistory ? (
                                        <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Loading history...</p>
                                    ) : (
                                        <div className="revision-history-list">
                                            {/* Interleave evaluations and revisions sorted by date */}
                                            {[
                                                ...evaluationHistory.map(e => ({ ...e, _type: 'evaluation' })),
                                                ...revisionHistory.map(r => ({ ...r, _type: 'revision', created_at: r.submitted_at }))
                                            ]
                                                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                                                .map((item, i) => {
                                                    if (item._type === 'evaluation') {
                                                        return (
                                                            <div key={`eval-${item.log_id}`} className="revision-history-item" style={{ borderLeft: '3px solid #2d365a' }}>
                                                                <div className="revision-history-header">
                                            <span className="revision-history-label">
                                                Evaluator Decision
                                                <span style={{
                                                    fontSize: '0.65rem',
                                                    background: '#e0e7ff', color: '#3730a3',
                                                    padding: '2px 8px', borderRadius: '999px', fontWeight: 700
                                                }}>
                                                    EVALUATOR
                                                </span>
                                            </span>
                                                                    <span className="revision-history-date">
                                                {new Date(item.created_at).toLocaleDateString('en-US', {
                                                    month: 'short', day: 'numeric', year: 'numeric'
                                                })}
                                            </span>
                                                                </div>
                                                                {item.notes && (
                                                                    <p className="revision-history-comment">
                                                                        <strong>Notes:</strong> {item.notes}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        );
                                                    } else {
                                                        return (
                                                            <div key={`rev-${item.revision_id}`} className="revision-history-item" style={{ borderLeft: '3px solid #6366f1' }}>
                                                                <div className="revision-history-header">
                                                                    <span className="revision-history-label">
                                                                        Your Revision
                                                                        <span className="revision-type-tag">
                                                                            {item.revision_type === 'minor' ? 'Minor' : 'Major'}
                                                                        </span>
                                                                    </span>
                                                                    <span className="revision-history-date">
                                                                        {new Date(item.created_at).toLocaleDateString('en-US', {
                                                                            month: 'short', day: 'numeric', year: 'numeric'
                                                                        })}
                                                                    </span>
                                                                </div>
                                                                {item.researcher_comment && (
                                                                    <p className="revision-history-comment">
                                                                        <strong>Your comment:</strong> {item.researcher_comment}
                                                                    </p>
                                                                )}
                                                                <a
                                                                    href={item.new_file_url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="revision-history-file"
                                                                >
                                                                <FileText size={14} /> View submitted file
                                                                </a>
                                                            </div>
                                                            );
                                                            }
                                                        })
                                                    }
                                                </div>
                                            )}
                                        </div>
                                     )}

                            {/* ── REVISION SUBMISSION AREA — only for minor/major, not approved/rejected ── */}
                            {(selectedLog.Research?.status?.toLowerCase().includes('minor') ||
                                selectedLog.Research?.status?.toLowerCase().includes('major')) && (
                                <div className="detail-section">
                                    <h3>Revision Submission</h3>

                                    {hasPendingRevision ? (
                                        <div style={{
                                            background: '#fefce8', border: '1px solid #fde047',
                                            color: '#713f12', display: 'flex', alignItems: 'flex-start',
                                            gap: '12px', padding: '14px 16px', borderRadius: '8px',
                                            fontSize: '0.875rem', lineHeight: '1.5'
                                        }}>
                                            <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>⏳</span>
                                            <p style={{ margin: 0 }}>
                                                Your revision is currently under review. You can submit another revision once the evaluator has reviewed your current submission.
                                            </p>
                                        </div>

                                    ) : revisionSubmitted ? (
                                        <div className="status-message approved">
                                            <CheckCircle size={20} />
                                            <p>Your revision has been submitted. The evaluator will be notified.</p>
                                        </div>

                                    ) : (
                                        <>
                                            <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.25rem', lineHeight: '1.5' }}>
                                                {selectedLog.Research?.status?.toLowerCase().includes('minor')
                                                    ? "Address the evaluator's notes and upload your revised document below."
                                                    : 'Substantially revise your research and upload the revised document below.'}
                                            </p>

                                            <div className="revision-upload-area">
                                                <input
                                                    type="file"
                                                    id="revision-file-input"
                                                    style={{ display: 'none' }}
                                                    accept=".pdf,.docx,.pptx,.jpg,.png"
                                                    onChange={e => setRevisionFile(e.target.files[0] || null)}
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
                                                        <button className="revision-file-remove" onClick={() => setRevisionFile(null)} type="button">
                                                            <X size={16} />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            <div style={{ marginTop: '1rem' }}>
                                                <label style={{
                                                    display: 'block', fontSize: '0.8rem', fontWeight: 700,
                                                    color: '#475569', textTransform: 'uppercase',
                                                    letterSpacing: '0.05em', marginBottom: '8px'
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
                                                    onChange={e => setRevisionComment(e.target.value)}
                                                    style={{
                                                        width: '100%', padding: '10px 14px',
                                                        border: '1px solid #e2e8f0', borderRadius: '8px',
                                                        fontSize: '0.875rem', color: '#0f172a',
                                                        resize: 'vertical', outline: 'none',
                                                        fontFamily: 'Inter, sans-serif', lineHeight: '1.5',
                                                        boxSizing: 'border-box'
                                                    }}
                                                />
                                            </div>

                                            <button
                                                className="edit-submission-btn"
                                                style={{
                                                    width: '100%', padding: '12px', marginTop: '1rem',
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