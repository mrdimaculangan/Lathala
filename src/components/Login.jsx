// src/components/Login.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import logoImg from '../assets/logo.png';
import './Login.css';

function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setError(null);
        setIsLoggingIn(true);

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            setError(error.message);
            setIsLoggingIn(false);
            return;
        }

        const { data: profile } = await supabase
            .from('Users')
            .select('role')
            .eq('user_id', data.user.id)
            .single();

        if (profile?.role === 'Researcher') {
            navigate('/researcher-dashboard');
        } else if (profile?.role === 'Evaluator') {
            navigate('/evaluator-dashboard');
        } else if (profile?.role === 'Admin') {
            navigate('/admin-dashboard');
        } else {
            navigate('/login');
        }
    };

    return (
        <div className="login-page">
            <div className="login-brand-section">
                <div className='brand-content'>
                    <img src={logoImg} alt="Logo" className="login-logo" />
                    <h1 className='brand-statement'>Elevating Institutional Research.</h1>
                    <p className='brand-description'>
                        A comprehensive platform engineered for academic excellence,
                        ethical integrity, and optimized research management.
                    </p>
                </div>
            </div>

            <div className='login-form-section'>
                <div className='login-box'>
                    <div className="login-header">
                        <h2>Welcome Back!</h2>
                        <p>Sign in to manage your research projects.</p>
                    </div>

                    {error && <div className="login-error">{error}</div>}

                    <form className="login-form" onSubmit={handleLogin}>
                        <div className='input-group'>
                            <label>EMAIL ADDRESS</label>
                            <input
                                type="email"
                                placeholder="Enter your email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <div className="input-group">
                            <label>PASSWORD</label>
                            <input
                                type="password"
                                placeholder="Enter your password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                        <div className="form-footer">
                            <label className="checkbox-container">
                                <input type="checkbox" />
                                <span className="checkmark"></span>
                                Remember me
                            </label>
                            <a href="/forgot-password">Forgot password?</a>
                        </div>
                        <button type="submit" className="login-btn" disabled={isLoggingIn}>
                            {isLoggingIn ? 'SIGNING IN...' : 'SIGN IN'}
                        </button>
                    </form>
                    <hr></hr>
                    <p className="copyright">© 2024 Lathala Research Management System. All rights reserved.</p>
                </div>
            </div>
        </div>
    );
}

export default Login;