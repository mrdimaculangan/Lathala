import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { User, Mail, Calendar, FileText, CheckCircle, XCircle, AlertCircle, Paperclip, ArrowRight, BarChart3 } from "lucide-react";
import { supabase } from "../../supabaseClient.js";
import { UserAuth } from "../../context/AuthContext.jsx";
import ResearcherNavbar from "./ResearcherNavbar";
import "./UserProfile.css";

export default function UserProfile() {
    const navigate = useNavigate();
    const { firstName, lastName, session, userRole, dbId } = UserAuth();
    const displayName = firstName ? `${firstName} ${lastName}` : session?.user?.email;
    const userEmail = session?.user?.email;

    const [studies, setStudies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statistics, setStatistics] = useState({
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        minorRevisions: 0,
        majorRevisions: 0
    });

    useEffect(() => {
        if (!dbId) {
            setLoading(false);
            return;
        }

        async function fetchStudies() {
            try {
                const { data, error } = await supabase
                    .from('Research')
                    .select('research_id, title, status, hru_no, created_at')
                    .eq('researcher_id', dbId)
                    .order('created_at', { ascending: false });

                if (error) throw error;

                setStudies(data || []);

                // Calculate statistics
                const stats = {
                    total: data?.length || 0,
                    pending: data?.filter(s => s.status === 'Pending').length || 0,
                    approved: data?.filter(s => s.status === 'Approved').length || 0,
                    rejected: data?.filter(s => s.status === 'Rejected').length || 0,
                    minorRevisions: data?.filter(s => s.status === 'With Minor Revisions').length || 0,
                    majorRevisions: data?.filter(s => s.status === 'With Major Revisions').length || 0
                };
                setStatistics(stats);
            } catch (error) {
                console.error("Error fetching studies:", error.message);
            } finally {
                setLoading(false);
            }
        }

        fetchStudies();
    }, [dbId]);

    const getStatusColor = (status) => {
        const colors = {
            'Pending': { bg: '#fef9c3', text: '#854d0e', dot: '#eab308' },
            'Approved': { bg: '#dcfce7', text: '#166534', dot: '#22c55e' },
            'Rejected': { bg: '#fee2e2', text: '#991b1b', dot: '#ef4444' },
            'With Minor Revisions': { bg: '#dbeafe', text: '#1e40af', dot: '#3b82f6' },
            'With Major Revisions': { bg: '#ede9fe', text: '#5b21b6', dot: '#8b5cf6' },
        };
        return colors[status] || { bg: '#f1f5f9', text: '#475569', dot: '#94a3b8' };
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    };

    const truncateUUID = (uuid) => {
        if (!uuid) return 'N/A';
        return `${uuid.substring(0, 8)}...${uuid.substring(uuid.length - 8)}`;
    };

    return (
        <div className="profile-wrapper">
            <ResearcherNavbar />

            <main className="profile-container">
                {/* PROFILE HEADER */}
                <div className="profile-header">
                    <div className="profile-avatar-section">
                        <div className="profile-avatar">
                            <User size={40} />
                        </div>
                        <div className="profile-header-info">
                            <h1>{displayName}</h1>
                            <div className="profile-meta">
                                <span className="role-badge">{userRole}</span>
                                <span className="profile-email">{userEmail}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* TWO-COLUMN LAYOUT */}
                <div className="profile-content">
                    {/* LEFT SECTION */}
                    <div className="profile-left">
                        {/* ACCOUNT INFORMATION */}
                        <div className="profile-section">
                            <h2>Account Information</h2>
                            <div className="profile-details">
                                <div className="detail-item">
                                    <label>Email Address</label>
                                    <p>{userEmail}</p>
                                </div>
                                <div className="detail-item">
                                    <label>Account Created</label>
                                    <p>{formatDate(session?.user?.created_at)}</p>
                                </div>
                                <div className="detail-item">
                                    <label>Account Status</label>
                                    <p className="status-active">Active</p>
                                </div>
                                <div className="detail-item">
                                    <label>User ID</label>
                                    <p className="user-id">{session?.user?.id}</p>
                                </div>
                                <div className="detail-item">
                                    <label>Role</label>
                                    <p>{userRole}</p>
                                </div>
                                <div className="detail-item">
                                    <label>Last Login</label>
                                    <p>{formatDate(session?.user?.last_sign_in_at)}</p>
                                </div>
                            </div>
                        </div>

                        {/* RECENT RESEARCH */}
                        {!loading && studies.length > 0 && (
                            <div className="profile-section">
                                <div className="section-header-with-action">
                                    <h2>Recent Research</h2>
                                    <button className="view-all-btn" onClick={() => navigate('/researcher-dashboard')}>
                                        View All <ArrowRight size={16} />
                                    </button>
                                </div>
                                <div className="recent-research-list">
                                    {studies.slice(0, 3).map((study) => {
                                        const statusColor = getStatusColor(study.status);
                                        return (
                                            <div key={study.research_id} className="recent-research-item">
                                                <div className="research-item-header">
                                                    <span className="research-status-badge" style={{ background: statusColor.bg, color: statusColor.text }}>
                                                        <span className="status-dot" style={{ background: statusColor.dot }}></span>
                                                        {study.status}
                                                    </span>
                                                    <span className="research-hru">{study.hru_no}</span>
                                                </div>
                                                <div className="research-item-title">{study.title}</div>
                                                <div className="research-item-date">{formatDate(study.created_at)}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* RIGHT SIDEBAR */}
                    <aside className="profile-sidebar">
                        {/* STATISTICS CARDS */}
                        <div className="sidebar-section stats-section">
                            <h3>Research Statistics</h3>
                            <div className="stat-cards-group">
                                <div className="stat-card total-card">
                                    <div className="stat-icon">
                                        <Paperclip size={32} />
                                    </div>
                                    <div className="stat-info">
                                        <span className="stat-number">{statistics.total}</span>
                                        <span className="stat-label">Total Researches</span>
                                    </div>
                                </div>
                                <div className="stat-card pending-stat">
                                    <div className="stat-icon">
                                        <FileText size={32} />
                                    </div>
                                    <div className="stat-info">
                                        <span className="stat-number">{statistics.pending}</span>
                                        <span className="stat-label">Pending</span>
                                    </div>
                                </div>
                                <div className="stat-card approved-stat">
                                    <div className="stat-icon">
                                        <CheckCircle size={32} />
                                    </div>
                                    <div className="stat-info">
                                        <span className="stat-number">{statistics.approved}</span>
                                        <span className="stat-label">Approved</span>
                                    </div>
                                </div>
                                <div className="stat-card rejected-stat">
                                    <div className="stat-icon">
                                        <XCircle size={32} />
                                    </div>
                                    <div className="stat-info">
                                        <span className="stat-number">{statistics.rejected}</span>
                                        <span className="stat-label">Rejected</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ADDITIONAL INFO */}
                        <div className="sidebar-section info-section">
                            <h3>Need Help?</h3>
                            <p>Visit our documentation or contact support for assistance with your research submissions.</p>
                            <button className="info-action-btn">Contact Support</button>
                        </div>
                    </aside>
                </div>
            </main>
        </div>
    );
}
