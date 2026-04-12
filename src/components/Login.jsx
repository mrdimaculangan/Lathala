// src/components/Login.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

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
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
            <div style={{
                backgroundColor: '#ffffff',
                padding: '3rem',
                borderRadius: '12px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                width: '100%',
                maxWidth: '400px'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <h2 style={{ margin: '0', color: '#1a1a1a', fontSize: '2rem', fontWeight: '800' }}>
                        Welcome Back
                    </h2>
                    <p style={{ margin: '8px 0 0', color: '#666', fontSize: '0.9rem' }}>
                        Please enter your details to sign in.
                    </p>
                </div>

                {error && (
                    <div style={{
                        backgroundColor: '#fee2e2',
                        color: '#991b1b',
                        padding: '12px',
                        borderRadius: '6px',
                        marginBottom: '1.5rem',
                        fontSize: '0.875rem',
                        textAlign: 'center'
                    }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '6px', color: '#333', fontSize: '0.875rem', fontWeight: '600' }}>
                            Email Address
                        </label>
                        <input
                            type="email"
                            placeholder="name@company.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            style={{
                                width: '100%',
                                padding: '12px',
                                borderRadius: '6px',
                                border: '1px solid #ddd',
                                fontSize: '1rem',
                                boxSizing: 'border-box',
                                outline: 'none'
                            }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '6px', color: '#333', fontSize: '0.875rem', fontWeight: '600' }}>
                            Password
                        </label>
                        <input
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            style={{
                                width: '100%',
                                padding: '12px',
                                borderRadius: '6px',
                                border: '1px solid #ddd',
                                fontSize: '1rem',
                                boxSizing: 'border-box',
                                outline: 'none'
                            }}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isLoggingIn}
                        style={{
                            marginTop: '0.5rem',
                            padding: '14px',
                            backgroundColor: isLoggingIn ? '#1f1340' : '#0b024a', /* Bold racing red */
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '1rem',
                            fontWeight: 'bold',
                            cursor: isLoggingIn ? 'not-allowed' : 'pointer',
                            transition: 'background-color 0.2s',
                            boxShadow: '0 4px 6px rgba(230, 0, 0, 0.2)'
                        }}
                    >
                        {isLoggingIn ? 'Signing In...' : 'Sign In'}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default Login;