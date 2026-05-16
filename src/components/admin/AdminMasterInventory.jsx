import React, { useState, useEffect } from "react";
import { supabase } from "../../supabaseClient";
import { Search, Filter, Eye, X, FileText, Download, Users, Calendar, CheckCircle, XCircle, Clock } from 'lucide-react';
import AdminNavbar from "./AdminNavbar";
import "./AdminMasterInventory.css";

const ITEMS_PER_PAGE = 10;

export default function AdminMasterInventory() {
    const [researches, setResearches] = useState([]);
    const [filteredResearches, setFilteredResearches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedStudy, setSelectedStudy] = useState(null);
    const [studyDetails, setStudyDetails] = useState({
        coauthors: [], bio: null, dept: null, hraa: null, files: [], evaluations: []
    });
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        loadMasterData();
    }, []);

    useEffect(() => {
        let result = [...researches];

        if (filterStatus !== 'all') {
            result = result.filter(r => {
                if (filterStatus === 'approved') return r.current_status === 'approved';
                if (filterStatus === 'rejected') return r.current_status === 'rejected';
                if (filterStatus === 'minor_revision') return r.current_status === 'minor_revision';
                if (filterStatus === 'major_revision') return r.current_status === 'major_revision';
                return true;
            });
        }

        if (searchTerm) {
            result = result.filter(r =>
                r.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                r.researcher_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                r.hru_no?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                r.evaluators?.some(e => e.name?.toLowerCase().includes(searchTerm.toLowerCase()))
            );
        }

        setFilteredResearches(result);
        setCurrentPage(1);
    }, [searchTerm, filterStatus, researches]);

    const totalPages = Math.ceil(filteredResearches.length / ITEMS_PER_PAGE);
    const paginatedResearches = filteredResearches.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    async function loadMasterData() {
        setLoading(true);
        try {
            // Step 1: Get all Evaluation_Research entries
            const { data: evaluationsData, error: evalError } = await supabase
                .from('Evaluation_Research')
                .select('*')
                .order('evaluated_at', { ascending: false });

            if (evalError) throw evalError;

            if (!evaluationsData || evaluationsData.length === 0) {
                setResearches([]);
                setLoading(false);
                return;
            }

            // Step 2: Get unique research IDs
            const researchIds = [...new Set(evaluationsData.map(er => er.research_id))];

            // Step 3: Get research details with author info
            const { data: researchData, error: researchError } = await supabase
                .from('Research')
                .select(`
                    *,
                    Researcher (
                        researcher_id,
                        user_id
                    )
                `)
                .in('research_id', researchIds);

            if (researchError) throw researchError;

            // Step 4: Get all researcher user details
            const researcherIds = researchData.map(r => r.Researcher?.user_id).filter(id => id);
            let researcherUsersMap = {};

            if (researcherIds.length > 0) {
                const { data: usersData, error: usersError } = await supabase
                    .from('Users')
                    .select('user_id, first_name, last_name, email')
                    .in('user_id', researcherIds);

                if (!usersError && usersData) {
                    researcherUsersMap = {};
                    usersData.forEach(user => {
                        researcherUsersMap[user.user_id] = user;
                    });
                }
            }

            // Step 5: Get all evaluator details
            const evaluatorIds = [...new Set(evaluationsData.map(er => er.evaluator_id).filter(id => id))];
            let evaluatorUsersMap = {};

            if (evaluatorIds.length > 0) {
                const { data: evaluatorsData, error: evaluatorsError } = await supabase
                    .from('Evaluator')
                    .select('evaluator_id, user_id')
                    .in('evaluator_id', evaluatorIds);

                if (!evaluatorsError && evaluatorsData) {
                    const userIds = evaluatorsData.map(ev => ev.user_id).filter(id => id);

                    if (userIds.length > 0) {
                        const { data: usersData, error: usersError } = await supabase
                            .from('Users')
                            .select('user_id, first_name, last_name, email')
                            .in('user_id', userIds);

                        if (!usersError && usersData) {
                            const userMap = {};
                            usersData.forEach(user => {
                                userMap[user.user_id] = user;
                            });

                            evaluatorsData.forEach(ev => {
                                if (userMap[ev.user_id]) {
                                    evaluatorUsersMap[ev.evaluator_id] = userMap[ev.user_id];
                                }
                            });
                        }
                    }
                }
            }

            // Step 6: Group evaluations by research_id
            const evaluationsByResearch = {};
            evaluationsData.forEach(evaluation => {
                if (!evaluationsByResearch[evaluation.research_id]) {
                    evaluationsByResearch[evaluation.research_id] = [];
                }

                const evaluatorUser = evaluatorUsersMap[evaluation.evaluator_id];
                let evaluatorName = evaluation.evaluator_name;
                let evaluatorEmail = evaluation.evaluator_email;

                if (evaluatorUser) {
                    evaluatorName = `${evaluatorUser.first_name} ${evaluatorUser.last_name}`;
                    evaluatorEmail = evaluatorUser.email;
                }

                evaluationsByResearch[evaluation.research_id].push({
                    id: evaluation.evaluator_id,
                    name: evaluatorName || 'Unknown Evaluator',
                    email: evaluatorEmail || 'No email',
                    recommendation: evaluation.overall_recommendation,
                    evaluation_date: evaluation.evaluated_at,
                    methodology: evaluation.methodology,
                    strengths: evaluation.strengths,
                    weaknesses: evaluation.weaknesses,
                    comments: evaluation.additional_comments,
                    scores: {
                        sci_rigor: evaluation.sci_rigor,
                        relevant_to_hru_obj: evaluation.relevant_to_hru_obj,
                        ethical_compliance: evaluation.ethical_compliance
                    }
                });
            });

            // Step 7: Combine research with evaluations
            const processedResearches = (researchData || []).map(research => {
                const evaluations = evaluationsByResearch[research.research_id] || [];

                const authorUser = researcherUsersMap[research.Researcher?.user_id];
                const researcherName = authorUser ?
                    `${authorUser.first_name} ${authorUser.last_name}` :
                    'Unknown';
                const researcherEmail = authorUser?.email;

                const latestEvaluation = evaluations.length > 0 ?
                    evaluations.reduce((latest, current) =>
                        new Date(current.evaluation_date) > new Date(latest.evaluation_date) ? current : latest
                    ) : null;

                return {
                    ...research,
                    researcher_name: researcherName,
                    researcher_email: researcherEmail,
                    evaluators: evaluations,
                    current_status: latestEvaluation?.recommendation || 'pending'
                };
            });

            setResearches(processedResearches);
        } catch (error) {
            console.error('Error loading Master Inventory:', error);
            alert('Failed to load master inventory. Please refresh and try again.');
        } finally {
            setLoading(false);
        }
    }

    const handleViewClick = async (study) => {
        setSelectedStudy(study);
        setIsModalOpen(true);

        try {
            const [coauthorsRes, bioRes, deptRes, hraaRes, filesRes] = await Promise.all([
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
                supabase.from('research_files').select('file_url, file_type, uploaded_at').eq('research_id', study.research_id)
            ]);

            setStudyDetails({
                coauthors: coauthorsRes.data || [],
                bio: bioRes.data,
                dept: deptRes.data,
                hraa: hraaRes.data,
                files: filesRes.data || [],
                evaluations: study.evaluators || []
            });
        } catch (err) {
            console.error("Error fetching detailed research info:", err);
        }
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setSelectedStudy(null);
        setStudyDetails({ coauthors: [], bio: null, dept: null, hraa: null, files: [], evaluations: [] });
    };

    const getCleanFileName = (url) => {
        if (!url) return "Unknown File";
        const parts = url.split('/');
        const fileName = parts[parts.length - 1];
        return fileName.split('_').slice(1).join('_') || fileName;
    };

    const getStatusClass = (status) => {
        const s = status?.toLowerCase();
        if (s === 'approved') return 'status-approved';
        if (s === 'rejected') return 'status-rejected';
        if (s === 'minor_revision') return 'status-minor-revision';
        if (s === 'major_revision') return 'status-major-revision';
        return 'status-pending';
    };

    const getStatusDisplayText = (status) => {
        const s = status?.toLowerCase();
        if (s === 'approved') return 'APPROVED';
        if (s === 'rejected') return 'REJECTED';
        if (s === 'minor_revision') return 'MINOR REVISION';
        if (s === 'major_revision') return 'MAJOR REVISION';
        return 'PENDING';
    };

    const renderPagination = () => {
        if (totalPages <= 1) return null;

        const pages = [];
        for (let i = 1; i <= Math.min(totalPages, 5); i++) {
            pages.push(i);
        }

        return (
            <div className="pagination">
                <button className="page-btn" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>«</button>
                <button className="page-btn" onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1}>‹</button>
                {pages.map(page => (
                    <button
                        key={page}
                        className={`page-btn ${currentPage === page ? 'active' : ''}`}
                        onClick={() => setCurrentPage(page)}
                    >
                        {page}
                    </button>
                ))}
                {totalPages > 5 && <span className="page-ellipsis">…</span>}
                {totalPages > 5 && (
                    <button className="page-btn" onClick={() => setCurrentPage(totalPages)}>
                        {totalPages}
                    </button>
                )}
                <button className="page-btn" onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages}>›</button>
                <button className="page-btn" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}>»</button>
            </div>
        );
    };

    return (
        <div className="admin-layout">
            <AdminNavbar />
            <main className="admin-content">
                <header className="header">
                    <div className="header-left">
                        <h1>Master Inventory</h1>
                        <p>Centralized repository of evaluated research submissions</p>
                    </div>

                    <div className="inventory-controls">
                        <div className="search-wrapper">
                            <Search size={18} className="search-icon" />
                            <input
                                type="text"
                                placeholder="Search by title, author, evaluator, or HRU..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div className="filter-wrapper">
                            <Filter size={18} />
                            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                                <option value="all">All Status</option>
                                <option value="approved">Approved</option>
                                <option value="minor_revision">Minor Revision</option>
                                <option value="major_revision">Major Revision</option>
                                <option value="rejected">Rejected</option>
                            </select>
                        </div>
                    </div>
                </header>

                <div className="table-container">
                    <table className="user-table">
                        <thead>
                            <tr>
                                <th>HRU NO.</th>
                                <th>RESEARCH TITLE</th>
                                <th>AUTHOR</th>
                                <th>EVALUATORS</th>
                                <th>STATUS</th>
                                <th>EVALUATION DATE</th>
                                <th>ACTIONS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="7" style={{ textAlign: 'center', padding: '60px' }}>
                                        Loading evaluated research...
                                    </td>
                                </tr>
                            ) : paginatedResearches.length === 0 ? (
                                <tr>
                                    <td colSpan="7" style={{ textAlign: 'center', padding: '60px' }}>
                                        <div>
                                            <p>No evaluated research found.</p>
                                            <p style={{ fontSize: '0.875rem', color: '#666' }}>
                                                Research appears in Master Inventory only after evaluation is complete.
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                paginatedResearches.map((research) => (
                                    <tr key={research.research_id}>
                                        <td className="hru-cell">{research.hru_no}</td>
                                        <td className="title-cell">{research.title}</td>
                                        <td>{research.researcher_name}</td>
                                        <td>
                                            {research.evaluators && research.evaluators.length > 0 ? (
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                    {research.evaluators.map((evaluator, idx) => (
                                                        <span
                                                            key={idx}
                                                            style={{
                                                                background: '#e2e8f0',
                                                                padding: '4px 10px',
                                                                borderRadius: '20px',
                                                                fontSize: '12px',
                                                                fontWeight: 500,
                                                                color: '#1e293b'
                                                            }}
                                                            title={evaluator.email}
                                                        >
                                                            {evaluator.name}
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span style={{ color: '#999', fontSize: '12px' }}>No evaluators</span>
                                            )}
                                        </td>
                                        <td>
                                            <span className={`role-badge ${getStatusClass(research.current_status)}`}>
                                                {getStatusDisplayText(research.current_status)}
                                            </span>
                                        </td>
                                        <td>
                                            {research.evaluators?.[0]?.evaluation_date
                                                ? new Date(research.evaluators[0].evaluation_date).toLocaleDateString()
                                                : 'N/A'}
                                        </td>
                                        <td>
                                            <div className="action-btns">
                                                <button className="icon-btn" title="View Details" onClick={() => handleViewClick(research)}>
                                                    <Eye size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="pagination-wrapper">
                    <span className="pagination-info">
                        Showing {filteredResearches.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1}–
                        {Math.min(currentPage * ITEMS_PER_PAGE, filteredResearches.length)} of {filteredResearches.length} results
                    </span>
                    {renderPagination()}
                </div>

                {/* View Modal */}
                {isModalOpen && selectedStudy && (
                    <div className="modal-overlay" onClick={closeModal}>
                        <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <div className="modal-header-info">
                                    <span className="hru-tag">{selectedStudy.hru_no}</span>
                                    <h2>{selectedStudy.title}</h2>
                                </div>
                                <button className="close-btn" onClick={closeModal}>
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="modal-body">
                                {/* Research Information */}
                                <div className="detail-section">
                                    <h3>Research Information</h3>
                                    <div className="detail-grid">
                                        <div className="detail-item">
                                            <label>HRU No.</label>
                                            <p>{selectedStudy.hru_no}</p>
                                        </div>
                                        <div className="detail-item">
                                            <label>Registration Date</label>
                                            <p>{new Date(selectedStudy.registration_date).toLocaleDateString()}</p>
                                        </div>
                                        <div className="detail-item">
                                            <label>Status</label>
                                            <p>
                                                <span className={`role-badge ${getStatusClass(selectedStudy.current_status)}`}>
                                                    {getStatusDisplayText(selectedStudy.current_status)}
                                                </span>
                                            </p>
                                        </div>
                                        <div className="detail-item">
                                            <label>Department</label>
                                            <p>{studyDetails.dept ? studyDetails.dept.department_name : 'N/A'}</p>
                                        </div>
                                        <div className="detail-item">
                                            <label>HRA Alignment</label>
                                            <p>{studyDetails.hraa ? studyDetails.hraa.hraa_category : 'N/A'}</p>
                                        </div>
                                        <div className="detail-item">
                                            <label>Primary Author</label>
                                            <p>{selectedStudy.researcher_name}</p>
                                        </div>
                                        <div className="detail-item">
                                            <label>Author Email</label>
                                            <p>{selectedStudy.researcher_email || 'N/A'}</p>
                                        </div>
                                    </div>
                                    {selectedStudy.description && (
                                        <div className="detail-item full-width" style={{ marginTop: '16px' }}>
                                            <label>Abstract / Description</label>
                                            <p style={{ fontWeight: 400, lineHeight: 1.6 }}>{selectedStudy.description}</p>
                                        </div>
                                    )}
                                </div>

                                {/* Co-authors */}
                                <div className="detail-section">
                                    <h3>Co-authors</h3>
                                    <div className="detail-grid">
                                        <div className="detail-item full-width">
                                            <p>
                                                {studyDetails.coauthors.length > 0
                                                    ? studyDetails.coauthors.map(c => c.author_name).join(', ')
                                                    : 'No co-authors listed'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Bioinformatics */}
                                {studyDetails.bio && (
                                    <div className="detail-section" style={{ background: '#f8fafc', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
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
                                                <p>{studyDetails.bio.data_source || 'N/A'}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Evaluations */}
                                <div className="detail-section">
                                    <h3>Evaluations</h3>
                                    {studyDetails.evaluations.length === 0 ? (
                                        <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>No evaluations recorded.</p>
                                    ) : (
                                        <div className="evaluations-list">
                                            {studyDetails.evaluations.map((evaluation, idx) => (
                                                <div key={idx} className="evaluation-card" style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
                                                    <div className="evaluation-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                                        <div className="evaluator-info-modal" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <Users size={16} />
                                                            <strong>{evaluation.name}</strong>
                                                            <span style={{ fontSize: '12px', color: '#64748b' }}>{evaluation.email}</span>
                                                        </div>
                                                        <span className={`role-badge ${getStatusClass(evaluation.recommendation)}`}>
                                                            {getStatusDisplayText(evaluation.recommendation)}
                                                        </span>
                                                    </div>
                                                    <div className="evaluation-date" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>
                                                        <Calendar size={14} />
                                                        {new Date(evaluation.evaluation_date).toLocaleString()}
                                                    </div>
                                                    {evaluation.methodology && (
                                                        <div className="evaluation-methodology" style={{ marginBottom: '8px' }}>
                                                            <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Methodology Assessment:</label>
                                                            <p style={{ fontSize: '13px', margin: '4px 0 0', color: '#334155' }}>{evaluation.methodology}</p>
                                                        </div>
                                                    )}
                                                    {evaluation.strengths && (
                                                        <div className="evaluation-strengths" style={{ marginBottom: '8px' }}>
                                                            <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Strengths:</label>
                                                            <p style={{ fontSize: '13px', margin: '4px 0 0', color: '#334155' }}>{evaluation.strengths}</p>
                                                        </div>
                                                    )}
                                                    {evaluation.weaknesses && (
                                                        <div className="evaluation-weaknesses" style={{ marginBottom: '8px' }}>
                                                            <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Weaknesses:</label>
                                                            <p style={{ fontSize: '13px', margin: '4px 0 0', color: '#334155' }}>{evaluation.weaknesses}</p>
                                                        </div>
                                                    )}
                                                    {evaluation.comments && (
                                                        <div className="evaluation-notes" style={{ marginBottom: '8px' }}>
                                                            <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Additional Comments:</label>
                                                            <p style={{ fontSize: '13px', margin: '4px 0 0', color: '#334155' }}>{evaluation.comments}</p>
                                                        </div>
                                                    )}
                                                    {evaluation.scores && (
                                                        <div className="evaluation-scores" style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
                                                            <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Scores:</label>
                                                            <div style={{ display: 'flex', gap: '16px', marginTop: '8px', fontSize: '12px' }}>
                                                                <span>Scientific Rigor: {evaluation.scores.sci_rigor}/100</span>
                                                                <span>HRU Relevance: {evaluation.scores.relevant_to_hru_obj}/100</span>
                                                                <span>Ethical Compliance: {evaluation.scores.ethical_compliance}/100</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Attached Files */}
                                <div className="detail-section">
                                    <h3>Attached Files</h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {studyDetails.files.length === 0 ? (
                                            <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>No files attached.</p>
                                        ) : (
                                            studyDetails.files.map((file, i) => (
                                                <a key={i} href={file.file_url} target="_blank" rel="noopener noreferrer" className="file-card">
                                                    <FileText size={20} style={{ marginRight: '10px', color: '#022050' }} />
                                                    <div style={{ flex: 1, overflow: 'hidden' }}>
                                                        <span style={{ fontSize: '0.9rem', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                                                            {getCleanFileName(file.file_url)}
                                                        </span>
                                                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                                            {file.file_type} • {file.uploaded_at ? new Date(file.uploaded_at).toLocaleDateString() : 'No date'}
                                                        </span>
                                                    </div>
                                                    <Download size={16} style={{ color: '#94a3b8', marginLeft: 'auto' }} />
                                                </a>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}