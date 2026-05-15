import React, { useState, useEffect } from "react";
import { supabase } from "../../supabaseClient";
import { UserPlus, X, Check, Users } from 'lucide-react';
import AdminNavbar from "./AdminNavbar";
import "./AdminQueue.css";

export default function AdminQueue() {
    const [researches, setResearches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [assignTarget, setAssignTarget] = useState(null);
    const [evaluators, setEvaluators] = useState([]);
    const [selectedEvaluatorIds, setSelectedEvaluatorIds] = useState([]);
    const [alreadyAssigned, setAlreadyAssigned] = useState([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadQueueData();
    }, []);

    async function loadQueueData() {
        setLoading(true);
        try {
            // Get research IDs that already have evaluations (completed)
            const { data: evaluatedResearch, error: evalError } = await supabase
                .from('Evaluation_Research')
                .select('research_id');

            if (evalError) throw evalError;

            const evaluatedIds = evaluatedResearch?.map(er => er.research_id) || [];

            // Build query for unevaluated research
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

            // Filter out already evaluated research
            if (evaluatedIds.length > 0) {
                query = query.not('research_id', 'in', `(${evaluatedIds.join(',')})`);
            }

            const { data: researchData, error: researchError } = await query;

            if (researchError) throw researchError;

            // Get assigned evaluators for these research items
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

                // Process and combine the data
                const processedResearches = researchData.map(research => {
                    const assignedEvaluators = (queueData || [])
                        .filter(q => q.research_id === research.research_id)
                        .map(q => {
                            // Properly format name with space
                            const firstName = q.Evaluator?.Users?.first_name || '';
                            const lastName = q.Evaluator?.Users?.last_name || '';
                            const fullName = `${firstName} ${lastName}`.trim();

                            return {
                                id: q.evaluator_id,
                                name: fullName || 'Unknown',
                                email: q.Evaluator?.Users?.email || 'No email',
                                assigned_at: q.assigned_at,
                                status: q.status
                            };
                        });

                    // Format researcher name with space
                    const researcherFirstName = research.Researcher?.Users?.first_name || '';
                    const researcherLastName = research.Researcher?.Users?.last_name || '';
                    const researcherFullName = `${researcherFirstName} ${researcherLastName}`.trim();

                    return {
                        ...research,
                        researcher_name: researcherFullName || 'Unknown',
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
            // Get all evaluators with their user info
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

            // Get currently assigned evaluators for this research
            const { data: assignedData, error: assignedError } = await supabase
                .from('Research_Queue')
                .select('evaluator_id')
                .eq('research_id', research.research_id);

            if (assignedError) throw assignedError;

            const formattedEvaluators = (evaluatorsData || []).map(ev => {
                const firstName = ev.Users?.first_name || '';
                const lastName = ev.Users?.last_name || '';
                const fullName = `${firstName} ${lastName}`.trim();

                return {
                    evaluator_id: ev.evaluator_id,
                    name: fullName || 'Unknown',
                    email: ev.Users?.email || 'No email'
                };
            });

            setEvaluators(formattedEvaluators);
            setAlreadyAssigned(assignedData || []);
            setSelectedEvaluatorIds((assignedData || []).map(a => a.evaluator_id));
        } catch (err) {
            console.error('Error loading evaluators:', err);
            alert('Failed to load evaluators. Please try again.');
        }
    };

    const handleSaveAssignments = async () => {
        setSaving(true);
        const currentSelection = selectedEvaluatorIds.map(id => Number(id));
        const alreadyIds = alreadyAssigned.map(a => Number(a.evaluator_id));

        const toAdd = currentSelection.filter(id => !alreadyIds.includes(id));
        const toRemove = alreadyIds.filter(id => !currentSelection.includes(id));

        try {
            // Add new assignments
            if (toAdd.length > 0) {
                const newRows = toAdd.map(id => ({
                    research_id: assignTarget.research_id,
                    evaluator_id: id,
                    assigned_at: new Date().toISOString(),
                    status: 'Pending'
                }));

                const { error: insertError } = await supabase
                    .from('Research_Queue')
                    .insert(newRows);

                if (insertError) throw insertError;
            }

            // Remove unassigned evaluators
            if (toRemove.length > 0) {
                const { error: deleteError } = await supabase
                    .from('Research_Queue')
                    .delete()
                    .eq('research_id', assignTarget.research_id)
                    .in('evaluator_id', toRemove);

                if (deleteError) throw deleteError;
            }

            alert(`Successfully updated evaluators for ${assignTarget.hru_no}`);
            setIsAssignModalOpen(false);
            await loadQueueData(); // Refresh the list
        } catch (error) {
            console.error('Error saving assignments:', error);
            alert('Error saving assignments. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const toggleEvaluator = (evaluatorId) => {
        setSelectedEvaluatorIds(prev =>
            prev.includes(evaluatorId)
                ? prev.filter(id => id !== evaluatorId)
                : [...prev, evaluatorId]
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
                    <div className="queue-stats">
                        <div className="stat-badge">
                            <Users size={16} />
                            <span>{researches.length} Pending</span>
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
                                <th>ASSIGNED EVALUATORS</th>
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
                            ) : researches.length === 0 ? (
                                <tr>
                                    <td colSpan="6" style={{ textAlign: 'center', padding: '40px' }}>
                                        <div className="empty-state">
                                            <p>No pending research found.</p>
                                            <p className="empty-subtitle">
                                                All research has been evaluated or is in progress.
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                researches.map((research) => (
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
                                                            data-email={assignedEval.email}
                                                            title={assignedEval.email}
                                                        >
                                                            {assignedEval.name}
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="no-evaluators">No evaluators assigned</span>
                                            )}
                                        </td>
                                        <td>{new Date(research.registration_date).toLocaleDateString()}</td>
                                        <td className="action-btns">
                                            <button
                                                className="icon-btn assign-btn"
                                                onClick={() => handleAssignClick(research)}
                                                title="Assign Evaluators"
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

                {/* Assign Evaluators Modal */}
                {isAssignModalOpen && assignTarget && (
                    <div className="modal-overlay" onClick={() => !saving && setIsAssignModalOpen(false)}>
                        <div className="admin-modal assign-modal" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <div>
                                    <div className="hru-tag">{assignTarget.hru_no}</div>
                                    <h2>Assign Evaluators</h2>
                                    <p className="assign-subtitle">Select evaluators to review this research</p>
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
                                <h3>Select Evaluators</h3>
                                <div className="evaluator-list">
                                    {evaluators.map((ev) => {
                                        const isChecked = selectedEvaluatorIds.includes(ev.evaluator_id);
                                        const isAlreadyAssigned = alreadyAssigned.some(a => a.evaluator_id === ev.evaluator_id);

                                        return (
                                            <div
                                                key={ev.evaluator_id}
                                                className={`evaluator-item ${isChecked ? 'selected' : ''} ${isAlreadyAssigned && !isChecked ? 'already-in' : ''}`}
                                                onClick={() => toggleEvaluator(ev.evaluator_id)}
                                            >
                                                <div className={`evaluator-checkbox ${isChecked ? 'checked' : ''}`}>
                                                    {isChecked && <Check size={14} />}
                                                </div>
                                                <div className="evaluator-info">
                                                    <span className="evaluator-name">
                                                        {ev.name}
                                                        {isAlreadyAssigned && !isChecked && (
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
                                            disabled={selectedEvaluatorIds.length === 0 || saving}
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