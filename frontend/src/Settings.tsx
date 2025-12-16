import React, { useRef, useState } from 'react'; // Adicione useRef
import axios from 'axios';
import { Lock, Shield, LogOut, Save, AlertCircle, CheckCircle, Moon, Sun, Camera } from 'lucide-react';
import './App.css';

const API_URL = 'http://192.168.0.21:3001';

interface SettingsProps {
    logout: () => void;
    toggleTheme: () => void;
    isDarkMode: boolean;
    userAvatar: string | null; // Recebe o avatar atual
    onAvatarUpdate: (newUrl: string) => void; // Função para atualizar o App.tsx
}

const Settings: React.FC<SettingsProps> = ({ logout, toggleTheme, isDarkMode, userAvatar, onAvatarUpdate }) => {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    
    // Referência para o input de arquivo escondido
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- LÓGICA DE UPLOAD ---
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('avatar', file);

        try {
            const token = localStorage.getItem('userToken');
            const res = await axios.post(`${API_URL}/auth/upload-avatar`, formData, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });
            
            // Sucesso: Atualiza no App.tsx
            onAvatarUpdate(res.data.avatar);
            alert("Foto de perfil atualizada!");
        } catch (error) {
            alert("Erro ao enviar foto.");
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);
        if (newPassword.length < 6) return setMessage({ type: 'error', text: 'Mínimo 6 caracteres.' });
        if (newPassword !== confirmPassword) return setMessage({ type: 'error', text: 'Senhas não conferem.' });

        setLoading(true);
        try {
            await axios.post(`${API_URL}/auth/change-password`, { currentPassword, newPassword });
            setMessage({ type: 'success', text: 'Senha atualizada!' });
            setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
        } catch (error) {
            setMessage({ type: 'error', text: 'Senha atual incorreta.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '800px' }}>
            
            {/* --- BLOCO DE AVATAR (NOVO) --- */}
            <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => fileInputRef.current?.click()}>
                    <img 
                        src={userAvatar ? `${API_URL}${userAvatar}` : `https://ui-avatars.com/api/?name=User&background=1e9e53&color=fff`} 
                        alt="Avatar" 
                        style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--primary)' }}
                    />
                    <div style={{ position: 'absolute', bottom: 0, right: 0, background: 'var(--text-main)', borderRadius: '50%', padding: '6px', border: '2px solid var(--bg-card)' }}>
                        <Camera size={16} color="var(--bg-card)" />
                    </div>
                </div>
                <div>
                    <h3 style={{ margin: 0, color: 'var(--text-main)' }}>Sua Foto de Perfil</h3>
                    <p style={{ margin: '5px 0 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Clique na imagem para alterar</p>
                </div>
                {/* Input escondido */}
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    style={{ display: 'none' }} 
                    accept="image/*"
                    onChange={handleFileChange}
                />
            </div>

            {/* BLOCO DE TEMA */}
            <div className="card">
                <div className="card-header" style={{ marginBottom: 0 }}>
                    <div className="card-title" style={{ fontSize: '1.2rem', color: 'var(--text-main)' }}>
                        {isDarkMode ? <Moon size={24} style={{ color: '#a855f7' }} /> : <Sun size={24} style={{ color: '#f59e0b' }} />}
                        Aparência
                    </div>
                    <button onClick={toggleTheme} className="btn btn-outline" style={{ minWidth: '140px' }}>
                        {isDarkMode ? 'Modo Claro' : 'Modo Escuro'}
                    </button>
                </div>
            </div>

            {/* BLOCO DE SENHA */}
            <div className="card">
                <div className="card-header" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '15px', marginBottom: '20px' }}>
                    <div className="card-title" style={{ fontSize: '1.2rem', color: 'var(--text-main)' }}>
                        <Shield size={24} style={{ color: 'var(--primary)' }} /> Senha
                    </div>
                </div>
                <form onSubmit={handleChangePassword}>
                    <div style={{ display: 'grid', gap: '20px' }}>
                        <div className="input-group">
                            <label>Senha Atual</label>
                            <input type="password" className="input-field" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            <div className="input-group">
                                <label>Nova Senha</label>
                                <input type="password" className="input-field" value={newPassword} onChange={e => setNewPassword(e.target.value)} required />
                            </div>
                            <div className="input-group">
                                <label>Confirmar</label>
                                <input type="password" className="input-field" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
                            </div>
                        </div>
                        {message && (
                            <div style={{ padding: '12px', borderRadius: '8px', background: message.type === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)', color: message.type === 'error' ? 'var(--danger)' : 'var(--success)', fontSize: '0.9rem' }}>
                                {message.text}
                            </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button type="submit" className="btn btn-primary" disabled={loading} style={{ opacity: loading ? 0.7 : 1 }}>
                                <Save size={18} /> {loading ? 'Salvar' : 'Salvar Senha'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>

            {/* BLOCO DE SESSÃO */}
            <div className="card" style={{ borderLeft: '4px solid var(--danger)' }}>
                <div className="card-header">
                    <div className="card-title" style={{ fontSize: '1.2rem', color: 'var(--text-main)' }}>
                        <LogOut size={24} style={{ color: 'var(--danger)' }} /> Sessão
                    </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Encerrar acesso?</p>
                    <button className="btn btn-danger" onClick={logout}>Sair</button>
                </div>
            </div>
        </div>
    );
};

export default Settings;