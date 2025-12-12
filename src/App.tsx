import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './App.css';

const API_URL = 'http://192.168.0.7:3001'; 

interface DadosSensor {
  id: number;
  velocidade: number;
  tensao: number;
  corrente: number;
  temperatura: number;
  data_hora?: string;
}

function App() {
  const [data, setData] = useState<DadosSensor[]>([]);
  const [motorLigado, setMotorLigado] = useState(false);
  
  // --- NOVOS ESTADOS PARA A SESSÃO ---
  const [gravando, setGravando] = useState(false);
  const [horaInicio, setHoraInicio] = useState<string | null>(null);

  // Busca dados a cada 1 segundo (Monitoramento)
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get<DadosSensor[]>(`${API_URL}/api/telemetria`);
        setData(response.data);
      } catch (error) {
        console.error("Erro ao buscar dados:", error);
      }
    };
    const interval = setInterval(fetchData, 1000);
    return () => clearInterval(interval);
  }, []);

  // Lógica do Motor (Ligar/Desligar Relé)
  const alternarMotor = async () => {
    const novaAcao = motorLigado ? 'DESLIGAR' : 'LIGAR';
    try {
      await axios.post(`${API_URL}/api/comando`, { acao: novaAcao });
      setMotorLigado(!motorLigado);
    } catch (error) {
      alert('Erro ao enviar comando!');
    }
  };

  // --- LÓGICA DE GRAVAÇÃO E EXPORTAÇÃO ---
  const gerenciarGravacao = async () => {
    if (!gravando) {
      // INICIAR GRAVAÇÃO
      const agora = new Date().toISOString(); // Pega hora atual formato ISO
      setHoraInicio(agora);
      setGravando(true);
    } else {
      // PARAR E EXPORTAR
      const horaFim = new Date().toISOString();
      setGravando(false);
      
      try {
        // 1. Pede os dados filtrados ao Backend
        const response = await axios.get(`${API_URL}/api/exportar`, {
          params: { inicio: horaInicio, fim: horaFim }
        });

        const dadosDaSessao = response.data;

        if (dadosDaSessao.length === 0) {
          alert("Nenhum dado capturado nesta sessão.");
          return;
        }

        // 2. Cria o arquivo JSON no navegador
        const jsonString = JSON.stringify(dadosDaSessao, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const href = URL.createObjectURL(blob);

        // 3. Simula um clique num link para baixar
        const link = document.createElement("a");
        link.href = href;
        link.download = `sessao_exportada_${new Date().getTime()}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

      } catch (error) {
        console.error("Erro ao exportar:", error);
        alert("Erro ao exportar dados.");
      }
    }
  };

  return (
    <div className="dashboard-container">
      <div className="header">
        <h1>Sistema Supervisório ESP32</h1>
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

        {/* Bloco da Gravação (NOVO) */}
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
        {/* Seus Gráficos continuam aqui iguais... */}
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
                <Line type="monotone" dataKey="tensao" stroke="#e94560" strokeWidth={3} dot={false} />
            </LineChart>
            </ResponsiveContainer>
        </div>
        
        {/* ... (outros gráficos) */}
      </div>
    </div>
  );
}

export default App;