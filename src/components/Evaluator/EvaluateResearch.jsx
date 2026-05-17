import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { UserAuth } from "../../context/AuthContext";
import { supabase } from "../../supabaseClient";
import Navbar from "./EvaluatorNavbar";
import { FileText } from "lucide-react";
import "./EvaluateResearch.css";

function EvaluateResearch() {
    const { researchId } = useParams();
    const navigate = useNavigate();
    const { user: authUser } = UserAuth();
    const leftCardRef = useRef(null);
    const [leftCardHeight, setLeftCardHeight] = useState(0);
    const [research, setResearch] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [evaluatorId, setEvaluatorId] = useState(null);
    const [evaluatorInfo, setEvaluatorInfo] = useState({
        name: '',
        email: ''
    });
    const [debugInfo, setDebugInfo] = useState({}); // For debugging
    const [evaluation, setEvaluation] = useState({
        scientificRigor: "",
        ethicalCompliance: "",
        relevance: "",
        methodology: "",
        strengths: "",
        weaknesses: "",
        recommendation: "",
        overallComments: "",
    });

    // Fetch evaluator directly with full debugging
    useEffect(() => {
        const fetchEvaluatorWithDebug = async () => {
            console.log('=== STARTING EVALUATOR FETCH WITH DEBUG ===');

            // Method 1: Try to get user from AuthContext
            console.log('1. AuthContext user:', authUser);
            console.log('   - user object keys:', authUser ? Object.keys(authUser) : 'null');
            console.log('   - user?.id:', authUser?.id);
            console.log('   - user?.user_id:', authUser?.user_id);

            // Method 2: Get session directly from Supabase
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();

            if (sessionError) {
                console.error('Session error:', sessionError);
                setDebugInfo(prev => ({ ...prev, sessionError: sessionError.message }));
                return;
            }

            if (!session) {
                console.error('No active session found');
                setDebugInfo(prev => ({ ...prev, error: 'No active session' }));
                return;
            }

            const authUserId = session.user.id;
            const authEmail = session.user.email;
            console.log('2. Session user from Supabase:', {
                authUserId,
                authEmail,
                userMetadata: session.user.user_metadata
            });

            setDebugInfo(prev => ({
                ...prev,
                sessionUserId: authUserId,
                sessionEmail: authEmail
            }));

            try {
                // Step 1: Check Evaluator table
                console.log('3. Querying Evaluator table with user_id:', authUserId);
                const { data: evaluatorData, error: evaluatorError } = await supabase
                    .from('Evaluator')
                    .select('evaluator_id, user_id')
                    .eq('user_id', authUserId)
                    .maybeSingle();

                if (evaluatorError) {
                    console.error('❌ Evaluator query error:', evaluatorError);
                    setDebugInfo(prev => ({ ...prev, evaluatorError: evaluatorError.message }));
                    return;
                }

                console.log('4. Evaluator query result:', evaluatorData);
                setDebugInfo(prev => ({ ...prev, evaluatorData }));

                if (!evaluatorData) {
                    console.error('❌ No evaluator record found for user_id:', authUserId);

                    // Let's check what evaluators DO exist
                    const { data: allEvaluators, error: listError } = await supabase
                        .from('Evaluator')
                        .select('evaluator_id, user_id')
                        .limit(5);

                    console.log('First 5 evaluators in table:', allEvaluators);
                    setDebugInfo(prev => ({
                        ...prev,
                        error: `No evaluator record for ${authUserId}`,
                        sampleEvaluators: allEvaluators
                    }));
                    return;
                }

                setEvaluatorId(evaluatorData.evaluator_id);
                console.log('✅ Set evaluatorId:', evaluatorData.evaluator_id);

                // Step 2: Get user details from Users table
                console.log('5. Querying Users table with user_id:', authUserId);
                const { data: userData, error: userError } = await supabase
                    .from('Users')
                    .select('first_name, last_name, email')
                    .eq('user_id', authUserId)
                    .maybeSingle();

                if (userError) {
                    console.error('❌ Users query error:', userError);
                    setDebugInfo(prev => ({ ...prev, userError: userError.message }));
                }

                console.log('6. Users query result:', userData);
                setDebugInfo(prev => ({ ...prev, userData }));

                if (userData) {
                    const fullName = `${userData.first_name || ''} ${userData.last_name || ''}`.trim();
                    setEvaluatorInfo({
                        name: fullName || 'Evaluator',
                        email: userData.email || authEmail || ''
                    });
                    console.log('✅ Set evaluator info from Users table:', { name: fullName, email: userData.email });
                } else {
                    console.warn('⚠️ No user record in Users table, using auth data');
                    setEvaluatorInfo({
                        name: session.user.user_metadata?.full_name || 'Evaluator',
                        email: authEmail || ''
                    });
                    setDebugInfo(prev => ({ ...prev, warning: 'User not found in Users table' }));
                }

            } catch (error) {
                console.error('❌ Unexpected error:', error);
                setDebugInfo(prev => ({ ...prev, unexpectedError: error.message }));
            }
        };

        fetchEvaluatorWithDebug();
    }, [authUser]);

    useEffect(() => {
        if (researchId) {
            fetchResearchDetails();
        }
    }, [researchId]);

    useLayoutEffect(() => {
        const updateHeight = () => {
            if (leftCardRef.current) {
                setLeftCardHeight(leftCardRef.current.getBoundingClientRect().height);
            }
        };

        updateHeight();
        window.addEventListener('resize', updateHeight);
        return () => window.removeEventListener('resize', updateHeight);
    }, [loading, research]);

    const fetchResearchDetails = async () => {
        try {
            const { data, error } = await supabase
                .from('Research')
                .select(`
                *,
                research_files ( file_url, file_type ),
                Researcher:researcher_id (
                    researcher_id,
                    user_id,
                    Users:user_id (
                        first_name,
                        last_name,
                        email
                    )
                )
            `)
                .eq('research_id', researchId)
                .single();

            if (error || !data) {
                console.error('Error fetching research:', error);
                // Fallback: just get the basic row so researcher_id is still available
                const { data: basicData } = await supabase
                    .from('Research')
                    .select('*')
                    .eq('research_id', researchId)
                    .single();
                setResearch(basicData || null);
                setLoading(false);
                return;
            }

            const researcher = data.Researcher;
            const users = researcher?.Users;
            data.author       = users ? `${users.first_name || ''} ${users.last_name || ''}`.trim() : 'Unknown Author';
            data.author_email = users?.email || 'No email';

            setResearch(data);
        } catch (error) {
            console.error("Error fetching research details:", error);
            setResearch(null);
        } finally {
            setLoading(false);
        }
    };

    const getCleanFileName = (url) => {
        if (!url) return "Unknown File";
        const parts = url.split('/');
        const fullFileName = parts[parts.length - 1];
        const cleanName = fullFileName.split('_').slice(1).join('_');
        return cleanName || fullFileName || "Unknown File";
    };

    const handleDownload = async (fileUrl, fileName) => {
        try {
            const { data, error } = await supabase.storage
                .from('research-files')
                .download(fileUrl);

            if (error) throw error;

            const url = window.URL.createObjectURL(data);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName || 'research-file';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Error downloading file:", error);
            window.open(fileUrl, '_blank');
        }
    };

    const handleChange = (field) => (event) => {
        setEvaluation((prev) => ({
            ...prev,
            [field]: event.target.value,
        }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (submitting) return;

        if (
            !evaluation.scientificRigor ||
            !evaluation.ethicalCompliance ||
            !evaluation.relevance ||
            !evaluation.methodology ||
            !evaluation.recommendation
        ) {
            alert('Please fill in all required evaluation fields before submitting.');
            return;
        }

        setSubmitting(true);

        try {
            const statusMap = {
                'Approved': 'Approved',
                'Minor_revision': 'With Minor Revisions',
                'Major_revision': 'With Major Revisions',
                'Rejected': 'Rejected',
            };
            const newStatus = statusMap[evaluation.recommendation];

            // ✅ Add evaluated_at with current timestamp
            const { error: evalError } = await supabase
                .from('Evaluation_Research')
                .insert([{
                    research_id: Number(researchId),
                    evaluator_id: evaluatorId,
                    sci_rigor: Number(evaluation.scientificRigor),
                    relevant_to_hru_obj: Number(evaluation.relevance),
                    ethical_compliance: Number(evaluation.ethicalCompliance),
                    methodology: evaluation.methodology,
                    strengths: evaluation.strengths,
                    weaknesses: evaluation.weaknesses,
                    overall_recommendation: evaluation.recommendation,
                    additional_comments: evaluation.overallComments,
                    evaluated_at: new Date().toISOString()  // ← Add this line
                }]);

            if (evalError) throw evalError;

            // Rest of your code remains the same...
            const { error: statusError } = await supabase
                .from('Research')
                .update({ status: newStatus })
                .eq('research_id', Number(researchId));

            if (statusError) throw statusError;

            const notesText = [
                `Evaluator: ${evaluatorInfo.name} (${evaluatorInfo.email})`,
                evaluation.overallComments,
                evaluation.strengths ? `Strengths: ${evaluation.strengths}` : null,
                evaluation.weaknesses ? `Weaknesses: ${evaluation.weaknesses}` : null,
            ].filter(Boolean).join('\n\n') || 'No additional comments provided.';

            const { data: logData, error: logError } = await supabase
                .from('ResearchActivityLog')
                .insert([{
                    research_id: Number(researchId),
                    actor_id: evaluatorId,
                    actor_role: 'evaluator',
                    action: 'evaluated',
                    notes: notesText,
                    status_snapshot: newStatus,
                }])
                .select()
                .single();

            if (logError) throw logError;
            console.log("logData:", logData);
            console.log("logData.log_id:", logData?.log_id);

            const researcherAuthUUID = research.Researcher?.user_id;

            // Always fetch researcher UUID fresh — don't rely on join
            const { data: researcherRow } = await supabase
                .from('Researcher')
                .select('user_id')
                .eq('researcher_id', research.researcher_id)
                .single();

            const recipientUUID = researcherRow?.user_id;

            if (!recipientUUID) {
                console.error('Could not find researcher UUID for notification');
            } else {
                const { error: notifError } = await supabase
                    .from('researcher_notifications')
                    .insert([{
                        recipient_id: recipientUUID,
                        research_id:  Number(researchId),
                        log_id:       logData.log_id,
                        message:      `Your research "${research.title}" has been evaluated. Status: ${newStatus}.`,
                    }]);

                if (notifError) {
                    console.error('Notification insert error:', notifError);
                }
            }

            // Update the latest ResearchRevisions row status to match decision
            const { data: latestRevision } = await supabase
                .from('ResearchRevisions')
                .select('revision_id')
                .eq('research_id', Number(researchId))
                .order('submitted_at', { ascending: false })
                .limit(1)
                .single();

            if (latestRevision) {
                await supabase
                    .from('ResearchRevisions')
                    .update({ status: newStatus })
                    .eq('revision_id', latestRevision.revision_id);
            }

            alert('Evaluation submitted successfully.');
            navigate('/evaluator-dashboard');

        } catch (error) {
            console.error('Submission Error:', error);
            alert(`Submission Error: ${error.message}`);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="evaluate-loading">Loading research details...</div>;
    if (!research) return <div className="evaluate-loading">Research not found</div>;

    return (
        <div className="evaluate-page">
            <Navbar />

            <main className="evaluate-container">
                <section className="evaluate-header">
                    <div className="evaluate-title">
                        <h1>Research Evaluation</h1>
                        <p>
                            Review the research details below and complete the evaluation criteria.
                            Your structured feedback will help move this submission toward the next stage.
                        </p>
                    </div>
                    <div className="action-buttons">
                        <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => navigate('/evaluator-dashboard')}
                        >
                            Back to Dashboard
                        </button>
                    </div>
                </section>

                {evaluatorInfo.name && (
                    <div className="evaluator-info-banner">
                        <div className="evaluator-info-content">
                            <strong>Evaluating as:</strong>
                            <span>{evaluatorInfo.name}</span>
                            <span>({evaluatorInfo.email})</span>
                        </div>
                    </div>
                )}

                {/* Rest of your JSX remains the same */}
                <div className="evaluate-grid">
                    <aside ref={leftCardRef} className="research-summary-card">
                        <div className="summary-header">
                            <span className="summary-status">
                                {research.status ? research.status.toUpperCase() : 'PENDING'}
                            </span>
                            <h2>{research.title || 'Untitled Research'}</h2>
                            <p>{research.description || 'No description available for this research submission.'}</p>
                        </div>

                        <div className="summary-detail-grid">
                            <div className="summary-row">
                                <strong>HRU Registration</strong>
                                <span>{research.hru_no || research.research_id || 'N/A'}</span>
                            </div>
                            <div className="summary-row">
                                <strong>Submission Date</strong>
                                <span>
                                    {research.registration_date
                                        ? new Date(research.registration_date).toLocaleDateString()
                                        : research.submission_date
                                            ? new Date(research.submission_date).toLocaleDateString()
                                            : 'N/A'}
                                </span>
                            </div>
                            <div className="summary-row">
                                <strong>Lead Author</strong>
                                <span>{research.author || 'N/A'}</span>
                            </div>
                            <div className="summary-row">
                                <strong>HRA Alignment</strong>
                                <span>{research.hra_alignment || 'Not provided'}</span>
                            </div>
                        </div>

                        <div className="research-files-section">
                            <h3>Submitted Files</h3>
                            <div className="file-list">
                                {research.research_files && research.research_files.length > 0 ? (
                                    research.research_files.map((file, index) => (
                                        <div key={index} className="file-item">
                                            <FileText size={18} />
                                            <div className="file-details">
                                                <span className="file-name">
                                                    {getCleanFileName(file.file_url)}
                                                </span>
                                                <span className="file-type">{file.file_type}</span>
                                            </div>
                                            <div className="file-buttons">
                                                <button
                                                    className="icon-btn"
                                                    onClick={() => window.open(file.file_url, '_blank')}
                                                    title="Preview"
                                                >
                                                    👁️
                                                </button>
                                                <button
                                                    className="icon-btn"
                                                    onClick={() => handleDownload(file.file_url, getCleanFileName(file.file_url))}
                                                    title="Download"
                                                >
                                                    📥
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="no-files">No files submitted</p>
                                )}
                            </div>
                        </div>
                    </aside>

                    <section
                        className="evaluation-card"
                        style={leftCardHeight ? { height: `${leftCardHeight}px` } : undefined}
                    >
                        <div className="evaluate-section-header">
                            <h2>Evaluation Form</h2>
                            <p>Provide ratings and comments across the research's scientific merit, ethics, relevance, and methodology.</p>
                        </div>

                        <form className="evaluate-form" onSubmit={handleSubmit}>
                            <div className="evaluate-form-grid">
                                <div className="evaluate-input-group">
                                    <label>Scientific Rigor <span className="required">*</span></label>
                                    <div className="rating-scale">
                                        {[5, 4, 3, 2, 1].map((value) => (
                                            <label key={value} className={`rating-option ${evaluation.scientificRigor === String(value) ? 'selected' : ''}`}>
                                                <input type="radio" name="scientificRigor" value={value} checked={evaluation.scientificRigor === String(value)} onChange={handleChange('scientificRigor')} />
                                                <span>{value}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div className="evaluate-input-group">
                                    <label>Ethical Compliance <span className="required">*</span></label>
                                    <div className="rating-scale">
                                        {[5, 4, 3, 2, 1].map((value) => (
                                            <label key={value} className={`rating-option ${evaluation.ethicalCompliance === String(value) ? 'selected' : ''}`}>
                                                <input type="radio" name="ethicalCompliance" value={value} checked={evaluation.ethicalCompliance === String(value)} onChange={handleChange('ethicalCompliance')} />
                                                <span>{value}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div className="evaluate-input-group">
                                    <label>Relevance to HRU Objectives <span className="required">*</span></label>
                                    <div className="rating-scale">
                                        {[5, 4, 3, 2, 1].map((value) => (
                                            <label key={value} className={`rating-option ${evaluation.relevance === String(value) ? 'selected' : ''}`}>
                                                <input type="radio" name="relevance" value={value} checked={evaluation.relevance === String(value)} onChange={handleChange('relevance')} />
                                                <span>{value}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div className="evaluate-input-group">
                                    <label>Methodology & Feasibility <span className="required">*</span></label>
                                    <textarea rows="4" value={evaluation.methodology} onChange={handleChange('methodology')} placeholder="Assess the study design, sample, analysis plan, and overall feasibility." />
                                </div>

                                <div className="evaluate-input-group evaluate-full">
                                    <label>Strengths</label>
                                    <textarea rows="4" value={evaluation.strengths} onChange={handleChange('strengths')} placeholder="Summarize the key strengths of the research." />
                                </div>

                                <div className="evaluate-input-group evaluate-full">
                                    <label>Weaknesses</label>
                                    <textarea rows="4" value={evaluation.weaknesses} onChange={handleChange('weaknesses')} placeholder="List the areas that need improvement or clarification." />
                                </div>

                                <div className="evaluate-input-group evaluate-full">
                                    <label>Overall Recommendation <span className="required">*</span></label>
                                    <select value={evaluation.recommendation} onChange={handleChange('recommendation')}>
                                        <option value="">Select recommendation</option>
                                        <option value="Approved">Approved</option>
                                        <option value="Minor_revision">Minor Revision</option>
                                        <option value="Major_revision">Major Revision</option>
                                        <option value="Rejected">Reject</option>
                                    </select>
                                </div>

                                <div className="evaluate-input-group evaluate-full">
                                    <label>Additional Comments</label>
                                    <textarea rows="5" value={evaluation.overallComments} onChange={handleChange('overallComments')} placeholder="Add any final remarks, clarifications, or recommended next steps." />
                                </div>
                            </div>

                            <div className="evaluate-form-actions">
                                <button type="button" className="btn-secondary" onClick={() => navigate('/evaluator-dashboard')}>Cancel</button>
                                <button type="submit" className="btn-primary" disabled={submitting}>
                                    {submitting ? 'Submitting...' : 'Submit Evaluation'}
                                </button>
                            </div>
                        </form>
                    </section>
                </div>
            </main>
        </div>
    );
}

export default EvaluateResearch;