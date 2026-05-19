import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PlusCircle, FileText, X, Download, Paperclip, CheckCircle, XCircle } from "lucide-react";
import { supabase } from "../../supabaseClient.js";
import { UserAuth } from "../../context/AuthContext.jsx";
import Navbar from "./ResearcherNavbar";
import "./ResearcherDashboard.css";

export default function ResearcherDashboard() {
    const navigate = useNavigate();
    const { dbId } = UserAuth();
    const { firstName, lastName, session } = UserAuth();
    const authorName = firstName ? `${firstName} ${lastName}` : session?.user?.email;

    useEffect(() => {
        const originalBodyOverflow = document.body.style.overflow;
        const originalHtmlOverflow = document.documentElement.style.overflow;
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = originalBodyOverflow;
            document.documentElement.style.overflow = originalHtmlOverflow;
        };
    }, []);

    // Stats (derived from Research table)
    const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });

    // Activity log rows (from ResearchActivityLog, joined with Research)
    const [activityLogs, setActivityLogs] = useState([]);
    const [loadingLogs, setLoadingLogs] = useState(true);
    const [researches, setResearches] = useState([]);

    // Revision counts per research
    const [revisionCounts, setRevisionCounts] = useState({});

    // Modal for study details
    const [selectedStudy, setSelectedStudy] = useState(null);
    const [selectedLogEntry, setSelectedLogEntry] = useState(null); // Track which log was clicked
    const [studyDetails, setStudyDetails] = useState({ coauthors: [], bio: null, dept: null, hraa: null });
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Calendar
    const [currentDate, setCurrentDate] = useState(new Date());
    const [submissionDates, setSubmissionDates] = useState({});
    const [calendarModal, setCalendarModal] = useState(null);

    const getDaysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
    const getFirstDayOfMonth = (y, m) => new Date(y, m, 1).getDay();

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
            const mm = String(month + 1).padStart(2, '0');
            const dd = String(i).padStart(2, '0');
            const key = `${year}-${mm}-${dd}`;
            const dayStudies = submissionDates[key];
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
                    {hasSubmissions && <span className="calendar-dot">{dayStudies.length}</span>}
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
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={i}>{d}</div>)}
                </div>
                <div className="calendar-days">{days}</div>
            </div>
        );
    };

    // ── Main data fetch ───────────────────────────────────────────
    useEffect(() => {
        if (!dbId) return;

        async function fetchData() {
            setLoadingLogs(true);

            // 1. Fetch all researches
            const { data: researchData, error: researchError } = await supabase
                .from('Research')
                .select(`*`)
                .eq('researcher_id', dbId)
                .order('created_at', { ascending: false });

            if (researchError) {
                console.error("❌ Error fetching researches:", researchError.message);
                setLoadingLogs(false);
                return;
            }

            // 2. Get latest file for each research (for the "no logs" fallback)
            const researchesWithLatestFiles = await Promise.all(
                (researchData || []).map(async (research) => {
                    const { data: latestRevision } = await supabase
                        .from('ResearchRevisions')
                        .select('new_file_url')
                        .eq('research_id', research.research_id)
                        .order('submitted_at', { ascending: false })
                        .limit(1);

                    let latestFiles = [];

                    if (latestRevision && latestRevision.length > 0 && latestRevision[0].new_file_url) {
                        latestFiles = [{
                            file_url: latestRevision[0].new_file_url,
                            file_type: "Research Paper"
                        }];
                    } else {
                        const { data: originalFiles } = await supabase
                            .from('research_files')
                            .select('file_url, file_type')
                            .eq('research_id', research.research_id);
                        latestFiles = originalFiles || [];
                    }

                    return {
                        ...research,
                        research_files: latestFiles
                    };
                })
            );

            setResearches(researchesWithLatestFiles);
            const all = researchesWithLatestFiles;

            // 3. Calculate stats
            const clean = (s) => s?.replace(/"/g, '').trim();
            setStats({
                total: all.length,
                pending: all.filter(s => clean(s.status) === 'Pending').length,
                approved: all.filter(s => clean(s.status) === 'Approved').length,
                rejected: all.filter(s => clean(s.status) === 'Rejected').length,
            });

            // 4. Calculate revision counts
            if (all.length > 0) {
                const { data: revData } = await supabase
                    .from('ResearchRevisions')
                    .select('research_id')
                    .in('research_id', all.map(s => s.research_id));

                const revCounts = {};
                (revData || []).forEach(r => {
                    revCounts[r.research_id] = (revCounts[r.research_id] || 0) + 1;
                });
                setRevisionCounts(revCounts);
            }

            // 5. Build calendar date map
            const dateMap = {};
            all.forEach(study => {
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

            // 6. Fetch activity logs with file info per log
            let logData = []; // Declare logData outside the if block

            if (all.length > 0) {
                const { data: fetchedLogs, error: logError } = await supabase
                    .from('ResearchActivityLog')
                    .select(`
                *,
                Research (
                    research_id,
                    title,
                    hru_no,
                    status,
                    description,
                    researcher_id,
                    bioinformatics_id,
                    department_id,
                    hraa_id,
                    registration_date
                )
            `)
                    .in('research_id', all.map(s => s.research_id))
                    .order('created_at', { ascending: false });

                if (!logError && fetchedLogs) {
                    logData = fetchedLogs;

                    // For each log, find the file that was submitted at that time
                    const logsWithFiles = await Promise.all(
                        logData.map(async (log) => {
                            let fileUrl = null;
                            let fileType = null;

                            if (log.action === 'submitted') {
                                // Original submission - get original file
                                const { data: originalFile } = await supabase
                                    .from('research_files')
                                    .select('file_url, file_type')
                                    .eq('research_id', log.research_id)
                                    .maybeSingle();

                                if (originalFile) {
                                    fileUrl = originalFile.file_url;
                                    fileType = originalFile.file_type;
                                }
                            } else if (log.action === 'revision_submitted') {
                                // Find the revision submitted closest to this log's date
                                const { data: revision } = await supabase
                                    .from('ResearchRevisions')
                                    .select('new_file_url, revision_type, submitted_at')
                                    .eq('research_id', log.research_id)
                                    .lte('submitted_at', log.created_at)
                                    .order('submitted_at', { ascending: false })
                                    .limit(1);

                                if (revision && revision.length > 0 && revision[0].new_file_url) {
                                    fileUrl = revision[0].new_file_url;
                                    fileType = "Research Paper";
                                }
                            }

                            return {
                                ...log,
                                display_file_url: fileUrl,
                                display_file_type: fileType
                            };
                        })
                    );

                    setActivityLogs(logsWithFiles);
                }
            }

            // 7. If there are researches with NO activity logs at all, create virtual log entries for them
            if (all.length > 0 && (!logData || logData.length === 0)) {
                console.log("📋 No activity logs found, creating virtual logs from researches");

                // Create virtual log entries for researches without any activity
                const virtualLogs = await Promise.all(
                    all.map(async (research) => {
                        // Get the original file for this research
                        let fileUrl = null;
                        let fileType = null;

                        const { data: originalFile } = await supabase
                            .from('research_files')
                            .select('file_url, file_type')
                            .eq('research_id', research.research_id)
                            .maybeSingle();

                        if (originalFile) {
                            fileUrl = originalFile.file_url;
                            fileType = originalFile.file_type;
                        } else {
                            // Check if there's a revision file
                            const { data: revision } = await supabase
                                .from('ResearchRevisions')
                                .select('new_file_url')
                                .eq('research_id', research.research_id)
                                .order('submitted_at', { ascending: false })
                                .limit(1);

                            if (revision && revision.length > 0) {
                                fileUrl = revision[0].new_file_url;
                                fileType = "Research Paper";
                            }
                        }

                        return {
                            log_id: `virtual_${research.research_id}`,
                            research_id: research.research_id,
                            action: 'submitted',
                            action_display: 'Submitted',
                            created_at: research.created_at,
                            status_snapshot: research.status,
                            Research: research,
                            display_file_url: fileUrl,
                            display_file_type: fileType,
                            is_virtual: true
                        };
                    })
                );

                // Sort by created_at descending
                virtualLogs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                setActivityLogs(virtualLogs);
            }

            setLoadingLogs(false);
        }

        fetchData();
    }, [dbId]);

    // ── Helpers ───────────────────────────────────────────────────
    const getCleanFileName = (url) => {
        if (!url) return "Unknown File";
        const parts = url.split('/');
        const fileWithTimestamp = parts[parts.length - 1];
        return decodeURIComponent(fileWithTimestamp.split('_').slice(1).join('_') || fileWithTimestamp);
    };

    const handleStudyClick = async (study, logEntry = null) => {
        console.log("🔍 Modal: Selected study:", study?.research_id, study?.title);
        console.log("🔍 Modal: Log entry:", logEntry?.log_id, logEntry?.action);

        setIsModalOpen(true);
        setSelectedLogEntry(logEntry);

        try {
            let fileToShow = [];

            // Determine which file to show based on the log entry
            if (logEntry && logEntry.action === 'revision_submitted' && logEntry.display_file_url) {
                // Use the file from the log entry
                fileToShow = [{
                    file_url: logEntry.display_file_url,
                    file_type: logEntry.display_file_type || "Research Paper"
                }];
                console.log("✅ Modal: Using revision file from log:", logEntry.display_file_url);
            } else if (logEntry && logEntry.action === 'submitted' && logEntry.display_file_url) {
                // Use the original submission file
                fileToShow = [{
                    file_url: logEntry.display_file_url,
                    file_type: logEntry.display_file_type || "Research Paper"
                }];
                console.log("✅ Modal: Using original file from log:", logEntry.display_file_url);
            } else {
                // Fallback: get latest revision or original file
                const { data: latestRevision } = await supabase
                    .from('ResearchRevisions')
                    .select('new_file_url')
                    .eq('research_id', study.research_id)
                    .order('submitted_at', { ascending: false })
                    .limit(1);

                if (latestRevision && latestRevision.length > 0 && latestRevision[0].new_file_url) {
                    fileToShow = [{
                        file_url: latestRevision[0].new_file_url,
                        file_type: "Research Paper"
                    }];
                } else {
                    const { data: originalFiles } = await supabase
                        .from('research_files')
                        .select('file_url, file_type')
                        .eq('research_id', study.research_id);
                    fileToShow = originalFiles || [];
                }
            }

            // Update the study object with the correct files
            const updatedStudy = {
                ...study,
                research_files: fileToShow
            };

            setSelectedStudy(updatedStudy);

            // Fetch other details (coauthors, bio, dept, hraa)
            const [coauthorsRes, bioRes, deptRes, hraaRes] = await Promise.all([
                supabase.from('research_coauthors').select('*').eq('research_id', study.research_id),
                study.bioinformatics_id
                    ? supabase.from('Bioinformatics').select('*').eq('bioinformatics_id', study.bioinformatics_id).single()
                    : Promise.resolve({ data: null }),
                study.department_id
                    ? supabase.from('Department').select('*').eq('department_id', study.department_id).single()
                    : Promise.resolve({ data: null }),
                study.hraa_id
                    ? supabase.from('HRAAlignment').select('*').eq('hraa_id', study.hraa_id).single()
                    : Promise.resolve({ data: null }),
            ]);

            setStudyDetails({
                coauthors: coauthorsRes.data || [],
                bio: bioRes.data,
                dept: deptRes.data,
                hraa: hraaRes.data,
            });

        } catch (err) {
            console.error("Error fetching study details:", err);
        }
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setSelectedStudy(null);
        setSelectedLogEntry(null);
        setStudyDetails({ coauthors: [], bio: null, dept: null, hraa: null });
    };

    // Helper to get files for a log entry (for displaying in the card)
    const getDisplayFilesForLog = (log) => {
        if (log.action === 'revision_submitted' && log.display_file_url) {
            return [{
                file_url: log.display_file_url,
                file_type: log.display_file_type || "Research Paper"
            }];
        } else if (log.action === 'submitted' && log.display_file_url) {
            return [{
                file_url: log.display_file_url,
                file_type: log.display_file_type || "Research Paper"
            }];
        }
        return [];
    };

    return (
        <div className="dashboard-wrapper">
            <Navbar />

            <main className="dashboard-container">
                {/* ── Top row ── */}
                <div className="first-row">
                    <div className="title-section">
                        <h1>Researcher Dashboard</h1>
                        <p>Manage your current research or start a new project below.</p>
                        <button className="add-study-btn" onClick={() => navigate("/researcher-study")}>
                            <PlusCircle size={20} />
                            <span>Add New Study</span>
                        </button>
                    </div>

                    <div className="stats-group">
                        <div className="stat-item">
                            <Paperclip size={45} className="research-icon" />
                            <div className="stat-text-group">
                                <span className="stat-number">{stats.total}</span>
                                <span className="stat-label">TOTAL<br />RESEARCHES</span>
                            </div>
                        </div>
                        <div className="stat-item">
                            <FileText size={45} className="research-icon" />
                            <div className="stat-text-group">
                                <span className="stat-number">{stats.pending}</span>
                                <span className="stat-label">PENDING<br />RESEARCHES</span>
                            </div>
                        </div>
                        <div className="stat-item">
                            <CheckCircle size={45} className="research-icon" />
                            <div className="stat-text-group">
                                <span className="stat-number">{stats.approved}</span>
                                <span className="stat-label">APPROVED<br />RESEARCHES</span>
                            </div>
                        </div>
                        <div className="stat-item">
                            <XCircle size={45} className="research-icon" />
                            <div className="stat-text-group">
                                <span className="stat-number">{stats.rejected}</span>
                                <span className="stat-label">REJECTED<br />RESEARCHES</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Second row ── */}
                <div className="second-row">
                    <div className="studies-section">
                        <h2>Revision Activity</h2>

                        {loadingLogs ? (
                            <p className="loading-text">Loading activity...</p>
                        ) : activityLogs.length === 0 ? (
                            // If no logs but there are researches, show them directly
                            researches?.length > 0 ? (
                                <div className="table-responsive">
                                    {researches.map((study) => {
                                        const status = study.status?.replace(/"/g, '').trim() || 'Pending';
                                        const statusColor = {
                                            'Pending': { bg: '#fef9c3', text: '#854d0e', dot: '#eab308' },
                                            'Approved': { bg: '#dcfce7', text: '#166534', dot: '#22c55e' },
                                            'Rejected': { bg: '#fee2e2', text: '#991b1b', dot: '#ef4444' },
                                            'With Minor Revisions': { bg: '#dbeafe', text: '#1e40af', dot: '#3b82f6' },
                                            'With Major Revisions': { bg: '#ede9fe', text: '#5b21b6', dot: '#8b5cf6' },
                                        }[status] || { bg: '#f1f5f9', text: '#475569', dot: '#94a3b8' };

                                        return (
                                            <div
                                                key={study.research_id}
                                                className="study-card"
                                                onClick={() => handleStudyClick(study, null)}
                                            >
                                                <div className="study-card-header">
                                                    <span className="status-badge" style={{ background: statusColor.bg, color: statusColor.text }}>
                                                        <span className="status-dot" style={{ background: statusColor.dot }} />
                                                        {status}
                                                    </span>
                                                    <span className="hru-label">{study.hru_no}</span>
                                                    <div className="file-type-pills">
                                                        {study.research_files?.map((f, i) => (
                                                            <span key={i} className="file-type-badge">{f.file_type}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="study-card-body">
                                                    <strong>{study.title || 'Untitled'}</strong>
                                                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic', marginTop: '2px', display: 'block' }}>
                                                        Submitted · {new Date(study.created_at).toLocaleDateString('en-US', {
                                                            month: 'short', day: 'numeric', year: 'numeric'
                                                        })}
                                                    </span>
                                                </div>
                                                {revisionCounts[study.research_id] > 0 && (
                                                    <span style={{
                                                        fontSize: '0.7rem', background: '#e0e7ff', color: '#3730a3',
                                                        padding: '2px 8px', borderRadius: '999px', fontWeight: 600,
                                                        marginTop: '4px', width: 'fit-content', display: 'block'
                                                    }}>
                                                        v{revisionCounts[study.research_id] + 1} · {revisionCounts[study.research_id]} revision{revisionCounts[study.research_id] > 1 ? 's' : ''}
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="empty-state">
                                    <FileText size={40} color="#ccc" />
                                    <p>No activity yet. Submit a study to get started.</p>
                                </div>
                            )
                        ) : (
                            <div className="table-responsive">
                                {activityLogs.map((log) => {
                                    const study = log.Research;
                                    const status = log.status_snapshot?.trim()
                                        || study?.status?.replace(/"/g, '').trim()
                                        || '';
                                    const statusColor = {
                                        'Pending': { bg: '#fef9c3', text: '#854d0e', dot: '#eab308' },
                                        'Approved': { bg: '#dcfce7', text: '#166534', dot: '#22c55e' },
                                        'Rejected': { bg: '#fee2e2', text: '#991b1b', dot: '#ef4444' },
                                        'With Minor Revisions': { bg: '#dbeafe', text: '#1e40af', dot: '#3b82f6' },
                                        'With Major Revisions': { bg: '#ede9fe', text: '#5b21b6', dot: '#8b5cf6' },
                                    }[status] || { bg: '#f1f5f9', text: '#475569', dot: '#94a3b8' };

                                    // Get the specific files for this log entry
                                    const displayFiles = getDisplayFilesForLog(log);

                                    return (
                                        <div
                                            key={log.log_id}
                                            className="study-card"
                                            onClick={() => handleStudyClick(study, log)}
                                        >
                                            <div className="study-card-header">
                                                <span className="status-badge" style={{ background: statusColor.bg, color: statusColor.text }}>
                                                    <span className="status-dot" style={{ background: statusColor.dot }} />
                                                    {status || 'Unknown'}
                                                </span>
                                                <span className="hru-label">{study?.hru_no}</span>
                                                <div className="file-type-pills">
                                                    {displayFiles.map((f, i) => (
                                                        <span key={i} className="file-type-badge">{f.file_type}</span>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="study-card-body">
                                                <strong>{study?.title || 'Untitled'}</strong>
                                                <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic', marginTop: '2px', display: 'block' }}>
                                                    {log.action?.replace(/_/g, ' ')} · {new Date(log.created_at).toLocaleDateString('en-US', {
                                                        month: 'short', day: 'numeric', year: 'numeric'
                                                    })}
                                                </span>
                                            </div>
                                            {log.action === 'revision_submitted' && (
                                                <span style={{
                                                    fontSize: '0.7rem', background: '#e0e7ff', color: '#3730a3',
                                                    padding: '2px 8px', borderRadius: '999px', fontWeight: 600,
                                                    marginTop: '4px', width: 'fit-content', display: 'block'
                                                }}>
                                                    Revision Submitted
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="calendar-section">
                        {renderCalendar()}
                    </div>
                </div>
            </main>

            {/* ── Study details modal ── */}
            {isModalOpen && selectedStudy && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{selectedStudy.title}</h2>
                            <div className="modal-header-actions">
                                <button
                                    className="view-log-btn"
                                    onClick={() => { closeModal(); navigate('/researcher-activity-log'); }}
                                >
                                    View in Activity Log
                                </button>
                                <button className="close-btn" onClick={closeModal}><X size={24} /></button>
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
                                        <p>{studyDetails.coauthors.length > 0
                                            ? studyDetails.coauthors.map(c => c.author_name).join(', ')
                                            : 'None'}
                                        </p>
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
                                    {selectedStudy.research_files && selectedStudy.research_files.length > 0 ? (
                                        selectedStudy.research_files.map((file, index) => (
                                            <a
                                                key={index}
                                                href={file.file_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="file-card"
                                            >
                                                <FileText size={24} className="file-icon" />
                                                <div className="file-info">
                                                    <span className="fname" title={getCleanFileName(file.file_url)}>
                                                        {getCleanFileName(file.file_url)}
                                                    </span>
                                                    <span className="ftype">{file.file_type}</span>
                                                </div>
                                                <Download size={18} className="download-icon" />
                                            </a>
                                        ))
                                    ) : (
                                        <p>No files attached.</p>
                                    )}
                                </div>
                                {selectedLogEntry && selectedLogEntry.action === 'revision_submitted' && (
                                    <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.75rem', fontStyle: 'italic' }}>
                                        This file was submitted as part of a revision on {new Date(selectedLogEntry.created_at).toLocaleDateString()}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Calendar modal ── */}
            {calendarModal && (
                <div className="modal-overlay" onClick={() => setCalendarModal(null)}>
                    <div className="modal-content cal-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{calendarModal.date}</h2>
                            <button className="close-btn" onClick={() => setCalendarModal(null)}>
                                <X size={24} />
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
                                            background: { 'Pending': '#fef9c3', 'Approved': '#dcfce7', 'Rejected': '#fee2e2' }[s.status] || '#f1f5f9',
                                            color: { 'Pending': '#854d0e', 'Approved': '#166534', 'Rejected': '#991b1b' }[s.status] || '#475569',
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