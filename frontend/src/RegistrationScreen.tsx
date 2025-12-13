import React, { useState } from 'react';
import axios from 'axios';
import { UserPlus, User, Mail, Lock, Zap } from 'lucide-react';
import './App.css';

const API_URL = 'http://192.168.0.15:3001'; // SEU IP

interface RegistrationProps {
    onSwitchToLogin: () => void;
}

const RegistrationScreen: React.FC<RegistrationProps> = ({ onSwitchToLogin }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // --- 1. APLICANDO O TRIM (LIMPEZA) ---
        const cleanName = name.trim();
        const cleanEmail = email.trim();

        // --- 2. VALIDAÇÃO USANDO OS DADOS LIMPOS ---
        // Isso impede que alguém cadastre um nome feito só de espaços "   "
        if (!cleanName || !cleanEmail || !password) {
            alert("Preencha todos os campos! (Espaços em branco não contam)");
            return;
        }

        // Opcional: Validação de tamanho mínimo
        if (cleanName.length < 2) {
            alert("Por favor, insira um nome válido.");
            return;
        }

        setLoading(true);
        try {
            // --- 3. ENVIA OS DADOS LIMPOS ---
            await axios.post(`${API_URL}/auth/register`, { 
                name: cleanName, 
                email: cleanEmail, 
                password 
            });
            
            alert("Conta criada com sucesso! Faça login.");
            onSwitchToLogin(); 
        } catch (error) {
            alert("Erro ao criar conta. Tente outro e-mail.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-left">
                <Zap size={64} style={{ marginBottom: 20 }} />
                <h1 style={{ fontSize: '2.5rem', margin: 0 }}>Junte-se ao IFECO</h1>
                <p style={{ opacity: 0.8 }}>Crie sua conta para monitorar seus dados</p>
            </div>

            <div className="login-right">
                <div className="login-form-box">
                    <h2 style={{ fontSize: '1.8rem', marginBottom: '10px' }}>Criar Conta</h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '30px' }}>Preencha seus dados abaixo</p>

                    <form onSubmit={handleRegister}>
                        {/* CAMPO NOME */}
                        <div className="input-group">
                            <label>Nome Completo</label>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                <User size={18} style={{ position: 'absolute', left: 12, color: '#9ca3af' }} />
                                <input 
                                    className="input-field" 
                                    style={{ paddingLeft: '40px' }}
                                    type="text" 
                                    placeholder="Ex: João da Silva" 
                                    required 
                                    value={name} 
                                    onChange={e => setName(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* CAMPO EMAIL */}
                        <div className="input-group">
                            <label>E-mail</label>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                <Mail size={18} style={{ position: 'absolute', left: 12, color: '#9ca3af' }} />
                                <input 
                                    className="input-field" 
                                    style={{ paddingLeft: '40px' }}
                                    type="email" 
                                    placeholder="seu@email.com" 
                                    required 
                                    value={email} 
                                    onChange={e => setEmail(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* CAMPO SENHA */}
                        <div className="input-group">
                            <label>Senha</label>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                <Lock size={18} style={{ position: 'absolute', left: 12, color: '#9ca3af' }} />
                                <input 
                                    className="input-field" 
                                    style={{ paddingLeft: '40px' }}
                                    type="password" 
                                    placeholder="••••••••" 
                                    required 
                                    value={password} 
                                    onChange={e => setPassword(e.target.value)}
                                />
                            </div>
                        </div>
                        
                        <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
                            <UserPlus size={18}/>
                            {loading ? 'Criando...' : 'Registrar'}
                        </button>
                    </form>

                    <div style={{ marginTop: 24, textAlign: 'center' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Já tem conta? </span>
                        <button 
                            onClick={onSwitchToLogin}
                            style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}
                        >
                            Fazer Login
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RegistrationScreen;