import React, { useState } from 'react';
import axios from 'axios';
import './App.css'; // Reutiliza o CSS

interface LoginProps {
    setToken: (token: string) => void;
}

const Login: React.FC<LoginProps> = ({ setToken }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isRegister, setIsRegister] = useState(false); // Alternar entre Login/Registro

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const endpoint = isRegister ? '/auth/register' : '/auth/login';
        
        try {
            // Tenta logar ou registrar
            const res = await axios.post(`http://localhost:3001${endpoint}`, { email, password });
            
            if (isRegister) {
                alert("Registrado! Agora faça login.");
                setIsRegister(false);
            } else {
                // Se for login, salva o token
                setToken(res.data.token);
                localStorage.setItem('userToken', res.data.token);
            }
        } catch (error) {
            alert("Erro! Verifique os dados.");
        }
    };

    return (
        <div className="dashboard-container" style={{display:'flex', justifyContent:'center', alignItems:'center', height:'100vh'}}>
            <div className="card" style={{width: '300px', textAlign:'center'}}>
                <h2>{isRegister ? 'Criar Conta' : 'Acessar Sistema'}</h2>
                <form onSubmit={handleSubmit} style={{display:'flex', flexDirection:'column', gap:'10px'}}>
                    <input 
                        type="email" placeholder="Email" required 
                        value={email} onChange={e => setEmail(e.target.value)}
                        style={{padding:'10px'}}
                    />
                    <input 
                        type="password" placeholder="Senha" required 
                        value={password} onChange={e => setPassword(e.target.value)}
                        style={{padding:'10px'}}
                    />
                    <button type="submit" className="btn-toggle btn-iniciar-rec">
                        {isRegister ? 'Registrar' : 'Entrar'}
                    </button>
                </form>
                <p 
                    onClick={() => setIsRegister(!isRegister)} 
                    style={{cursor:'pointer', color:'#3a86ff', marginTop:'10px'}}
                >
                    {isRegister ? 'Já tenho conta' : 'Criar nova conta'}
                </p>
            </div>
        </div>
    );
};

export default Login;