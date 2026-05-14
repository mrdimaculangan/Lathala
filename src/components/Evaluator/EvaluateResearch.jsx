import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { UserAuth } from "../../context/AuthContext";
import { supabase } from "../../supabaseClient";
import Navbar from "./EvaluatorNavbar";
import { FileText } from "lucide-react"; // ✅ ADD THIS IMPORT
import "./EvaluateResearch.css";

function EvaluateResearch() {
    const { researchId } = useParams();
    const navigate = useNavigate();
    const { dbId } = UserAuth();
    const leftCardRef = useRef(null);
    const [leftCardHeight, setLeftCardHeight] = useState(0);
    const [research, setResearch] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
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
        const { data: basicData, error: basicError } = await supabase
            .from('Research')
            .select('*')
            .eq('research_id', researchId)
            .single();
        
        if (basicError) {
            console.error('Error fetching basic research:', basicError);
            setResearch(null);
            setLoading(false);
            return;
        }
        
        if (!basicData) {
            console.log('❌ No research found with ID:', researchId);
            setResearch(null);
            setLoading(false);
            return;
        }

        const { data, error } = await supabase
            .from('Research')
            .select(`
                *,
                research_files ( 
                    file_url, 
                    file_type,
                    file_name 
                ),
                Researcher:researcher_id (
                    researcher_id,
                    user_id,
                    User:user_id (
                        first_name,
                        last_name,
                        email
                    )
                )
            `)
            .eq('research_id', researchId)
            .single();

        console.log('Full research data:', data);
        console.log('Full research error:', error);

        if (error) {
            console.error('Error fetching full research:', error);
            // Use basic data if join fails
            setResearch(basicData);
            setLoading(false);
            return;
        }
        
        if (data) {
            const researcher = data.Researcher;
            const user = researcher?.User;
            
            data.author = user 
                ? `${user.first_name || ''} ${user.last_name || ''}`.trim() 
                : 'Unknown Author';
            data.author_email = user?.email || 'No email';
        }
        
        setResearch(data || basicData);
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
        const fileWithTimestamp = parts[parts.length - 1];
        const cleanName = fileWithTimestamp.split('_').slice(1).join('_');
        return cleanName || fileWithTimestamp;
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
            const { error } = await supabase
                .from('Evaluation_Research')
                .insert([{
                    research_id: Number(researchId),
                    evaluator_id: Number(dbId),
                    sci_rigor: Number(evaluation.scientificRigor),
                    relevant_to_hru_obj: Number(evaluation.relevance),
                    ethical_compliance: Number(evaluation.ethicalCompliance),
                    methodology: evaluation.methodology,
                    strengths: evaluation.strengths,
                    weaknesses: evaluation.weaknesses,
                    overall_recommendation: evaluation.recommendation,
                    additional_comments: evaluation.overallComments
                }]);

            if (error) throw error;

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

                <div className="evaluate-grid">
                    {/* Left sidebar with research summary */}
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

                        {/* Research Files Section - NEW */}
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
                                    <label>
                                        Scientific Rigor <span className="required">*</span>
                                    </label>
                                    <div className="rating-scale">
                                        {[5, 4, 3, 2, 1].map((value) => (
                                            <label
                                                key={value}
                                                className={`rating-option ${evaluation.scientificRigor === String(value) ? 'selected' : ''}`}
                                            >
                                                <input
                                                    type="radio"
                                                    name="scientificRigor"
                                                    value={value}
                                                    checked={evaluation.scientificRigor === String(value)}
                                                    onChange={handleChange('scientificRigor')}
                                                />
                                                <span>{value}</span>
                                            </label>
                                        ))}
                                    </div>
                                    <div className="rating-help">1 = Poor, 5 = Excellent</div>
                                </div>

                                <div className="evaluate-input-group">
                                    <label>
                                        Ethical Compliance <span className="required">*</span>
                                    </label>
                                    <div className="rating-scale">
                                        {[5, 4, 3, 2, 1].map((value) => (
                                            <label
                                                key={value}
                                                className={`rating-option ${evaluation.ethicalCompliance === String(value) ? 'selected' : ''}`}
                                            >
                                                <input
                                                    type="radio"
                                                    name="ethicalCompliance"
                                                    value={value}
                                                    checked={evaluation.ethicalCompliance === String(value)}
                                                    onChange={handleChange('ethicalCompliance')}
                                                />
                                                <span>{value}</span>
                                            </label>
                                        ))}
                                    </div>
                                    <div className="rating-help">1 = Not compliant, 5 = Fully compliant</div>
                                </div>

                                <div className="evaluate-input-group">
                                    <label>
                                        Relevance to HRU Objectives <span className="required">*</span>
                                    </label>
                                    <div className="rating-scale">
                                        {[5, 4, 3, 2, 1].map((value) => (
                                            <label
                                                key={value}
                                                className={`rating-option ${evaluation.relevance === String(value) ? 'selected' : ''}`}
                                            >
                                                <input
                                                    type="radio"
                                                    name="relevance"
                                                    value={value}
                                                    checked={evaluation.relevance === String(value)}
                                                    onChange={handleChange('relevance')}
                                                />
                                                <span>{value}</span>
                                            </label>
                                        ))}
                                    </div>
                                    <div className="rating-help">1 = Not relevant, 5 = Highly relevant</div>
                                </div>

                                <div className="evaluate-input-group">
                                    <label>
                                        Methodology & Feasibility <span className="required">*</span>
                                    </label>
                                    <textarea
                                        rows="4"
                                        value={evaluation.methodology}
                                        onChange={handleChange('methodology')}
                                        placeholder="Assess the study design, sample, analysis plan, and overall feasibility."
                                    />
                                </div>

                                <div className="evaluate-input-group evaluate-full">
                                    <label>Strengths</label>
                                    <textarea
                                        rows="4"
                                        value={evaluation.strengths}
                                        onChange={handleChange('strengths')}
                                        placeholder="Summarize the key strengths of the research."
                                    />
                                </div>

                                <div className="evaluate-input-group evaluate-full">
                                    <label>Weaknesses</label>
                                    <textarea
                                        rows="4"
                                        value={evaluation.weaknesses}
                                        onChange={handleChange('weaknesses')}
                                        placeholder="List the areas that need improvement or clarification."
                                    />
                                </div>

                                <div className="evaluate-input-group evaluate-full">
                                    <label>
                                        Overall Recommendation <span className="required">*</span>
                                    </label>
                                    <select
                                        value={evaluation.recommendation}
                                        onChange={handleChange('recommendation')}
                                    >
                                        <option value="">Select recommendation</option>
                                        <option value="Approved">Approved</option>
                                        <option value="Minor_revision">Minor Revision</option>
                                        <option value="Major_revision">Major Revision</option>
                                        <option value="Rejected">Reject</option>
                                    </select>
                                </div>

                                <div className="evaluate-input-group evaluate-full">
                                    <label>Additional Comments</label>
                                    <textarea
                                        rows="5"
                                        value={evaluation.overallComments}
                                        onChange={handleChange('overallComments')}
                                        placeholder="Add any final remarks, clarifications, or recommended next steps."
                                    />
                                </div>
                            </div>

                            <div className="evaluate-form-actions">
                                <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={() => navigate('/evaluator-dashboard')}
                                >
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary">
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
