import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";
import Navbar from "./EvaluatorNavbar";
import "./EvaluateResearch.css";

function EvaluateResearch() {
    const { researchId } = useParams(); // Get the ID from URL
    const navigate = useNavigate();
    const [research, setResearch] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchResearchDetails();
    }, [researchId]);

    async function fetchResearchDetails() {
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

    if (loading) return <div>Loading research details...</div>;
    if (!research) return <div>Research not found</div>;

    return (
        <div>
            <Navbar />
            <h1>Evaluating Research: {research.title}</h1>
            {/* Add your evaluation form/content here */}
            <button onClick={() => navigate('/evaluator-dashboard')}>
                Back to Dashboard
            </button>
        </div>
    );
}

export default EvaluateResearch;