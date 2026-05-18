import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import { FileText, Paperclip, CheckCircle, XCircle, Clock, X, RefreshCw } from 'lucide-react';
import Navbar from "./EvaluatorNavbar";
import "./EvaluatorDashboard.css";

function EvaluatorDashboard() {
    const navigate = useNavigate();
    const [researches, setResearches]             = useState([]);
    const [loading, setLoading]                   = useState(true);
    const [currentDate, setCurrentDate]           = useState(new Date());
    const [selectedResearch, setSelectedResearch] = useState(null);
    const [showModal, setShowModal]               = useState(false);
    const [activeTab, setActiveTab]               = useState('submissions'); // ADDED

    // Resubmission eval modal
    const [showEvalModal, setShowEvalModal]       = useState(null); // holds the research
    const [submitting, setSubmitting]             = useState(false);
    const [evaluation, setEvaluation]             = useState({
        scientificRigor: '', ethicalCompliance: '', relevance: '',
        methodology: '', strengths: '', weaknesses: '',
        recommendation: '', overallComments: ''
    });
    const [revisions, setRevisions]               = useState([]); // for showing history

    useEffect(() => { loadAllData(); }, []); // FIXED: changed loadResearches to loadAllData

    async function loadAllData() {
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) { setLoading(false); return; }

            const authUserId = session.user.id;

            const { data: evaluatorData } = await supabase
                .from('Evaluator')
                .select('evaluator_id')
                .eq('user_id', authUserId)
                .maybeSingle();

            if (!evaluatorData) { setLoading(false); return; }

            const { data: queueData } = await supabase
                .from('Research_Queue')
                .select('research_id')
                .eq('evaluator_id', evaluatorData.evaluator_id);

            if (!queueData || queueData.length === 0) { setResearches([]); setLoading(false); return; }

            const assignedIds = queueData.map(q => q.research_id);

            const { data: researchData } = await supabase
                .from('Research')
                .select(`
                    *,
                    research_files (file_url, file_type),
                    Researcher:researcher_id (
                        researcher_id,
                        user_id,
                        Users:user_id (first_name, last_name, email)
                    )
                `)
                .in('research_id', assignedIds)
                .order('registration_date', { ascending: false });

            console.log('Raw researchData:', JSON.stringify(researchData, null, 2));

            const formatted = (researchData || []).map(r => ({
                ...r,
                author: r.Researcher?.Users
                    ? `${r.Researcher.Users.first_name || ''} ${r.Researcher.Users.last_name || ''}`.trim()
                    : 'Unknown',
                author_email: r.Researcher?.Users?.email || '',
                evaluatorId: evaluatorData.evaluator_id,
                authUserId,
            }));

            setResearches(formatted);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    // ADDED: Get pending submissions (first-time submissions)
    const pendingSubmissions = researches.filter(r => {
        const s = r.status?.toLowerCase() || 'pending';
        // Submissions that are not revisions (no revision history or status is pending/under review)
        return (s === 'pending' || s === 'under review') && !r.has_revision;
    });

    // ADDED: Get pending revisions
    const pendingRevisions = researches.filter(r => {
        const s = r.status?.toLowerCase() || 'pending';
        // Resubmissions that need evaluation
        return (s.includes('minor') || s.includes('major')) || r.status === 'revision_pending';
    });

    // Pending = needs first evaluation OR resubmission review
    const pendingResearches = researches.filter(r => {
        const s = r.status?.toLowerCase() || 'pending';
        // Show anything that is NOT fully approved or rejected
        return s !== 'approved' && s !== 'rejected';
    });
    const approvedCount     = researches.filter(r => r.status?.toLowerCase() === 'approved').length;
    const rejectedCount     = researches.filter(r => r.status?.toLowerCase() === 'rejected').length;

    const getStatusBadge = (status) => {
        const s = status?.toLowerCase() || 'pending';
        if (s === 'pending')                                  return <span className="status-badge status-pending"><Clock size={14} /> Pending</span>;
        if (s === 'approved')                                 return <span className="status-badge status-approved"><CheckCircle size={14} /> Approved</span>;
        if (s === 'rejected')                                 return <span className="status-badge status-rejected"><XCircle size={14} /> Rejected</span>;
        if (s.includes('minor') || s.includes('major'))      return <span className="status-badge status-revision"><FileText size={14} /> Revision</span>;
        return <span className="status-badge status-pending">{status}</span>;
    };

    // ADDED: Get revision type badge
    const getRevisionTypeBadge = (revisionType) => {
        const type = revisionType?.toLowerCase() || '';
        if (type === 'minor') return <span className="status-badge status-minor">Minor Revision</span>;
        if (type === 'major') return <span className="status-badge status-major">Major Revision</span>;
        return <span className="status-badge status-pending">Revision</span>;
    };

    const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A';
    
    // ADDED: Format datetime
    const formatDateTime = (d) => d ? new Date(d).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';

    const handleResearchClick = async (research) => {
        setSelectedResearch(research);

        // Check if there's a pending revision (resubmission)
        const { data: revData } = await supabase
            .from('ResearchRevisions')
            .select('*')
            .eq('research_id', research.research_id)
            .order('submitted_at', { ascending: false });

        setRevisions(revData || []);
        setShowModal(true);
    };

    // ADDED: Handle revision click
    const handleRevisionClick = async (revision) => {
        // Fetch the full research data for this revision
        const { data: researchData } = await supabase
            .from('Research')
            .select('*')
            .eq('research_id', revision.research_id)
            .single();
        
        if (researchData) {
            setSelectedResearch(researchData);
            setRevisions([revision]);
            setShowModal(true);
        }
    };

    const closeModal = () => {
        setShowModal(false);
        setSelectedResearch(null);
        setRevisions([]);
    };

    // Open the quick evaluation modal for resubmissions
    const handleOpenEvalModal = () => {
        setShowModal(false);
        setShowEvalModal(selectedResearch);
        setEvaluation({ scientificRigor: '', ethicalCompliance: '', relevance: '', methodology: '', strengths: '', weaknesses: '', recommendation: '', overallComments: '' });
    };

    const handleEvaluate = () => {
        closeModal();
        navigate(`/evaluate-research/${selectedResearch.research_id}`);
    };

    const handleChange = (field) => (e) => setEvaluation(prev => ({ ...prev, [field]: e.target.value }));

    const handleSubmitEval = async () => {
        if (!evaluation.scientificRigor || !evaluation.ethicalCompliance || !evaluation.relevance || !evaluation.methodology || !evaluation.recommendation) {
            alert('Please fill in all required fields.'); return;
        }
        if (submitting) return;
        setSubmitting(true);

        try {
            const research = showEvalModal;
            const statusMap = {
                'Approved': 'Approved',
                'Minor_revision': 'With Minor Revisions',
                'Major_revision': 'With Major Revisions',
                'Rejected': 'Rejected',
            };
            const newStatus = statusMap[evaluation.recommendation];

            // 1. Insert evaluation
            await supabase.from('Evaluation_Research').insert([{
                research_id:             research.research_id,
                evaluator_id:            research.evaluatorId,
                sci_rigor:               Number(evaluation.scientificRigor),
                relevant_to_hru_obj:     Number(evaluation.relevance),
                ethical_compliance:      Number(evaluation.ethicalCompliance),
                methodology:             evaluation.methodology,
                strengths:               evaluation.strengths,
                weaknesses:              evaluation.weaknesses,
                overall_recommendation:  evaluation.recommendation,
                additional_comments:     evaluation.overallComments,
                evaluated_at:            new Date().toISOString()
            }]);

            // 2. Update Research status
            await supabase.from('Research').update({ status: newStatus }).eq('research_id', research.research_id);

            // 3. Update latest revision status
            const { data: latestRev } = await supabase
                .from('ResearchRevisions')
                .select('revision_id')
                .eq('research_id', research.research_id)
                .order('submitted_at', { ascending: false })
                .limit(1)
                .single();

            if (latestRev) {
                await supabase.from('ResearchRevisions').update({ status: newStatus }).eq('revision_id', latestRev.revision_id);
            }

            // 4. Log activity
            const { data: logData } = await supabase
                .from('ResearchActivityLog')
                .insert([{
                    research_id: research.research_id,
                    actor_id:    research.evaluatorId,
                    actor_role:  'evaluator',
                    action:      'evaluated',
                    notes:       evaluation.overallComments || 'No additional comments.',
                }])
                .select()
                .single();

            // 5. Notify researcher — fresh lookup, don't rely on join
            const { data: researcherRow } = await supabase
                .from('Researcher')
                .select('user_id')
                .eq('researcher_id', research.researcher_id)
                .single();

            const researcherUUID = researcherRow?.user_id;

            if (researcherUUID && logData) {
                await supabase.from('researcher_notifications').insert([{
                    recipient_id: researcherUUID,
                    research_id:  research.research_id,
                    log_id:       logData?.log_id ?? null,
                    message:      `Your revision for "${research.title}" has been evaluated. Status: ${newStatus}.`,
                }]);
            }

            alert('Evaluation submitted.');
            setShowEvalModal(null);
            loadAllData(); // FIXED: changed loadResearches to loadAllData

        } catch (err) {
            console.error(err);
            alert('Error: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    // Calendar
    const getDaysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
    const getFirstDayOfMonth = (y, m) => new Date(y, m, 1).getDay();

    const renderCalendar = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const daysInMonth = getDaysInMonth(year, month);
        const firstDay = getFirstDayOfMonth(year, month);
        const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
        const days = [];
        for (let i = 0; i < firstDay; i++) days.push(<div key={`e-${i}`} className="calendar-day empty" />);
        for (let i = 1; i <= daysInMonth; i++) {
            const isToday = i === new Date().getDate() && year === new Date().getFullYear() && month === new Date().getMonth();
            days.push(<div key={i} className={`calendar-day ${isToday ? 'today' : ''}`}>{i}</div>);
        }
        return (
            <div className="calendar">
                <div className="calendar-header">
                    <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))}>&lt;</button>
                    <h3>{monthNames[month]} {year}</h3>
                    <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))}>&gt;</button>
                </div>
                <div className="calendar-weekdays">{['S','M','T','W','T','F','S'].map((d, i) => <div key={i}>{d}</div>)}</div>
                <div className="calendar-days">{days}</div>
            </div>
        );
    };

    return (
        <div className="dashboard-wrapper">
            <Navbar />
            <main className="dashboard-container">
                <div className="first-row">
                    <div className="title-section"><h1>Evaluator Dashboard</h1></div>
                    <div className="stats-group">
                        <div className="stat-item">
                            <Paperclip size={45} className="research-icon" />
                            <span className="stat-label">TOTAL<br/>RESEARCHES</span>
                            <span className="stat-number">{researches.length}</span>
                        </div>
                        <div className="stat-item">
                            <FileText size={45} className="research-icon" />
                            <span className="stat-label">PENDING<br/>RESEARCHES</span>
                            <span className="stat-number">{pendingResearches.length}</span>
                        </div>
                        <div className="stat-item">
                            <CheckCircle size={45} className="research-icon" />
                            <span className="stat-label">APPROVED<br/>RESEARCHES</span>
                            <span className="stat-number">{approvedCount}</span>
                        </div>
                        <div className="stat-item">
                            <XCircle size={45} className="research-icon" />
                            <span className="stat-label">REJECTED<br/>RESEARCHES</span>
                            <span className="stat-number">{rejectedCount}</span>
                        </div>
                    </div>
                </div>

                <div className="second-row">
                    <div className="review-section">
                        <div className="recent-header">
                            <h1>Evaluation Queue</h1>
                            <p>Research papers assigned to you — including resubmissions.</p>
                        </div>
                        
                        {/* ADDED: Tab buttons */}
                        <div className="tabs" style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid #e2e8f0' }}>
                            <button 
                                onClick={() => setActiveTab('submissions')}
                                style={{ 
                                    padding: '10px 20px', 
                                    background: activeTab === 'submissions' ? '#031640' : 'transparent',
                                    color: activeTab === 'submissions' ? 'white' : '#475569',
                                    border: 'none',
                                    borderRadius: '8px 8px 0 0',
                                    cursor: 'pointer',
                                    fontWeight: 600
                                }}
                            >
                                Original Submissions ({pendingSubmissions.length})
                            </button>
                            <button 
                                onClick={() => setActiveTab('revisions')}
                                style={{ 
                                    padding: '10px 20px', 
                                    background: activeTab === 'revisions' ? '#031640' : 'transparent',
                                    color: activeTab === 'revisions' ? 'white' : '#475569',
                                    border: 'none',
                                    borderRadius: '8px 8px 0 0',
                                    cursor: 'pointer',
                                    fontWeight: 600
                                }}
                            >
                                Revisions ({pendingRevisions.length})
                            </button>
                        </div>

                        {loading ? (
                            <div className="loading-state">Loading...</div>
                        ) : (
                            <>
                                {/* Original Submissions Tab */}
                                {activeTab === 'submissions' && (
                                    <div className="submissions-table">
                                        <div className="table-header">
                                            <div>HRU NUMBER</div>
                                            <div>RESEARCH TITLE</div>
                                            <div>STATUS</div>
                                            <div>DATE</div>
                                        </div>

                                        {pendingSubmissions.length === 0 ? (
                                            <div className="empty-state">No pending submissions assigned to you.</div>
                                        ) : (
                                            pendingSubmissions.map((research) => (
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
                                )}

                                {/* Revisions Tab */}
                                {activeTab === 'revisions' && (
                                    <div className="submissions-table">
                                        <div className="table-header">
                                            <div>HRU NUMBER</div>
                                            <div>RESEARCH TITLE</div>
                                            <div>REVISION TYPE</div>
                                            <div>SUBMITTED</div>
                                        </div>

                                        {pendingRevisions.length === 0 ? (
                                            <div className="empty-state">No pending revisions assigned to you.</div>
                                        ) : (
                                            pendingRevisions.map((research) => (
                                                <div
                                                    key={research.research_id}
                                                    className="table-row"
                                                    onClick={() => handleResearchClick(research)}
                                                    style={{ cursor: 'pointer' }}
                                                >
                                                    <div className="hru-number">{research.hru_no || research.research_id}</div>
                                                    <div className="research-title">{research.title}</div>
                                                    <div>{getStatusBadge(research.status)}</div>
                                                    <div>{formatDate(research.updated_at || research.registration_date)}</div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                    <div className="calendar-section">{renderCalendar()}</div>
                </div>

                {/* Research details modal */}
                {showModal && selectedResearch && (
                    <div className="modal-overlay" onClick={closeModal}>
                        <div className="modal-content" onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                                <div className="modal-title-section">
                                    <h2>Research Details</h2>
                                    {getStatusBadge(selectedResearch.status)}
                                </div>
                                <button className="modal-close" onClick={closeModal}>×</button>
                            </div>
                            <div className="modal-body">
                                <div className="modal-field"><label>Title:</label><b><p>{selectedResearch.title}</p></b></div>
                                <div className="modal-field"><label>Description:</label><p>{selectedResearch.description || 'No description'}</p></div>
                                <div className="modal-row-two">
                                    <div className="modal-field-half"><label>Author:</label><p>{selectedResearch.author}</p></div>
                                    <div className="modal-field-half"><label>Email:</label><p>{selectedResearch.author_email}</p></div>
                                </div>
                                <div className="modal-row-two">
                                    <div className="modal-field-half"><label>Submission Date:</label><p>{formatDate(selectedResearch.registration_date)}</p></div>
                                    <div className="modal-field-half"><label>HRU Number:</label><p>{selectedResearch.hru_no}</p></div>
                                </div>

                                {/* Show revision history if any */}
                                {revisions.length > 0 && (
                                    <div style={{ marginTop: '1.5rem' }}>
                                        <p style={{ fontWeight: 700, fontSize: '0.85rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
                                            Revision History ({revisions.length})
                                        </p>
                                        {revisions.map((rev, i) => (
                                            <div key={rev.revision_id} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', marginBottom: '8px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                                    <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                                                        Revision #{revisions.length - i}
                                                        {i === 0 && <span style={{ marginLeft: '8px', fontSize: '0.65rem', background: '#fef9c3', color: '#854d0e', padding: '2px 8px', borderRadius: '999px' }}>LATEST</span>}
                                                    </span>
                                                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{formatDate(rev.submitted_at)}</span>
                                                </div>
                                                {rev.researcher_comment && <p style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '8px' }}><strong>Note:</strong> {rev.researcher_comment}</p>}
                                                <a href={rev.new_file_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.8rem', color: '#2563eb', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                    <FileText size={14} /> View revised file
                                                </a>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button className="btn-cancel" onClick={closeModal}>Cancel</button>
                                {revisions.length > 0 ? (
                                    // Has revisions — quick eval in modal
                                    <button className="btn-evaluate" onClick={handleOpenEvalModal}>
                                        Evaluate Resubmission
                                    </button>
                                ) : (
                                    // First evaluation — full page
                                    <button className="btn-evaluate" onClick={handleEvaluate}>
                                        Evaluate
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Quick evaluation modal for resubmissions */}
                {showEvalModal && (
                    <div className="modal-overlay" onClick={() => setShowEvalModal(null)}>
                        <div className="modal-content" style={{ maxWidth: '680px' }} onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                                <div>
                                    <h2>Evaluate Resubmission</h2>
                                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{showEvalModal.title}</span>
                                </div>
                                <button className="modal-close" onClick={() => setShowEvalModal(null)}>×</button>
                            </div>
                            <div className="modal-body" style={{ overflowY: 'auto', maxHeight: '65vh' }}>
                                {/* Ratings */}
                                {[
                                    { label: 'Scientific Rigor *', field: 'scientificRigor' },
                                    { label: 'Ethical Compliance *', field: 'ethicalCompliance' },
                                    { label: 'Relevance to HRU *', field: 'relevance' },
                                ].map(({ label, field }) => (
                                    <div key={field} style={{ marginBottom: '1.25rem' }}>
                                        <label style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: '8px', color: '#334155' }}>{label}</label>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            {[5,4,3,2,1].map(v => (
                                                <label key={v} style={{
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    width: '40px', height: '40px', borderRadius: '8px', cursor: 'pointer',
                                                    background: evaluation[field] === String(v) ? '#031640' : '#f1f5f9',
                                                    color: evaluation[field] === String(v) ? 'white' : '#475569',
                                                    fontWeight: 600, fontSize: '0.875rem'
                                                }}>
                                                    <input type="radio" name={field} value={v} checked={evaluation[field] === String(v)} onChange={handleChange(field)} style={{ display: 'none' }} />
                                                    {v}
                                                </label>
                                            ))}
                                            <span style={{ fontSize: '0.75rem', color: '#94a3b8', alignSelf: 'center', marginLeft: '4px' }}>1=Poor 5=Excellent</span>
                                        </div>
                                    </div>
                                ))}

                                {/* Textareas */}
                                {[
                                    { label: 'Methodology & Feasibility *', field: 'methodology', placeholder: 'Assess the study design and feasibility.' },
                                    { label: 'Strengths', field: 'strengths', placeholder: 'Key strengths of the research.' },
                                    { label: 'Weaknesses', field: 'weaknesses', placeholder: 'Areas needing improvement.' },
                                    { label: 'Additional Comments', field: 'overallComments', placeholder: 'Any final remarks.' },
                                ].map(({ label, field, placeholder }) => (
                                    <div key={field} style={{ marginBottom: '1rem' }}>
                                        <label style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: '6px', color: '#334155' }}>{label}</label>
                                        <textarea rows={3} placeholder={placeholder} value={evaluation[field]} onChange={handleChange(field)}
                                                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.875rem', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
                                    </div>
                                ))}

                                {/* Recommendation */}
                                <div style={{ marginBottom: '1rem' }}>
                                    <label style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: '6px', color: '#334155' }}>Overall Recommendation *</label>
                                    <select value={evaluation.recommendation} onChange={handleChange('recommendation')}
                                            style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.875rem', outline: 'none', background: 'white' }}>
                                        <option value="">Select recommendation</option>
                                        <option value="Approved">Approved</option>
                                        <option value="Minor_revision">Minor Revision</option>
                                        <option value="Major_revision">Major Revision</option>
                                        <option value="Rejected">Reject</option>
                                    </select>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button className="btn-cancel" onClick={() => setShowEvalModal(null)} disabled={submitting}>Cancel</button>
                                <button className="btn-evaluate" onClick={handleSubmitEval} disabled={submitting}>
                                    {submitting ? 'Submitting...' : 'Submit Evaluation'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

export default EvaluatorDashboard;