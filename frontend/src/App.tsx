import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './App.css';
import Login from './Login'; // <--- IMPORTANTE: Importa a tela de login

// Se for testar no PC, use localhost. Se for no celular, coloque o IP (ex: 192.168.0.7)
const API_URL = 'http://localhost:3001'; 

interface DadosSensor {
  id: number;
  velocidade: number;
  tensao: number;
  corrente: number;
  temperatura: number;
  data_hora?: string;
}

function App() {
  // --- ESTADO DE AUTENTICAÇÃO ---
  // Tenta pegar o token salvo na memória do navegador
  const [token, setToken] = useState<string | null>(localStorage.getItem('userToken'));

  // --- ESTADOS DO DASHBOARD ---
  const [data, setData] = useState<DadosSensor[]>([]);
  const [motorLigado, setMotorLigado] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [horaInicio, setHoraInicio] = useState<string | null>(null);

  // --- CONFIGURAÇÃO DE SEGURANÇA ---
  if (token) {
    // Se tem token, avisa o Axios para mandar ele em TODAS as requisições
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  // --- FUNÇÃO AUXILIAR DE DATA (CORREÇÃO DE FUSO HORÁRIO) ---
  const pegarHoraLocal = () => {
    const agora = new Date();
    const offset = agora.getTimezoneOffset() * 60000;
    const dataLocal = new Date(agora.getTime() - offset);
    return dataLocal.toISOString().slice(0, 19).replace('T', ' ');
  };

  // --- MONITORAMENTO (Só roda se estiver logado) ---
  useEffect(() => {
    if (!token) return; // Se não tem token, não busca dados

    const fetchData = async () => {
      try {
        const response = await axios.get<DadosSensor[]>(`${API_URL}/api/telemetria`);
        setData(response.data);
      } catch (error) {
        console.error("Erro ao buscar dados. Token expirado?", error);
        // Se der erro de autorização (401/403), desloga o usuário
        if (axios.isAxiosError(error) && (error.response?.status === 401 || error.response?.status === 403)) {
            logout();
        }
      }
    };
    
    const interval = setInterval(fetchData, 1000);
    return () => clearInterval(interval);
  }, [token]);

  // --- AÇÕES DO SISTEMA ---

  const logout = () => {
    setToken(null);
    localStorage.removeItem('userToken');
    // Remove o header para garantir
    delete axios.defaults.headers.common['Authorization'];
  };

  const alternarMotor = async () => {
    const novaAcao = motorLigado ? 'DESLIGAR' : 'LIGAR';
    try {
      await axios.post(`${API_URL}/api/comando`, { acao: novaAcao });
      setMotorLigado(!motorLigado);
    } catch (error) {
      alert('Erro ao enviar comando! Você tem permissão?');
    }
  };

  const gerenciarGravacao = async () => {
    if (!gravando) {
      // INICIAR: Usa hora local corrigida
      const agora = pegarHoraLocal();
      setHoraInicio(agora);
      setGravando(true);
    } else {
      // PARAR
      const horaFim = pegarHoraLocal();
      setGravando(false);
      
      try {
        const response = await axios.get(`${API_URL}/api/exportar`, {
          params: { inicio: horaInicio, fim: horaFim }
        });

        const dadosDaSessao = response.data;

        if (!dadosDaSessao || dadosDaSessao.length === 0) {
          alert("Nenhum dado capturado nesta sessão. (Verifique se o ESP32 está ligado)");
          return;
        }

        // Download do JSON
        const jsonString = JSON.stringify(dadosDaSessao, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const href = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = href;
        link.download = `sessao_${horaFim.replace(/:/g, '-')}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

      } catch (error) {
        console.error("Erro ao exportar:", error);
        alert("Erro ao exportar dados.");
      }
    }
  };

  // --- RENDERIZAÇÃO CONDICIONAL ---
  
  // 1. Se NÃO tem token, mostra LOGIN
  if (!token) {
    return <Login setToken={(t) => {
        setToken(t);
        localStorage.setItem('userToken', t);
    }} />;
  }

  // 2. Se TEM token, mostra DASHBOARD
  return (
    <div className="dashboard-container">
      <div className="header" style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <h1>Sistema Supervisório ESP32</h1>
        <button 
            onClick={logout}
            style={{
                background: '#ff4d4d', 
                color: 'white', 
                border: 'none', 
                padding: '8px 15px', 
                borderRadius: '5px',
                cursor: 'pointer',
                fontWeight: 'bold'
            }}
        >
            SAIR
        </button>
      </div>

      <div className="painel-controle">
        {/* Bloco do Motor */}
        <div className="controle-box">
           <h3>Controle de Carga</h3>
           <button 
              className={`btn-toggle ${motorLigado ? 'btn-desligar' : 'btn-ligar'}`}
              onClick={alternarMotor}
           >
              {motorLigado ? 'DESLIGAR MOTOR' : 'LIGAR MOTOR'}
           </button>
        </div>

        {/* Bloco da Gravação */}
        <div className="controle-box">
           <h3>Registro de Dados</h3>
           {gravando && <span className="rec-blink">● GRAVANDO...</span>}
           <button 
              className={`btn-toggle ${gravando ? 'btn-exportar' : 'btn-iniciar-rec'}`}
              onClick={gerenciarGravacao}
           >
              {gravando ? 'PARAR E BAIXAR JSON' : 'INICIAR SESSÃO'}
           </button>
        </div>
      </div>
      
      <div className="grid">
        <div className="card">
          <h3>Velocidade (km/h)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <YAxis domain={[0, 150]} stroke="#aaa" />
              <Tooltip contentStyle={{backgroundColor: '#333', border: 'none'}} />
              <Line type="monotone" dataKey="velocidade" stroke="#00ff88" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        
        <div className="card">
            <h3>Tensão (V)</h3>
            <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <YAxis domain={[0, 30]} stroke="#aaa" />
                <Tooltip contentStyle={{backgroundColor: '#333', border: 'none'}} />
                <Line type="monotone" dataKey="tensao" stroke="#e94560" strokeWidth={3} dot={false} />
            </LineChart>
            </ResponsiveContainer>
        </div>

        <div className="card">
            <h3>Corrente (A)</h3>
            <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <YAxis domain={[0, 15]} stroke="#aaa" />
                <Tooltip contentStyle={{backgroundColor: '#333', border: 'none'}} />
                <Line type="monotone" dataKey="corrente" stroke="#fce38a" strokeWidth={3} dot={false} />
            </LineChart>
            </ResponsiveContainer>
        </div>

        <div className="card">
            <h3>Temperatura (°C)</h3>
            <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <YAxis domain={[0, 100]} stroke="#aaa" />
                <Tooltip contentStyle={{backgroundColor: '#333', border: 'none'}} />
                <Line type="monotone" dataKey="temperatura" stroke="#00d4ff" strokeWidth={3} dot={false} />
            </LineChart>
            </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export default App;