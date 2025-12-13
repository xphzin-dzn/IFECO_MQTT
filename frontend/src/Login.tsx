import React, { useState } from 'react';
import axios from 'axios';
import { LogIn, Zap, Mail, Lock } from 'lucide-react'; 
import './App.css';
import RegistrationScreen from './RegistrationScreen';

const API_URL = 'http://192.168.0.15:3001'; 

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
                <Zap size={64} style={{ marginBottom: 20 }} />
                <h1 style={{ fontSize: '2.5rem', margin: 0 }}>IFECO IoT</h1>
                <p style={{ opacity: 0.8 }}>Sistema de Telemetria Avançada</p>
            </div>
            <div className="login-right">
                <div className="login-form-box">
                    <h2 style={{ fontSize: '1.8rem', marginBottom: '10px' }}>Bem-vindo de volta</h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '30px' }}>Insira suas credenciais</p>
                    <form onSubmit={handleLogin}>
                        <div className="input-group"><label>E-mail</label><input className="input-field" type="email" placeholder="seu@email.com" required value={email} onChange={e => setEmail(e.target.value)} /></div>
                        <div className="input-group"><label>Senha</label><input className="input-field" type="password" placeholder="••••••••" required value={password} onChange={e => setPassword(e.target.value)} /></div>
                        <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}><LogIn size={18}/> Entrar</button>
                    </form>
                    <div style={{ marginTop: 24, textAlign: 'center' }}><span style={{ color: 'var(--text-secondary)' }}>Não tem conta? </span><button onClick={() => setShowRegister(true)} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}>Criar Conta</button></div>
                </div>
            </div>
        </div>
    );
};

export default Login;