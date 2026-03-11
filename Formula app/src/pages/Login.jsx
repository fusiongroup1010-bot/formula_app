import React, { useState } from 'react';
import { useAppContext } from '../store';
import { LogIn, UserPlus } from 'lucide-react';

export default function Login() {
    const { login, register } = useAppContext();
    const [isRegister, setIsRegister] = useState(false);
    const [username, setUsername] = useState(() => localStorage.getItem('formula_app_remembered_user') || '');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        setError('');

        if (!username || !password) {
            setError('Please enter both username and password');
            return;
        }

        localStorage.setItem('formula_app_remembered_user', username);

        if (isRegister) {
            const result = register(username, password);
            if (!result.success) setError(result.message);
        } else {
            const result = login(username, password);
            if (!result.success) setError(result.message);
        }
    };

    return (
        <div className="login-container">
            <div className="glass-panel login-card animate-fade-in">
                <div className="login-header">
                    <div className="sidebar-logo" style={{ paddingLeft: 0, justifyContent: 'center' }}>
                        Fusion Formula
                    </div>
                    <h2>{isRegister ? 'Create Account' : 'Welcome Back'}</h2>
                    <p>{isRegister ? 'Sign up to start managing formulas' : 'Please login to your account'}</p>
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
                        {isRegister ? <><UserPlus size={18} /> Register</> : <><LogIn size={18} /> Login</>}
                    </button>
                </form>

                <div className="login-footer">
                    <p>
                        {isRegister ? 'Already have an account?' : "Don't have an account?"}
                        <span onClick={() => setIsRegister(!isRegister)}>
                            {isRegister ? ' Login here' : ' Register here'}
                        </span>
                    </p>
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
