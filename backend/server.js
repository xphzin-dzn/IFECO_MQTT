require('dotenv').config();
const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const mqtt = require('mqtt');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const authMiddleware = require('./middleware/auth'); // Certifique-se que esse arquivo existe

const app = express();
app.use(cors());
app.use(express.json());

// --- CONFIGURAÇÕES DE REDE ---
// Se mudar o IP do broker, altere aqui
const MQTT_BROKER = 'mqtt://192.168.0.21'; 

// --- VARIAVEIS DE CONTROLE (SISTEMA HÍBRIDO RAM/DB) ---
let isRecording = false;      // Se true, salva no banco
let currentSessionId = null;  // ID da sessão sendo gravada agora
let liveBuffer = [];          // Buffer circular (RAM) para o gráfico ao vivo

// --- CONFIGURAÇÃO DE UPLOAD ---
app.use('/uploads', express.static('uploads'));

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = './uploads';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir);
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// --- 1. BANCO DE DADOS (SEQUELIZE) ---
const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS, {
    host: process.env.DB_HOST,
    dialect: 'mysql',
    logging: false // Deixe false para não poluir o terminal
});

// MODELOS
const User = sequelize.define('User', {
    name: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    password: { type: DataTypes.STRING, allowNull: false },
    avatar: { type: DataTypes.STRING, allowNull: true }
});

const Session = sequelize.define('Session', {
    nome: { type: DataTypes.STRING, allowNull: false },
    data_inicio: { type: DataTypes.DATE, allowNull: false },
    data_fim: { type: DataTypes.DATE, allowNull: true }
});

const Leitura = sequelize.define('Leitura', {
    velocidade: DataTypes.FLOAT,
    tensao: DataTypes.FLOAT,
    corrente: DataTypes.FLOAT,
    temperatura: DataTypes.FLOAT,
    data_hora: { type: DataTypes.DATE, defaultValue: Sequelize.NOW },
    SessionId: { type: DataTypes.INTEGER, allowNull: true }
}, { timestamps: false, tableName: 'leituras' });

// RELACIONAMENTOS
User.hasMany(Session);
Session.belongsTo(User);
Session.hasMany(Leitura);
Leitura.belongsTo(Session);

// SINCRONIA
sequelize.sync({ alter: true }).then(() => console.log('>>> Banco de Dados Sincronizado!'));

// --- 2. MQTT (LÓGICA HÍBRIDA) ---
const mqttClient = mqtt.connect(MQTT_BROKER);
const TOPICO_TELEMETRIA = 'esp32/painel/telemetria';
const TOPICO_COMANDO = 'esp32/painel/comando';

mqttClient.on('connect', () => {
    console.log(`>>> Conectado ao MQTT: ${MQTT_BROKER}`);
    mqttClient.subscribe(TOPICO_TELEMETRIA);
});

mqttClient.on('message', async (topic, message) => {
    if (topic === TOPICO_TELEMETRIA) {
        try {
            const rawData = JSON.parse(message.toString());
            
            // Cria o objeto de dados completo
            const dadosCompletos = { 
                ...rawData, 
                data_hora: new Date(),
                SessionId: currentSessionId // Pode ser null se não estiver gravando
            };

            // ---------------------------------------------------------
            // 1. VIA RÁPIDA (RAM) - Para o Dashboard "Ao Vivo"
            // SEMPRE executa, independente de estar gravando ou não
            // ---------------------------------------------------------
            liveBuffer.push(dadosCompletos);
            if (liveBuffer.length > 50) liveBuffer.shift(); // Mantém apenas os últimos 50

            // ---------------------------------------------------------
            // 2. VIA LENTA (DISCO/DB) - Apenas se estiver gravando
            // Só executa se o botão de gravar tiver sido apertado
            // ---------------------------------------------------------
            if (isRecording && currentSessionId) {
                // fire-and-forget (não usamos await aqui para não travar o loop do MQTT)
                Leitura.create(dadosCompletos).catch(err => console.error("Erro ao salvar ponto:", err));
            }

        } catch (e) { console.error('Erro ao processar mensagem MQTT:', e); }
    }
});

