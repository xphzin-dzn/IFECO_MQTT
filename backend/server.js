require('dotenv').config(); // Carrega as variaveis do .env
const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const mqtt = require('mqtt');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const authMiddleware = require('./middleware/auth'); // Nosso porteiro

const app = express();
app.use(cors());
app.use(express.json());

// --- 1. CONEXÃO SEQUELIZE ---
const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS, {
    host: process.env.DB_HOST,
    dialect: 'mysql',
    logging: false // Desliga logs chatos no terminal
});

// --- IMPORTAR MODELOS ---
const User = require('./models/User')(sequelize);
// IMPORTANTE: Importamos o modelo de Sessão que criamos
const Session = require('./models/Session')(sequelize); 

// Definindo modelo de Leituras via Sequelize
const Leitura = sequelize.define('Leitura', {
    velocidade: DataTypes.FLOAT,
    tensao: DataTypes.FLOAT,
    corrente: DataTypes.FLOAT,
    temperatura: DataTypes.FLOAT,
    data_hora: { type: DataTypes.DATE, defaultValue: Sequelize.NOW }
}, { timestamps: false, tableName: 'leituras' });

// Sincroniza o banco (Cria as tabelas Users, Sessions e Leituras se não existirem)
sequelize.sync().then(() => console.log('Banco de Dados Sincronizado!'));

// --- 2. MQTT ---
const mqttClient = mqtt.connect('mqtt://test.mosquitto.org');
const TOPICO_TELEMETRIA = 'esp32/painel/telemetria';
const TOPICO_COMANDO = 'esp32/painel/comando';

mqttClient.on('connect', () => mqttClient.subscribe(TOPICO_TELEMETRIA));

mqttClient.on('message', async (topic, message) => {
    if (topic === TOPICO_TELEMETRIA) {
        try {
            const dados = JSON.parse(message.toString());
            await Leitura.create(dados);
        } catch (e) {
            console.error('Erro MQTT:', e);
        }
    }
});

// --- 3. ROTAS DE AUTENTICAÇÃO (Públicas) ---

app.post('/auth/register', async (req, res) => {
    const { email, password } = req.body;
    try {
        const hashPassword = await bcrypt.hash(password, 10);
        const user = await User.create({ email, password: hashPassword });
        res.json({ message: "Usuário criado!", id: user.id });
    } catch (err) {
        res.status(400).json({ error: "Erro ao criar usuário (Email já existe?)" });
    }
});

app.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ where: { email } });
        if (!user) return res.status(404).json({ error: "Usuário não encontrado" });

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) return res.status(401).json({ error: "Senha incorreta" });

        const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '1d' });
        
        res.json({ token, email: user.email });
    } catch (err) {
        res.status(500).json({ error: "Erro no login" });
    }
});

// --- 4. ROTAS PROTEGIDAS (DASHBOARD) ---

app.get('/api/telemetria', authMiddleware, async (req, res) => {
    const leituras = await Leitura.findAll({ 
        order: [['id', 'DESC']], 
        limit: 20 
    });
    res.json(leituras.reverse());
});

app.post('/api/comando', authMiddleware, (req, res) => {
    const { acao } = req.body;
    mqttClient.publish(TOPICO_COMANDO, acao);
    res.json({ status: 'Comando enviado por usuário autenticado' });
});

// Rota antiga de exportação (ainda útil se quiser baixar JSON direto sem salvar sessão)
app.get('/api/exportar', authMiddleware, async (req, res) => {
    const { inicio, fim } = req.query;
    const { Op } = require('sequelize'); 
    
    const dados = await Leitura.findAll({
        where: {
            data_hora: { [Op.between]: [inicio, fim] }
        }
    });
    res.json(dados);
});

// --- 5. ROTAS DE HISTÓRICO (NOVAS) ---

// A. Salvar uma nova sessão no banco
app.post('/api/sessions', authMiddleware, async (req, res) => {
    const { nome, inicio, fim } = req.body;
    try {
        // Se o usuário não digitar nome, cria um automático
        const nomeFinal = nome || `Sessão de ${new Date(inicio).toLocaleString('pt-BR')}`;
        
        const sessao = await Session.create({ 
            nome: nomeFinal,
            data_inicio: inicio, 
            data_fim: fim 
        });
        res.json(sessao);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erro ao salvar sessão" });
    }
});

// B. Listar todas as sessões para a barra lateral
app.get('/api/sessions', authMiddleware, async (req, res) => {
    try {
        const sessoes = await Session.findAll({ order: [['data_inicio', 'DESC']] });
        res.json(sessoes);
    } catch (err) {
        res.status(500).json({ error: "Erro ao listar sessões" });
    }
});

// C. Pegar os dados de sensores de UMA sessão específica (para o gráfico)
app.get('/api/sessions/:id/dados', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { Op } = require('sequelize');
    
    try {
        // 1. Acha a sessão para saber a hora de inicio e fim
        const sessao = await Session.findByPk(id);
        if (!sessao) return res.status(404).json({ error: "Sessão não encontrada" });

        // 2. Busca na tabela de Leituras tudo que aconteceu nesse intervalo
        const dados = await Leitura.findAll({
            where: {
                data_hora: {
                    [Op.between]: [sessao.data_inicio, sessao.data_fim]
                }
            },
            order: [['data_hora', 'ASC']] // Ordem cronológica para o gráfico
        });
        
        res.json(dados);
    } catch (err) {
        res.status(500).json({ error: "Erro ao buscar dados da sessão" });
    }
});

app.listen(3001, () => console.log('Servidor Seguro rodando na porta 3001'));