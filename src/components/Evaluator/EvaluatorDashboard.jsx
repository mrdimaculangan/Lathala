import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import { FileText, Paperclip, CheckCircle, XCircle, Clock } from 'lucide-react';
import Navbar from "./EvaluatorNavbar";
import "./EvaluatorDashboard.css";

async function fetchResearches() {
  const { data, error } = await supabase
    .from('research_with_authors')
    .select('*');
  
  if (error) {
    console.error('Error fetching researches:', error);
    return [];
  }
  
  // Format with consistent property names
  const formattedData = data.map(research => ({
    ...research,
    author: research.author_name || 'Unknown Author',
    author_email: research.author_email || 'No email',
  }));
  
  return formattedData;
}

function EvaluatorDashboard() {
    const navigate = useNavigate();
    const [researches, setResearches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentDate, setCurrentDate] = useState(new Date());

    const [selectedResearch, setSelectedResearch] = useState(null);
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        loadResearches();
    }, []);

    async function loadResearches() {
        setLoading(true);
        const data = await fetchResearches();
        setResearches(data);
        setLoading(false);
    }

    

    const getStatusBadge = (status) => {
        // Convert to lowercase for case-insensitive comparison
        const normalizedStatus = status?.toLowerCase() || 'pending';
        
        switch(normalizedStatus) {
            case 'pending':
                return <span className="status-badge status-pending">
                    <Clock size={14} className="status-icon" /> Pending
                </span>;
            case 'reviewed':
                return <span className="status-badge status-reviewed">
                    <FileText size={14} className="status-icon" /> Reviewed
                </span>;
            case 'approved':
                return <span className="status-badge status-approved">
                    <CheckCircle size={14} className="status-icon" /> Approved
                </span>;
            case 'rejected':
                return <span className="status-badge status-rejected">
                    <XCircle size={14} className="status-icon" /> Rejected
                </span>;
            case 'minor_revision':
                return <span className="status-badge status-revision">
                    <FileText size={14} className="status-icon" /> Needs Minor Revision
                </span>;
            case 'major_revision':
                return <span className="status-badge status-revision">
                    <FileText size={14} className="status-icon" /> Needs Major Revision
                </span>;
            default:
                // If status exists but doesn't match any case, display it as-is
                if (status) {
                    return <span className="status-badge status-pending">
                        {status}
                    </span>;
                }
                return <span className="status-badge status-pending">
                    <Clock size={14} className="status-icon" /> Pending
                </span>;
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    // Handling the research clicks
    const handleResearchClick = (research) => {
        setSelectedResearch(research); 
        setShowModal(true);
    };

    const handleEvaluate = () => {
        setShowModal(false); 
        navigate(`/evaluate-research/${selectedResearch.research_id || selectedResearch.id}`);
    };

    const closeModal = () => {
        setShowModal(false);
        setSelectedResearch(null);
    };


    const pendingResearches = researches.filter(research => {
        const status = research.status?.toLowerCase();
        return status === 'pending';
    });
    // Case-insensitive status counting
    const pendingCount = researches.filter(r => 
        r.status?.toLowerCase() === 'pending'
    ).length;

    const approvedCount = researches.filter(r => 
        r.status?.toLowerCase() === 'approved'
    ).length;

    const rejectedCount = researches.filter(r => 
        r.status?.toLowerCase() === 'rejected'
    ).length;

    // Optional: Add reviewed count if you use it
    const reviewedCount = researches.filter(r => 
        r.status?.toLowerCase() === 'reviewed'
    ).length;
        // Calendar generation
        const getDaysInMonth = (year, month) => {
            return new Date(year, month + 1, 0).getDate();
        };

    const getFirstDayOfMonth = (year, month) => {
        return new Date(year, month, 1).getDay();
    };

    const renderCalendar = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const daysInMonth = getDaysInMonth(year, month);
        const firstDay = getFirstDayOfMonth(year, month);
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        
        const days = [];
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
        }
        for (let i = 1; i <= daysInMonth; i++) {
            const isToday = i === new Date().getDate() && 
                           year === new Date().getFullYear() && 
                           month === new Date().getMonth();
            days.push(
                <div key={i} className={`calendar-day ${isToday ? 'today' : ''}`}>
                    {i}
                </div>
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
                    <div>S</div><div>M</div><div>T</div><div>W</div><div>T</div><div>F</div><div>S</div>
                </div>
                <div className="calendar-days">
                    {days}
                </div>
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
                            <span className="stat-number">
                                {researches.filter(r => r.status?.toLowerCase() === 'pending').length}
                            </span>
                        </div>
                        <div className="stat-item">
                            <CheckCircle size={45} className="research-icon" />
                            <span className="stat-label">APPROVED <br /> RESEARCHES</span>
                            <span className="stat-number">
                                {researches.filter(r => r.status?.toLowerCase() === 'approved').length}
                            </span>
                        </div>
                        <div className="stat-item">
                            <XCircle size={45} className="research-icon" />
                            <span className="stat-label">REJECTED <br /> RESEARCHES</span>
                            <span className="stat-number">
                                {researches.filter(r => r.status?.toLowerCase() === 'rejected').length}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Second Row: To Be Reviewed and Calendar */}
                <div className="second-row">
                    {/* Left: To Be Reviewed Section */}
                    <div className="review-section">
                    
                        <div className="recent-header">
                            <h1>Evaluation Queue</h1>
                            <p>Latest research added to the system.</p>
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
                                <div className="empty-state">No pending researches found</div>
                            ) : (
                                pendingResearches.slice(0, 5).map((research, index) => (
                                    <div 
                                        key={research.id || research.research_id} 
                                        className="table-row" 
                                        onClick={() => handleResearchClick(research)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <div className="hru-number">HRU-{String(index + 1).padStart(3, '0')}</div>
                                        <div className="research-title">{research.title}</div>
                                        <div>{getStatusBadge(research.status)}</div>
                                        <div>{formatDate(research.registration_date || research.submission_date)}</div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Right: Calendar Section */}
                    <div className="calendar-section">
                        {renderCalendar()}
                    </div>
                </div>


                {showModal && selectedResearch && (
                    <div className="modal-overlay" onClick={closeModal}>
                        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                            {/* Header with title and status */}
                            <div className="modal-header">
                                <div className="modal-title-section">
                                    <h2>Research Details</h2>
                                    <div className="modal-status">
                                        {getStatusBadge(selectedResearch.status)}
                                    </div>
                                </div>
                                <button className="modal-close" onClick={closeModal}>×</button>
                            </div>
                            
                            <div className="modal-body">
                                {/* 1st Row: Title */}
                                <div className="modal-field">
                                    <label>Title:</label>
                                    <b><p>{selectedResearch.title}</p></b>
                                </div>
                                
                                {/* 2nd Row: Description */}
                                <div className="modal-field">
                                    <label>Description:</label>
                                    <p>{selectedResearch.description || 'No description provided'}</p>
                                </div>
                                
                                {/* 3rd Row: Author and Submission Date (side by side) */}
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

                                {/* 4th Row: Email and HRU Number (side by side) */}
                                <div className="modal-row-two">
                                    <div className="modal-field-half">
                                        <label>Submission Date:</label>
                                        <p>{formatDate(selectedResearch.registration_date || selectedResearch.submission_date)}</p>
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