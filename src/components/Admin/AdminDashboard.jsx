import { useState, useEffect } from 'react';
import { UserAuth } from '../../context/AuthContext';
import { supabase } from '../../supabaseClient';
import Navbar from './AdminNavbar';
import {
    Users, ClipboardList, BookOpen, CheckCircle,
    Clock, TrendingUp, UserCheck, AlertCircle,
    BarChart2, FileText, Plus, UserPlus,
    FileSearch, Download, Mail, Settings, Calendar
} from 'lucide-react';
import './AdminDashboard.css';

export default function AdminDashboard() {
    const { session, userRole, firstName, lastName } = UserAuth();

    const [stats, setStats] = useState({
        totalUsers: 0,
        activeUsers: 0,
        totalResearch: 0,
        pendingQueue: 0,
        evaluatedResearch: 0,
        approvedResearch: 0,
        rejectedResearch: 0,
        revisionResearch: 0,
        unassignedResearch: 0,
    });
    const [recentResearch, setRecentResearch] = useState([]);
    const [loading, setLoading] = useState(true);
    const [monthlyData, setMonthlyData] = useState([]);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    async function fetchDashboardData() {
        setLoading(true);
        try {
            const [usersRes, allResearchRes, queueRes, evaluationsRes] = await Promise.all([
                supabase.from('Users').select('user_id, deleted_at'),
                supabase.from('Research').select('research_id, title, hru_no, registration_date, status'),
                supabase.from('Research_Queue').select('research_id'),
                supabase.from('Evaluation_Research').select('research_id, overall_recommendation'),
            ]);

            const users = usersRes.data || [];
            const allResearch = allResearchRes.data || [];
            const queue = queueRes.data || [];
            const evaluations = evaluationsRes.data || [];

            // Calculate monthly submissions
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const currentYear = new Date().getFullYear();
            const monthlyCounts = Array(12).fill(0);

            allResearch.forEach(research => {
                if (research.registration_date) {
                    const date = new Date(research.registration_date);
                    if (date.getFullYear() === currentYear) {
                        const month = date.getMonth();
                        monthlyCounts[month]++;
                    }
                }
            });

            // Get last 6 months with data
            const currentMonth = new Date().getMonth();
            const last6Months = [];
            for (let i = 5; i >= 0; i--) {
                let monthIndex = currentMonth - i;
                let year = currentYear;
                if (monthIndex < 0) {
                    monthIndex += 12;
                    year--;
                }
                last6Months.push({
                    name: monthNames[monthIndex],
                    count: monthlyCounts[monthIndex],
                    year: year,
                    monthIndex: monthIndex
                });
            }

            // Find max count for scaling (max bar height = 80px)
            const maxCount = Math.max(...last6Months.map(m => m.count), 1);

            const monthlyChartData = last6Months.map(month => ({
                ...month,
                height: month.count === 0 ? 4 : Math.max(20, (month.count / maxCount) * 70) // Min 20px, max 90px
            }));

            setMonthlyData(monthlyChartData);

            const evaluatedIds = new Set(evaluations.map(e => Number(e.research_id)));

            const inQueueIds = new Set(queue.map(q => Number(q.research_id)));

            const queueIds = queue.map(q => Number(q.research_id));

            const finalizedIds = new Set(
                evaluations
                    .filter(e => {
                        const status = (e.overall_recommendation || '').toLowerCase();
                        return status === 'approved' || status === 'rejected';
                    })
                    .map(e => Number(e.research_id))
            );

            const trulyPendingInQueue = queueIds.filter(id => !finalizedIds.has(id));
            const normalize = (val) => val?.toLowerCase().replace(' ', '_') || '';

            const unassignedPapers = allResearch.filter(r => {
                const isInQueue = inQueueIds.has(Number(r.research_id));
                const isFinished = evaluations.some(e =>
                    Number(e.research_id) === Number(r.research_id) &&
                    ['approved', 'rejected'].includes(normalize(e.overall_recommendation))
                );
                return !isInQueue && !isFinished;
            });

            const approvedCount = evaluations.filter(e => normalize(e.overall_recommendation) === 'approved').length;
            const rejectedCount = evaluations.filter(e => normalize(e.overall_recommendation) === 'rejected').length;

            const revisionPapers = allResearch.filter(r => {
                const status = (r.status || '').toLowerCase();
                return status === 'minor_revision' || status === 'major_revision';
            });
            const revisionCount = revisionPapers.length;

            setStats({
                totalUsers: users.length,
                activeUsers: users.filter(u => !u.deleted_at).length,
                totalResearch: allResearch.length,
                pendingQueue: trulyPendingInQueue.length,
                evaluatedResearch: evaluatedIds.size,
                approvedResearch: approvedCount,
                rejectedResearch: rejectedCount,
                revisionResearch: revisionCount,
                unassignedResearch: unassignedPapers.length
            });

            setRecentResearch(allResearch.sort((a, b) =>
                new Date(b.registration_date) - new Date(a.registration_date)).slice(0, 5)
            );

        } catch (err) {
            console.error('Dashboard fetch error:', err);
        } finally {
            setLoading(false);
        }
    }

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 18) return 'Good afternoon';
        return 'Good evening';
    };

    const getStatusBadge = (status) => {
        const s = status?.toLowerCase();
        if (s === 'approved') return <span className="dash-badge approved">Approved</span>;
        if (s === 'rejected') return <span className="dash-badge rejected">Rejected</span>;
        if (s === 'minor_revision') return <span className="dash-badge revision">Minor Revision</span>;
        if (s === 'major_revision') return <span className="dash-badge revision">Major Revision</span>;
        return <span className="dash-badge pending">Pending</span>;
    };

    return (
        <div className="admin-layout">
            <Navbar />
            <main className="admin-content">

                {/* Welcome Header */}
                <section className="dash-welcome">
                    <div>
                        <h1>{getGreeting()}, {firstName || 'Admin'}</h1>
                        <p>Here's what's happening in the research management system today.</p>
                    </div>
                    <div className="dash-date">
                        {new Date().toLocaleDateString('en-US', {
                            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                        })}
                    </div>
                </section>

                {/* Stat Cards Row 1 */}
                <section className="dash-stats-grid">
                    <div className="dash-stat-card">
                        <div className="stat-icon-wrap blue">
                            <Users size={20} />
                        </div>
                        <div className="stat-info">
                            <span className="stat-label">Total Users</span>
                            <span className="stat-value">{loading ? '—' : stats.totalUsers}</span>
                        </div>
                        <div className="stat-sub">
                            <UserCheck size={13} />
                            <span>{loading ? '—' : stats.activeUsers} Active</span>
                        </div>
                    </div>

                    <div className="dash-stat-card">
                        <div className="stat-icon-wrap purple">
                            <BookOpen size={20} />
                        </div>
                        <div className="stat-info">
                            <span className="stat-label">Total Research</span>
                            <span className="stat-value">{loading ? '—' : stats.totalResearch}</span>
                        </div>
                        <div className="stat-sub">
                            <FileText size={13} />
                            <span>Submitted Papers</span>
                        </div>
                    </div>

                    <div className="dash-stat-card">
                        <div className="stat-icon-wrap amber">
                            <ClipboardList size={20} />
                        </div>
                        <div className="stat-info">
                            <span className="stat-label">Pending Queue</span>
                            <span className="stat-value">{loading ? '—' : stats.pendingQueue}</span>
                        </div>
                        <div className="stat-sub">
                            <Clock size={13} />
                            <span>Awaiting Evaluation</span>
                        </div>
                    </div>

                    <div className="dash-stat-card">
                        <div className="stat-icon-wrap green">
                            <BarChart2 size={20} />
                        </div>
                        <div className="stat-info">
                            <span className="stat-label">Evaluated</span>
                            <span className="stat-value">{loading ? '—' : stats.evaluatedResearch}</span>
                        </div>
                        <div className="stat-sub">
                            <TrendingUp size={13} />
                            <span>Completed Reviews</span>
                        </div>
                    </div>
                </section>

                {/* Monthly Trend + Evaluation Breakdown Row */}
                <section className="dash-two-column-grid">
                    {/* Monthly Submissions Trend */}
                    <div className="dash-card">
                        <div className="dash-card-header">
                            <h2>Monthly Submissions</h2>
                            <Calendar size={18} className="card-header-icon" />
                        </div>
                        {loading ? (
                            <p className="dash-loading-text">Loading trend data...</p>
                        ) : (
                            <div className="trend-container">
                                <div className="trend-bars">
                                    {monthlyData.map((month, idx) => (
                                        <div key={idx} className="trend-item">
                                            <div
                                                className="trend-bar"
                                                style={{
                                                    height: `${month.height}px`,
                                                    backgroundColor: month.count > 0 ? '#4f46e5' : '#e2e8f0'
                                                }}
                                            >
                                                {month.count > 0 && (
                                                    <span className="trend-value">{month.count}</span>
                                                )}
                                            </div>
                                            <span className="trend-label">{month.name}</span>
                                            {month.year !== new Date().getFullYear() && (
                                                <span className="trend-year">{month.year}</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <div className="trend-footer">
                                    <span className="trend-total">
                                        Total: {monthlyData.reduce((sum, m) => sum + m.count, 0)} submissions
                                    </span>
                                    <span className="trend-period">Last 6 months</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Evaluation Breakdown */}
                    <div className="dash-card">
                        <div className="dash-card-header">
                            <h2>Evaluation Breakdown</h2>
                            <CheckCircle size={18} className="card-header-icon" />
                        </div>

                        <div className="breakdown-list">
                            {/* Approved Bar */}
                            <div className="breakdown-item">
                                <div className="breakdown-label">
                                    <span className="dot green" />
                                    <span>Approved</span>
                                </div>
                                <div className="breakdown-bar-wrap">
                                    <div className="breakdown-bar green" style={{ width: stats.totalResearch ? `${(stats.approvedResearch / stats.totalResearch) * 100}%` : '0%' }} />
                                </div>
                                <span className="breakdown-count">{stats.approvedResearch}</span>
                            </div>

                            {/* Revision Bar */}
                            <div className="breakdown-item">
                                <div className="breakdown-label">
                                    <span className="dot blue" />
                                    <span>Revision</span>
                                </div>
                                <div className="breakdown-bar-wrap">
                                    <div className="breakdown-bar blue" style={{ width: stats.totalResearch ? `${(stats.revisionResearch / stats.totalResearch) * 100}%` : '0%' }} />
                                </div>
                                <span className="breakdown-count">{stats.revisionResearch}</span>
                            </div>

                            {/* Rejected Bar */}
                            <div className="breakdown-item">
                                <div className="breakdown-label">
                                    <span className="dot red" />
                                    <span>Rejected</span>
                                </div>
                                <div className="breakdown-bar-wrap">
                                    <div className="breakdown-bar red" style={{ width: stats.totalResearch ? `${(stats.rejectedResearch / stats.totalResearch) * 100}%` : '0%' }} />
                                </div>
                                <span className="breakdown-count">{stats.rejectedResearch}</span>
                            </div>
                        </div>

                        {!loading && stats.evaluatedResearch > 0 && (
                            <div className="breakdown-footer">
                                <AlertCircle size={13} />
                                <span>
                                    {Math.round((stats.approvedResearch / stats.evaluatedResearch) * 100)}% approval rate
                                </span>
                            </div>
                        )}
                    </div>
                </section>

                {/* Recent Research */}
                <div className="dash-card">
                    <div className="dash-card-header">
                        <h2>Recent Submissions</h2>
                        <Clock size={18} className="card-header-icon" />
                    </div>

                    {loading ? (
                        <p className="dash-loading-text">Loading...</p>
                    ) : recentResearch.length === 0 ? (
                        <p className="dash-empty-text">No research submissions yet.</p>
                    ) : (
                        <div className="recent-list">
                            {recentResearch.map((r) => (
                                <div key={r.research_id} className="recent-item">
                                    <div className="recent-left">
                                        <span className="recent-hru">{r.hru_no}</span>
                                        <span className="recent-title">{r.title}</span>
                                    </div>
                                    <div className="recent-right">
                                        {getStatusBadge(r.status)}
                                        <span className="recent-date">
                                            {new Date(r.registration_date).toLocaleDateString('en-US', {
                                                month: 'short', day: 'numeric', year: 'numeric'
                                            })}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

            </main>
        </div>
    );
}