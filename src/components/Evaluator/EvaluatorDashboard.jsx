import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import { FileText, Paperclip, CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react';
import Navbar from "./EvaluatorNavbar";
import "./EvaluatorDashboard.css";

function EvaluatorDashboard() {
    const navigate = useNavigate();
    const [researches, setResearches] = useState([]);
    const [revisions, setRevisions] = useState([]);
    const [activeTab, setActiveTab] = useState('submissions'); // 'submissions' or 'revisions'
    const [loading, setLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedResearch, setSelectedResearch] = useState(null);
    const [selectedRevision, setSelectedRevision] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [modalType, setModalType] = useState('submission'); // 'submission' or 'revision'

    useEffect(() => {
        loadAllData();
    }, []);

    async function loadAllData() {
        setLoading(true);
        try {
            // Step 1: Get the logged-in user's session
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError || !session) {
                console.error('No active session');
                setLoading(false);
                return;
            }

            const authUserId = session.user.id;

            // Step 2: Get the evaluator_id for this user
            const { data: evaluatorData, error: evaluatorError } = await supabase
                .from('Evaluator')
                .select('evaluator_id')
                .eq('user_id', authUserId)
                .maybeSingle();

            if (evaluatorError || !evaluatorData) {
                console.error('No evaluator record found for this user');
                setLoading(false);
                return;
            }

            const evaluatorId = evaluatorData.evaluator_id;

            // Load both original submissions and revisions in parallel
            await Promise.all([
                loadOriginalSubmissions(evaluatorId),
                loadRevisedSubmissions(evaluatorId)
            ]);

        } catch (err) {
            console.error('Unexpected error loading data:', err);
        } finally {
            setLoading(false);
        }
    }

    async function loadOriginalSubmissions(evaluatorId) {
        try {
            // Get research_ids assigned to this evaluator from Research_Queue
            const { data: queueData, error: queueError } = await supabase
                .from('Research_Queue')
                .select('research_id')
                .eq('evaluator_id', evaluatorId);

            if (queueError) {
                console.error('Error fetching queue:', queueError);
                return;
            }

            if (!queueData || queueData.length === 0) {
                setResearches([]);
                return;
            }

            const assignedResearchIds = queueData.map(q => q.research_id);

            // Fetch only the assigned research with author details
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
                console.error('Error fetching research:', researchError);
                return;
            }

            // Format the data
            const formatted = (researchData || []).map(r => ({
                ...r,
                author: r.Researcher?.Users
                    ? `${r.Researcher.Users.first_name || ''} ${r.Researcher.Users.last_name || ''}`.trim()
                    : 'Unknown Author',
                author_email: r.Researcher?.Users?.email || 'No email',
            }));

            setResearches(formatted);
        } catch (err) {
            console.error('Error loading original submissions:', err);
        }
    }

    async function loadRevisedSubmissions(evaluatorId) {
        try {
            // Fetch pending revisions assigned to this evaluator
            const { data: revisionsData, error: revisionsError } = await supabase
                .from('ResearchRevisions')
                .select(`
                    *,
                    Research:research_id (
                        research_id,
                        title,
                        hru_no,
                        description,
                        registration_date,
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

            // Format the revisions data - ensure it's always an array
            const formatted = (revisionsData || []).map(revision => ({
                ...revision,
                research_title: revision.Research?.title,
                research_description: revision.Research?.description,
                hru_no: revision.Research?.hru_no,
                original_submission_date: revision.Research?.registration_date,
                author: revision.Research?.Researcher?.Users 
                    ? `${revision.Research.Researcher.Users.first_name || ''} ${revision.Research.Researcher.Users.last_name || ''}`.trim()
                    : 'Unknown Author',
                author_email: revision.Research?.Researcher?.Users?.email || 'No email',
                revision_type_display: revision.revision_type === 'minor' ? 'Minor Revision' : 'Major Revision'
            }));

            setRevisions(formatted || []);
        } catch (err) {
            console.error('Error loading revised submissions:', err);
            setRevisions([]);  
        }
    }

    const getStatusBadge = (status) => {
        const normalizedStatus = status?.toLowerCase() || 'pending';
        switch (normalizedStatus) {
            case 'pending':
                return <span className="status-badge status-pending"><Clock size={14} className="status-icon" /> Pending</span>;
            case 'reviewed':
                return <span className="status-badge status-reviewed"><FileText size={14} className="status-icon" /> Reviewed</span>;
            case 'approved':
                return <span className="status-badge status-approved"><CheckCircle size={14} className="status-icon" /> Approved</span>;
            case 'rejected':
                return <span className="status-badge status-rejected"><XCircle size={14} className="status-icon" /> Rejected</span>;
            case 'minor_revision':
            case 'with minor revisions':
                return <span className="status-badge status-revision"><FileText size={14} className="status-icon" /> Minor Revision</span>;
            case 'major_revision':
            case 'with major revisions':
                return <span className="status-badge status-revision"><FileText size={14} className="status-icon" /> Major Revision</span>;
            default:
                return <span className="status-badge status-pending">{status || 'Pending'}</span>;
        }
    };

    const getRevisionTypeBadge = (type) => {
        if (type === 'minor') {
            return <span className="revision-badge revision-minor">Minor Revision</span>;
        } else if (type === 'major') {
            return <span className="revision-badge revision-major">Major Revision</span>;
        }
        return null;
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

    const handleResearchClick = (research) => {
        setSelectedResearch(research);
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
        if (modalType === 'submission') {
            navigate(`/evaluate-research/${selectedResearch.research_id}`);
        } else if (modalType === 'revision') {
        
            navigate(`/evaluate-research/${selectedRevision.research_id}`, {
                state: { 
                    revision: selectedRevision,
                    isRevision: true 
                }
            });
        }
    };

    const closeModal = () => {
        setShowModal(false);
        setSelectedResearch(null);
        setSelectedRevision(null);
    };

    // Stat counts
    const pendingSubmissions = researches.filter(r => r.status?.toLowerCase() === 'pending');
    const pendingRevisions = revisions?.length || 0;  // Add fallback for undefined/null
    const totalPending = (pendingSubmissions?.length || 0) + (pendingRevisions || 0);

    // Calendar
    const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

    const renderCalendar = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const daysInMonth = getDaysInMonth(year, month);
        const firstDay = getFirstDayOfMonth(year, month);
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];

        const days = [];
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="calendar-day empty" />);
        }
        for (let i = 1; i <= daysInMonth; i++) {
            const isToday = i === new Date().getDate() &&
                year === new Date().getFullYear() &&
                month === new Date().getMonth();
            days.push(
                <div key={i} className={`calendar-day ${isToday ? 'today' : ''}`}>{i}</div>
            );
        }

        return (
            <div className="calendar">
                <div className="calendar-header">
                    <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))}>&lt;</button>
                    <h3>{monthNames[month]} {year}</h3>
                    <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))}>&gt;</button>
                </div>
                <div className="calendar-weekdays">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={i}>{d}</div>)}
                </div>
                <div className="calendar-days">{days}</div>
            </div>
        );
    };

    return (
        <div className="dashboard-wrapper">
            <Navbar />

            <main className="dashboard-container">
                <div className="first-row">
                    <div className="title-section">
                        <h1>Evaluator Dashboard</h1>
                    </div>

                    <div className="stats-group">
                        <div className="stat-item">
                            <Paperclip size={45} className="research-icon" />
                            <span className="stat-label">TOTAL <br /> PENDING</span>
                            <span className="stat-number">{totalPending}</span>
                        </div>
                        <div className="stat-item">
                            <FileText size={45} className="research-icon" />
                            <span className="stat-label">SUBMISSIONS <br /> PENDING</span>
                            <span className="stat-number">{pendingSubmissions.length}</span>
                        </div>
                        <div className="stat-item">
                            <RefreshCw size={45} className="research-icon" />
                            <span className="stat-label">REVISIONS <br /> PENDING</span>
                            <span className="stat-number">{pendingRevisions}</span>
                        </div>
                        <div className="stat-item">
                            <CheckCircle size={45} className="research-icon" />
                            <span className="stat-label">TOTAL <br /> COMPLETED</span>
                            <span className="stat-number">
                                {researches.filter(r => r.status?.toLowerCase() === 'approved' || r.status?.toLowerCase() === 'rejected').length}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="second-row">
                    <div className="review-section">
                        <div className="recent-header">
                            <h1>Evaluation Queue</h1>
                            <p>Research papers and revisions assigned to you for evaluation.</p>
                            
                            {/* Tab Buttons */}
                            <div className="queue-tabs">
                                <button 
                                    className={`tab-btn ${activeTab === 'submissions' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('submissions')}
                                >
                                    Original Submissions
                                    {pendingSubmissions.length > 0 && (
                                        <span className="tab-badge">{pendingSubmissions.length}</span>
                                    )}
                                </button>
                                <button 
                                    className={`tab-btn ${activeTab === 'revisions' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('revisions')}
                                >
                                    Revised Papers
                                    {pendingRevisions > 0 && (
                                        <span className="tab-badge revision-badge-count">{pendingRevisions}</span>
                                    )}
                                </button>
                            </div>
                        </div>

                        {loading ? (
                            <div className="loading-state">Loading...</div>
                        ) : (
                            <>
                                {/* Original Submissions Tab */}
                                {activeTab === 'submissions' && (
                                    <div className="submissions-table">
                                        <div className="table-header">
                                            <div>HRU NUMBER</div>
                                            <div>RESEARCH TITLE</div>
                                            <div>STATUS</div>
                                            <div>DATE</div>
                                        </div>

                                        {pendingSubmissions.length === 0 ? (
                                            <div className="empty-state">No pending submissions assigned to you.</div>
                                        ) : (
                                            pendingSubmissions.map((research) => (
                                                <div
                                                    key={research.research_id}
                                                    className="table-row"
                                                    onClick={() => handleResearchClick(research)}
                                                    style={{ cursor: 'pointer' }}
                                                >
                                                    <div className="hru-number">{research.hru_no || research.research_id}</div>
                                                    <div className="research-title">{research.title}</div>
                                                    <div>{getStatusBadge(research.status)}</div>
                                                    <div>{formatDate(research.registration_date)}</div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}

                                {/* Revisions Tab */}
                                {activeTab === 'revisions' && (
                                    <div className="submissions-table">
                                        <div className="table-header">
                                            <div>HRU NUMBER</div>
                                            <div>RESEARCH TITLE</div>
                                            <div>REVISION TYPE</div>
                                            <div>SUBMITTED</div>
                                        </div>

                                        {revisions.length === 0 ? (
                                            <div className="empty-state">No pending revisions assigned to you.</div>
                                        ) : (
                                            revisions.map((revision) => (
                                                <div
                                                    key={revision.revision_id}
                                                    className="table-row"
                                                    onClick={() => handleRevisionClick(revision)}
                                                    style={{ cursor: 'pointer' }}
                                                >
                                                    <div className="hru-number">{revision.hru_no || revision.research_id}</div>
                                                    <div className="research-title">{revision.research_title}</div>
                                                    <div>{getRevisionTypeBadge(revision.revision_type)}</div>
                                                    <div>{formatDateTime(revision.submitted_at)}</div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <div className="calendar-section">
                        {renderCalendar()}
                    </div>
                </div>

                {/* Modal for Original Submission */}
                {showModal && modalType === 'submission' && selectedResearch && (
                    <div className="modal-overlay" onClick={closeModal}>
                        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <div className="modal-title-section">
                                    <h2>Research Details</h2>
                                    <div className="modal-status">{getStatusBadge(selectedResearch.status)}</div>
                                </div>
                                <button className="modal-close" onClick={closeModal}>×</button>
                            </div>

                            <div className="modal-body">
                                <div className="modal-field">
                                    <label>Title:</label>
                                    <b><p>{selectedResearch.title}</p></b>
                                </div>
                                <div className="modal-field">
                                    <label>Description:</label>
                                    <p>{selectedResearch.description || 'No description provided'}</p>
                                </div>
                                <div className="modal-row-two">
                                    <div className="modal-field-half">
                                        <label>Author:</label>
                                        <p>{selectedResearch.author || 'N/A'}</p>
                                    </div>
                                    <div className="modal-field-half">
                                        <label>Email:</label>
                                        <p>{selectedResearch.author_email || 'N/A'}</p>
                                    </div>
                                </div>
                                <div className="modal-row-two">
                                    <div className="modal-field-half">
                                        <label>Submission Date:</label>
                                        <p>{formatDate(selectedResearch.registration_date)}</p>
                                    </div>
                                    <div className="modal-field-half">
                                        <label>HRU Number:</label>
                                        <p>{selectedResearch.hru_no || 'N/A'}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="modal-footer">
                                <button className="btn-cancel" onClick={closeModal}>Cancel</button>
                                    <button className="btn-evaluate" onClick={handleEvaluate}>
                                        {modalType === 'revision' ? 'Evaluate Revision' : 'Evaluate'}
                                    </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Modal for Revision */}
                {showModal && modalType === 'revision' && selectedRevision && (
                    <div className="modal-overlay" onClick={closeModal}>
                        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <div className="modal-title-section">
                                    <h2>Revised Paper Details</h2>
                                    <div className="modal-status">{getRevisionTypeBadge(selectedRevision.revision_type)}</div>
                                </div>
                                <button className="modal-close" onClick={closeModal}>×</button>
                            </div>

                            <div className="modal-body">
                                <div className="modal-field">
                                    <label>Research Title:</label>
                                    <b><p>{selectedRevision.research_title}</p></b>
                                </div>
                                <div className="modal-field">
                                    <label>Description:</label>
                                    <p>{selectedRevision.research_description || 'No description provided'}</p>
                                </div>
                                
                                <div className="revision-info-box">
                                    <h4>Revision Information</h4>
                                    <div className="modal-field">
                                        <label>Revision Type:</label>
                                        <p>{selectedRevision.revision_type_display}</p>
                                    </div>
                                    <div className="modal-field">
                                        <label>Researcher's Comment:</label>
                                        <p className="researcher-comment">{selectedRevision.researcher_comment || 'No comment provided'}</p>
                                    </div>
                                    <div className="modal-field">
                                        <label>Submitted:</label>
                                        <p>{formatDateTime(selectedRevision.submitted_at)}</p>
                                    </div>
                                    {selectedRevision.new_file_url && (
                                        <div className="modal-field">
                                            <label>Revised File:</label>
                                            <a href={selectedRevision.new_file_url} target="_blank" rel="noopener noreferrer" className="file-link">
                                                <Paperclip size={16} /> Download Revised Paper
                                            </a>
                                        </div>
                                    )}
                                </div>

                                <div className="modal-row-two">
                                    <div className="modal-field-half">
                                        <label>Author:</label>
                                        <p>{selectedRevision.author || 'N/A'}</p>
                                    </div>
                                    <div className="modal-field-half">
                                        <label>Email:</label>
                                        <p>{selectedRevision.author_email || 'N/A'}</p>
                                    </div>
                                </div>
                                <div className="modal-row-two">
                                    <div className="modal-field-half">
                                        <label>Original Submission:</label>
                                        <p>{formatDate(selectedRevision.original_submission_date)}</p>
                                    </div>
                                    <div className="modal-field-half">
                                        <label>HRU Number:</label>
                                        <p>{selectedRevision.hru_no || 'N/A'}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="modal-footer">
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

export default EvaluatorDashboard;