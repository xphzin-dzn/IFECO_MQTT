const express = require('express');
const mysql = require('mysql2');
const mqtt = require('mqtt');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());


const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'iot_projeto'
});

db.connect(err => {
    if (err) {
        console.error('Erro ao conectar ao MySQL:', err);
        return;
    }
    console.log('MySQL Conectado!');
});

// --- 2. CONFIGURAÇÃO DO MQTT ---
const mqttClient = mqtt.connect('mqtt://test.mosquitto.org');
const TOPICO_TELEMETRIA = 'esp32/painel/telemetria';
const TOPICO_COMANDO = 'esp32/painel/comando';

mqttClient.on('connect', () => {
    console.log('Conectado ao Broker MQTT');
    mqttClient.subscribe(TOPICO_TELEMETRIA);
});

mqttClient.on('message', (topic, message) => {
    if (topic === TOPICO_TELEMETRIA) {
        try {
            const dados = JSON.parse(message.toString());
            
            // Salva no banco
            const sql = "INSERT INTO leituras (velocidade, tensao, corrente, temperatura) VALUES (?, ?, ?, ?)";
            const valores = [dados.velocidade, dados.tensao, dados.corrente, dados.temperatura];

            db.query(sql, valores, (err) => {
                if (err) console.error('Erro no INSERT:', err);
            });
        } catch (e) {
            console.error('Erro ao processar JSON:', e);
        }
    }
});

// --- 3. ROTAS DA API (O que o Celular acessa) ---

// ROTA 1: Dados para os gráficos (Últimos 20 registros)
app.get('/api/telemetria', (req, res) => {
    const sql = "SELECT * FROM (SELECT * FROM leituras ORDER BY id DESC LIMIT 20) sub ORDER BY id ASC";
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

// ROTA 2: Enviar comando para o ESP32 (Ligar/Desligar)
app.post('/api/comando', (req, res) => {
    const { acao } = req.body; // Recebe "LIGAR" ou "DESLIGAR"
    
    if (acao === 'LIGAR' || acao === 'DESLIGAR') {
        console.log(`Enviando comando: ${acao}`);
        mqttClient.publish(TOPICO_COMANDO, acao);
        res.json({ status: 'Comando enviado', acao });
    } else {
        res.status(400).json({ error: 'Comando inválido' });
    }
});

// ROTA 3: Exportar dados de uma Sessão (Filtro por Data/Hora)
app.get('/api/exportar', (req, res) => {
    const { inicio, fim } = req.query; // Recebe data de inicio e fim do Frontend
    
    if (!inicio || !fim) {
        return res.status(400).json({ error: 'Precisa enviar inicio e fim' });
    }

    console.log(`Exportando sessão: de ${inicio} até ${fim}`);

    // Busca no banco tudo que aconteceu entre o clique de Iniciar e Parar
    const sql = "SELECT * FROM leituras WHERE data_hora >= ? AND data_hora <= ?";
    
    db.query(sql, [inicio, fim], (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

// Inicia o servidor na porta 3001
app.listen(3001, () => {
    console.log('Servidor Backend rodando na porta 3001');
});