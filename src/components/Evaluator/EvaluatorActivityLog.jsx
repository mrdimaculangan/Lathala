import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { X, FileText, Clock, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { supabase } from "../../supabaseClient.js";
import { UserAuth } from "../../context/AuthContext.jsx";
import Navbar from "./EvaluatorNavbar";
import "./EvaluatorActivityLog.css";

const STATUS_STYLES = {
    'Pending': { bg: '#fef9c3', text: '#854d0e' },
    'Approved': { bg: '#dcfce7', text: '#166534' },
    'Rejected': { bg: '#fee2e2', text: '#991b1b' },
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
    const { dbId, session } = UserAuth();

    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState("");
    const [selectedLog, setSelectedLog] = useState(null);
    const [evaluatorInfo, setEvaluatorInfo] = useState(null);

    useEffect(() => {
        const currentUserId = dbId || session?.user?.id;

        if (!currentUserId) {
            setLoading(false);
            return;
        }

        async function fetchEvaluatorAndLogs() {
            try {
                setLoading(true);
                setError(null);

                // 1. Get evaluator profile
                const { data: evaluatorData, error: evaluatorError } = await supabase
                    .from('Evaluator')
                    .select('evaluator_id')
                    .eq('user_id', currentUserId)
                    .maybeSingle();

                if (evaluatorError) throw new Error(`Evaluator Profile Error: ${evaluatorError.message}`);
                if (!evaluatorData) {
                    setError("No evaluator profile found. Please contact an administrator.");
                    setLoading(false);
                    return;
                }

                setEvaluatorInfo(evaluatorData);

                // 2. Fetch evaluation records
                const { data: evaluationData, error: evaluationError } = await supabase
                    .from('Evaluation_Research')
                    .select(`
                        evaluation_id,
                        research_id,
                        sci_rigor,
                        relevant_to_hru_obj,
                        ethical_compliance,
                        methodology,
                        strengths,
                        weaknesses,
                        additional_comments,
                        overall_recommendation,
                        evaluator_name,
                        evaluator_email,
                        evaluated_at,
                        evaluator_id
                    `)
                    .eq('evaluator_id', evaluatorData.evaluator_id)
                    .order('evaluated_at', { ascending: false });

                if (evaluationError) {
                    console.error("Supabase Query Error:", evaluationError);
                    throw new Error(`Failed to fetch evaluations: ${evaluationError.message}`);
                }

                if (!evaluationData || evaluationData.length === 0) {
                    setLogs([]);
                    setLoading(false);
                    return;
                }

                // 3. Get research details with nested joins for researcher info
                const researchIds = evaluationData.map(e => e.research_id);

                const { data: researchData, error: researchError } = await supabase
                    .from('Research')
                    .select(`
                        research_id,
                        title,
                        hru_no,
                        status,
                        researcher_id,
                        Researcher:researcher_id (
                            researcher_id,
                            user_id,
                            Users (
                                first_name,
                                last_name,
                                email
                            )
                        )
                    `)
                    .in('research_id', researchIds);

                if (researchError) {
                    console.error("Research fetch error:", researchError);
                    throw new Error(`Failed to fetch research details: ${researchError.message}`);
                }

                // 4. Combine all the data
                const formattedLogs = evaluationData.map(evaluation => {
                    const research = researchData?.find(r => r.research_id === evaluation.research_id);
                    
                    // Access researcher name from nested structure
                    const researcherName = research?.Researcher?.Users 
                        ? `${research.Researcher.Users.first_name || ''} ${research.Researcher.Users.last_name || ''}`.trim()
                        : 'Unknown Researcher';
                    
                    const researcherEmail = research?.Researcher?.Users?.email || 'No email provided';

                    return {
                        log_id: evaluation.evaluation_id,
                        research_id: evaluation.research_id,
                        // Keep scores for the modal
                        sci_rigor: evaluation.sci_rigor,
                        relevant_to_hru_obj: evaluation.relevant_to_hru_obj,
                        ethical_compliance: evaluation.ethical_compliance,
                        methodology: evaluation.methodology,
                        strengths: evaluation.strengths,
                        weaknesses: evaluation.weaknesses,
                        additional_comments: evaluation.additional_comments,
                        overall_recommendation: evaluation.overall_recommendation,
                        evaluator_name: evaluation.evaluator_name,
                        evaluator_email: evaluation.evaluator_email,
                        evaluated_at: evaluation.evaluated_at,
                        Research: {
                            research_id: research?.research_id,
                            title: research?.title || "Untitled Research",
                            hru_no: research?.hru_no,
                            status: research?.status || "Pending",
                            researcher: {
                                name: researcherName,
                                email: researcherEmail
                            }
                        }
                    };
                });

                setLogs(formattedLogs);

                // Handle deep link
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

        fetchEvaluatorAndLogs();
    }, [dbId, session, logId]);

    // Filter logs based on search
    const filteredLogs = logs.filter(log =>
        log.Research?.title?.toLowerCase().includes(search.toLowerCase()) ||
        log.Research?.hru_no?.toLowerCase().includes(search.toLowerCase()) ||
        log.Research?.researcher?.name?.toLowerCase().includes(search.toLowerCase()) ||
        log.overall_recommendation?.toLowerCase().includes(search.toLowerCase())
    );

    const closeModal = () => {
        setSelectedLog(null);
        navigate('/evaluator-activity-log', { replace: true });
    };

    const getRecommendationDisplay = (recommendation) => {
        switch(recommendation) {
            case 'Approved':
                return { label: 'APPROVED', icon: DECISION_ICONS['Approved'], color: '#166534' };
            case 'Rejected':
                return { label: 'REJECTED', icon: DECISION_ICONS['Rejected'], color: '#991b1b' };
            case 'With Minor Revisions':
                return { label: 'MINOR REVISIONS', icon: DECISION_ICONS['With Minor Revisions'], color: '#1e40af' };
            case 'With Major Revisions':
                return { label: 'MAJOR REVISIONS', icon: DECISION_ICONS['With Major Revisions'], color: '#5b21b6' };
            default:
                return { label: recommendation?.toUpperCase() || 'PENDING', icon: <Clock size={16} />, color: '#854d0e' };
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
                            placeholder="Search by title, HRU number, researcher name, or recommendation..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    {/* Table header - No score column */}
                    <div className="alog-table-head">
                        <span>Recommendation</span>
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
                            const recommendationInfo = getRecommendationDisplay(log.overall_recommendation);
                            
                            return (
                                <div 
                                    key={log.log_id} 
                                    className="alog-row"
                                    onClick={() => setSelectedLog(log)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <div>
                                        <span 
                                            className="alog-status-badge"
                                            style={{ 
                                                background: `${recommendationInfo.color}15`, 
                                                color: recommendationInfo.color,
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '6px'
                                            }}
                                        >
                                            {recommendationInfo.icon}
                                            {recommendationInfo.label}
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
                                    </div>

                                    <div>
                                        <span className="alog-researcher-name" style={{ fontSize: '0.85rem', color: '#475569' }}>
                                            {log.Research?.researcher?.name || 'Unknown'}
                                        </span>
                                    </div>

                                    <div>
                                        <span className="alog-date">
                                            {log.evaluated_at ? new Date(log.evaluated_at).toLocaleDateString('en-US', {
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric'
                                            }) : 'Date not available'}
                                        </span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </main>

            {/* DETAIL MODAL - Scores are displayed here */}
            {selectedLog && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <h2>{selectedLog.Research?.title}</h2>
                                {selectedLog.Research?.hru_no && (
                                    <span className="alog-hru" style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                        HRU No: {selectedLog.Research.hru_no}
                                    </span>
                                )}
                            </div>
                            <button className="close-btn" onClick={closeModal}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="modal-body">
                            {/* Recommendation Banner */}
                            <div className="detail-section">
                                <h3>Overall Recommendation</h3>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
                                    <span 
                                        className="alog-status-badge"
                                        style={{ 
                                            background: `${getRecommendationDisplay(selectedLog.overall_recommendation).color}15`, 
                                            color: getRecommendationDisplay(selectedLog.overall_recommendation).color,
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            padding: '6px 14px'
                                        }}
                                    >
                                        {getRecommendationDisplay(selectedLog.overall_recommendation).icon}
                                        {getRecommendationDisplay(selectedLog.overall_recommendation).label}
                                    </span>
                                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                        Evaluated on {selectedLog.evaluated_at ? new Date(selectedLog.evaluated_at).toLocaleDateString('en-US', {
                                            year: 'numeric', month: 'long', day: 'numeric'
                                        }) : 'Date not available'}
                                    </span>
                                </div>
                            </div>

                            {/* Evaluation Scores - Only visible in modal */}
                            <div className="detail-section">
                                <h3>Evaluation Scores</h3>
                                <div className="detail-grid">
                                    <div className="detail-item">
                                        <label>Scientific Rigor</label>
                                        <p style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                                            {selectedLog.sci_rigor}
                                        </p>
                                    </div>
                                    <div className="detail-item">
                                        <label>Relevance to HRU Objectives</label>
                                        <p style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                                            {selectedLog.relevant_to_hru_obj}
                                        </p>
                                    </div>
                                    <div className="detail-item">
                                        <label>Ethical Compliance</label>
                                        <p style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                                            {selectedLog.ethical_compliance}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Methodology & Comments */}
                            {selectedLog.methodology && (
                                <div className="detail-section">
                                    <h3>Methodology Assessment</h3>
                                    <div className="evaluator-notes-box">
                                        {selectedLog.methodology}
                                    </div>
                                </div>
                            )}

                            {selectedLog.strengths && (
                                <div className="detail-section">
                                    <h3>Strengths</h3>
                                    <div className="evaluator-notes-box" style={{ borderLeftColor: '#166534' }}>
                                        {selectedLog.strengths}
                                    </div>
                                </div>
                            )}

                            {selectedLog.weaknesses && (
                                <div className="detail-section">
                                    <h3>Areas for Improvement</h3>
                                    <div className="evaluator-notes-box" style={{ borderLeftColor: '#991b1b' }}>
                                        {selectedLog.weaknesses}
                                    </div>
                                </div>
                            )}

                            {selectedLog.additional_comments && (
                                <div className="detail-section">
                                    <h3>Additional Comments</h3>
                                    <div className="evaluator-notes-box">
                                        {selectedLog.additional_comments}
                                    </div>
                                </div>
                            )}

                            {/* Research Information */}
                            <div className="detail-section">
                                <h3>Research Information</h3>
                                <div className="detail-grid">
                                    <div className="detail-item">
                                        <label>Researcher</label>
                                        <p>{selectedLog.Research?.researcher?.name}</p>
                                        <small style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{selectedLog.Research?.researcher?.email}</small>
                                    </div>
                                    <div className="detail-item">
                                        <label>Current Status</label>
                                        <p style={{ 
                                            color: STATUS_STYLES[selectedLog.Research?.status]?.text || '#64748b',
                                            fontWeight: '500'
                                        }}>
                                            {selectedLog.Research?.status || 'Pending'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}