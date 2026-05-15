import React, { useState, useEffect } from "react";
import { supabase } from "../../supabaseClient";
import { Search, Filter, Eye, X, FileText, Download, UserPlus, Check } from 'lucide-react';
import AdminNavbar from "./AdminNavbar";
import "./AdminMasterInventory.css";

const ITEMS_PER_PAGE = 10;

export default function AdminMasterInventory() {
    // List States
    const [researches, setResearches] = useState([]);
    const [filteredResearches, setFilteredResearches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');

    // Pagination States
    const [currentPage, setCurrentPage] = useState(1);

    // Detail/Modal States
    const [selectedStudy, setSelectedStudy] = useState(null);
    const [studyDetails, setStudyDetails] = useState({
        coauthors: [], bio: null, dept: null, hraa: null, files: [], evaluators: []
    });
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Evaluator Assignment States
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [assignTarget, setAssignTarget] = useState(null);
    const [evaluators, setEvaluators] = useState([]);
    const [selectedEvaluatorIds, setSelectedEvaluatorIds] = useState([]);
    const [alreadyAssigned, setAlreadyAssigned] = useState([]);
    const [assignLoading, setAssignLoading] = useState(false);
    const [assignSaving, setAssignSaving] = useState(false);

    useEffect(() => {
        loadMasterData();
    }, []);

    // Filter Logic
    useEffect(() => {
        let result = researches;
        if (filterStatus !== 'all') {
            result = result.filter(r => r.status?.toLowerCase() === filterStatus.toLowerCase());
        }
        if (searchTerm) {
            result = result.filter(r =>
                r.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                r.author_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                r.hru_no?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        setFilteredResearches(result);
        setCurrentPage(1);
    }, [searchTerm, filterStatus, researches]);

    // Pagination Derived Data
    const totalPages = Math.ceil(filteredResearches.length / ITEMS_PER_PAGE);
    const paginatedResearches = filteredResearches.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    async function loadMasterData() {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('research_with_authors')
                .select('*')
                .order('registration_date', { ascending: false });
            if (error) throw error;
            setResearches(data || []);
        } catch (error) {
            console.error('Error loading inventory:', error);
        } finally {
            setLoading(false);
        }
    }

    // ─── VIEW MODAL ───────────────────────────────────────────────────────────

    const handleViewClick = async (study) => {
        setSelectedStudy(study);
        setIsModalOpen(true);

        try {
            const [coauthorsRes, bioRes, deptRes, hraaRes, filesRes, evalRes] = await Promise.all([
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
                supabase.from('research_files').select('file_url, file_type').eq('research_id', study.research_id),
                supabase.from('Evaluation_Research').select('evaluator_name, evaluator_email, overall_recommendation').eq('research_id', study.research_id)
            ]);

            setStudyDetails({
                coauthors: coauthorsRes.data || [],
                bio: bioRes.data,
                dept: deptRes.data,
                hraa: hraaRes.data,
                files: filesRes.data || [],
                evaluators: evalRes.data || [],
            });
        } catch (err) {
            console.error("Error fetching detailed research info:", err);
        }
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setSelectedStudy(null);
        setStudyDetails({ coauthors: [], bio: null, dept: null, hraa: null, files: [], evaluators: [] });
    };

    // ─── EVALUATOR ASSIGNMENT ─────────────────────────────────────────────────

    const handleAssignClick = async (item) => {
        setAssignTarget(item);
        setIsAssignModalOpen(true);
        setAssignLoading(true);
        setSelectedEvaluatorIds([]);

        try {
            const [evalRes, alreadyAssignedRes] = await Promise.all([
                supabase
                    .from('Evaluator')
                    .select(`
                        evaluator_id,
                        Users (
                            first_name,
                            last_name,
                            email
                        )
                    `),
                supabase
                    .from('Evaluation_Research')
                    .select('evaluator_id')
                    .eq('research_id', item.research_id)
            ]);

            if (evalRes.error) throw evalRes.error;

            const formattedEvaluators = (evalRes.data || []).map(ev => ({
                evaluator_id: Number(ev.evaluator_id),
                first_name: ev.Users?.first_name || 'Unknown',
                last_name: ev.Users?.last_name || 'User',
                email: ev.Users?.email || 'No email'
            }));

            setEvaluators(formattedEvaluators);
            setAlreadyAssigned(alreadyAssignedRes.data || []);

            const assignedIds = (alreadyAssignedRes.data || []).map(e => Number(e.evaluator_id));
            setSelectedEvaluatorIds(assignedIds);

        } catch (err) {
            console.error('Error loading evaluators:', err.message);
        } finally {
            setAssignLoading(false);
        }
    };

    const closeAssignModal = () => {
        setIsAssignModalOpen(false);
        setAssignTarget(null);
        setEvaluators([]);
        setSelectedEvaluatorIds([]);
        setAlreadyAssigned([]);
    };

    const toggleEvaluator = (id) => {
        const numId = Number(id);
        setSelectedEvaluatorIds(prev =>
            prev.includes(numId)
                ? prev.filter(item => item !== numId)
                : [...prev, numId]
        );
    };

    const handleSaveAssignments = async () => {
        if (!assignTarget) return;
        setAssignSaving(true);

        try {
            const alreadyInDB = alreadyAssigned.map(e => Number(e.evaluator_id));
            const currentSelection = selectedEvaluatorIds.map(id => Number(id));

            const toAdd = currentSelection.filter(id => !alreadyInDB.includes(id));
            const toRemove = alreadyInDB.filter(id => !currentSelection.includes(id));

            const promises = [];

            if (toAdd.length > 0) {
                const newRows = toAdd.map(id => {
                    const user = evaluators.find(e => Number(e.evaluator_id) === id);
                    return {
                        research_id: assignTarget.research_id,
                        evaluator_id: id,
                        evaluator_name: user ? `${user.first_name} ${user.last_name}` : 'Unknown',
                        evaluator_email: user?.email || '',
                        sci_rigor: 0,
                        relevant_to_hru_obj: 0,
                        ethical_compliance: 0,
                        methodology: 'EMPTY',
                        overall_recommendation: 'Pending',
                    };
                });
                promises.push(supabase.from('Evaluation_Research').insert(newRows));
            }

            if (toRemove.length > 0) {
                promises.push(
                    supabase
                        .from('Evaluation_Research')
                        .delete()
                        .eq('research_id', assignTarget.research_id)
                        .in('evaluator_id', toRemove)
                );
            }

            await Promise.all(promises);
            alert(`Assignments updated successfully.`);
            await loadMasterData();
            closeAssignModal();
        } catch (err) {
            console.error('Error saving assignments:', err);
            alert('Failed to save assignments.');
        } finally {
            setAssignSaving(false);
        }
    };

    // ─── HELPERS ──────────────────────────────────────────────────────────────

    const getCleanFileName = (url) => {
        if (!url) return "Unknown File";
        const parts = url.split('/');
        const fileWithTimestamp = parts[parts.length - 1];
        return fileWithTimestamp.split('_').slice(1).join('_') || fileWithTimestamp;
    };

    const getStatusClass = (status) => {
        const s = status?.toLowerCase();
        if (s?.includes('approved')) return 'status-approved';
        if (s?.includes('disapproved') || s?.includes('rejected')) return 'status-rejected';
        if (s?.includes('revision')) return 'status-revision';
        return 'status-pending';
    };

    // ─── PAGINATION ───────────────────────────────────────────────────────────

    const renderPagination = () => {
        if (totalPages <= 1) return null;
        const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(page =>
                page === 1 ||
                page === totalPages ||
                Math.abs(page - currentPage) <= 1
            );

        const withEllipsis = pages.reduce((acc, page, idx, arr) => {
            if (idx > 0 && page - arr[idx - 1] > 1) {
                acc.push(<span key={`ellipsis-${page}`} className="page-ellipsis">…</span>);
            }
            acc.push(
                <button
                    key={page}
                    className={`page-btn ${currentPage === page ? 'active' : ''}`}
                    onClick={() => setCurrentPage(page)}
                >
                    {page}
                </button>
            );
            return acc;
        }, []);

        return (
            <div className="pagination">
                <button className="page-btn" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>«</button>
                <button className="page-btn" onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1}>‹</button>
                {withEllipsis}
                <button className="page-btn" onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages}>›</button>
                <button className="page-btn" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}>»</button>
            </div>
        );
    };

    // ─── RENDER ───────────────────────────────────────────────────────────────

    return (
        <div className="admin-layout">
            <AdminNavbar />

            <main className="admin-content">
                <header className="header">
                    <div className="header-left">
                        <h1>Master Inventory</h1>
                        <p>Centralized repository of all research submissions</p>
                    </div>

                    <div className="inventory-controls">
                        <div className="search-wrapper">
                            <Search size={18} className="search-icon" />
                            <input
                                type="text"
                                placeholder="Search by title, author, or HR..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div className="filter-wrapper">
                            <Filter size={18} />
                            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                                <option value="all">All Status</option>
                                <option value="pending">Pending</option>
                                <option value="approved">Approved</option>
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
                                <th>STATUS</th>
                                <th>SUBMITTED</th>
                                <th>ACTIONS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="6" style={{ textAlign: 'center' }}>Loading database...</td></tr>
                            ) : paginatedResearches.length === 0 ? (
                                <tr><td colSpan="6" style={{ textAlign: 'center' }}>No results found.</td></tr>
                            ) : (
                                paginatedResearches.map((item) => (
                                    <tr key={item.research_id}>
                                        <td className="hru-cell">{item.hru_no}</td>
                                        <td className="title-cell">{item.title}</td>
                                        <td>{item.author_name || <span style={{ color: '#bbb', fontWeight: '400' }}>No Author Listed</span>}</td>
                                        <td>
                                            <span className={`role-badge ${getStatusClass(item.status)}`}>
                                                {item.status?.replace(/_/g, ' ')}
                                            </span>
                                        </td>
                                        <td>{new Date(item.registration_date).toLocaleDateString()}</td>
                                        <td>
                                            <div className="action-btns">
                                                <button className="icon-btn" title="View" onClick={() => handleViewClick(item)}><Eye size={18} /></button>
                                                <button className="icon-btn assign-btn" title="Assign Evaluator" onClick={() => handleAssignClick(item)}><UserPlus size={18} /></button>
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
                        Showing {filteredResearches.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredResearches.length)} of {filteredResearches.length} results
                    </span>
                    {renderPagination()}
                </div>

                {/* ─── VIEW MODAL ─────────────────────────────────────────────── */}
                {isModalOpen && selectedStudy && (
                    <div className="modal-overlay" onClick={closeModal}>
                        <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <div className="modal-header-info">
                                    <span className="hru-tag">{selectedStudy.hru_no}</span>
                                    <h2>{selectedStudy.title}</h2>
                                </div>
                                <button className="close-btn" onClick={closeModal}><X size={24} /></button>
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
                                            <p>{selectedStudy.registration_date}</p>
                                        </div>
                                        <div className="detail-item">
                                            <label>Status</label>
                                            <p>
                                                <span className={`role-badge ${getStatusClass(selectedStudy.status)}`}>
                                                    {selectedStudy.status?.replace(/_/g, ' ')}
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
                                    </div>
                                    {selectedStudy.description && (
                                        <div className="detail-item full-width" style={{ marginTop: '16px' }}>
                                            <label>Description</label>
                                            <p style={{ fontWeight: 400, lineHeight: 1.6 }}>{selectedStudy.description}</p>
                                        </div>
                                    )}
                                </div>

                                {/* Credentials */}
                                <div className="detail-section">
                                    <h3>Credentials</h3>
                                    <div className="detail-grid">
                                        <div className="detail-item">
                                            <label>Primary Author</label>
                                            <p>{selectedStudy.author_name || 'N/A'}</p>
                                        </div>
                                        <div className="detail-item">
                                            <label>Co-Authors</label>
                                            <p>
                                                {studyDetails.coauthors.length > 0
                                                    ? studyDetails.coauthors.map(c => c.author_name).join(', ')
                                                    : 'None'}
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
                                                <p>{studyDetails.bio._data_source || 'N/A'}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Assigned Evaluators */}
                                <div className="detail-section">
                                    <h3>Assigned Evaluators</h3>
                                    {studyDetails.evaluators.length === 0 ? (
                                        <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>No evaluators assigned yet.</p>
                                    ) : (
                                        <div className="evaluator-list" style={{ maxHeight: 'unset' }}>
                                            {studyDetails.evaluators.map((ev, i) => (
                                                <div key={i} className="evaluator-item" style={{ cursor: 'default', pointerEvents: 'none' }}>
                                                    <div className="evaluator-info">
                                                        <span className="evaluator-name">{ev.evaluator_name}</span>
                                                        <span className="evaluator-email">{ev.evaluator_email}</span>
                                                    </div>
                                                    <span
                                                        className={`role-badge ${getStatusClass(ev.overall_recommendation)}`}
                                                        style={{ marginLeft: 'auto' }}
                                                    >
                                                        {ev.overall_recommendation}
                                                    </span>
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
                                        ) : studyDetails.files.map((file, i) => (
                                            <a key={i} href={file.file_url} target="_blank" rel="noopener noreferrer" className="file-card">
                                                <FileText size={20} style={{ marginRight: '10px', color: '#022050' }} />
                                                <div style={{ flex: 1, overflow: 'hidden' }}>
                                                    <span style={{ fontSize: '0.9rem', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                                                        {getCleanFileName(file.file_url)}
                                                    </span>
                                                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{file.file_type}</span>
                                                </div>
                                                <Download size={16} style={{ color: '#94a3b8', marginLeft: 'auto' }} />
                                            </a>
                                        ))}
                                    </div>
                                </div>

                            </div>
                        </div>
                    </div>
                )}

                {/* ─── ASSIGN MODAL ────────────────────────────────────────────── */}
                {isAssignModalOpen && assignTarget && (
                    <div className="modal-overlay" onClick={closeAssignModal}>
                        <div className="modal-content assign-modal" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <div className="modal-header-info">
                                    <span className="hru-tag">{assignTarget.hru_no}</span>
                                    <h2>Assign Evaluators</h2>
                                    <p className="assign-subtitle">{assignTarget.title}</p>
                                </div>
                                <button className="close-btn" onClick={closeAssignModal}><X size={24} /></button>
                            </div>

                            <div className="modal-body">
                                {assignLoading ? (
                                    <p style={{ textAlign: 'center', padding: '24px' }}>Loading evaluators...</p>
                                ) : evaluators.length === 0 ? (
                                    <p style={{ textAlign: 'center', padding: '24px', color: '#888' }}>No evaluators found.</p>
                                ) : (
                                    <>
                                        <p className="assign-hint">Select or remove evaluators to adjust assignments for this research.</p>

                                        <div className="evaluator-list">
                                            {evaluators.map((ev) => {
                                                const eId = Number(ev.evaluator_id);
                                                const isChecked = selectedEvaluatorIds.includes(eId);
                                                const wasAlready = alreadyAssigned.some(a => Number(a.evaluator_id) === eId);

                                                return (
                                                    <div
                                                        key={ev.evaluator_id}
                                                        className={`evaluator-item ${isChecked ? 'selected' : ''} ${wasAlready ? 'already-in' : ''}`}
                                                        onClick={() => toggleEvaluator(eId)}
                                                    >
                                                        <div className={`evaluator-checkbox ${isChecked ? 'checked' : ''}`}>
                                                            {isChecked && <Check size={14} />}
                                                        </div>
                                                        <div className="evaluator-info">
                                                            <span className={`evaluator-name ${wasAlready ? 'strike-out' : ''}`}>
                                                                {ev.first_name} {ev.last_name}
                                                                {wasAlready && <span className="assigned-tag">Currently Assigned</span>}
                                                            </span>
                                                            <span className={`evaluator-email ${wasAlready ? 'strike-out' : ''}`}>{ev.email}</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <div className="assign-actions">
                                            <span className="selected-count">{selectedEvaluatorIds.length} evaluator{selectedEvaluatorIds.length !== 1 ? 's' : ''} selected</span>
                                            <div className="assign-btns">
                                                <button className="cancel-assign-btn" onClick={closeAssignModal}>Cancel</button>
                                                <button className="save-assign-btn" onClick={handleSaveAssignments} disabled={assignSaving}>
                                                    {assignSaving ? 'Saving...' : 'Save Assignments'}
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}

            </main>
        </div>
    );
}