// --- 3. ROTAS DE AUTENTICAÇÃO ---
app.post('/auth/register', async (req, res) => {
    const { name, email, password } = req.body;
    try {
        const hashPassword = await bcrypt.hash(password, 10);
        const user = await User.create({ name, email, password: hashPassword });
        res.json({ message: "Usuário criado!", id: user.id });
    } catch (err) { res.status(400).json({ error: "Erro ao criar usuário." }); }
});

app.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ where: { email } });
        if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) return res.status(401).json({ error: "Senha incorreta" });
        const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '1d' });
        res.json({ token, email: user.email, name: user.name, avatar: user.avatar });
    } catch (err) { res.status(500).json({ error: "Erro no login" }); }
});

app.post('/auth/upload-avatar', authMiddleware, upload.single('avatar'), async (req, res) => {
    try {
        const user = await User.findByPk(req.userId);
        if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
        const avatarPath = `/uploads/${req.file.filename}`;
        user.avatar = avatarPath;
        await user.save();
        res.json({ message: "Foto atualizada!", avatar: avatarPath });
    } catch (err) { res.status(500).json({ error: "Erro no upload." }); }
});

// --- 4. ROTAS DE TELEMETRIA E CONTROLE ---

// ROTA AO VIVO (Super Rápida - Lê da RAM)
app.get('/api/telemetria', authMiddleware, (req, res) => {
    // Retorna o buffer para o gráfico (atualização 200ms)
    res.json(liveBuffer); 
});

// COMANDO MQTT (Ligar/Desligar Motor)
app.post('/api/comando', authMiddleware, (req, res) => {
    const { acao } = req.body;
    mqttClient.publish(TOPICO_COMANDO, acao);
    res.json({ status: 'Comando enviado', comando: acao });
});

// --- 5. ROTAS DE SESSÃO (GRAVAÇÃO) ---

// INICIAR GRAVAÇÃO
app.post('/api/sessions/start', authMiddleware, async (req, res) => {
    const { nome } = req.body;
    const userId = req.userId;

    if (isRecording) {
        return res.status(400).json({ error: "Já existe uma gravação em andamento." });
    }

    try {
        const novaSessao = await Session.create({
            nome: nome || `Treino ${new Date().toLocaleTimeString()}`,
            data_inicio: new Date(),
            UserId: userId
        });

        currentSessionId = novaSessao.id;
        isRecording = true; // LIGA A CHAVE DE GRAVAÇÃO

        console.log(`>>> REC: Iniciado Sessão #${currentSessionId}`);
        res.json({ success: true, sessionId: currentSessionId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erro ao criar sessão." });
    }
});

// PARAR GRAVAÇÃO
app.post('/api/sessions/stop', authMiddleware, async (req, res) => {
    if (!isRecording || !currentSessionId) {
        return res.status(400).json({ error: "Nenhuma gravação ativa." });
    }

    try {
        const fim = new Date();
        // Atualiza a data fim no banco
        await Session.update({ data_fim: fim }, { where: { id: currentSessionId } });
        
        console.log(`>>> REC: Finalizado Sessão #${currentSessionId}`);

        // DESLIGA A CHAVE DE GRAVAÇÃO
        isRecording = false;
        currentSessionId = null;

        res.json({ success: true, message: "Sessão salva com sucesso." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erro ao finalizar sessão." });
    }
});

// LISTAR HISTÓRICO
app.get('/api/sessions', authMiddleware, async (req, res) => {
    try {
        const sessoes = await Session.findAll({ 
            where: { UserId: req.userId }, 
            order: [['data_inicio', 'DESC']] 
        });
        res.json(sessoes);
    } catch (err) { res.status(500).json({ error: "Erro ao buscar histórico." }); }
});

// DADOS DE UMA SESSÃO ANTIGA (Para gráfico de histórico)
app.get('/api/sessions/:id/dados', authMiddleware, async (req, res) => {
    const { id } = req.params;
    try {
        const sessao = await Session.findOne({ where: { id, UserId: req.userId } });
        if (!sessao) return res.status(404).json({ error: "Sessão não encontrada." });

        const dados = await Leitura.findAll({
            where: { SessionId: id },
            order: [['data_hora', 'ASC']]
        });
        res.json(dados);
    } catch (err) { res.status(500).json({ error: "Erro ao buscar dados." }); }
});

// --- INICIALIZAÇÃO ---
const PORT = 3001;
app.listen(PORT, () => console.log(`>>> Servidor Otimizado rodando em http://localhost:${PORT}`));