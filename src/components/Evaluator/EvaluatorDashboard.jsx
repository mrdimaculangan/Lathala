import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import { FileText, Paperclip, CheckCircle, XCircle, Clock } from 'lucide-react';
import Navbar from "./EvaluatorNavbar";
import "./EvaluatorDashboard.css";

function EvaluatorDashboard() {
    const navigate = useNavigate();
    const [researches, setResearches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedResearch, setSelectedResearch] = useState(null);
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        loadResearches();
    }, []);

    async function loadResearches() {
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

            // Step 3: Get only the research_ids assigned to this evaluator from Research_Queue
            const { data: queueData, error: queueError } = await supabase
                .from('Research_Queue')
                .select('research_id')
                .eq('evaluator_id', evaluatorId);

            if (queueError) {
                console.error('Error fetching queue:', queueError);
                setLoading(false);
                return;
            }

            if (!queueData || queueData.length === 0) {
                setResearches([]);
                setLoading(false);
                return;
            }

            const assignedResearchIds = queueData.map(q => q.research_id);

            // Step 4: Fetch only the assigned research with author details
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
                setLoading(false);
                return;
            }

            // Step 5: Format the data
            const formatted = (researchData || []).map(r => ({
                ...r,
                author: r.Researcher?.Users
                    ? `${r.Researcher.Users.first_name || ''} ${r.Researcher.Users.last_name || ''}`.trim()
                    : 'Unknown Author',
                author_email: r.Researcher?.Users?.email || 'No email',
            }));

            setResearches(formatted);
        } catch (err) {
            console.error('Unexpected error loading researches:', err);
        } finally {
            setLoading(false);
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

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric'
        });
    };

    const handleResearchClick = (research) => {
        setSelectedResearch(research);
        setShowModal(true);
    };

    const handleEvaluate = () => {
        setShowModal(false);
        navigate(`/evaluate-research/${selectedResearch.research_id}`);
    };

    const closeModal = () => {
        setShowModal(false);
        setSelectedResearch(null);
    };

    // Stat counts — scoped to assigned research only
    const pendingResearches = researches.filter(r => r.status?.toLowerCase() === 'pending');
    const approvedCount = researches.filter(r => r.status?.toLowerCase() === 'approved').length;
    const rejectedCount = researches.filter(r => r.status?.toLowerCase() === 'rejected').length;

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
                            <span className="stat-label">TOTAL <br /> RESEARCHES</span>
                            <span className="stat-number">{researches.length}</span>
                        </div>
                        <div className="stat-item">
                            <FileText size={45} className="research-icon" />
                            <span className="stat-label">PENDING <br /> RESEARCHES</span>
                            <span className="stat-number">{pendingResearches.length}</span>
                        </div>
                        <div className="stat-item">
                            <CheckCircle size={45} className="research-icon" />
                            <span className="stat-label">APPROVED <br /> RESEARCHES</span>
                            <span className="stat-number">{approvedCount}</span>
                        </div>
                        <div className="stat-item">
                            <XCircle size={45} className="research-icon" />
                            <span className="stat-label">REJECTED <br /> RESEARCHES</span>
                            <span className="stat-number">{rejectedCount}</span>
                        </div>
                    </div>
                </div>

                <div className="second-row">
                    <div className="review-section">
                        <div className="recent-header">
                            <h1>Evaluation Queue</h1>
                            <p>Research papers assigned to you for evaluation.</p>
                        </div>

                        <div className="submissions-table">
                            <div className="table-header">
                                <div>HRU NUMBER</div>
                                <div>RESEARCH TITLE</div>
                                <div>STATUS</div>
                                <div>DATE</div>
                            </div>

                            {loading ? (
                                <div className="loading-state">Loading...</div>
                            ) : pendingResearches.length === 0 ? (
                                <div className="empty-state">No pending research assigned to you.</div>
                            ) : (
                                pendingResearches.slice(0, 5).map((research) => (
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
                    </div>

                    <div className="calendar-section">
                        {renderCalendar()}
                    </div>
                </div>

                {showModal && selectedResearch && (
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
                                <button className="btn-evaluate" onClick={handleEvaluate}>Evaluate</button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

export default EvaluatorDashboard;
