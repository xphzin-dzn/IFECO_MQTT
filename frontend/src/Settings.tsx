import React, { useState } from 'react';
import axios from 'axios';
import { Lock, Shield, LogOut, Save, AlertCircle, CheckCircle } from 'lucide-react';
import './App.css';

// CONFIGURAÇÃO DO IP (Para funcionar no celular)
const API_URL = 'http://192.168.0.9:3001'; 

interface SettingsProps {
    logout: () => void;
}

const Settings: React.FC<SettingsProps> = ({ logout }) => {
    // Estados do Formulário
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    
    // Estados de Feedback
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);

        // Validação básica
        if (newPassword.length < 6) {
            setMessage({ type: 'error', text: 'A nova senha deve ter pelo menos 6 caracteres.' });
            return;
        }
        if (newPassword !== confirmPassword) {
            setMessage({ type: 'error', text: 'A confirmação de senha não confere.' });
            return;
        }

        setLoading(true);

        try {
            // O Token é enviado automaticamente pelo axios configurado no App.tsx
            await axios.post(`${API_URL}/auth/change-password`, {
                currentPassword,
                newPassword
            });

            setMessage({ type: 'success', text: 'Senha atualizada com segurança!' });
            // Limpa os campos
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (error) {
            if (axios.isAxiosError(error) && error.response?.data?.error) {
                setMessage({ type: 'error', text: error.response.data.error });
            } else {
                setMessage({ type: 'error', text: 'Erro ao conectar ao servidor.' });
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '800px' }}>
            
            {/* Seção 1: Gerenciamento de Conta */}
            <div className="card">
                <div className="card-header" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '15px', marginBottom: '20px' }}>
                    <div className="card-title" style={{ fontSize: '1.2rem', color: 'var(--text-main)' }}>
                        <Shield size={24} style={{ color: 'var(--primary)' }} /> Gerenciamento de Conta
                    </div>
                </div>

                <form onSubmit={handleChangePassword}>
                    <div style={{ display: 'grid', gap: '20px' }}>
                        <div className="input-group">
                            <label>Senha Atual</label>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                <Lock size={18} style={{ position: 'absolute', left: 12, color: '#9ca3af' }} />
                                <input 
                                    type="password" 
                                    className="input-field" 
                                    style={{ paddingLeft: '40px' }}
                                    placeholder="Digite sua senha atual para confirmar"
                                    value={currentPassword}
                                    onChange={e => setCurrentPassword(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            <div className="input-group">
                                <label>Nova Senha</label>
                                <input 
                                    type="password" 
                                    className="input-field" 
                                    placeholder="Mínimo 6 caracteres"
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="input-group">
                                <label>Confirmar Nova Senha</label>
                                <input 
                                    type="password" 
                                    className="input-field" 
                                    placeholder="Repita a nova senha"
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        {/* Mensagens de Feedback */}
                        {message && (
                            <div style={{ 
                                padding: '12px', 
                                borderRadius: '8px', 
                                background: message.type === 'error' ? '#fee2e2' : '#dcfce7',
                                color: message.type === 'error' ? '#ef4444' : '#166534',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontSize: '0.9rem'
                            }}>
                                {message.type === 'error' ? <AlertCircle size={18}/> : <CheckCircle size={18}/>}
                                {message.text}
                            </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button 
                                type="submit" 
                                className="btn btn-primary"
                                disabled={loading}
                                style={{ opacity: loading ? 0.7 : 1 }}
                            >
                                <Save size={18} />
                                {loading ? 'Atualizando...' : 'Atualizar Senha'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>

            {/* Seção 2: Sessão */}
            <div className="card" style={{ borderLeft: '4px solid var(--danger)' }}>
                <div className="card-header">
                    <div className="card-title" style={{ fontSize: '1.2rem', color: 'var(--text-main)' }}>
                        <LogOut size={24} style={{ color: 'var(--danger)' }} /> Sessão
                    </div>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                        Deseja encerrar seu acesso? Isso revogará seu token de autenticação atual.
                    </p>
                    <button className="btn btn-danger" onClick={logout}>
                        Encerrar Sessão (Sair)
                    </button>
                </div>
            </div>

        </div>
    );
};

export default Settings;