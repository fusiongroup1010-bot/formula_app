import React, { useState, useEffect } from 'react';
import { useAppContext } from '../store';
import { LogIn } from 'lucide-react';
import logo from '../assets/logo.png';

export default function Login() {
    const { login } = useAppContext();
    const [username, setUsername] = useState(() => localStorage.getItem('formula_app_remembered_user') || '');
    const [password, setPassword] = useState('');
    const [rememberId, setRememberId] = useState(true);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (localStorage.getItem('formula_app_remembered_user')) {
            setRememberId(true);
        }
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        // Pre-check for admin account if needed, but the login function will handle Firebase auth
        if (username !== 'vetnam@fusiongroup.vn' || password !== 'tndmltk6211#') {
            setError('Unauthorized access. Only the administrator account can log in.');
            setLoading(false);
            return;
        }

        try {
            const result = await login(username, password);
            if (result.success) {
                if (rememberId) {
                    localStorage.setItem('formula_app_remembered_user', username);
                } else {
                    localStorage.removeItem('formula_app_remembered_user');
                }
            } else {
                setError(result.message);
            }
        } catch (err) {
            setError('An error occurred during login.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="glass-panel login-card animate-fade-in">
                <div className="login-header">
                    <div className="sidebar-logo" style={{ paddingLeft: 0, justifyContent: 'center', marginBottom: '1rem', color: '#1a1a1a', fontWeight: '800', fontSize: '1.2rem', gap: '0.8rem' }}>
                        <img src={logo} alt="Fusion Logo" style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
                        Fusion Formula
                    </div>
                    <h2>Administrator Login</h2>
                    <p>Enter your credentials to access the system</p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Username / ID</label>
                        <input
                            type="text"
                            className="form-input"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Enter username"
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Password</label>
                        <input
                            type="password"
                            className="form-input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter password"
                            autoFocus={!!username}
                            required
                        />
                    </div>

                    <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                        <input 
                            type="checkbox" 
                            id="remember-id"
                            checked={rememberId}
                            onChange={(e) => setRememberId(e.target.checked)}
                            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                        />
                        <label htmlFor="remember-id" style={{ fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer', margin: 0 }}>Remember ID</label>
                    </div>

                    {error && <div className="error-message">{error}</div>}

                    <button type="submit" disabled={loading} className="btn btn-primary login-btn">
                        <LogIn size={18} /> {loading ? 'Logging in...' : 'Sign In'}
                    </button>
                </form>

                <div className="login-footer">
                    <p>© 2026 Fusion Group - Formula app</p>
                </div>
            </div>

            <style>{`
                .login-container {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 100vh;
                    width: 100vw;
                    background: radial-gradient(circle at top left, #f8fafc, #f1f5f9);
                }
                .login-card {
                    width: 100%;
                    max-width: 420px;
                    padding: 3rem;
                    background: white;
                    border-radius: 24px;
                    box-shadow: 0 20px 50px rgba(0,0,0,0.05);
                    border: 1px solid rgba(0,0,0,0.05);
                }
                .login-header {
                    text-align: center;
                    margin-bottom: 2.5rem;
                }
                .login-header h2 {
                    margin-top: 1rem;
                    font-size: 1.5rem;
                    font-weight: 800;
                    color: #1e293b;
                }
                .login-header p {
                    color: #64748b;
                    font-size: 0.95rem;
                    margin-top: 0.5rem;
                }
                .form-group {
                    margin-bottom: 1.5rem;
                }
                .form-label {
                    display: block;
                    font-size: 0.85rem;
                    font-weight: 700;
                    color: #475569;
                    margin-bottom: 0.5rem;
                }
                .form-input {
                    width: 100%;
                    padding: 0.85rem 1rem;
                    border-radius: 12px;
                    border: 1px solid #e2e8f0;
                    font-size: 0.95rem;
                    transition: all 0.2s;
                    background: #f8fafc;
                }
                .form-input:focus {
                    outline: none;
                    border-color: #3b82f6;
                    background: white;
                    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
                }
                .login-btn {
                    width: 100%;
                    padding: 0.85rem;
                    height: auto;
                    font-weight: 700;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                    background: #2563eb;
                    color: white;
                    border: none;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .login-btn:hover {
                    background: #1d4ed8;
                    transform: translateY(-1px);
                }
                .login-btn:disabled {
                    opacity: 0.7;
                    cursor: not-allowed;
                }
                .error-message {
                    color: #ef4444;
                    background: #fef2f2;
                    padding: 0.85rem;
                    border-radius: 12px;
                    font-size: 0.85rem;
                    margin-bottom: 1.5rem;
                    text-align: center;
                    border: 1px solid #fee2e2;
                    font-weight: 600;
                }
                .login-footer {
                    margin-top: 2.5rem;
                    text-align: center;
                    font-size: 0.85rem;
                    color: #94a3b8;
                    font-weight: 600;
                }
                .sidebar-logo {
                    display: flex;
                    align-items: center;
                }
            `}</style>
        </div>
    );
}
