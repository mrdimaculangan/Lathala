import { useNavigate } from "react-router-dom";
import { PlusCircle } from "lucide-react";
import Navbar from "./ResearcherNavbar";
import "./ResearcherDashboard.css";

export default function ResearcherDashboard() {
    const navigate = useNavigate();

    return (
        <div className="dashboard-wrapper">
            <Navbar />

            <main className="dashboard-container">
                <div className="hero-section">
                    <h1>Welcome to the Researcher Dashboard</h1>
                    <p>Start a new project by clicking the button below.</p>

                    <button
                        className="add-study-btn"
                        onClick={() => navigate("/researcher-study")}
                    >
                        <PlusCircle size={20} />
                        <span>Add New Study</span>
                    </button>
                </div>
            </main>
        </div>
    );
}