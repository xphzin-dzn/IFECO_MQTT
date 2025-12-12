import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { LineChart, Line, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { 
  Zap, Activity, Thermometer, Gauge, LogOut, Play, Square, Save, Menu, Settings as SettingsIcon, 
  Calculator, Timer, TrendingUp 
} from 'lucide-react';
import './App.css';
import Login from './Login';
import History from './History'; 
import Settings from './Settings';

// CONFIGURAÇÃO DO IP
const API_URL = 'http://192.168.0.9:3001'; 

interface DadosSensor {
  id: number;
  velocidade: number;
  tensao: number;
  corrente: number;
  temperatura: number;
}

// Interface para os cálculos acumulados
interface MetricasCalculadas {
  distanciaTotal: number; // km
  energiaTotal: number;   // Wh (Watt-hora)
  tempoDecorrido: number; // horas
  velocidadeMedia: number;// km/h
  consumoMedio: number;   // Wh/km
}

function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('userToken'));
  const [currentScreen, setCurrentScreen] = useState<'dashboard' | 'history' | 'settings'>('dashboard');

  // --- ESTADOS DE DADOS ---
  const [data, setData] = useState<DadosSensor[]>([]);
  const [motorLigado, setMotorLigado] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [horaInicio, setHoraInicio] = useState<string | null>(null);

  // --- CÁLCULOS EM TEMPO REAL ---
  const lastUpdateRef = useRef<number>(Date.now()); // Para calcular o delta T
  const [metricas, setMetricas] = useState<MetricasCalculadas>({
    distanciaTotal: 0,
    energiaTotal: 0,
    tempoDecorrido: 0,
    velocidadeMedia: 0,
    consumoMedio: 0
  });

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
        const novosDados = response.data;
        setData(novosDados);

        // --- A MÁGICA DOS CÁLCULOS AQUI ---
        if (novosDados.length > 0) {
            const ultimo = novosDados[novosDados.length - 1];
            const agora = Date.now();
            // Diferença de tempo em horas desde a última leitura (ex: 1 segundo = 0.000277 horas)
            const deltaTempoHoras = (agora - lastUpdateRef.current) / 1000 / 3600;
            
            // Só calcula se o tempo for positivo e pequeno (evita saltos se a aba ficar inativa)
            if (deltaTempoHoras > 0 && deltaTempoHoras < 0.1) {
                setMetricas(prev => {
                    // 1. Potência Instantânea (Watts) = Tensão * Corrente
                    const potenciaInstantanea = ultimo.tensao * ultimo.corrente;
                    
                    // 2. Acumula Energia (Wh) = Potência * Tempo
                    const novaEnergia = prev.energiaTotal + (potenciaInstantanea * deltaTempoHoras);
                    
                    // 3. Acumula Distância (km) = Velocidade * Tempo
                    const novaDistancia = prev.distanciaTotal + (ultimo.velocidade * deltaTempoHoras);
                    
                    // 4. Tempo Total (h)
                    const novoTempo = prev.tempoDecorrido + deltaTempoHoras;

                    // 5. Aplica a SUA FÓRMULA: Velocidade Média = Distância Total / Tempo Total
                    const novaVelMedia = novoTempo > 0 ? (novaDistancia / novoTempo) : 0;

                    // 6. Consumo (Wh/km) = Energia / Distância
                    const novoConsumo = novaDistancia > 0.001 ? (novaEnergia / novaDistancia) : 0;

                    return {
                        distanciaTotal: novaDistancia,
                        energiaTotal: novaEnergia,
                        tempoDecorrido: novoTempo,
                        velocidadeMedia: novaVelMedia,
                        consumoMedio: novoConsumo
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
        const interval = setInterval(fetchData, 1000);
        return () => clearInterval(interval);
    }
  }, [token, currentScreen]);

  const logout = () => {
    setToken(null);
    localStorage.removeItem('userToken');
    setCurrentScreen('dashboard');
    // Reseta métricas ao sair
    setMetricas({ distanciaTotal: 0, energiaTotal: 0, tempoDecorrido: 0, velocidadeMedia: 0, consumoMedio: 0 });
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
      // Opcional: Resetar métricas ao iniciar gravação
      // setMetricas({ distanciaTotal: 0, energiaTotal: 0, tempoDecorrido: 0, velocidadeMedia: 0, consumoMedio: 0 });
    } else {
      const horaFim = pegarHoraLocal();
      setGravando(false);
      const nomeSessao = prompt("Nome da Sessão:", `Sessão ${new Date().toLocaleTimeString()}`);
      try {
        await axios.post(`${API_URL}/api/sessions`, { nome: nomeSessao, inicio: horaInicio, fim: horaFim });
        alert("Sessão salva com sucesso!");
      } catch (error) { alert("Erro ao salvar sessão."); }
    }
  };

  if (!token) return <Login setToken={(t) => { setToken(t); localStorage.setItem('userToken', t); }} />;

  const ultimoDado = data.length > 0 ? data[data.length - 1] : { velocidade: 0, tensao: 0, corrente: 0, temperatura: 0 };

  return (
    <div className="app-layout">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="brand"> <Zap size={28} /> IFECO IoT </div>
        <nav className="nav-menu">
          <div className={`nav-item ${currentScreen === 'dashboard' ? 'active' : ''}`} onClick={() => setCurrentScreen('dashboard')}>
            <Menu size={20} /> Dashboard
          </div>
          <div className={`nav-item ${currentScreen === 'history' ? 'active' : ''}`} onClick={() => setCurrentScreen('history')}>
            <Activity size={20} /> Histórico
          </div>
          <div className={`nav-item ${currentScreen === 'settings' ? 'active' : ''}`} onClick={() => setCurrentScreen('settings')}>
            <SettingsIcon size={20} /> Configurações
          </div>
          <button className="nav-item logout-btn" onClick={logout}> <LogOut size={20} /> Sair </button>
        </nav>
      </aside>

      {/* ÁREA PRINCIPAL */}
      <main className="main-content">
        {currentScreen === 'history' ? ( <History /> ) : currentScreen === 'settings' ? (
            <>
                <header className="top-header">
                  <div className="page-title"><h1>Configurações</h1><span>Segurança da conta</span></div>
                </header>
                <Settings logout={logout} />
            </>
        ) : (
            <>
                <header className="top-header">
                  <div className="page-title">
                    <h1>Monitoramento em Tempo Real</h1>
                    <span>Sensores e Consumo Energético</span>
                  </div>
                  <div className="header-actions">
                    <div className="status-badge"><div className={`dot ${gravando ? 'rec' : 'online'}`} />{gravando ? 'GRAVANDO' : 'ONLINE'}</div>
                    <button className={`btn ${gravando ? 'btn-rec recording' : 'btn-rec'}`} onClick={gerenciarGravacao}>
                      {gravando ? <Square size={18}/> : <Save size={18}/>} {gravando ? 'Salvar' : 'Gravar'}
                    </button>
                    <button className={`btn ${motorLigado ? 'btn-danger' : 'btn-primary'}`} onClick={alternarMotor}>
                      <Play size={18} fill={motorLigado ? "currentColor" : "none"} /> {motorLigado ? 'Parar' : 'Ligar'}
                    </button>
                  </div>
                </header>

                {/* --- NOVA ÁREA: CALCULADORA DE CONSUMO --- */}
                <div style={{ marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '1rem', color: '#64748b', marginBottom: '12px', display:'flex', alignItems:'center', gap:'8px' }}>
                        <Calculator size={18}/> Métricas Calculadas (Sessão Atual)
                    </h3>
                    <div className="grid-container">
                        {/* 1. Consumo Energético */}
                        <div className="card" style={{ background: 'linear-gradient(135deg, #1e9e53 0%, #166534 100%)', color: 'white', border: 'none' }}>
                            <div className="card-header" style={{ marginBottom: '10px' }}>
                                <div className="card-title" style={{ color: 'rgba(255,255,255,0.8)' }}><Zap size={20} /> Consumo Médio</div>
                            </div>
                            <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                                {metricas.consumoMedio.toFixed(1)} <span style={{ fontSize: '1rem', fontWeight:'normal' }}>Wh/km</span>
                            </div>
                            <div style={{ fontSize: '0.85rem', opacity: 0.8, marginTop: '5px' }}>
                                Energia gasta por Km rodado
                            </div>
                        </div>

                        {/* 2. Velocidade Média (Sua Fórmula) */}
                        <div className="card">
                            <div className="card-header">
                                <div className="card-title"><TrendingUp size={20} /> Vel. Média</div>
                            </div>
                            <div className="card-value">{metricas.velocidadeMedia.toFixed(1)} <span style={{ fontSize: '0.8rem', color: '#aaa' }}>km/h</span></div>
                            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '5px' }}>
                                Dist. ({metricas.distanciaTotal.toFixed(2)} km) / Tempo
                            </div>
                        </div>

                        {/* 3. Tempo Decorrido */}
                        <div className="card">
                            <div className="card-header">
                                <div className="card-title"><Timer size={20} /> Tempo Ativo</div>
                            </div>
                            <div className="card-value">
                                {Math.floor(metricas.tempoDecorrido * 60)} <span style={{ fontSize: '0.8rem', color: '#aaa' }}>minutos</span>
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '5px' }}>
                                Desde que abriu o painel
                            </div>
                        </div>

                        {/* 4. Energia Acumulada */}
                        <div className="card">
                            <div className="card-header">
                                <div className="card-title"><Activity size={20} /> Energia Total</div>
                            </div>
                            <div className="card-value">{metricas.energiaTotal.toFixed(2)} <span style={{ fontSize: '0.8rem', color: '#aaa' }}>Wh</span></div>
                             <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '5px' }}>
                                Potência x Tempo
                            </div>
                        </div>
                    </div>
                </div>

                {/* GRÁFICOS ORIGINAIS */}
                <h3 style={{ fontSize: '1rem', color: '#64748b', marginBottom: '12px', marginTop: '20px' }}>Leituras dos Sensores</h3>
                <div className="grid-container">
                  <div className="card">
                    <div className="card-header">
                      <div className="card-title"><Gauge size={20} /> Velocidade Instantânea</div>
                      <div className="card-value">{ultimoDado.velocidade.toFixed(1)} <span style={{fontSize:'0.8rem', color:'#aaa'}}>km/h</span></div>
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                      <AreaChart data={data}>
                        <defs><linearGradient id="colorVel" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#1e9e53" stopOpacity={0.1}/><stop offset="95%" stopColor="#1e9e53" stopOpacity={0}/></linearGradient></defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                        <Tooltip />
                        <Area type="monotone" dataKey="velocidade" stroke="#1e9e53" fillOpacity={1} fill="url(#colorVel)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

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