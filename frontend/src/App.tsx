import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  LineChart, Line, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts';
import { 
  Zap, Activity, Thermometer, Gauge, LogOut, Play, Square, Download, Menu, Wifi 
} from 'lucide-react';
import './App.css';
import Login from './Login';

const API_URL = 'http://localhost:3001'; 

interface DadosSensor {
  id: number;
  velocidade: number;
  tensao: number;
  corrente: number;
  temperatura: number;
}

function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('userToken'));
  const [data, setData] = useState<DadosSensor[]>([]);
  const [motorLigado, setMotorLigado] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [horaInicio, setHoraInicio] = useState<string | null>(null);

  if (token) axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

  const pegarHoraLocal = () => {
    const agora = new Date();
    const offset = agora.getTimezoneOffset() * 60000;
    return new Date(agora.getTime() - offset).toISOString().slice(0, 19).replace('T', ' ');
  };

  useEffect(() => {
    if (!token) return;
    const fetchData = async () => {
      try {
        const response = await axios.get<DadosSensor[]>(`${API_URL}/api/telemetria`);
        setData(response.data);
      } catch (error) {
        if (axios.isAxiosError(error) && (error.response?.status === 401)) logout();
      }
    };
    const interval = setInterval(fetchData, 1000);
    return () => clearInterval(interval);
  }, [token]);

  const logout = () => {
    setToken(null);
    localStorage.removeItem('userToken');
  };

  const alternarMotor = async () => {
    try {
      await axios.post(`${API_URL}/api/comando`, { acao: motorLigado ? 'DESLIGAR' : 'LIGAR' });
      setMotorLigado(!motorLigado);
    } catch (error) { alert('Erro ao enviar comando!'); }
  };

  const gerenciarGravacao = async () => {
    if (!gravando) {
      setHoraInicio(pegarHoraLocal());
      setGravando(true);
    } else {
      const horaFim = pegarHoraLocal();
      setGravando(false);
      try {
        const response = await axios.get(`${API_URL}/api/exportar`, { params: { inicio: horaInicio, fim: horaFim } });
        if (!response.data.length) return alert("Nenhum dado capturado.");
        
        const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: "application/json" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `sessao_${horaFim.replace(/:/g, '-')}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (error) { alert("Erro ao exportar."); }
    }
  };

  if (!token) return <Login setToken={(t) => { setToken(t); localStorage.setItem('userToken', t); }} />;

  // Pega o último dado para mostrar o valor atual
  const ultimoDado = data.length > 0 ? data[data.length - 1] : { velocidade: 0, tensao: 0, corrente: 0, temperatura: 0 };

  return (
    <div className="app-layout">
      {/* SIDEBAR LATERAL */}
      <aside className="sidebar">
        <div className="brand">
          <Zap size={28} /> IFECO IoT
        </div>
        <nav className="nav-menu">
          <div className="nav-item active"><Menu size={20} /> Dashboard</div>
          <div className="nav-item"><Activity size={20} /> Histórico</div>
          
          <button className="nav-item logout-btn" onClick={logout}>
            <LogOut size={20} /> Sair do Sistema
          </button>
        </nav>
      </aside>

      {/* ÁREA PRINCIPAL */}
      <main className="main-content">
        
        {/* Header Superior */}
        <header className="top-header">
          <div className="page-title">
            <h1>Monitoramento em Tempo Real</h1>
            <span>Visão geral dos sensores do ESP32</span>
          </div>
          
          <div className="header-actions">
            <div className="status-badge">
              <div className={`dot ${gravando ? 'rec' : 'online'}`} />
              {gravando ? 'GRAVANDO SESSÃO' : 'SISTEMA ONLINE'}
            </div>
            
            <button className={`btn ${gravando ? 'btn-rec recording' : 'btn-rec'}`} onClick={gerenciarGravacao}>
              {gravando ? <Square size={18}/> : <Download size={18}/>}
              {gravando ? 'Parar Gravação' : 'Gravar Sessão'}
            </button>

            <button className={`btn ${motorLigado ? 'btn-danger' : 'btn-primary'}`} onClick={alternarMotor}>
              <Play size={18} fill={motorLigado ? "currentColor" : "none"} />
              {motorLigado ? 'Parar Motor' : 'Ligar Motor'}
            </button>
          </div>
        </header>

        {/* Grid de Gráficos */}
        <div className="grid-container">
          
          {/* Card Velocidade */}
          <div className="card">
            <div className="card-header">
              <div className="card-title"><Gauge size={20} /> Velocidade</div>
              <div className="card-value">{ultimoDado.velocidade.toFixed(1)} <span style={{fontSize:'0.8rem', color:'#aaa'}}>km/h</span></div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorVel" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1e9e53" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#1e9e53" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <Tooltip />
                <Area type="monotone" dataKey="velocidade" stroke="#1e9e53" fillOpacity={1} fill="url(#colorVel)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Card Tensão */}
          <div className="card">
            <div className="card-header">
              <div className="card-title"><Zap size={20} /> Tensão da Bateria</div>
              <div className="card-value">{ultimoDado.tensao.toFixed(1)} <span style={{fontSize:'0.8rem', color:'#aaa'}}>Volts</span></div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <Tooltip />
                <Line type="monotone" dataKey="tensao" stroke="#f59e0b" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Card Corrente */}
          <div className="card">
            <div className="card-header">
              <div className="card-title"><Activity size={20} /> Corrente</div>
              <div className="card-value">{ultimoDado.corrente.toFixed(2)} <span style={{fontSize:'0.8rem', color:'#aaa'}}>Amperes</span></div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <Tooltip />
                <Line type="monotone" dataKey="corrente" stroke="#ef4444" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Card Temperatura */}
          <div className="card">
            <div className="card-header">
              <div className="card-title"><Thermometer size={20} /> Temperatura</div>
              <div className="card-value">{ultimoDado.temperatura.toFixed(1)} <span style={{fontSize:'0.8rem', color:'#aaa'}}>°C</span></div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <Tooltip />
                <Line type="monotone" dataKey="temperatura" stroke="#3b82f6" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

        </div>
      </main>
    </div>
  );
}

export default App;