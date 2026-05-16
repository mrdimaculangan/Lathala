import React, { useState, useEffect } from "react";
import { supabase } from "../../supabaseClient";
import { UserPlus, X, Check, Users, Search } from 'lucide-react';
import AdminNavbar from "./AdminNavbar";
import "./AdminQueue.css";

const ITEMS_PER_PAGE = 10;

export default function AdminQueue() {
    const [researches, setResearches] = useState([]);
    const [filteredResearches, setFilteredResearches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [assignTarget, setAssignTarget] = useState(null);
    const [evaluators, setEvaluators] = useState([]);
    const [selectedEvaluatorId, setSelectedEvaluatorId] = useState(null);  // single value
    const [alreadyAssigned, setAlreadyAssigned] = useState(null);           // single object
    const [saving, setSaving] = useState(false);

    // Pagination and Filter states
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');

    useEffect(() => {
        loadQueueData();
    }, []);

    // Filter and search logic
    useEffect(() => {
        let result = [...researches];

        if (filterStatus !== 'all') {
            result = result.filter(r => {
                if (filterStatus === 'assigned') return r.assigned_evaluators?.length > 0;
                if (filterStatus === 'unassigned') return r.assigned_evaluators?.length === 0;
                return true;
            });
        }

        if (searchTerm) {
            result = result.filter(r =>
                r.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                r.researcher_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                r.hru_no?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                r.assigned_evaluators?.some(e => e.name.toLowerCase().includes(searchTerm.toLowerCase()))
            );
        }

        setFilteredResearches(result);
        setCurrentPage(1);
    }, [searchTerm, filterStatus, researches]);

    // Pagination derived data
    const totalPages = Math.ceil(filteredResearches.length / ITEMS_PER_PAGE);
    const paginatedResearches = filteredResearches.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    async function loadQueueData() {
        setLoading(true);
        try {
            const { data: evaluatedResearch, error: evalError } = await supabase
                .from('Evaluation_Research')
                .select('research_id');

            if (evalError) throw evalError;

            const evaluatedIds = evaluatedResearch?.map(er => er.research_id) || [];

            let query = supabase
                .from('Research')
                .select(`
                    research_id,
                    hru_no,
                    title,
                    description,
                    registration_date,
                    status,
                    researcher_id,
                    Researcher (
                        researcher_id,
                        user_id,
                        Users (
                            first_name,
                            last_name,
                            email
                        )
                    )
                `)
                .order('registration_date', { ascending: false });

            if (evaluatedIds.length > 0) {
                query = query.not('research_id', 'in', `(${evaluatedIds.join(',')})`);
            }

            const { data: researchData, error: researchError } = await query;
            if (researchError) throw researchError;

            if (researchData && researchData.length > 0) {
                const researchIds = researchData.map(r => r.research_id);

                const { data: queueData, error: queueError } = await supabase
                    .from('Research_Queue')
                    .select(`
                        research_id,
                        evaluator_id,
                        assigned_at,
                        status,
                        Evaluator (
                            evaluator_id,
                            user_id,
                            Users (
                                first_name,
                                last_name,
                                email
                            )
                        )
                    `)
                    .in('research_id', researchIds);

                if (queueError) throw queueError;

                const processedResearches = researchData.map(research => {
                    const assignedEvaluators = (queueData || [])
                        .filter(q => q.research_id === research.research_id)
                        .map(q => ({
                            id: q.evaluator_id,
                            name: `${q.Evaluator?.Users?.first_name || ''} ${q.Evaluator?.Users?.last_name || ''}`.trim() || 'Unknown',
                            email: q.Evaluator?.Users?.email || 'No email',
                            assigned_at: q.assigned_at,
                            status: q.status
                        }));

                    return {
                        ...research,
                        researcher_name: `${research.Researcher?.Users?.first_name || ''} ${research.Researcher?.Users?.last_name || ''}`.trim() || 'Unknown',
                        researcher_email: research.Researcher?.Users?.email,
                        assigned_evaluators: assignedEvaluators
                    };
                });

                setResearches(processedResearches);
            } else {
                setResearches([]);
            }
        } catch (error) {
            console.error('Error loading queue:', error);
            alert('Failed to load queue data. Please refresh and try again.');
        } finally {
            setLoading(false);
        }
    }

    const handleAssignClick = async (research) => {
        setAssignTarget(research);
        setIsAssignModalOpen(true);
        setSaving(false);

        try {
            const { data: evaluatorsData, error: evalError } = await supabase
                .from('Evaluator')
                .select(`
                    evaluator_id,
                    user_id,
                    Users (
                        first_name,
                        last_name,
                        email
                    )
                `);

            if (evalError) throw evalError;

            const { data: assignedData, error: assignedError } = await supabase
                .from('Research_Queue')
                .select('evaluator_id')
                .eq('research_id', research.research_id);

            if (assignedError) throw assignedError;

            const formattedEvaluators = (evaluatorsData || []).map(ev => ({
                evaluator_id: ev.evaluator_id,
                name: `${ev.Users?.first_name || ''} ${ev.Users?.last_name || ''}`.trim() || 'Unknown',
                email: ev.Users?.email || 'No email'
            }));

            setEvaluators(formattedEvaluators);
            // Single evaluator — take the first assigned one if it exists
            const current = assignedData && assignedData.length > 0 ? assignedData[0] : null;
            setAlreadyAssigned(current);
            setSelectedEvaluatorId(current ? current.evaluator_id : null);
        } catch (err) {
            console.error('Error loading evaluators:', err);
            alert('Failed to load evaluators. Please try again.');
        }
    };

    const handleSaveAssignments = async () => {
        setSaving(true);
        const currentSelection = selectedEvaluatorId ? Number(selectedEvaluatorId) : null;
        const alreadyId = alreadyAssigned ? Number(alreadyAssigned.evaluator_id) : null;

        try {
            // Remove old evaluator if changed
            if (alreadyId !== null && alreadyId !== currentSelection) {
                const { error: deleteError } = await supabase
                    .from('Research_Queue')
                    .delete()
                    .eq('research_id', assignTarget.research_id)
                    .eq('evaluator_id', alreadyId);

                if (deleteError) throw deleteError;
            }

            // Insert new evaluator if changed
            if (currentSelection !== null && currentSelection !== alreadyId) {
                const { error: insertError } = await supabase
                    .from('Research_Queue')
                    .insert({
                        research_id: assignTarget.research_id,
                        evaluator_id: currentSelection,
                        assigned_at: new Date().toISOString(),
                        status: 'Pending'
                    });

                if (insertError) throw insertError;

                // Send notification to newly assigned evaluator
                await createAssignmentNotification(currentSelection);
            }

            alert(`Successfully updated evaluator for ${assignTarget.hru_no}`);
            setIsAssignModalOpen(false);
            await loadQueueData();
        } catch (error) {
            console.error('Error saving assignments:', error);
            alert('Error saving assignments. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const createAssignmentNotification = async (newEvaluatorId) => {
        try {
            // Get the evaluator's user_id
            const { data: evaluatorData, error: evaluatorError } = await supabase
                .from('Evaluator')
                .select('evaluator_id, user_id')
                .eq('evaluator_id', newEvaluatorId)
                .single();

            if (evaluatorError || !evaluatorData) {
                console.error('Error fetching evaluator user_id:', evaluatorError);
                return;
            }

            // Get admin info
            const { data: { session } } = await supabase.auth.getSession();
            const adminUserId = session?.user?.id;

            let adminName = 'Administrator';
            if (adminUserId) {
                const { data: adminData } = await supabase
                    .from('Users')
                    .select('first_name, last_name')
                    .eq('user_id', adminUserId)
                    .single();

                if (adminData) {
                    adminName = `${adminData.first_name || ''} ${adminData.last_name || ''}`.trim() || 'Administrator';
                }
            }

            // Get evaluator name for log
            const evaluator = evaluators.find(ev => ev.evaluator_id === newEvaluatorId);
            const evaluatorName = evaluator?.name || 'Evaluator';

            // Create activity log
            const { data: logData, error: logError } = await supabase
                .from('ResearchActivityLog')
                .insert([{
                    research_id: assignTarget.research_id,
                    actor_id: adminUserId,
                    actor_role: 'admin',
                    action: 'assigned_evaluators',
                    notes: `Research "${assignTarget.title}" (${assignTarget.hru_no}) assigned to evaluator: ${evaluatorName}`,
                }])
                .select()
                .single();

            if (logError) {
                console.error('Error creating activity log:', logError);
            }

            // Insert notification
            const { error: notifError } = await supabase
                .from('evaluator_notifications')
                .insert({
                    recipient_id: evaluatorData.user_id,
                    research_id: assignTarget.research_id,
                    log_id: logData?.log_id || null,
                    message: `You have been assigned to evaluate research "${assignTarget.title}" (${assignTarget.hru_no}). Please review and submit your evaluation.`,
                    is_read: false,
                    is_deleted: false,
                });

            if (notifError) {
                console.error('Error creating notification:', notifError);
            } else {
                console.log('✅ Notification sent to evaluator:', evaluatorName);
            }
        } catch (error) {
            console.error('Error in createAssignmentNotification:', error);
        }
    };

    const selectEvaluator = (evaluatorId) => {
        // Radio behavior — clicking the same one deselects, clicking another switches
        setSelectedEvaluatorId(prev => prev === evaluatorId ? null : evaluatorId);
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
                <div className="header">
                    <div className="header-left">
                        <h1>Research Queue</h1>
                        <p>Research papers pending evaluation</p>
                    </div>
                    <div className="inventory-controls">
                        <div className="search-wrapper">
                            <Search size={18} className="search-icon" />
                            <input
                                type="text"
                                placeholder="Search by title, author, HRU, or evaluator..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="filter-wrapper">
                            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                                <option value="all">All Status</option>
                                <option value="assigned">Has Evaluator</option>
                                <option value="unassigned">No Evaluator</option>
                            </select>
                        </div>
                        <div className="queue-stats">
                            <div className="stat-badge">
                                <Users size={16} />
                                <span>{filteredResearches.length} Pending</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="table-container">
                    <table className="user-table">
                        <thead>
                            <tr>
                                <th>HRU NO.</th>
                                <th>RESEARCH TITLE</th>
                                <th>AUTHOR</th>
                                <th>ASSIGNED EVALUATOR</th>
                                <th>SUBMITTED DATE</th>
                                <th>ACTIONS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="6" style={{ textAlign: 'center', padding: '40px' }}>
                                        <div className="loading-state">Loading...</div>
                                    </td>
                                </tr>
                            ) : paginatedResearches.length === 0 ? (
                                <tr>
                                    <td colSpan="6" style={{ textAlign: 'center', padding: '40px' }}>
                                        <div className="empty-state">
                                            <p>No pending research found.</p>
                                            <p className="empty-subtitle">
                                                {searchTerm || filterStatus !== 'all'
                                                    ? 'Try adjusting your search or filter criteria.'
                                                    : 'All research has been evaluated or is in progress.'}
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
                                            {research.assigned_evaluators && research.assigned_evaluators.length > 0 ? (
                                                <div className="evaluators-container">
                                                    {research.assigned_evaluators.map((assignedEval) => (
                                                        <span
                                                            key={assignedEval.id}
                                                            className="evaluator-chip"
                                                            title={assignedEval.email}
                                                        >
                                                            {assignedEval.name}
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="no-evaluators">No evaluator assigned</span>
                                            )}
                                        </td>
                                        <td>{new Date(research.registration_date).toLocaleDateString()}</td>
                                        <td className="action-btns">
                                            <button
                                                className="icon-btn assign-btn"
                                                onClick={() => handleAssignClick(research)}
                                                title="Assign Evaluator"
                                            >
                                                <UserPlus size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {!loading && filteredResearches.length > 0 && (
                    <div className="pagination-wrapper">
                        <div className="pagination-info">
                            Showing {filteredResearches.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1}–
                            {Math.min(currentPage * ITEMS_PER_PAGE, filteredResearches.length)} of {filteredResearches.length} results
                        </div>
                        {renderPagination()}
                    </div>
                )}

                {/* Assign Evaluator Modal */}
                {isAssignModalOpen && assignTarget && (
                    <div className="modal-overlay" onClick={() => !saving && setIsAssignModalOpen(false)}>
                        <div className="admin-modal assign-modal" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <div>
                                    <div className="hru-tag">{assignTarget.hru_no}</div>
                                    <h2>Assign Evaluator</h2>
                                    <p className="assign-subtitle">Select an evaluator to review this research</p>
                                </div>
                                <button className="icon-btn close-modal-btn" onClick={() => !saving && setIsAssignModalOpen(false)}>
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="detail-section">
                                <h3>Research Details</h3>
                                <div className="detail-grid">
                                    <div className="detail-item">
                                        <label>Title</label>
                                        <p>{assignTarget.title}</p>
                                    </div>
                                    <div className="detail-item">
                                        <label>Author</label>
                                        <p>{assignTarget.researcher_name}</p>
                                    </div>
                                    <div className="detail-item">
                                        <label>HRU Number</label>
                                        <p>{assignTarget.hru_no}</p>
                                    </div>
                                    <div className="detail-item">
                                        <label>Submission Date</label>
                                        <p>{new Date(assignTarget.registration_date).toLocaleDateString()}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="detail-section">
                                <h3>Select Evaluator</h3>
                                <div className="evaluator-list">
                                    {evaluators.map((ev) => {
                                        const isSelected = selectedEvaluatorId === ev.evaluator_id;
                                        const isAlreadyAssigned = alreadyAssigned?.evaluator_id === ev.evaluator_id;

                                        return (
                                            <div
                                                key={ev.evaluator_id}
                                                className={`evaluator-item ${isSelected ? 'selected' : ''}`}
                                                onClick={() => selectEvaluator(ev.evaluator_id)}
                                            >
                                                <div className={`evaluator-radio ${isSelected ? 'checked' : ''}`}>
                                                    {isSelected && <Check size={14} />}
                                                </div>
                                                <div className="evaluator-info">
                                                    <span className="evaluator-name">
                                                        {ev.name}
                                                        {isAlreadyAssigned && (
                                                            <span className="assigned-tag">Currently Assigned</span>
                                                        )}
                                                    </span>
                                                    <span className="evaluator-email">{ev.email}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="assign-actions">
                                    <div className="selected-count">
                                        {selectedEvaluatorId ? '1 evaluator selected' : 'No evaluator selected'}
                                    </div>
                                    <div className="assign-btns">
                                        <button
                                            className="cancel-assign-btn"
                                            onClick={() => setIsAssignModalOpen(false)}
                                            disabled={saving}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            className="save-assign-btn"
                                            onClick={handleSaveAssignments}
                                            disabled={!selectedEvaluatorId || saving}
                                        >
                                            {saving ? 'Saving...' : 'Save to Queue'}
                                        </button>
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
