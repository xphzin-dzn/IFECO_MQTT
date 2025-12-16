import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { LineChart, Line, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, YAxis } from 'recharts';
import {
  Zap, Activity, Thermometer, Gauge, LogOut, Play, Square, Save, Menu, Settings as SettingsIcon,
  Calculator, Timer, TrendingUp, X, AlertTriangle, Flame
} from 'lucide-react';
import './App.css';
import Login from './Login';
import History from './History';
import Settings from './Settings';

// IP CONFIG
// Lembre-se: Se mudar de rede, atualize este IP aqui também!
const API_URL = 'http://192.168.0.21:3001';

// Tipos
interface DadosSensor {
  id: number;
  velocidade: number;
  tensao: number;
  corrente: number;
  temperatura: number;
  data_hora?: string;
}

interface MetricasCalculadas {
  distanciaTotal: number;
  energiaTotal: number;
  tempoDecorrido: number;
  velocidadeMedia: number;
  consumoMedio: number;
}

// Função para gerar a URL do Avatar
const getAvatarUrl = (name: string | null, avatarPath: string | null) => {
  if (avatarPath) {
    return `${API_URL}${avatarPath}`;
  }
  const safeName = name || 'Usuario';
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(safeName)}&background=1e9e53&color=fff&bold=true`;
};

function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('userToken'));
  const [userName, setUserName] = useState<string | null>(localStorage.getItem('userName'));
  const [userAvatar, setUserAvatar] = useState<string | null>(localStorage.getItem('userAvatar'));

  const [currentScreen, setCurrentScreen] = useState<'dashboard' | 'history' | 'settings'>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // TEMA
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');

  useEffect(() => {
    if (isDarkMode) {
      document.body.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.body.removeAttribute('data-theme');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  // SAUDAÇÃO
  const getGreeting = () => {
    const hour = new Date().getHours();
    const firstName = userName ? userName.split(' ')[0] : 'Usuário';
    const formattedName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
    if (hour < 12) return `Bom dia, ${formattedName}! ☀️`;
    if (hour < 18) return `Boa tarde, ${formattedName}! 🌤️`;
    return `Boa noite, ${formattedName}! 🌙`;
  };

  // DASHBOARD
  const [data, setData] = useState<DadosSensor[]>([]);
  const [motorLigado, setMotorLigado] = useState(false);
  const [gravando, setGravando] = useState(false);
  
  // Referência para calcular integrais (energia/distância) no frontend
  const lastUpdateRef = useRef<number>(Date.now());
  const [metricas, setMetricas] = useState<MetricasCalculadas>({
    distanciaTotal: 0,
    energiaTotal: 0,
    tempoDecorrido: 0,
    velocidadeMedia: 0,
    consumoMedio: 0
  });

  if (token) axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

  // --- FETCH DE DADOS "AO VIVO" (Super Rápido) ---
  useEffect(() => {
    if (!token) return;

    const fetchData = async () => {
      try {
        // Busca o buffer da RAM do servidor (últimos 50 pontos)
        const response = await axios.get<DadosSensor[]>(`${API_URL}/api/telemetria`);
        const novosDados = response.data;
        setData(novosDados);

        // Cálculos matemáticos locais (Integração no tempo)
        if (novosDados.length > 0) {
          const ultimo = novosDados[novosDados.length - 1];
          const agora = Date.now();
          const deltaTempoHoras = (agora - lastUpdateRef.current) / 1000 / 3600; // Delta em horas

          // Só calcula se o delta for razoável (evita saltos grandes se a aba ficar inativa)
          if (deltaTempoHoras > 0 && deltaTempoHoras < 0.1) {
            setMetricas(prev => {
              const potenciaInstantanea = ultimo.tensao * ultimo.corrente;
              
              // Energia (Wh) = Potência (W) * Tempo (h)
              const novaEnergia = prev.energiaTotal + (potenciaInstantanea * deltaTempoHoras);
              
              // Distância (km) = Velocidade (km/h) * Tempo (h)
              const novaDistancia = prev.distanciaTotal + (ultimo.velocidade * deltaTempoHoras);
              
              const novoTempo = prev.tempoDecorrido + deltaTempoHoras;

              return {
                distanciaTotal: novaDistancia,
                energiaTotal: novaEnergia,
                tempoDecorrido: novoTempo,
                velocidadeMedia: novoTempo > 0 ? novaDistancia / novoTempo : 0,
                consumoMedio: novaDistancia > 0.001 ? novaEnergia / novaDistancia : 0
              };
            });
          }
          lastUpdateRef.current = agora;
        }
      } catch (error) {
        if (axios.isAxiosError(error) && (error.response?.status === 401)) logout();
      }
    };

    if (currentScreen === 'dashboard') {
      // 🚀 TURBO MODE: 200ms (5 atualizações por segundo)
      const interval = setInterval(fetchData, 200); 
      return () => clearInterval(interval);
    }
  }, [token, currentScreen]);

  const logout = () => {
    setToken(null);
    setUserName(null);
    setUserAvatar(null);
    localStorage.removeItem('userToken');
    localStorage.removeItem('userName');
    localStorage.removeItem('userAvatar');
    setCurrentScreen('dashboard');
    setMetricas({ distanciaTotal: 0, energiaTotal: 0, tempoDecorrido: 0, velocidadeMedia: 0, consumoMedio: 0 });
  };

  const alternarMotor = async () => {
    try {
      await axios.post(`${API_URL}/api/comando`, { acao: motorLigado ? 'DESLIGAR' : 'LIGAR' });
      setMotorLigado(!motorLigado);
    } catch (error) {
      alert('Erro ao enviar comando!');
    }
  };

  // --- NOVA LÓGICA DE GRAVAÇÃO (Backend Start/Stop) ---
  const gerenciarGravacao = async () => {
    if (!gravando) {
      // INICIAR: Pede o nome ANTES
      const nomeSessao = prompt("Nome para a gravação:", `Treino ${new Date().toLocaleTimeString()}`);
      if (nomeSessao === null) return; // Cancelou

      try {
        // Avisa o servidor para começar a salvar no banco
        await axios.post(`${API_URL}/api/sessions/start`, { nome: nomeSessao });
        setGravando(true);
        
        // ZERA AS MÉTRICAS AO INICIAR NOVA GRAVAÇÃO
        setMetricas({
           distanciaTotal: 0,
           energiaTotal: 0,
           tempoDecorrido: 0,
           velocidadeMedia: 0,
           consumoMedio: 0
        });
        
      } catch (error) {
        console.error(error);
        alert("Erro ao iniciar gravação no servidor.");
      }

    } else {
      // PARAR
      try {
        // Avisa o servidor para parar
        await axios.post(`${API_URL}/api/sessions/stop`);
        setGravando(false);
        alert("Gravação Finalizada e Salva com Sucesso!");
      } catch (error) {
        console.error(error);
        alert("Erro ao finalizar gravação.");
      }
    }
  };

  const handleMenuClick = (screen: 'dashboard' | 'history' | 'settings') => {
    setCurrentScreen(screen);
    setMobileMenuOpen(false);
  };

  const handleLoginSuccess = (t: string, name: string, avatar: string | null) => {
    setToken(t);
    setUserName(name);
    setUserAvatar(avatar);
    localStorage.setItem('userToken', t);
    localStorage.setItem('userName', name);
    if (avatar) localStorage.setItem('userAvatar', avatar);
  };

  const updateAvatar = (newUrl: string) => {
    setUserAvatar(newUrl);
    localStorage.setItem('userAvatar', newUrl);
  };

  // --- ALERTAS ---
  const renderWarning = (tipo: string, valor: number) => {
    let mensagem = "";
    let Icone = AlertTriangle;

    if (tipo === 'temperatura' && valor > 50) { mensagem = "Superaquecimento!"; Icone = Flame; }
    else if (tipo === 'velocidade' && valor > 90) { mensagem = "Excesso de Velocidade!"; Icone = Activity; }
    else if (tipo === 'corrente' && valor > 40) { mensagem = "Sobrecarga de Corrente!"; Icone = Zap; }
    else if (tipo === 'tensao' && valor > 85) { mensagem = "Tensão Crítica!"; Icone = AlertTriangle; }

    if (!mensagem) return null;

    return (
      <div className="alert-modern">
        <Icone size={24} strokeWidth={2.5} />
        <span>{mensagem}</span>
      </div>
    );
  };

  if (!token) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  const ultimoDado = data.length > 0 ? data[data.length - 1] : { velocidade: 0, tensao: 0, corrente: 0, temperatura: 0 };

  return (
    <div className="app-layout">
      <div className={`sidebar-overlay ${mobileMenuOpen ? 'visible' : ''}`} onClick={() => setMobileMenuOpen(false)} />

      {/* SIDEBAR */}
      <aside className={`sidebar ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="brand" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '5px', marginBottom: '30px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', justifyContent: 'space-between' }}>
            {/* LOGO */}
            <img
              src="/3.png"
              alt="Logo IFECO"
              style={{ width: '110px', height: 'auto', objectFit: 'contain' }}
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = 'https://placehold.co/200x80/1e9e53/ffffff?text=IFECO+IoT&font=montserrat';
              }}
            />
            <button className="sidebar-close-btn" onClick={() => setMobileMenuOpen(false)}> <X size={24} /> </button>
          </div>
          <div style={{ marginTop: '20px', padding: '12px', background: 'rgba(255,255,255,0.1)', borderRadius: '12px', width: '100%', boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img src={getAvatarUrl(userName, userAvatar)} alt="Perfil" style={{ width: '42px', height: '42px', borderRadius: '50%', border: '2px solid white', objectFit: 'cover' }} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'white' }}>{userName || 'Visitante'}</span>
              <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>Online</span>
            </div>
          </div>
        </div>
        <nav className="nav-menu">
          <div className={`nav-item ${currentScreen === 'dashboard' ? 'active' : ''}`} onClick={() => handleMenuClick('dashboard')}> <Menu size={20} /> Dashboard </div>
          <div className={`nav-item ${currentScreen === 'history' ? 'active' : ''}`} onClick={() => handleMenuClick('history')}> <Activity size={20} /> Histórico </div>
          <div className={`nav-item ${currentScreen === 'settings' ? 'active' : ''}`} onClick={() => handleMenuClick('settings')}> <SettingsIcon size={20} /> Configurações </div>
          <button className="nav-item logout-btn" onClick={logout}> <LogOut size={20} /> Sair </button>
        </nav>
      </aside>

      <main className="main-content">
        {currentScreen !== 'settings' && (
          <header className="top-header">
            <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
              <button className="mobile-menu-btn" onClick={() => setMobileMenuOpen(true)}> <Menu size={28} /> </button>
              <div className="page-title" style={{ flex: 1 }}>
                {currentScreen === 'dashboard' ? (
                  <>
                    <h1>{getGreeting()}</h1>
                    {/* Alteração 1: Texto de Atualização */}
                    <span>Monitoramento em Tempo Real (Atualização: 200ms)</span>
                  </>
                ) : (
                  <> <h1>Histórico de Sessões</h1> <span>Análise de dados gravados</span> </>
                )}
              </div>
            </div>
            
            {currentScreen === 'dashboard' && (
              <div className="header-actions">
                {/* Alteração 2: Botão CSV Removido */}

                <div className="status-badge">
                    <div className={`dot ${gravando ? 'rec' : 'online'}`} />
                    {gravando ? 'GRAVANDO' : 'AO VIVO'}
                </div>
                
                {/* Alteração 3: Texto Gravar Sessão */}
                <button 
                    className={`btn ${gravando ? 'btn-rec recording' : 'btn-rec'}`} 
                    onClick={gerenciarGravacao}
                >
                    {gravando ? <Square size={18} /> : <Save size={18} />} 
                    {gravando ? 'Parar Gravação' : 'Gravar Sessão'}
                </button>
                
                {/* Alteração 4: Texto Teste ESP32 */}
                <button className={`btn ${motorLigado ? 'btn-danger' : 'btn-primary'}`} onClick={alternarMotor}>
                    <Play size={18} fill={motorLigado ? "currentColor" : "none"} /> {motorLigado ? 'Parar Teste' : 'Teste ESP32'}
                </button>
              </div>
            )}
          </header>
        )}

        {currentScreen === 'history' ? (<History />) : currentScreen === 'settings' ? (
          <>
            <header className="top-header"><div style={{ display: 'flex', alignItems: 'center' }}><button className="mobile-menu-btn" onClick={() => setMobileMenuOpen(true)}> <Menu size={28} /> </button><div className="page-title"><h1>Configurações</h1><span>Personalize sua experiência</span></div></div></header>
            <Settings logout={logout} toggleTheme={toggleTheme} isDarkMode={isDarkMode} userAvatar={userAvatar} onAvatarUpdate={updateAvatar} />
          </>
        ) : (
          // --- DASHBOARD PRINCIPAL ---
          <>
            <div style={{ marginBottom: '24px', marginTop: '10px' }}>
              <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}> <Calculator size={18} /> Métricas da Sessão Atual </h3>
              <div className="grid-container">
                <div className="card" style={{ background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)', color: 'white', border: 'none' }}>
                  <div className="card-header" style={{ marginBottom: '10px' }}><div className="card-title" style={{ color: 'rgba(255,255,255,0.8)' }}><Zap size={20} /> Consumo</div></div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>{metricas.consumoMedio.toFixed(1)} <span style={{ fontSize: '0.9rem', fontWeight: 'normal' }}>Wh/km</span></div>
                </div>
                <div className="card"><div className="card-header"><div className="card-title"><TrendingUp size={20} /> Vel. Média</div></div><div className="card-value">{metricas.velocidadeMedia.toFixed(1)} <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>km/h</span></div></div>
                <div className="card"><div className="card-header"><div className="card-title"><Timer size={20} /> Tempo</div></div><div className="card-value">{Math.floor(metricas.tempoDecorrido * 60)} <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>min</span></div></div>
                <div className="card"><div className="card-header"><div className="card-title"><Activity size={20} /> Energia</div></div><div className="card-value">{metricas.energiaTotal.toFixed(2)} <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Wh</span></div></div>
              </div>
            </div>

            <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '12px', marginTop: '20px' }}>Leitura dos Sensores (Ao Vivo)</h3>
            <div className="grid-container">

              {/* --- CARD VELOCIDADE --- */}
              <div className="card">
                <div className="card-header">
                  <div className="card-title"><Gauge size={20} /> Velocidade</div>
                  <div className="card-value">{ultimoDado.velocidade.toFixed(1)} <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>km/h</span></div>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={data}>
                    <defs>
                      <linearGradient id="colorVel" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1e9e53" stopOpacity={0.1} />
                        <stop offset="95%" stopColor="#1e9e53" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-main)' }} />
                    <Area type="monotone" dataKey="velocidade" stroke="#1e9e53" fillOpacity={1} fill="url(#colorVel)" strokeWidth={2} isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
                {renderWarning('velocidade', ultimoDado.velocidade)}
              </div>

              {/* --- CARD TENSÃO --- */}
              <div className="card">
                <div className="card-header">
                  <div className="card-title"><Zap size={20} /> Tensão</div>
                  <div className="card-value">{ultimoDado.tensao.toFixed(1)} <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>V</span></div>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <YAxis domain={['auto', 'auto']} hide={true} />
                    <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-main)' }} />
                    <Line type="monotone" dataKey="tensao" stroke="#f59e0b" strokeWidth={3} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
                {renderWarning('tensao', ultimoDado.tensao)}
              </div>

              {/* --- CARD CORRENTE --- */}
              <div className="card">
                <div className="card-header">
                  <div className="card-title"><Activity size={20} /> Corrente</div>
                  <div className="card-value">{ultimoDado.corrente.toFixed(2)} <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>A</span></div>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <YAxis domain={['auto', 'auto']} hide={true} />
                    <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-main)' }} />
                    <Line type="monotone" dataKey="corrente" stroke="#ef4444" strokeWidth={3} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
                {renderWarning('corrente', ultimoDado.corrente)}
              </div>

              {/* --- CARD TEMPERATURA --- */}
              <div className="card">
                <div className="card-header">
                  <div className="card-title"><Thermometer size={20} /> Temp</div>
                  <div className="card-value">{ultimoDado.temperatura.toFixed(1)} <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>°C</span></div>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <YAxis domain={['auto', 'auto']} hide={true} />
                    <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-main)' }} />
                    <Line type="monotone" dataKey="temperatura" stroke="#3b82f6" strokeWidth={3} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
                {renderWarning('temperatura', ultimoDado.temperatura)}
              </div>

            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default App;