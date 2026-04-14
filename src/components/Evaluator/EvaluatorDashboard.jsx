import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import { FileText, Paperclip, CheckCircle, XCircle, Clock } from 'lucide-react';
import Navbar from "./EvaluatorNavbar";
import "./EvaluatorDashboard.css";

async function fetchResearches() {
  const { data, error } = await supabase
    .from('Research')
    .select('*');
  
  if (error) {
    console.error('Error fetching researches:', error);
    return [];
  }
  
  console.log('Available columns:', Object.keys(data[0] || {}));
  return data;
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
        switch(status) {
            case 'pending':
                return <span className="status-badge status-pending">Pending</span>;
            case 'reviewed':
                return <span className="status-badge status-reviewed">Reviewed</span>;
            case 'approved':
                return <span className="status-badge status-approved">Approved</span>;
            case 'rejected':
                return <span className="status-badge status-rejected">Rejected</span>;
            default:
                return <span className="status-badge status-pending">Pending</span>;
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


    const filteredResearches = researches.filter(research => {
        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            return research.title.toLowerCase().includes(searchLower) ||
                   research.author.toLowerCase().includes(searchLower);
        }
        return true;
    });

    const pendingCount = researches.filter(r => r.status === 'pending').length;
    const approvedCount = researches.filter(r => r.status === 'approved').length;
    const rejectedCount = researches.filter(r => r.status === 'rejected').length;

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
                {/* First Row: Title and Stats - Centered together */}
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
                            <span className="stat-number">{pendingCount}</span>
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
                            ) : filteredResearches.length === 0 ? (
                                <div className="empty-state">No researches found</div>
                            ) : (
                                filteredResearches.slice(0, 5).map((research, index) => (
                                    <div 
                                        key={research.id} 
                                        className="table-row" 
                                        onClick={() => handleResearchClick(research)} // Pass the whole research object
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
                        
                        <div className="upcoming-deadlines">
                            <h3>UPCOMING DEADLINES</h3>
                            
                        </div>
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
                                        <label>Submission Date:</label>
                                        <p>{formatDate(selectedResearch.registration_date || selectedResearch.submission_date)}</p>
                                    </div>
                                </div>
                                
                                {/* 4th Row: HRU Number */}
                                <div className="modal-field">
                                    <label>HRU Number:</label>
                                    <p>{selectedResearch.hru_no || 'N/A'}</p>
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