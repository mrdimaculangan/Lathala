import React, { useEffect } from "react";
import { User } from "lucide-react";
import { UserAuth } from "../../context/AuthContext.jsx";
import EvaluatorNavbar from "./EvaluatorNavbar";
import "./UserProfile.css";

export default function UserProfile() {
    const { firstName, lastName, session, userRole } = UserAuth();
    const displayName = firstName ? `${firstName} ${lastName}` : session?.user?.email;
    const userEmail = session?.user?.email;

    useEffect(() => {
        const originalBodyOverflow = document.body.style.overflow;
        const originalHtmlOverflow = document.documentElement.style.overflow;
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = originalBodyOverflow;
            document.documentElement.style.overflow = originalHtmlOverflow;
        };
    }, []);

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    };

    return (
        <div className="profile-wrapper">
            <EvaluatorNavbar />

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
                    </div>
                </div>
            </main>
        </div>
    );
}