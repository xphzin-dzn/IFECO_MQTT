import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { LineChart, Line, CartesianGrid, Tooltip, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { Calendar, Clock, Activity, Download, MousePointerClick, AlertCircle } from 'lucide-react';
import './App.css';

// SEU IP CONFIGURADO
const API_URL = 'http://172.29.110.52:3001';

interface Session {
    id: number;
    nome: string;
    data_inicio: string;
    data_fim: string;
}

interface DadosSensor {
    id: number;
    velocidade: number;
    tensao: number;
    corrente: number;
    temperatura: number;
    data_hora: string;
}

const History: React.FC = () => {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [selectedSession, setSelectedSession] = useState<Session | null>(null);
    const [chartData, setChartData] = useState<DadosSensor[]>([]);
    const [loading, setLoading] = useState(false);

    // Carrega a lista de sessões ao abrir
    useEffect(() => {
        carregarLista();
    }, []);

    const carregarLista = async () => {
        try {
            // O Token já está configurado no axios pelo App.tsx
            const res = await axios.get(`${API_URL}/api/sessions`);
            setSessions(res.data);
        } catch (error) {
            console.error("Erro ao buscar sessões", error);
        }
    };

    // Quando clica em uma sessão, busca os dados dela
    const handleSelectSession = async (sessao: Session) => {
        setSelectedSession(sessao);
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/api/sessions/${sessao.id}/dados`);
            setChartData(res.data);
        } catch (error) {
            alert("Erro ao carregar dados desta sessão.");
        } finally {
            setLoading(false);
        }
    };

    const exportarJSON = () => {
        if (!chartData.length) return;
        const jsonString = JSON.stringify(chartData, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const href = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = href;
        link.download = `export_sessao_${selectedSession?.id}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const formatData = (isoString: string) => {
        return new Date(isoString).toLocaleString('pt-BR');
    };

    return (
        <div style={{ display: 'flex', height: 'calc(100vh - 140px)', gap: '24px' }}>
            
            {/* --- LISTA LATERAL (ESQUERDA) --- */}
            <div className="card" style={{ width: '320px', padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div className="card-header" style={{ padding: '20px', borderBottom: '1px solid var(--border)', marginBottom: 0 }}>
                    <div className="card-title">
                        <Calendar size={20} /> Histórico de Sessões
                    </div>
                </div>
                
                <div style={{ overflowY: 'auto', flex: 1 }}>
                    {sessions.map(sessao => (
                        <div 
                            key={sessao.id}
                            onClick={() => handleSelectSession(sessao)}
                            style={{
                                padding: '16px 20px',
                                borderBottom: '1px solid var(--border)',
                                cursor: 'pointer',
                                background: selectedSession?.id === sessao.id ? '#f0fdf4' : 'transparent',
                                borderLeft: selectedSession?.id === sessao.id ? '4px solid var(--primary)' : '4px solid transparent',
                                transition: 'all 0.2s'
                            }}
                        >
                            <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
                                {sessao.nome}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Clock size={14} /> {formatData(sessao.data_inicio)}
                            </div>
                        </div>
                    ))}
                    
                    {sessions.length === 0 && (
                        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                            <AlertCircle size={32} style={{ marginBottom: 10, opacity: 0.5 }} />
                            <p>Nenhuma sessão gravada ainda.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* --- ÁREA DO GRÁFICO (DIREITA) --- */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                {selectedSession ? (
                    <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <div className="card-header">
                            <div className="card-title">
                                <Activity size={20} /> Análise: {selectedSession.nome}
                            </div>
                            <button className="btn btn-outline" onClick={exportarJSON}>
                                <Download size={16} /> Baixar JSON
                            </button>
                        </div>

                        {loading ? (
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                                Carregando dados...
                            </div>
                        ) : chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                                    <XAxis 
                                        dataKey="data_hora" 
                                        tickFormatter={(tick) => new Date(tick).toLocaleTimeString()} 
                                        stroke="var(--text-secondary)"
                                        fontSize={12}
                                    />
                                    <YAxis stroke="var(--text-secondary)" fontSize={12} />
                                    <Tooltip 
                                        labelFormatter={(label) => formatData(label)}
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    />
                                    <Line type="monotone" dataKey="velocidade" name="Velocidade" stroke="#1e9e53" strokeWidth={2} dot={false} />
                                    <Line type="monotone" dataKey="tensao" name="Tensão" stroke="#f59e0b" strokeWidth={2} dot={false} />
                                    <Line type="monotone" dataKey="corrente" name="Corrente" stroke="#ef4444" strokeWidth={2} dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        ) : (
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: 'var(--text-secondary)' }}>
                                <AlertCircle size={48} style={{ marginBottom: '15px', opacity: 0.2 }} />
                                <p>A sessão foi criada, mas não há dados de sensores neste intervalo.</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: '#9ca3af', border: '2px dashed var(--border)', borderRadius: '16px' }}>
                        <MousePointerClick size={64} style={{ marginBottom: '20px', opacity: 0.2 }} />
                        <h3>Selecione uma sessão na lista para ver os detalhes</h3>
                    </div>
                )}
            </div>
        </div>
    );
};

export default History;