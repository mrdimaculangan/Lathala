import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { X, FileText, Clock, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { supabase } from "../../supabaseClient.js";
import { UserAuth } from "../../context/AuthContext.jsx";
import Navbar from "./EvaluatorNavbar";
import "./EvaluatorActivityLog.css";

const DECISION_ICONS = {
    'Approved':             <CheckCircle size={16} style={{ color: '#166534' }} />,
    'Rejected':             <XCircle size={16} style={{ color: '#991b1b' }} />,
    'With Minor Revisions': <FileText size={16} style={{ color: '#1e40af' }} />,
    'With Major Revisions': <FileText size={16} style={{ color: '#5b21b6' }} />,
};

const getDecisionDisplay = (decision) => {
    switch (decision) {
        case 'Approved':             return { label: 'APPROVED',         color: '#166534', icon: DECISION_ICONS['Approved'] };
        case 'Rejected':             return { label: 'REJECTED',         color: '#991b1b', icon: DECISION_ICONS['Rejected'] };
        case 'With Minor Revisions': return { label: 'MINOR REVISIONS',  color: '#1e40af', icon: DECISION_ICONS['With Minor Revisions'] };
        case 'With Major Revisions': return { label: 'MAJOR REVISIONS',  color: '#5b21b6', icon: DECISION_ICONS['With Major Revisions'] };
        default: return { label: decision?.toUpperCase() || '—', color: '#854d0e', icon: <Clock size={16} /> };
    }
};

export default function EvaluatorActivityLog() {
    const navigate = useNavigate();
    const { logId } = useParams();
    const { session } = UserAuth();
    const authUserId = session?.user?.id;

    const [logs, setLogs]               = useState([]);
    const [loading, setLoading]         = useState(true);
    const [error, setError]             = useState(null);
    const [search, setSearch]           = useState("");
    const [selectedLog, setSelectedLog] = useState(null);
    const [evaluatorInfo, setEvaluatorInfo] = useState(null); // ADDED missing state

    useEffect(() => {
        if (!authUserId) return;
        fetchLogs();
    }, [authUserId, logId]);

    async function fetchLogs() {
        setLoading(true);
        setError(null);

        try {
            // Step 1: Get evaluator_id from logged in user
            console.log("Step 1: Fetching evaluator record for user_id:", authUserId);
            const { data: evaluatorData, error: evaluatorError } = await supabase
                .from('Evaluator')
                .select('evaluator_id')
                .eq('user_id', authUserId)
                .single();

            if (evaluatorError) {
                console.error("Evaluator fetch error:", evaluatorError);
                throw new Error(`Evaluator Profile Error: ${evaluatorError.message}`);
            }
            
            if (!evaluatorData) {
                console.log("No evaluator record found for user_id:", authUserId);
                setError("No evaluator profile found. Please contact administrator.");
                setLoading(false);
                return;
            }

            setEvaluatorInfo(evaluatorData);

            // Step 2: Fetch evaluation records for this evaluator
            console.log("Step 2: Fetching evaluations for evaluator_id:", evaluatorData.evaluator_id);
            const { data: evaluationData, error: evaluationError } = await supabase
                .from('Evaluation_Research')
                .select(`
                    evaluation_id,
                    research_id,
                    overall_recommendation,
                    additional_comments,
                    strengths,
                    weaknesses,
                    methodology,
                    sci_rigor,
                    ethical_compliance,
                    relevant_to_hru_obj,
                    evaluated_at,
                    Research:research_id (
                        research_id,
                        title,
                        hru_no,
                        description,
                        status,
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

            if (evaluationError) {
                console.error("Evaluation fetch error:", evaluationError);
                throw new Error(`Failed to fetch evaluations: ${evaluationError.message}`);
            }

            console.log("Raw evaluation data:", evaluationData);
            console.log("Number of evaluations found:", evaluationData?.length || 0);

            if (!evaluationData || evaluationData.length === 0) {
                setLogs([]);
                setLoading(false);
                return;
            }

            // Step 3: Format the data
            const formattedLogs = evaluationData.map(evaluation => {
                // Navigate through the nested structure safely
                const research = evaluation.Research;
                const researcher = research?.Researcher;
                const user = researcher?.Users;

                return {
                    log_id:              evaluation.evaluation_id,
                    research_id:         evaluation.research_id,
                    decision:            evaluation.overall_recommendation,
                    comments:            evaluation.additional_comments,
                    strengths:           evaluation.strengths,
                    weaknesses:          evaluation.weaknesses,
                    methodology:         evaluation.methodology,
                    sci_rigor:           evaluation.sci_rigor,
                    ethical_compliance:  evaluation.ethical_compliance,
                    relevant_to_hru_obj: evaluation.relevant_to_hru_obj,
                    evaluated_at:        evaluation.evaluated_at,
                    Research: {
                        research_id: research?.research_id,
                        title:       research?.title,
                        hru_no:      research?.hru_no,
                        abstract:    research?.description,
                        status:      research?.status,
                        researcher: {
                            name:  user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Unknown' : 'Unknown',
                            email: user?.email || '—'
                        }
                    }
                };
            });

            setLogs(formattedLogs);

            // Handle deep link if logId is provided in URL
            if (logId) {
                const target = formattedLogs.find(l => String(l.log_id) === String(logId));
                if (target) setSelectedLog(target);
            }

        } catch (err) {
            console.error("Activity Log Error:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    const filtered = logs.filter(log =>
        log.Research?.title?.toLowerCase().includes(search.toLowerCase()) ||
        log.Research?.hru_no?.toLowerCase().includes(search.toLowerCase()) ||
        log.Research?.researcher?.name?.toLowerCase().includes(search.toLowerCase()) ||
        log.decision?.toLowerCase().includes(search.toLowerCase())
    );

    const closeModal = () => {
        setSelectedLog(null);
        navigate('/evaluator-activity-log', { replace: true });
    };

    return (
        <div className="dashboard-wrapper">
            <Navbar />
            <main className="dashboard-container">
                <div className="alog-page-header">
                    <h1>My Evaluation Activity</h1>
                    <p>Track all research papers you have evaluated.</p>
                </div>

                <div className="alog-card">
                    <div className="alog-toolbar">
                        <input
                            type="text"
                            className="alog-search"
                            placeholder="Search by title, HRU number, or researcher..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>

                    <div className="alog-table-head">
                        <span>Recommendation</span>
                        <span>HRU No.</span>
                        <span>Research Title</span>
                        <span>Researcher</span>
                        <span>Evaluated On</span>
                    </div>

                    {loading ? (
                        <div className="alog-empty">
                            <RefreshCw size={24} className="spinning" />
                            <p>Loading evaluation history...</p>
                        </div>
                    ) : error ? (
                        <div className="alog-empty">
                            <XCircle size={48} strokeWidth={1} style={{ color: '#dc2626' }} />
                            <p style={{ color: '#dc2626' }}>{error}</p>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="alog-empty">
                            <FileText size={48} strokeWidth={1} />
                            <p>No evaluation activity found.</p>
                        </div>
                    ) : filtered.map(log => {
                        const d = getDecisionDisplay(log.decision);
                        return (
                            <div
                                key={log.log_id}
                                className="alog-row"
                                onClick={() => setSelectedLog(log)}
                                style={{ cursor: 'pointer' }}
                            >
                                <div>
                                    <span className="alog-status-badge" style={{
                                        background: `${d.color}18`,
                                        color: d.color,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}>
                                        {d.icon}{d.label}
                                    </span>
                                </div>
                                <div><span className="alog-hru">{log.Research?.hru_no || '—'}</span></div>
                                <div className="alog-title-cell">
                                    <span className="alog-research-title">{log.Research?.title || 'Untitled'}</span>
                                    <span className="alog-action-tag">
                                        Evaluated {new Date(log.evaluated_at).toLocaleDateString()}
                                    </span>
                                </div>
                                <div>
                                    <span style={{ fontSize: '0.85rem', color: '#475569' }}>
                                        {log.Research?.researcher?.name || 'Unknown'}
                                    </span>
                                </div>
                                <div>
                                    <span className="alog-date">
                                        {log.evaluated_at ? new Date(log.evaluated_at).toLocaleDateString('en-US', {
                                            year: 'numeric', month: 'short', day: 'numeric'
                                        }) : 'Date not available'}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </main>

            {/* DETAIL MODAL - Scores are displayed here */}
            {selectedLog && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <h2>{selectedLog.Research?.title}</h2>
                                <span style={{ fontSize: '0.75rem', color: '#64748b', fontFamily: 'monospace' }}>
                                    {selectedLog.Research?.hru_no}
                                </span>
                            </div>
                            <button className="close-btn" onClick={closeModal}><X size={20} /></button>
                        </div>

                        <div className="modal-body">
                            {/* Decision */}
                            <div className="detail-section">
                                <h3>Decision</h3>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <span className="alog-status-badge" style={{
                                        background: `${getDecisionDisplay(selectedLog.decision).color}18`,
                                        color: getDecisionDisplay(selectedLog.decision).color,
                                        display: 'inline-flex', alignItems: 'center',
                                        gap: '8px', padding: '6px 14px'
                                    }}>
                                        {getDecisionDisplay(selectedLog.decision).icon}
                                        {getDecisionDisplay(selectedLog.decision).label}
                                    </span>
                                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                        {selectedLog.evaluated_at ? new Date(selectedLog.evaluated_at).toLocaleDateString('en-US', {
                                            year: 'numeric', month: 'long', day: 'numeric'
                                        }) : 'Date not available'}
                                    </span>
                                </div>
                            </div>

                            {/* Researcher */}
                            <div className="detail-section">
                                <h3>Researcher</h3>
                                <div className="detail-grid">
                                    <div className="detail-item">
                                        <label>Name</label>
                                        <p>{selectedLog.Research?.researcher?.name || '—'}</p>
                                    </div>
                                    <div className="detail-item">
                                        <label>Email</label>
                                        <p>{selectedLog.Research?.researcher?.email || '—'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Scores */}
                            <div className="detail-section">
                                <h3>Evaluation Scores</h3>
                                <div className="detail-grid">
                                    <div className="detail-item">
                                        <label>Scientific Rigor</label>
                                        <p>{selectedLog.sci_rigo ?? '—'} / 5</p>
                                    </div>
                                    <div className="detail-item">
                                        <label>Ethical Compliance</label>
                                        <p>{selectedLog.ethical_compliance ?? '—'} / 5</p>
                                    </div>
                                    <div className="detail-item">
                                        <label>Relevance to HRU</label>
                                        <p>{selectedLog.relevant_to_hru_obj ?? '—'} / 5</p>
                                    </div>
                                </div>
                            </div>

                            {/* Notes */}
                            {selectedLog.methodology && (
                                <div className="detail-section">
                                    <h3>Methodology Notes</h3>
                                    <div className="evaluator-notes-box">{selectedLog.methodology}</div>
                                </div>
                            )}
                            {selectedLog.strengths && (
                                <div className="detail-section">
                                    <h3>Strengths</h3>
                                    <div className="evaluator-notes-box">{selectedLog.strengths}</div>
                                </div>
                            )}
                            {selectedLog.weaknesses && (
                                <div className="detail-section">
                                    <h3>Weaknesses</h3>
                                    <div className="evaluator-notes-box">{selectedLog.weaknesses}</div>
                                </div>
                            )}
                            {selectedLog.comments && (
                                <div className="detail-section">
                                    <h3>Additional Comments</h3>
                                    <div className="evaluator-notes-box">{selectedLog.comments}</div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}