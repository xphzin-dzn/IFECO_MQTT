import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { LineChart, Line, CartesianGrid, Tooltip, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { Calendar, Clock, ChevronRight, Activity, Download } from 'lucide-react';
import './App.css';

const API_URL = 'http://localhost:3001';

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

    // Função para exportar JSON (igual tinha antes, mas agora do histórico)
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

    // Formata data para ficar bonito (ex: 12/12/2023 14:00)
    const formatData = (isoString: string) => {
        return new Date(isoString).toLocaleString('pt-BR');
    };

    return (
        <div style={{ display: 'flex', height: '100%', gap: '20px' }}>
            {/* LISTA LATERAL (ESQUERDA) */}
            <div style={{ width: '300px', background: 'white', borderRadius: '16px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '20px', borderBottom: '1px solid var(--border)', background: '#f8fafc' }}>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Calendar size={20} /> Histórico
                    </h3>
                </div>
                <div style={{ overflowY: 'auto', flex: 1 }}>
                    {sessions.map(sessao => (
                        <div 
                            key={sessao.id}
                            onClick={() => handleSelectSession(sessao)}
                            style={{
                                padding: '15px 20px',
                                borderBottom: '1px solid var(--border)',
                                cursor: 'pointer',
                                background: selectedSession?.id === sessao.id ? '#f0fdf4' : 'white',
                                borderLeft: selectedSession?.id === sessao.id ? '4px solid var(--primary)' : '4px solid transparent',
                                transition: 'all 0.2s'
                            }}
                        >
                            <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
                                {sessao.nome}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <Clock size={14} /> {formatData(sessao.data_inicio)}
                            </div>
                        </div>
                    ))}
                    {sessions.length === 0 && (
                        <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Nenhuma sessão gravada.</div>
                    )}
                </div>
            </div>

            {/* ÁREA DO GRÁFICO (DIREITA) */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {selectedSession ? (
                    <>
                        <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                            <div className="card-header">
                                <div className="card-title">
                                    <Activity size={20} /> Análise da Sessão: {selectedSession.nome}
                                </div>
                                <button className="btn btn-outline" onClick={exportarJSON}>
                                    <Download size={16} /> Baixar JSON
                                </button>
                            </div>

                            {loading ? (
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Carregando dados...</div>
                            ) : chartData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                                        <XAxis dataKey="data_hora" tickFormatter={(tick) => new Date(tick).toLocaleTimeString()} />
                                        <YAxis />
                                        <Tooltip labelFormatter={(label) => formatData(label)} />
                                        <Line type="monotone" dataKey="velocidade" name="Velocidade" stroke="#1e9e53" strokeWidth={2} dot={false} />
                                        <Line type="monotone" dataKey="tensao" name="Tensão" stroke="#f59e0b" strokeWidth={2} dot={false} />
                                        <Line type="monotone" dataKey="corrente" name="Corrente" stroke="#ef4444" strokeWidth={2} dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            ) : (
                                <div style={{ textAlign: 'center', marginTop: '50px', color: '#666' }}>
                                    A sessão foi criada, mas não há dados de sensores neste intervalo.
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', flexDirection: 'column' }}>
                        <Calendar size={64} style={{ marginBottom: '20px', opacity: 0.2 }} />
                        <h3>Selecione uma sessão ao lado para ver os detalhes</h3>
                    </div>
                )}
            </div>
        </div>
    );
};

export default History;