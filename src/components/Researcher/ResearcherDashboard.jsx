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

    const [selectedStudy, setSelectedStudy] = useState(null);
    const [studyDetails, setStudyDetails] = useState({coauthors: [], bio: null, dept: null, hraa: null});
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Calendar generation
    const [currentDate, setCurrentDate] = useState(new Date());
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
                                <span className="stat-label">TOTAL <br/> RESEARCHES</span>
                            </div>
                            <div className="stat-item">
                                <FileText size={45} className="research-icon"/>
                                <span className="stat-label">PENDING <br/> RESEARCHES</span>
                            </div>
                            <div className="stat-item">
                                <CheckCircle size={45} className="research-icon"/>
                                <span className="stat-label">APPROVED <br/> RESEARCHES</span>
                            </div>
                            <div className="stat-item">
                                <XCircle size={45} className="research-icon"/>
                                <span className="stat-label">REJECTED <br/> RESEARCHES</span>
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
                                    <table className="studies-table">
                                        <thead>
                                        <tr>
                                            <th>Research Title</th>
                                            <th>File Name</th>
                                            <th>File Type</th>
                                        </tr>
                                        </thead>
                                        <tbody>
                                        {studies.map((study) => (
                                            <tr key={study.research_id} onClick={() => handleStudyClick(study)}
                                                className="clickable-row">
                                                <td className="title-cell">
                                                    <strong>{study.title}</strong>
                                                    <span className="hru-badge">{study.hru_no}</span>
                                                </td>
                                                <td>
                                                    {study.research_files?.map((f, i) => (
                                                        <div key={i}
                                                             className="file-list-item">{getCleanFileName(f.file_url)}</div>
                                                    ))}
                                                </td>
                                                <td>
                                                    {study.research_files?.map((f, i) => (
                                                        <div key={i} className="file-type-badge">{f.file_type}</div>
                                                    ))}
                                                </td>
                                            </tr>
                                        ))}
                                        </tbody>
                                    </table>
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
                                <button className="close-btn" onClick={closeModal}><X size={24}/></button>
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
            </div>
        );
    }