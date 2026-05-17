import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import { FileText, Clock, CheckCircle, XCircle, RefreshCw, X, Paperclip } from 'lucide-react';
import Navbar from "./EvaluatorNavbar";
import "./EvaluatorActivityLog.css"; // Reusing the same CSS

function EvaluatorReviewQueue() {
    const navigate = useNavigate();
    const [researches, setResearches] = useState([]);
    const [revisions, setRevisions] = useState([]);
    const [activeTab, setActiveTab] = useState('submissions');
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [selectedSubmission, setSelectedSubmission] = useState(null);
    const [selectedRevision, setSelectedRevision] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [modalType, setModalType] = useState('submission');

    useEffect(() => {
        loadAllData();
    }, []);

    async function loadAllData() {
        setLoading(true);
        try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError || !session) {
                console.error('No active session');
                setLoading(false);
                return;
            }

            const authUserId = session.user.id;

            const { data: evaluatorData, error: evaluatorError } = await supabase
                .from('Evaluator')
                .select('evaluator_id')
                .eq('user_id', authUserId)
                .maybeSingle();

            if (evaluatorError || !evaluatorData) {
                console.error('No evaluator record found');
                setLoading(false);
                return;
            }

            const evaluatorId = evaluatorData.evaluator_id;

            await Promise.all([
                loadOriginalSubmissions(evaluatorId),
                loadRevisedSubmissions(evaluatorId)
            ]);

        } catch (err) {
            console.error('Unexpected error:', err);
        } finally {
            setLoading(false);
        }
    }

    async function loadOriginalSubmissions(evaluatorId) {
        try {
            // Get research IDs from queue
            const { data: queueData, error: queueError } = await supabase
                .from('Research_Queue')
                .select('research_id')
                .eq('evaluator_id', evaluatorId);

            if (queueError || !queueData || queueData.length === 0) {
                setResearches([]);
                return;
            }

            const assignedResearchIds = queueData.map(q => q.research_id);

            // Fetch research data with researcher info and file attachments
            const { data: researchData, error: researchError } = await supabase
                .from('Research')
                .select(`
                    *,
                    research_files (file_url, file_type),
                    Researcher:researcher_id (
                        researcher_id,
                        user_id,
                        Users!inner (
                            first_name,
                            last_name,
                            email
                        )
                    )
                `)
                .in('research_id', assignedResearchIds)
                .order('registration_date', { ascending: false });

            if (researchError) {
                console.error('Error fetching research data:', researchError);
                return;
            }

            const formatted = (researchData || []).map(r => ({
                ...r,
                author: r.Researcher?.Users
                    ? `${r.Researcher.Users.first_name || ''} ${r.Researcher.Users.last_name || ''}`.trim()
                    : 'Unknown Author',
                author_email: r.Researcher?.Users?.email || 'No email',
                type: 'submission',
                submitted_at: r.registration_date
            }));

            setResearches(formatted);
        } catch (err) {
            console.error('Error loading submissions:', err);
        }
    }

    async function loadRevisedSubmissions(evaluatorId) {
        try {
            // Fetch revisions assigned to this evaluator that are still pending
            // Similar to how ResearcherDashboard fetches revisions but filtered by evaluator
            const { data: revisionsData, error: revisionsError } = await supabase
                .from('ResearchRevisions')
                .select(`
                    revision_id,
                    research_id,
                    revision_type,
                    researcher_comment,
                    new_file_url,
                    submitted_at,
                    status,
                    evaluator_id,
                    Research:research_id (
                        research_id,
                        title,
                        hru_no,
                        description,
                        registration_date,
                        status as research_status,
                        researcher_id,
                        Researcher:researcher_id (
                            researcher_id,
                            user_id,
                            Users!inner (
                                first_name,
                                last_name,
                                email
                            )
                        )
                    )
                `)
                .eq('evaluator_id', evaluatorId)
                .eq('status', 'Pending')
                .order('submitted_at', { ascending: false });

            if (revisionsError) {
                console.error('Error fetching revisions:', revisionsError);
                setRevisions([]);
                return;
            }

            console.log('Fetched revisions:', revisionsData); // Debug log

            const formatted = (revisionsData || []).map(revision => {
                const research = revision.Research;
                const researcher = research?.Researcher;
                const user = researcher?.Users;
                
                return {
                    revision_id: revision.revision_id,
                    research_id: revision.research_id,
                    revision_type: revision.revision_type,
                    revision_type_display: revision.revision_type === 'minor' ? 'Minor Revision' : 'Major Revision',
                    researcher_comment: revision.researcher_comment,
                    new_file_url: revision.new_file_url,
                    submitted_at: revision.submitted_at,
                    status: revision.status,
                    evaluator_id: revision.evaluator_id,
                    research_title: research?.title || 'Untitled',
                    research_description: research?.description || '',
                    hru_no: research?.hru_no || '—',
                    original_submission_date: research?.registration_date,
                    research_status: research?.research_status,
                    author: user 
                        ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Unknown Author'
                        : 'Unknown Author',
                    author_email: user?.email || 'No email',
                    type: 'revision'
                };
            });

            setRevisions(formatted);
        } catch (err) {
            console.error('Error loading revisions:', err);
            setRevisions([]);
        }
    }

    const getStatusBadge = (status) => {
        const normalizedStatus = status?.toLowerCase() || 'pending';
        switch (normalizedStatus) {
            case 'pending':
                return { label: 'PENDING', icon: <Clock size={14} />, color: '#854d0e', bg: '#fef9c3' };
            case 'approved':
                return { label: 'APPROVED', icon: <CheckCircle size={14} />, color: '#166534', bg: '#dcfce7' };
            case 'rejected':
                return { label: 'REJECTED', icon: <XCircle size={14} />, color: '#991b1b', bg: '#fee2e2' };
            default:
                return { label: 'PENDING REVIEW', icon: <Clock size={14} />, color: '#854d0e', bg: '#fef9c3' };
        }
    };

    const getRevisionTypeDisplay = (type) => {
        if (type === 'minor') {
            return { label: 'MINOR REVISION', color: '#1e40af', bg: '#dbeafe' };
        }
        return { label: 'MAJOR REVISION', color: '#5b21b6', bg: '#ede9fe' };
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric'
        });
    };

    const formatDateTime = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    const handleSubmissionClick = (submission) => {
        setSelectedSubmission(submission);
        setModalType('submission');
        setShowModal(true);
    };

    const handleRevisionClick = (revision) => {
        setSelectedRevision(revision);
        setModalType('revision');
        setShowModal(true);
    };

    const handleEvaluate = () => {
        setShowModal(false);
        if (modalType === 'submission' && selectedSubmission) {
            navigate(`/evaluate-research/${selectedSubmission.research_id}`);
        } else if (modalType === 'revision' && selectedRevision) {
            // Pass revision data to the evaluation page
            navigate(`/evaluate-research/${selectedRevision.research_id}`, {
                state: { 
                    revision: selectedRevision,
                    isRevision: true,
                    revisionId: selectedRevision.revision_id,
                    revisionType: selectedRevision.revision_type,
                    revisionComment: selectedRevision.researcher_comment,
                    revisedFileUrl: selectedRevision.new_file_url
                }
            });
        }
    };

    const closeModal = () => {
        setShowModal(false);
        setSelectedSubmission(null);
        setSelectedRevision(null);
    };

    // Combine and filter items based on active tab and search
    const getFilteredItems = () => {
        let items = [];
        if (activeTab === 'submissions') {
            // Only show submissions with status 'Pending' (not yet evaluated)
            items = researches.filter(r => 
                r.status?.toLowerCase() === 'pending' || 
                r.status?.toLowerCase() === 'under_review'
            );
        } else {
            items = revisions;
        }

        return items.filter(item => {
            const title = activeTab === 'submissions' ? item.title : item.research_title;
            const hruNo = item.hru_no;
            const author = item.author;
            
            return (
                title?.toLowerCase().includes(search.toLowerCase()) ||
                hruNo?.toLowerCase().includes(search.toLowerCase()) ||
                author?.toLowerCase().includes(search.toLowerCase())
            );
        });
    };

    const filteredItems = getFilteredItems();
    const pendingSubmissionsCount = researches.filter(r => 
        r.status?.toLowerCase() === 'pending' || 
        r.status?.toLowerCase() === 'under_review'
    ).length;
    const pendingRevisionsCount = revisions.length;
    const totalPending = pendingSubmissionsCount + pendingRevisionsCount;

    return (
        <div className="dashboard-wrapper">
            <Navbar />
            <main className="dashboard-container">
                <div className="alog-page-header">
                    <h1>Evaluation Queue</h1>
                    <p>Research papers and revisions assigned to you for evaluation.</p>
                    {totalPending > 0 && (
                        <div className="queue-summary">
                            <span className="queue-badge">
                                Total Pending: {totalPending}
                            </span>
                        </div>
                    )}
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
                        <div style={{ display: 'flex', gap: '1rem', marginLeft: 'auto' }}>
                            <button
                                onClick={() => setActiveTab('submissions')}
                                style={{
                                    padding: '8px 16px',
                                    background: activeTab === 'submissions' ? 'white' : 'transparent',
                                    color: activeTab === 'submissions' ? '#031640' : 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    fontSize: '0.85rem',
                                    transition: 'all 0.2s'
                                }}
                            >
                                Original Submissions
                                {pendingSubmissionsCount > 0 && (
                                    <span style={{ 
                                        marginLeft: '8px',
                                        background: activeTab === 'submissions' ? '#031640' : 'white',
                                        color: activeTab === 'submissions' ? 'white' : '#031640',
                                        padding: '2px 8px',
                                        borderRadius: '999px',
                                        fontSize: '0.7rem'
                                    }}>
                                        {pendingSubmissionsCount}
                                    </span>
                                )}
                            </button>
                            <button
                                onClick={() => setActiveTab('revisions')}
                                style={{
                                    padding: '8px 16px',
                                    background: activeTab === 'revisions' ? 'white' : 'transparent',
                                    color: activeTab === 'revisions' ? '#031640' : 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    fontSize: '0.85rem',
                                    transition: 'all 0.2s'
                                }}
                            >
                                Revised Papers
                                {pendingRevisionsCount > 0 && (
                                    <span style={{ 
                                        marginLeft: '8px',
                                        background: activeTab === 'revisions' ? '#031640' : 'white',
                                        color: activeTab === 'revisions' ? 'white' : '#031640',
                                        padding: '2px 8px',
                                        borderRadius: '999px',
                                        fontSize: '0.7rem'
                                    }}>
                                        {pendingRevisionsCount}
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Table Header */}
                    <div className="alog-table-head">
                        <span>Status</span>
                        <span>HRU No.</span>
                        <span>Research Title</span>
                        <span>Researcher</span>
                        <span>Submitted On</span>
                    </div>

                    {/* Table Rows */}
                    {loading ? (
                        <div className="alog-empty">
                            <RefreshCw size={24} className="spinning" />
                            <p>Loading evaluation queue...</p>
                        </div>
                    ) : filteredItems.length === 0 ? (
                        <div className="alog-empty">
                            <FileText size={48} strokeWidth={1} />
                            <p>No {activeTab === 'submissions' ? 'submissions' : 'revisions'} found.</p>
                            {search && <small>Try adjusting your search terms.</small>}
                            {filteredItems.length === 0 && !search && (
                                <small>
                                    {activeTab === 'submissions' 
                                        ? 'No pending research submissions assigned to you.'
                                        : 'No pending revisions assigned to you.'}
                                </small>
                            )}
                        </div>
                    ) : (
                        filteredItems.map((item) => {
                            const isRevision = activeTab === 'revisions';
                            const statusInfo = isRevision 
                                ? getRevisionTypeDisplay(item.revision_type)
                                : getStatusBadge(item.status);
                            
                            return (
                                <div 
                                    key={isRevision ? item.revision_id : item.research_id}
                                    className="alog-row"
                                    onClick={() => isRevision ? handleRevisionClick(item) : handleSubmissionClick(item)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <div>
                                        <span 
                                            className="alog-status-badge"
                                            style={{ 
                                                background: statusInfo.bg,
                                                color: statusInfo.color,
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '6px'
                                            }}
                                        >
                                            {!isRevision && statusInfo.icon}
                                            {statusInfo.label}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="alog-hru">
                                            {item.hru_no || '—'}
                                        </span>
                                    </div>
                                    <div className="alog-title-cell">
                                        <span className="alog-research-title">
                                            {isRevision ? item.research_title : item.title}
                                        </span>
                                        {isRevision && (
                                            <span className="alog-action-tag">
                                                {item.revision_type_display} • Submitted {formatDate(item.submitted_at)}
                                            </span>
                                        )}
                                        {!isRevision && item.research_files && item.research_files.length > 0 && (
                                            <span className="alog-action-tag">
                                                {item.research_files.length} file(s) attached
                                            </span>
                                        )}
                                    </div>
                                    <div>
                                        <span style={{ fontSize: '0.85rem', color: '#475569' }}>
                                            {item.author || 'Unknown'}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="alog-date">
                                            {formatDateTime(item.submitted_at)}
                                        </span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Modal for Original Submission */}
                {showModal && modalType === 'submission' && selectedSubmission && (
                    <div className="modal-overlay" onClick={closeModal}>
                        <div className="modal-content" onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                                <div>
                                    <h2>{selectedSubmission.title}</h2>
                                    {selectedSubmission.hru_no && (
                                        <span className="alog-hru" style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                            HRU No: {selectedSubmission.hru_no}
                                        </span>
                                    )}
                                </div>
                                <button className="close-btn" onClick={closeModal}>
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="modal-body">
                                <div className="detail-section">
                                    <h3>Research Information</h3>
                                    <div className="detail-grid">
                                        <div className="detail-item">
                                            <label>Author</label>
                                            <p>{selectedSubmission.author}</p>
                                            <small style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{selectedSubmission.author_email}</small>
                                        </div>
                                        <div className="detail-item">
                                            <label>Submission Date</label>
                                            <p>{formatDate(selectedSubmission.registration_date)}</p>
                                        </div>
                                        <div className="detail-item">
                                            <label>Current Status</label>
                                            <p style={{ color: getStatusBadge(selectedSubmission.status).color }}>
                                                {selectedSubmission.status || 'Pending'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {selectedSubmission.description && (
                                    <div className="detail-section">
                                        <h3>Abstract / Description</h3>
                                        <div className="evaluator-notes-box">
                                            {selectedSubmission.description}
                                        </div>
                                    </div>
                                )}

                                {selectedSubmission.research_files && selectedSubmission.research_files.length > 0 && (
                                    <div className="detail-section">
                                        <h3>Research Files</h3>
                                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                            {selectedSubmission.research_files.map((file, idx) => (
                                                <a
                                                    key={idx}
                                                    href={file.file_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="revision-history-file"
                                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                                                >
                                                    <Paperclip size={14} />
                                                    {file.file_type || 'Research Paper'}
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="modal-footer" style={{ padding: '1rem 1.5rem 1.5rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                                <button className="btn-cancel" onClick={closeModal}>Cancel</button>
                                <button className="btn-evaluate" onClick={handleEvaluate}>Evaluate</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Modal for Revision */}
                {showModal && modalType === 'revision' && selectedRevision && (
                    <div className="modal-overlay" onClick={closeModal}>
                        <div className="modal-content" onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                                <div>
                                    <h2>{selectedRevision.research_title}</h2>
                                    {selectedRevision.hru_no && (
                                        <span className="alog-hru" style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                            HRU No: {selectedRevision.hru_no}
                                        </span>
                                    )}
                                </div>
                                <button className="close-btn" onClick={closeModal}>
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="modal-body">
                                <div className="detail-section">
                                    <h3>Revision Information</h3>
                                    <div className="detail-grid">
                                        <div className="detail-item">
                                            <label>Revision Type</label>
                                            <p style={{ 
                                                color: getRevisionTypeDisplay(selectedRevision.revision_type).color,
                                                fontWeight: 600
                                            }}>
                                                {selectedRevision.revision_type_display}
                                            </p>
                                        </div>
                                        <div className="detail-item">
                                            <label>Submitted</label>
                                            <p>{formatDateTime(selectedRevision.submitted_at)}</p>
                                        </div>
                                        <div className="detail-item">
                                            <label>Original Submission</label>
                                            <p>{formatDate(selectedRevision.original_submission_date)}</p>
                                        </div>
                                    </div>
                                </div>

                                {selectedRevision.researcher_comment && (
                                    <div className="detail-section">
                                        <h3>Researcher's Cover Letter</h3>
                                        <div className="evaluator-notes-box" style={{ borderLeftColor: '#3b82f6', background: '#f8fafc' }}>
                                            {selectedRevision.researcher_comment}
                                        </div>
                                    </div>
                                )}

                                {selectedRevision.research_description && (
                                    <div className="detail-section">
                                        <h3>Research Description</h3>
                                        <div className="evaluator-notes-box">
                                            {selectedRevision.research_description}
                                        </div>
                                    </div>
                                )}

                                {selectedRevision.new_file_url && (
                                    <div className="detail-section">
                                        <h3>Revised Manuscript</h3>
                                        <a
                                            href={selectedRevision.new_file_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="revision-history-file"
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                                        >
                                            <Paperclip size={14} />
                                            Download Revised Paper
                                        </a>
                                    </div>
                                )}

                                <div className="detail-section">
                                    <h3>Author Information</h3>
                                    <div className="detail-grid">
                                        <div className="detail-item">
                                            <label>Author</label>
                                            <p>{selectedRevision.author}</p>
                                            <small style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{selectedRevision.author_email}</small>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="modal-footer" style={{ padding: '1rem 1.5rem 1.5rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                                <button className="btn-cancel" onClick={closeModal}>Cancel</button>
                                <button className="btn-evaluate" onClick={handleEvaluate}>Evaluate Revision</button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

export default EvaluatorReviewQueue;