import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {PlusCircle, FileText, X, Download, Paperclip, CheckCircle, XCircle} from "lucide-react";
import { supabase } from "../../supabaseClient.js";
import { UserAuth } from "../../context/AuthContext.jsx";
import Navbar from "./ResearcherNavbar";
import "./ResearcherDashboard.css";

// In the evaluator side, they call it "Researches" | here, it's "Studies"

export default function ResearcherDashboard() {
    const navigate = useNavigate();
    const {dbId} = UserAuth();
    const {firstName, lastName, session, userRole} = UserAuth();
    const authorName = firstName ? `${firstName} ${lastName}` : session?.user?.email;

    const [studies, setStudies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });

    const [selectedStudy, setSelectedStudy] = useState(null);
    const [studyDetails, setStudyDetails] = useState({coauthors: [], bio: null, dept: null, hraa: null});
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Calendar generation
    const [currentDate, setCurrentDate] = useState(new Date());
    const getDaysInMonth = (year, month) => {
        return new Date(year, month + 1, 0).getDate();
    };
    // NEW: Additional for the calendar hover kineme
    const [submissionDates, setSubmissionDates] = useState({});
    const [calendarModal, setCalendarModal] = useState(null);


    const getFirstDayOfMonth = (year, month) => {
        return new Date(year, month, 1).getDay();
    };

    // NEW: Render Calendar
    const renderCalendar = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const daysInMonth = getDaysInMonth(year, month);
        const firstDay = getFirstDayOfMonth(year, month);
        const monthNames = ['January','February','March','April','May','June',
            'July','August','September','October','November','December'];

        const days = [];
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
        }

        for (let i = 1; i <= daysInMonth; i++) {
            const isToday = i === new Date().getDate() &&
                year === new Date().getFullYear() &&
                month === new Date().getMonth();

            const mm = String(month + 1).padStart(2, '0');
            const dd = String(i).padStart(2, '0');
            const dateKey = `${year}-${mm}-${dd}`;
            const dayStudies = submissionDates[dateKey];
            const hasSubmissions = dayStudies && dayStudies.length > 0;

            days.push(
                <div
                    key={i}
                    className={`calendar-day ${isToday ? 'today' : ''} ${hasSubmissions ? 'has-submissions' : ''}`}
                    onClick={() => hasSubmissions && setCalendarModal({
                        date: new Date(year, month, i).toLocaleDateString('en-US', {
                            month: 'long', day: 'numeric', year: 'numeric'
                        }),
                        studies: dayStudies
                    })}
                    title={hasSubmissions ? `${dayStudies.length} submission(s)` : undefined}
                >
                    {i}
                    {hasSubmissions && (
                        <span className="calendar-dot">{dayStudies.length}</span>
                    )}
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
                <div className="calendar-days">{days}</div>
            </div>
        );
    };



        useEffect(() => {
            if (!dbId) {
                console.log("Waiting for dbId...");
                return;
            }

            async function fetchStudies() {
                try {
                    console.log("Fetching studies for ID:", dbId);
                    const {data, error} = await supabase
                        .from('Research')
                        .select(`
                        *,
                        research_files ( file_url, file_type )
                    `)
                        .eq('researcher_id', dbId)
                        .order('created_at', {ascending: false});

                    if (error) throw error;
                    setStudies(data || []);

                    const allStudies = data || [];
                    setStats({
                        total:    allStudies.length,
                        pending:  allStudies.filter(s => s.status?.trim() === 'Pending').length,
                        approved: allStudies.filter(s => s.status?.trim() === 'Approved').length,
                        rejected: allStudies.filter(s => s.status?.trim() === 'Rejected').length,
                    });

                    // NEW: Build submission date map
                    const dateMap = {};
                    (data || []).forEach(study => {
                        const dateKey = new Date(study.created_at).toISOString().split('T')[0];
                        if (!dateMap[dateKey]) dateMap[dateKey] = [];
                        dateMap[dateKey].push({
                            title: study.title,
                            created_at: study.created_at,
                            research_id: study.research_id,
                            status: study.status
                        });
                    });
                    setSubmissionDates(dateMap);
                } catch (error) {
                    console.error("Error fetching studies:", error.message);
                } finally {
                    setLoading(false);
                }
            }

            fetchStudies();
        }, [dbId]);

        const getCleanFileName = (url) => {
            if (!url) return "Unknown File";
            const parts = url.split('/');
            const fileWithTimestamp = parts[parts.length - 1];
            return fileWithTimestamp.split('_').slice(1).join('_') || fileWithTimestamp;
        };

        const handleStudyClick = async (study) => {
            setSelectedStudy(study);
            setIsModalOpen(true);

            try {
                const [coauthorsRes, bioRes, deptRes, hraaRes] = await Promise.all([
                    supabase.from('research_coauthors').select('*').eq('research_id', study.research_id),
                    study.bioinformatics_id ? supabase.from('Bioinformatics').select('*').eq('bioinformatics_id', study.bioinformatics_id).single() : Promise.resolve({data: null}),
                    study.department_id ? supabase.from('Department').select('*').eq('department_id', study.department_id).single() : Promise.resolve({data: null}),
                    study.hraa_id ? supabase.from('HRAAlignment').select('*').eq('hraa_id', study.hraa_id).single() : Promise.resolve({data: null})
                ]);

                setStudyDetails({
                    coauthors: coauthorsRes.data || [],
                    bio: bioRes.data,
                    dept: deptRes.data,
                    hraa: hraaRes.data
                });
            } catch (err) {
                console.error("Error fetching study details:", err);
            }
        };

        const closeModal = () => {
            setIsModalOpen(false);
            setSelectedStudy(null);
            setStudyDetails({coauthors: [], bio: null, dept: null, hraa: null});
        };

        return (
            <div className="dashboard-wrapper">
                <Navbar/>

                <main className="dashboard-container">
                    <div className="first-row">
                        <div className="title-section">
                            <h1>Researcher Dashboard</h1>
                            <p>Manage your current research or start a new project below.</p>
                            <button
                                className="add-study-btn"
                                onClick={() => navigate("/researcher-study")}
                            >
                                <PlusCircle size={20}/>
                                <span>Add New Study</span>
                            </button>
                        </div>

                        <div className="stats-group">
                            <div className="stat-item">
                                <Paperclip size={45} className="research-icon"/>
                                <div className="stat-text-group">
                                    <span className="stat-number">{stats.total}</span>
                                    <span className="stat-label">TOTAL<br/>RESEARCHES</span>
                                </div>
                            </div>
                            <div className="stat-item">
                                <FileText size={45} className="research-icon"/>
                                <div className="stat-text-group">
                                    <span className="stat-number">{stats.pending}</span>
                                    <span className="stat-label">PENDING<br/>RESEARCHES</span>
                                </div>
                            </div>
                            <div className="stat-item">
                                <CheckCircle size={45} className="research-icon"/>
                                <div className="stat-text-group">
                                    <span className="stat-number">{stats.approved}</span>
                                    <span className="stat-label">APPROVED<br/>RESEARCHES</span>
                                </div>
                            </div>
                            <div className="stat-item">
                                <XCircle size={45} className="research-icon"/>
                                <div className="stat-text-group">
                                    <span className="stat-number">{stats.rejected}</span>
                                    <span className="stat-label">REJECTED<br/>RESEARCHES</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* CURRENT RESEARCHES TABLE */}
                    <div className="second-row">
                        <div className="studies-section">
                            <h2>Your Current Researches</h2>

                            {loading ? (
                                <p className="loading-text">Loading your studies...</p>
                            ) : studies.length === 0 ? (
                                <div className="empty-state">
                                    <FileText size={40} color="#ccc"/>
                                    <p>You haven't added any studies yet.</p>
                                </div>
                            ) : (
                                <div className="table-responsive">
                                    {studies.map((study) => {
                                        const statusColor = {
                                            'Pending': { bg: '#fef9c3', text: '#854d0e', dot: '#eab308' },
                                            'Approved': { bg: '#dcfce7', text: '#166534', dot: '#22c55e' },
                                            'Rejected': { bg: '#fee2e2', text: '#991b1b', dot: '#ef4444' },
                                            'With Minor Revisions': { bg: '#dbeafe', text: '#1e40af', dot: '#3b82f6' },
                                            'With Major Revisions': { bg: '#ede9fe', text: '#5b21b6', dot: '#8b5cf6' },
                                        }[study.status] || { bg: '#f1f5f9', text: '#475569', dot: '#94a3b8' };

                                        return (
                                            <div key={study.research_id} className="study-card" onClick={() => handleStudyClick(study)}>
                                                <div className="study-card-header">
                                                <span className="status-badge" style={{ background: statusColor.bg, color: statusColor.text }}>
                                                <span className="status-dot" style={{ background: statusColor.dot }}></span>
                                                    {study.status}
                                                </span>
                                                    <span className="hru-label">{study.hru_no}</span>
                                                    <div className="file-type-pills">
                                                        {study.research_files?.map((f, i) => (
                                                            <span key={i} className="file-type-badge">{f.file_type}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="study-card-body">
                                                    <strong>{study.title}</strong>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Right: Calendar Section */}
                        <div className="calendar-section">
                            {renderCalendar()}
                        </div>
                    </div>
                </main>

                {/* STUDY DETAILS OVERLAY (MODAL) */}
                {isModalOpen && selectedStudy && (
                    <div className="modal-overlay" onClick={closeModal}>
                        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h2>{selectedStudy.title}</h2>
                                <div className="modal-header-actions">
                                    {selectedStudy.status?.replace(/"/g, '').trim() === 'Pending' && (
                                        <button
                                            className="edit-submission-btn"
                                            onClick={() => navigate(`/researcher-study/edit/${selectedStudy.research_id}`)}
                                        >
                                            Edit Submission
                                        </button>
                                    )}
                                    <button className="close-btn" onClick={closeModal}><X size={24}/></button>
                                </div>
                            </div>

                            <div className="modal-body">
                                <div className="detail-section">
                                    <h3>Research Information</h3>
                                    <div className="detail-grid">
                                        <div className="detail-item">
                                            <label>HRU No.</label>
                                            <p>{selectedStudy.hru_no}</p>
                                        </div>
                                        <div className="detail-item">
                                            <label>Registration Date</label>
                                            <p>{selectedStudy.registration_date}</p>
                                        </div>
                                        <div className="detail-item">
                                            <label>Department</label>
                                            <p>{studyDetails.dept ? studyDetails.dept.department_name : 'Loading...'}</p>
                                        </div>
                                        <div className="detail-item">
                                            <label>HRA Alignment</label>
                                            <p>{studyDetails.hraa ? studyDetails.hraa.hraa_category : 'Loading...'}</p>
                                        </div>
                                    </div>
                                    <div className="detail-item full-width">
                                        <label>Description</label>
                                        <p className="description-text">{selectedStudy.description}</p>
                                    </div>
                                </div>

                                <div className="detail-section">
                                    <h3>Credentials</h3>
                                    <div className="detail-grid">
                                        <div className="detail-item">
                                            <label>Primary Author</label>
                                            <p>{authorName}</p>
                                        </div>
                                        <div className="detail-item">
                                            <label>Co-Authors</label>
                                            <p>{studyDetails.coauthors.length > 0 ? studyDetails.coauthors.map(c => c.author_name).join(', ') : 'None'}</p>
                                        </div>
                                    </div>
                                </div>

                                {studyDetails.bio && (
                                    <div className="detail-section bioinformatics-section">
                                        <h3>Bioinformatics Details</h3>
                                        <div className="detail-grid">
                                            <div className="detail-item">
                                                <label>Organism Name</label>
                                                <p>{studyDetails.bio.organism_name || 'N/A'}</p>
                                            </div>
                                            <div className="detail-item">
                                                <label>Accession Number</label>
                                                <p>{studyDetails.bio.accession_number || 'N/A'}</p>
                                            </div>
                                            <div className="detail-item">
                                                <label>Sequence Type</label>
                                                <p>{studyDetails.bio.sequence_type || 'N/A'}</p>
                                            </div>
                                            <div className="detail-item">
                                                <label>Data Source</label>
                                                <p>{studyDetails.bio._data_source || 'N/A'}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="detail-section">
                                    <h3>Attached Files</h3>
                                    <div className="file-grid">
                                        {selectedStudy.research_files?.map((file, index) => (
                                            <a href={file.file_url} target="_blank" rel="noopener noreferrer"
                                               className="file-card" key={index}>
                                                <FileText size={24} className="file-icon"/>
                                                <div className="file-info">
                                                    <span className="fname"
                                                          title={getCleanFileName(file.file_url)}>{getCleanFileName(file.file_url)}</span>
                                                    <span className="ftype">{file.file_type}</span>
                                                </div>
                                                <Download size={18} className="download-icon"/>
                                            </a>
                                        ))}
                                        {(!selectedStudy.research_files || selectedStudy.research_files.length === 0) && (
                                            <p>No files attached.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {calendarModal && (
                    <div className="modal-overlay" onClick={() => setCalendarModal(null)}>
                        <div className="modal-content cal-modal" onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                                <h2>{calendarModal.date}</h2>
                                <button className="close-btn" onClick={() => setCalendarModal(null)}>
                                    <X size={24}/>
                                </button>
                            </div>
                            <div className="modal-body">
                                <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1rem' }}>
                                    {calendarModal.studies.length} submission(s) on this date
                                </p>
                                <div className="cal-study-list">
                                    {calendarModal.studies.map((s, i) => (
                                        <div key={i} className="cal-study-item">
                                            <div className="cal-study-info">
                                                <strong>{s.title}</strong>
                                                <span className="cal-study-time">
                                    {new Date(s.created_at).toLocaleTimeString('en-US', {
                                        hour: '2-digit', minute: '2-digit'
                                    })}
                                </span>
                                            </div>
                                            <span className="status-badge" style={{
                                                background: {
                                                    'Pending': '#fef9c3', 'Approved': '#dcfce7',
                                                    'Rejected': '#fee2e2'
                                                }[s.status] || '#f1f5f9',
                                                color: {
                                                    'Pending': '#854d0e', 'Approved': '#166534',
                                                    'Rejected': '#991b1b'
                                                }[s.status] || '#475569',
                                                fontSize: '0.7rem', padding: '3px 10px',
                                                borderRadius: '999px', fontWeight: 700
                                            }}>
                                {s.status}
                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }