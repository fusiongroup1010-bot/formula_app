import React, { useState } from 'react';
import { useAppContext } from '../store';
import { LogIn } from 'lucide-react';
import logo from '../assets/logo.png';

export default function Login() {
    const { login, register } = useAppContext();
    const [isRegister, setIsRegister] = useState(false);
    const [username, setUsername] = useState(() => localStorage.getItem('formula_app_remembered_user') || '');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        setError('');

        if (username !== 'vetnam@fusiongroup.vn' || password !== 'tndmltk6211#') {
            setError('Unauthorized access. Only the administrator account can log in.');
            return;
        }

        const result = login(username, password);
        result.then(res => {
            if (!res.success) setError(res.message);
        });
    };

    return (
        <div className="login-container">
            <div className="glass-panel login-card animate-fade-in">
                <div className="login-header">
                    <div className="sidebar-logo" style={{ paddingLeft: 0, justifyContent: 'center', marginBottom: '1rem' }}>
                        <img src={logo} alt="Fusion Logo" style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
                        Fusion Formula
                    </div>
                    <h2>Administrator Login</h2>
                    <p>Please enter your credentials to access the system</p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Username</label>
                        <input
                            type="text"
                            className="form-input"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Enter username"
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
                        />
                    </div>

                    {error && <div className="error-message">{error}</div>}

                    <button type="submit" className="btn btn-primary login-btn">
                        <LogIn size={18} /> Login
                    </button>
                </form>

                <div className="login-footer">
                    <p>Protected System - Authorized Personnel Only</p>
                </div>
            </div>

            <style>{`
                .login-container {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 100vh;
                    width: 100vw;
                    background: radial-gradient(circle at top left, #f3f4f6, #ffffff);
                }
                .login-card {
                    width: 100%;
                    max-width: 400px;
                    padding: 3rem;
                }
                .login-header {
                    text-align: center;
                    margin-bottom: 2rem;
                }
                .login-header h2 {
                    margin-top: 1rem;
                    font-size: 1.5rem;
                }
                .login-header p {
                    color: var(--text-secondary);
                    font-size: 0.9rem;
                    margin-top: 0.5rem;
                }
                .login-btn {
                    width: 100%;
                    margin-top: 1rem;
                }
                .error-message {
                    color: var(--danger-color);
                    background: rgba(239, 68, 68, 0.1);
                    padding: 0.75rem;
                    border-radius: 8px;
                    font-size: 0.85rem;
                    margin-bottom: 1rem;
                    text-align: center;
                }
                .login-footer {
                    margin-top: 2rem;
                    text-align: center;
                    font-size: 0.9rem;
                    color: var(--text-secondary);
                }
                .login-footer span {
                    color: var(--accent-color);
                    cursor: pointer;
                    font-weight: 500;
                }
                .login-footer span:hover {
                    text-decoration: underline;
                }
            `}</style>
        </div>
    );
}
