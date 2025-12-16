import React, { useState } from 'react';
import axios from 'axios';
import { LogIn, Mail, Lock } from 'lucide-react';
import './App.css';
import RegistrationScreen from './RegistrationScreen';

const API_URL = 'http://192.168.0.21:3001';

interface LoginProps {
    // Nova assinatura (Recebe token, nome E avatar)
    onLoginSuccess: (token: string, userName: string, avatar: string | null) => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showRegister, setShowRegister] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await axios.post(`${API_URL}/auth/login`, { email, password });

            const token = res.data.token;
            const userName = res.data.name || email.split('@')[0];
            const userAvatar = res.data.avatar || null; // O backend agora manda isso

            // Chama a função do Pai
            onLoginSuccess(token, userName, userAvatar);

        } catch (error) {
            alert("Login falhou! Verifique e-mail e senha.");
        }
    };

    if (showRegister) {
        return <RegistrationScreen onSwitchToLogin={() => setShowRegister(false)} />;
    }

    return (
        <div className="login-container">
            <div className="login-left">
                {/* --- MUDANÇA AQUI: LOGO RESPONSIVA --- */}
                <img
                    src="/3.png"
                    alt="IFECO IoT Logo"
                    style={{
                        // Tenta atingir 500px em telas grandes
                        width: '500px',
                        // Em telas menores (celular), limita-se a 100% da largura disponível
                        maxWidth: '100%',
                        // Garante que a altura ajuste proporcionalmente
                        height: 'auto',
                        marginBottom: '20px',
                        filter: 'brightness(0) invert(1)'
                    }}
                    onError={(e) => {
                        e.currentTarget.onerror = null;
                        // Fallback
                        e.currentTarget.src = 'https://placehold.co/300x100/ffffff/1e9e53?text=IFECO+IoT&font=montserrat';
                    }}
                />
            </div>

            <div className="login-right">
                <div className="login-form-box">
                    <h2 style={{ fontSize: '1.8rem', marginBottom: '10px' }}>Bem-vindo de volta</h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '30px' }}>Insira suas credenciais</p>

                    <form onSubmit={handleLogin}>
                        <div className="input-group">
                            <label>E-mail</label>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                <Mail size={18} style={{ position: 'absolute', left: 12, color: 'var(--text-secondary)' }} />
                                <input
                                    className="input-field"
                                    type="email"
                                    placeholder="seu@email.com"
                                    required
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    style={{ paddingLeft: '40px' }}
                                />
                            </div>
                        </div>

                        <div className="input-group">
                            <label>Senha</label>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                <Lock size={18} style={{ position: 'absolute', left: 12, color: 'var(--text-secondary)' }} />
                                <input
                                    className="input-field"
                                    type="password"
                                    placeholder="••••••••"
                                    required
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    style={{ paddingLeft: '40px' }}
                                />
                            </div>
                        </div>

                        <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '10px' }}>
                            <LogIn size={18} /> Entrar
                        </button>
                    </form>

                    <div style={{ marginTop: 24, textAlign: 'center' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Não tem conta? </span>
                        <button
                            onClick={() => setShowRegister(true)}
                            style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}
                        >
                            Criar Conta
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;