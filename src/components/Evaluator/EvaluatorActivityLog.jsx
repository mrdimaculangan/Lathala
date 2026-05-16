import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { X, FileText, Clock, CheckCircle, XCircle, RefreshCw, Eye, UserCheck } from "lucide-react";
import { supabase } from "../../supabaseClient.js";
import { UserAuth } from "../../context/AuthContext.jsx";
import Navbar from "./EvaluatorNavbar";
import "./EvaluatorActivityLog.css";

const STATUS_STYLES = {
    'Pending':              { bg: '#fef9c3', text: '#854d0e' },
    'Approved':             { bg: '#dcfce7', text: '#166534' },
    'Rejected':             { bg: '#fee2e2', text: '#991b1b' },
    'With Minor Revisions': { bg: '#dbeafe', text: '#1e40af' },
    'With Major Revisions': { bg: '#ede9fe', text: '#5b21b6' },
};

const DECISION_ICONS = {
    'Approved': <CheckCircle size={16} style={{ color: '#166534' }} />,
    'Rejected': <XCircle size={16} style={{ color: '#991b1b' }} />,
    'With Minor Revisions': <FileText size={16} style={{ color: '#1e40af' }} />,
    'With Major Revisions': <FileText size={16} style={{ color: '#5b21b6' }} />,
};

