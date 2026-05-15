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
    const { dbId, firstName, lastName, session, userRole } = UserAuth();

    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState("");
    const [selectedLog, setSelectedLog] = useState(null);
    const [evaluatorInfo, setEvaluatorInfo] = useState(null);

    useEffect(() => {
        console.log("=== DEBUG: Component mounted ===");
        console.log("dbId from UserAuth:", dbId);
        console.log("userRole:", userRole);
        console.log("session:", session?.user?.email);
        
        if (!dbId) {
            console.log("No dbId found, waiting for auth...");
            return;
        }

        async function fetchEvaluatorAndLogs() {
            try {
                console.log("Starting fetchEvaluatorAndLogs...");
                setLoading(true);
                setError(null);
                
                // 1. Get evaluator_id from Evaluator table using the user's dbId (UUID)
                console.log("Step 1: Fetching evaluator record for user_id:", dbId);
                const { data: evaluatorData, error: evaluatorError } = await supabase
                    .from('Evaluator')
                    .select('evaluator_id, specialization, department')
                    .eq('user_id', dbId)
                    .single();

                if (evaluatorError) {
                    console.error("Error fetching evaluator:", evaluatorError);
                    setError(`Failed to fetch evaluator record: ${evaluatorError.message}`);
                    setLoading(false);
                    return;
                }

                if (!evaluatorData) {
                    console.log("No evaluator record found for user_id:", dbId);
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
                        decision,
                        comments,
                        evaluated_at,
                        created_at,
                        updated_at,
                        Research!inner (
                            research_id,
                            title,
                            hru_no,
                            abstract,
                            researcher_id,
                            status,
                            created_at as research_created_at,
                            Users!inner (
                                first_name,
                                last_name,
                                email
                            )
                        )
                    `)
                    .eq('evaluator_id', evaluatorData.evaluator_id)
                    .order('evaluated_at', { ascending: false });

                if (evaluationError) {
                    console.error("Error fetching evaluations:", evaluationError);
                    setError(`Failed to fetch evaluations: ${evaluationError.message}`);
                    setLoading(false);
                    return;
                }

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
                    console.log("Processing evaluation:", evaluation.evaluation_id);
                    return {
                        log_id: evaluation.evaluation_id,
                        research_id: evaluation.research_id,
                        decision: evaluation.decision,
                        comments: evaluation.comments,
                        evaluated_at: evaluation.evaluated_at,
                        created_at: evaluation.created_at,
                        Research: {
                            research_id: evaluation.Research.research_id,
                            title: evaluation.Research.title,
                            hru_no: evaluation.Research.hru_no,
                            abstract: evaluation.Research.abstract,
                            status: evaluation.Research.status,
                            researcher: {
                                name: evaluation.Research.Users ? 
                                    `${evaluation.Research.Users.first_name} ${evaluation.Research.Users.last_name}` : 
                                    'Unknown',
                                email: evaluation.Research.Users?.email || 'No email'
                            }
                        }
                    };
                });

                console.log("Formatted logs:", formattedLogs);
                setLogs(formattedLogs);

                // If there's a logId in URL params, open that log
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
    }, [dbId, logId]);

    // Filter logs based on search
    const filteredLogs = logs.filter(log =>
        log.Research?.title?.toLowerCase().includes(search.toLowerCase()) ||
        log.Research?.hru_no?.toLowerCase().includes(search.toLowerCase()) ||
        log.Research?.researcher?.name?.toLowerCase().includes(search.toLowerCase())
    );

    const closeModal = () => {
        setSelectedLog(null);
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
                            <div className="detail-section">
                                <h3>Your Evaluation Comments</h3>
                                <div className="evaluator-notes-box">
                                    {selectedLog.comments || 'No comments were provided for this evaluation.'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}