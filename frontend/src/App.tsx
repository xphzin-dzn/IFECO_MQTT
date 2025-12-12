import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { LineChart, Line, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { 
  Zap, Activity, Thermometer, Gauge, LogOut, Play, Square, Save, Menu, Settings as SettingsIcon 
} from 'lucide-react';
import './App.css';
import Login from './Login';
import History from './History'; 
import Settings from './Settings';

// CONFIGURAÇÃO DO IP (Para funcionar no celular)
const API_URL = 'http://192.168.0.9:3001'; 

interface DadosSensor {
  id: number;
  velocidade: number;
  tensao: number;
  corrente: number;
  temperatura: number;
}

function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('userToken'));
  
  // --- NAVEGAÇÃO ---
  const [currentScreen, setCurrentScreen] = useState<'dashboard' | 'history' | 'settings'>('dashboard');

  // --- ESTADOS DO DASHBOARD ---
  const [data, setData] = useState<DadosSensor[]>([]);
  const [motorLigado, setMotorLigado] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [horaInicio, setHoraInicio] = useState<string | null>(null);

  // Configura o Axios para enviar o Token em todas as requisições
  if (token) axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

  // Função para corrigir o fuso horário
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
        // Se o token for inválido ou expirado, faz logout
        if (axios.isAxiosError(error) && (error.response?.status === 401)) logout();
      }
    };

    // Só busca dados em tempo real se estivermos vendo o Dashboard
    if (currentScreen === 'dashboard') {
        const interval = setInterval(fetchData, 1000);
        return () => clearInterval(interval);
    }
  }, [token, currentScreen]);

  const logout = () => {
    setToken(null);
    localStorage.removeItem('userToken');
    setCurrentScreen('dashboard'); // Reseta a tela
  };

  const alternarMotor = async () => {
    try {
      await axios.post(`${API_URL}/api/comando`, { acao: motorLigado ? 'DESLIGAR' : 'LIGAR' });
      setMotorLigado(!motorLigado);
    } catch (error) { alert('Erro ao enviar comando!'); }
  };

  const gerenciarGravacao = async () => {
    if (!gravando) {
      // INICIAR
      setHoraInicio(pegarHoraLocal());
      setGravando(true);
    } else {
      // PARAR E SALVAR NO HISTÓRICO
      const horaFim = pegarHoraLocal();
      setGravando(false);
      
      const nomeSessao = prompt("Nome da Sessão (Opcional):", `Sessão ${new Date().toLocaleTimeString()}`);
      
      try {
        // O backend vai pegar o ID do usuário automaticamente pelo Token
        await axios.post(`${API_URL}/api/sessions`, {
            nome: nomeSessao,
            inicio: horaInicio,
            fim: horaFim
        });
        alert("Sessão salva com sucesso! Consulte no Histórico.");
      } catch (error) {
        alert("Erro ao salvar sessão no histórico.");
      }
    }
  };

  // Se não tiver token, mostra a tela de Login
  if (!token) return <Login setToken={(t) => { setToken(t); localStorage.setItem('userToken', t); }} />;

  // Pega o último dado para os cards (ou zeros se não tiver dados)
  const ultimoDado = data.length > 0 ? data[data.length - 1] : { velocidade: 0, tensao: 0, corrente: 0, temperatura: 0 };

  return (
    <div className="app-layout">
      {/* --- SIDEBAR LATERAL --- */}
      <aside className="sidebar">
        <div className="brand">
          <Zap size={28} /> IFECO IoT
        </div>
        <nav className="nav-menu">
          <div 
            className={`nav-item ${currentScreen === 'dashboard' ? 'active' : ''}`}
            onClick={() => setCurrentScreen('dashboard')}
          >
            <Menu size={20} /> Dashboard
          </div>
          <div 
            className={`nav-item ${currentScreen === 'history' ? 'active' : ''}`}
            onClick={() => setCurrentScreen('history')}
          >
            <Activity size={20} /> Histórico
          </div>
          <div 
            className={`nav-item ${currentScreen === 'settings' ? 'active' : ''}`}
            onClick={() => setCurrentScreen('settings')}
          >
            <SettingsIcon size={20} /> Configurações
          </div>
          
          <button className="nav-item logout-btn" onClick={logout}>
            <LogOut size={20} /> Sair
          </button>
        </nav>
      </aside>

      {/* --- CONTEÚDO PRINCIPAL --- */}
      <main className="main-content">
        
        {currentScreen === 'history' ? (
            // TELA 1: HISTÓRICO
            <History />
        ) : currentScreen === 'settings' ? (
            // TELA 2: CONFIGURAÇÕES
            <>
                <header className="top-header">
                  <div className="page-title">
                    <h1>Configurações do Sistema</h1>
                    <span>Segurança e preferências da conta</span>
                  </div>
                </header>
                <Settings logout={logout} />
            </>
        ) : (
            // TELA 3: DASHBOARD (PADRÃO)
            <>
                <header className="top-header">
                  <div className="page-title">
                    <h1>Monitoramento em Tempo Real</h1>
                    <span>Visão geral dos sensores do ESP32</span>
                  </div>
                  
                  <div className="header-actions">
                    <div className="status-badge">
                      <div className={`dot ${gravando ? 'rec' : 'online'}`} />
                      {gravando ? 'GRAVANDO' : 'ONLINE'}
                    </div>
                    
                    <button className={`btn ${gravando ? 'btn-rec recording' : 'btn-rec'}`} onClick={gerenciarGravacao}>
                      {gravando ? <Square size={18}/> : <Save size={18}/>}
                      {gravando ? 'Parar e Salvar' : 'Gravar Sessão'}
                    </button>

                    <button className={`btn ${motorLigado ? 'btn-danger' : 'btn-primary'}`} onClick={alternarMotor}>
                      <Play size={18} fill={motorLigado ? "currentColor" : "none"} />
                      {motorLigado ? 'Parar Motor' : 'Ligar Motor'}
                    </button>
                  </div>
                </header>

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
                      <div className="card-title"><Zap size={20} /> Tensão</div>
                      <div className="card-value">{ultimoDado.tensao.toFixed(1)} <span style={{fontSize:'0.8rem', color:'#aaa'}}>V</span></div>
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
                      <div className="card-value">{ultimoDado.corrente.toFixed(2)} <span style={{fontSize:'0.8rem', color:'#aaa'}}>A</span></div>
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
            </>
        )}
      </main>
    </div>
  );
}

export default App;