export default function EvaluatorActivityLog() {
    const navigate = useNavigate();
    const { logId } = useParams();
    const { session, firstName, lastName, userRole } = UserAuth();
    const authUserId = session?.user?.id;  // this is the UUID that matches Evaluator.user_id

    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState("");
    const [selectedLog, setSelectedLog] = useState(null);
    const [evaluatorInfo, setEvaluatorInfo] = useState(null);

    // REVISIONS PART
    const [pendingRevisions, setPendingRevisions] = useState([]);
    const [loadingRevisions, setLoadingRevisions] = useState(false);

    // para magpakita yung may revisions too 'pending' na lang rin pls lang idgaf anymore tbh
    useEffect(() => {
        if (!selectedLog) {
            setPendingRevisions([]);
            return;
        }

        async function fetchRevisions() {
            setLoadingRevisions(true);
            const { data } = await supabase
                .from('ResearchRevisions')
                .select('*')
                .eq('research_id', selectedLog.research_id)
                .order('submitted_at', { ascending: false });

            setPendingRevisions(data || []);
            setLoadingRevisions(false);
        }

        fetchRevisions();
    }, [selectedLog]);

    useEffect(() => {
        if (!authUserId) {
            console.log("No authuser found, waiting for auth...");
            return;
        }

        async function fetchEvaluatorAndLogs() {
            try {
                console.log("Starting fetchEvaluatorAndLogs...");
                setLoading(true);
                setError(null);
                
                // Get evaluator_id from logged in user
                console.log("Step 1: Fetching evaluator record for user_id:", authUserId);
                const { data: evaluatorData, error: evaluatorError } = await supabase
                    .from('Evaluator')
                    .select('evaluator_id')
                    .eq('user_id', authUserId)
                    .single();

                if (evaluatorError) {
                    console.error("Error fetching evaluator:", evaluatorError);
                    setError(`Failed to fetch evaluator record: ${evaluatorError.message}`);
                    setLoading(false);
                    return;
                }

                if (!evaluatorData) {
                    console.log("No evaluator record found for user_id:", authUserId);
                    setError("No evaluator profile found. Please contact administrator.");
                    setLoading(false);
                    return;
                }

                console.log("Evaluator found:", evaluatorData);
                setEvaluatorInfo(evaluatorData);

                // 2. Get all evaluation records from Evaluation_Research table
                console.log("Step 2: Fetching evaluations for evaluator_id:", evaluatorData.evaluator_id);
                const { data: evaluationData, error: evaluationError } = await supabase
                    .from('Evaluation_Research')
                    .select(`
                        evaluation_id,
                        research_id,
                        evaluator_id,
                        overall_recommendation,
                        additional_comments,
                        strengths,
                        weaknesses,
                        methodology,
                        sci_rigor,
                        ethical_compliance,
                        relevant_to_hru_obj,
                        evaluated_at,
                        Research (
                            research_id,
                            title,
                            hru_no,
                            description,
                            status,
                            researcher_id,
                            Researcher:researcher_id (
                                researcher_id,
                                user_id,
                                Users:user_id (
                                    first_name,
                                    last_name,
                                    email
                                )
                            )
                        )
                    `)
                    .eq('evaluator_id', evaluatorData.evaluator_id)
                    .order('evaluated_at', { ascending: false });

                console.log("Raw evaluation data:", evaluationData);
                console.log("Number of evaluations found:", evaluationData?.length || 0);

                if (!evaluationData || evaluationData.length === 0) {
                    console.log("No evaluations found for this evaluator");
                    setLogs([]);
                    setLoading(false);
                    return;
                }

                // Format the logs data
                const formattedLogs = evaluationData.map(evaluation => {
                    const researcher = evaluation.Research?.Researcher;
                    const user = researcher?.Users;

                    return {
                        log_id:           evaluation.evaluation_id,
                        research_id:      evaluation.research_id,
                        decision:         evaluation.overall_recommendation, // ← was: evaluation.decision
                        comments:         evaluation.additional_comments,    // ← was: evaluation.comments
                        strengths:        evaluation.strengths,
                        weaknesses:       evaluation.weaknesses,
                        methodology:      evaluation.methodology,
                        sci_rigor:        evaluation.sci_rigor,
                        evaluated_at:     evaluation.evaluated_at,
                        created_at:       evaluation.evaluated_at,
                        Research: {
                            research_id: evaluation.Research?.research_id,
                            title:       evaluation.Research?.title,
                            hru_no:      evaluation.Research?.hru_no,
                            abstract:    evaluation.Research?.description,
                            status:      evaluation.Research?.status,
                            researcher: {
                                name:  user ? `${user.first_name} ${user.last_name}`.trim() : 'Unknown',
                                email: user?.email || 'No email'
                            }
                        }
                    };
                });

                console.log("Formatted logs:", formattedLogs);
                setLogs(formattedLogs);

                if (logId) {
                    console.log("Looking for log with ID:", logId);
                    const target = formattedLogs.find(l => String(l.log_id) === String(logId));
                    if (target) {
                        console.log("Found target log:", target);
                        setSelectedLog(target);
                    } else {
                        console.log("No log found with ID:", logId);
                    }
                }
            } catch (err) {
                console.error("Unexpected error in fetchEvaluatorAndLogs:", err);
                setError(`Unexpected error: ${err.message}`);
            } finally {
                setLoading(false);
                console.log("Loading state set to false");
            }
        }

        fetchEvaluatorAndLogs();
    }, [authUserId, logId]);

    // Filter logs based on search
    const filteredLogs = logs.filter(log =>
        log.Research?.title?.toLowerCase().includes(search.toLowerCase()) ||
        log.Research?.hru_no?.toLowerCase().includes(search.toLowerCase()) ||
        log.Research?.researcher?.name?.toLowerCase().includes(search.toLowerCase())
    );

    const closeModal = () => {
        setSelectedLog(null);
        setPendingRevisions([]);
        navigate('/evaluator-activity-log', { replace: true });
    };

    const getDecisionDisplay = (decision) => {
        switch(decision) {
            case 'Approved':
                return { label: 'APPROVED', icon: DECISION_ICONS['Approved'], color: '#166534' };
            case 'Rejected':
                return { label: 'REJECTED', icon: DECISION_ICONS['Rejected'], color: '#991b1b' };
            case 'With Minor Revisions':
                return { label: 'MINOR REVISIONS', icon: DECISION_ICONS['With Minor Revisions'], color: '#1e40af' };
            case 'With Major Revisions':
                return { label: 'MAJOR REVISIONS', icon: DECISION_ICONS['With Major Revisions'], color: '#5b21b6' };
            default:
                return { label: decision?.toUpperCase() || 'PENDING', icon: <Clock size={16} />, color: '#854d0e' };
        }
    };

    return (
        <div className="dashboard-wrapper">
            <Navbar />
            <main className="dashboard-container">
                <div className="alog-page-header">
                    <h1>My Evaluation Activity</h1>
                    <p>Track all research papers you have evaluated as an evaluator.</p>
                </div>

                <div className="alog-card">
                    <div className="alog-toolbar">
                        <input
                            type="text"
                            className="alog-search"
                            placeholder="Search by title, HRU number, or researcher name..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    {/* Table header */}
                    <div className="alog-table-head">
                        <span>Decision</span>
                        <span>HRU No.</span>
                        <span>Research Title</span>
                        <span>Researcher</span>
                        <span>Evaluated On</span>
                    </div>

                    {/* Rows */}
                    {loading ? (
                        <div className="alog-empty">
                            <RefreshCw size={24} className="spinning" />
                            <p>Loading evaluation history...</p>
                        </div>
                    ) : error ? (
                        <div className="alog-empty">
                            <XCircle size={48} strokeWidth={1} style={{ color: '#dc2626' }} />
                            <p style={{ color: '#dc2626' }}>Error: {error}</p>
                            <button 
                                onClick={() => window.location.reload()}
                                style={{ marginTop: '12px', padding: '8px 16px', cursor: 'pointer' }}
                            >
                                Retry
                            </button>
                        </div>
                    ) : filteredLogs.length === 0 ? (
                        <div className="alog-empty">
                            <FileText size={48} strokeWidth={1} />
                            <p>No evaluation activity found.</p>
                            {search && <small>Try adjusting your search terms.</small>}
                            {logs.length === 0 && !search && (
                                <small>You haven't evaluated any research papers yet.</small>
                            )}
                        </div>
                    ) : (
                        filteredLogs.map(log => {
                            const decisionInfo = getDecisionDisplay(log.decision);
                            
                            return (
                                <div key={log.log_id} className="alog-row">
                                    <div>
                                        <span 
                                            className="alog-status-badge"
                                            style={{ 
                                                background: `${decisionInfo.color}15`, 
                                                color: decisionInfo.color,
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '6px'
                                            }}
                                        >
                                            {decisionInfo.icon}
                                            {decisionInfo.label}
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
                                            Decision made on {new Date(log.evaluated_at).toLocaleDateString()}
                                        </span>
                                    </div>

                                    <div>
                                        <span className="alog-researcher-name" style={{ fontSize: '0.85rem', color: '#475569' }}>
                                            {log.Research?.researcher?.name || 'Unknown'}
                                        </span>
                                    </div>

                                    <div>
                                        <span className="alog-date">
                                            {new Date(log.evaluated_at).toLocaleDateString('en-US', {
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric'
                                            })}
                                        </span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </main>

            {/* DETAIL MODAL */}
            {selectedLog && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <h2>{selectedLog.Research?.title}</h2>
                                <span className="alog-hru" style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                    HRU No: {selectedLog.Research?.hru_no}
                                </span>
                            </div>
                            <button className="close-btn" onClick={closeModal}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="modal-body">
                            {/* Decision Banner */}
                            <div className="detail-section">
                                <h3>Evaluation Decision</h3>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
                                    <span 
                                        className="alog-status-badge"
                                        style={{ 
                                            background: `${getDecisionDisplay(selectedLog.decision).color}15`, 
                                            color: getDecisionDisplay(selectedLog.decision).color,
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            padding: '6px 14px'
                                        }}
                                    >
                                        {getDecisionDisplay(selectedLog.decision).icon}
                                        {getDecisionDisplay(selectedLog.decision).label}
                                    </span>
                                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                        Evaluated on {new Date(selectedLog.evaluated_at).toLocaleDateString('en-US', {
                                            year: 'numeric', month: 'long', day: 'numeric'
                                        })}
                                    </span>
                                </div>
                            </div>

                            {/* Research Information */}
                            <div className="detail-section">
                                <h3>Research Information</h3>
                                <div className="detail-grid">
                                    <div className="detail-item">
                                        <label>HRU Number</label>
                                        <p>{selectedLog.Research?.hru_no}</p>
                                    </div>
                                    <div className="detail-item">
                                        <label>Researcher</label>
                                        <p>{selectedLog.Research?.researcher?.name}</p>
                                        <small style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{selectedLog.Research?.researcher?.email}</small>
                                    </div>
                                    <div className="detail-item" style={{ gridColumn: 'span 2' }}>
                                        <label>Abstract</label>
                                        <p style={{ fontSize: '0.85rem', lineHeight: '1.5', color: '#475569' }}>
                                            {selectedLog.Research?.abstract || 'No abstract provided.'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Evaluator's Comments */}
                            {/* Evaluator's Full Evaluation */}
                            <div className="detail-section">
                                <h3>Your Evaluation</h3>
                                <div className="detail-grid" style={{ marginBottom: '1rem' }}>
                                    <div className="detail-item">
                                        <label>Scientific Rigor</label>
                                        <p>{selectedLog.sci_rigor ?? 'N/A'} / 5</p>
                                    </div>
                                    <div className="detail-item">
                                        <label>Ethical Compliance</label>
                                        <p>{selectedLog.ethical_compliance ?? 'N/A'} / 5</p>
                                    </div>
                                    <div className="detail-item">
                                        <label>Relevance to HRU</label>
                                        <p>{selectedLog.relevant_to_hru_obj ?? selectedLog.sci_rigor ?? 'N/A'} / 5</p>
                                    </div>
                                </div>
                                {selectedLog.strengths && (
                                    <div style={{ marginBottom: '12px' }}>
                                        <label style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>Strengths</label>
                                        <div className="evaluator-notes-box">{selectedLog.strengths}</div>
                                    </div>
                                )}
                                {selectedLog.weaknesses && (
                                    <div style={{ marginBottom: '12px' }}>
                                        <label style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>Weaknesses</label>
                                        <div className="evaluator-notes-box">{selectedLog.weaknesses}</div>
                                    </div>
                                )}
                                {selectedLog.methodology && (
                                    <div style={{ marginBottom: '12px' }}>
                                        <label style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>Methodology Notes</label>
                                        <div className="evaluator-notes-box">{selectedLog.methodology}</div>
                                    </div>
                                )}
                                {selectedLog.comments && (
                                    <div>
                                        <label style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>Additional Comments</label>
                                        <div className="evaluator-notes-box">{selectedLog.comments}</div>
                                    </div>
                                )}
                            </div>

                            {/* Revision Submissions from Researcher */}
                            {pendingRevisions.length > 0 && (
                                <div className="detail-section">
                                    <h3>Researcher Revision Submissions</h3>
                                    {loadingRevisions ? (
                                        <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Loading...</p>
                                    ) : (
                                        <div className="revision-history-list">
                                            {pendingRevisions.map((rev, i) => (
                                                <div key={rev.revision_id} className="revision-history-item">
                                                    <div className="revision-history-header">
                                                        <span className="revision-history-label">
                                                            Submission #{pendingRevisions.length - i}
                                                            <span className="revision-type-tag">
                                                                {rev.revision_type === 'minor' ? 'Minor' : 'Major'}
                                                            </span>
                                                            {i === 0 && (
                                                                <span style={{
                                                                    fontSize: '0.65rem', background: '#fef9c3',
                                                                    color: '#854d0e', padding: '2px 8px',
                                                                    borderRadius: '999px', fontWeight: 700
                                                                }}>
                                                                    LATEST
                                                                </span>
                                                            )}
                                                        </span>
                                                                                    <span className="revision-history-date">
                                                            {new Date(rev.submitted_at).toLocaleDateString('en-US', {
                                                                month: 'short', day: 'numeric', year: 'numeric'
                                                            })}
                                                        </span>
                                                    </div>
                                                    {rev.researcher_comment && (
                                                        <p className="revision-history-comment">
                                                            <strong>Researcher's note:</strong> {rev.researcher_comment}
                                                        </p>
                                                    )}
                                                 <a
                                                    href={rev.new_file_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="revision-history-file"
                                                    >
                                                    <FileText size={14} />
                                                    View revised file
                                                </a>
                                                </div>
                                                ))}
                                        </div>
                                    )}

                                    {/* Button to go evaluate the resubmission */}
                                    <button
                                        style={{
                                            marginTop: '1rem',
                                            width: '100%',
                                            padding: '12px',
                                            background: '#031640',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '8px',
                                            fontWeight: 600,
                                            fontSize: '0.9rem',
                                            cursor: 'pointer'
                                        }}
                                        onClick={() => {
                                            closeModal();
                                            navigate(`/evaluate-research/${selectedLog.research_id}`);
                                        }}
                                    >
                                        Evaluate Resubmission →
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