import React, { useState } from 'react';
import axios from 'axios';
import { LogIn, UserPlus, Zap } from 'lucide-react'; // Ícones novos
import './App.css';

interface LoginProps {
    setToken: (token: string) => void;
}

const Login: React.FC<LoginProps> = ({ setToken }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isRegister, setIsRegister] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const endpoint = isRegister ? '/auth/register' : '/auth/login';
        try {
            const res = await axios.post(`http://localhost:3001${endpoint}`, { email, password });
            if (isRegister) {
                alert("Conta criada com sucesso! Faça login.");
                setIsRegister(false);
            } else {
                setToken(res.data.token);
                localStorage.setItem('userToken', res.data.token);
            }
        } catch (error) {
            alert("Erro na operação. Verifique seus dados.");
        }
    };

    return (
        <div className="login-container">
            {/* Lado Esquerdo - Marca */}
            <div className="login-left">
                <Zap size={64} style={{ marginBottom: 20 }} />
                <h1 style={{ fontSize: '2.5rem', margin: 0 }}>IFECO IoT</h1>
                <p style={{ opacity: 0.8 }}>Sistema de Telemetria Avançada</p>
            </div>

            {/* Lado Direito - Formulário */}
            <div className="login-right">
                <div className="login-form-box">
                    <h2 style={{ fontSize: '1.8rem', marginBottom: '10px' }}>
                        {isRegister ? 'Criar Conta' : 'Bem-vindo de volta'}
                    </h2>
                    <p style={{ color: '#6B7280', marginBottom: '30px' }}>
                        {isRegister ? 'Preencha os dados para começar' : 'Insira suas credenciais para acessar'}
                    </p>

                    <form onSubmit={handleSubmit}>
                        <div className="input-group">
                            <label>E-mail</label>
                            <input 
                                className="input-field" 
                                type="email" 
                                placeholder="seu@email.com" 
                                required 
                                value={email} 
                                onChange={e => setEmail(e.target.value)}
                            />
                        </div>
                        <div className="input-group">
                            <label>Senha</label>
                            <input 
                                className="input-field" 
                                type="password" 
                                placeholder="••••••••" 
                                required 
                                value={password} 
                                onChange={e => setPassword(e.target.value)}
                            />
                        </div>
                        
                        <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                            {isRegister ? <UserPlus size={18}/> : <LogIn size={18}/>}
                            {isRegister ? 'Registrar' : 'Entrar'}
                        </button>
                    </form>

                    <div style={{ marginTop: 24, textAlign: 'center' }}>
                        <span style={{ color: '#6B7280' }}>
                            {isRegister ? 'Já tem conta? ' : 'Novo por aqui? '}
                        </span>
                        <button 
                            onClick={() => setIsRegister(!isRegister)}
                            style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}
                        >
                            {isRegister ? 'Fazer Login' : 'Criar Conta'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;