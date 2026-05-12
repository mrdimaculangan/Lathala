import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { supabase } from "../../supabaseClient";
import Navbar from "./EvaluatorNavbar";
import "./EvaluateResearch.css";

function EvaluateResearch() {
    const { researchId } = useParams();
    const navigate = useNavigate();
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
        fetchResearchDetails();
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

    async function fetchResearchDetails() {
        setLoading(true);
        const { data, error } = await supabase
            .from('Research')
            .select('*')
            .eq('research_id', researchId)
            .single();

        if (error) {
            console.error('Error fetching research:', error);
        } else {
            setResearch(data);
        }
        setLoading(false);
    }

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
            console.log('Submitting evaluation for research:', researchId, evaluation);
            alert('Evaluation submitted successfully.');
            navigate('/evaluator-dashboard');
        } catch (error) {
            console.error('Error submitting evaluation:', error);
            alert('There was a problem submitting the evaluation. Please try again.');
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
                            <div className="summary-row summary-row--full">
                                <strong>Alignment Summary</strong>
                                <span>{research.hra_description || research.alignment_description || 'No alignment summary available.'}</span>
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
                                        <option value="approve">Approve</option>
                                        <option value="minor_revision">Minor Revision</option>
                                        <option value="major_revision">Major Revision</option>
                                        <option value="reject">Reject</option>
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
