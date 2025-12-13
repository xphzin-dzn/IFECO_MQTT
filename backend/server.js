require('dotenv').config();
const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const mqtt = require('mqtt');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer'); // [NOVO] Biblioteca de upload
const path = require('path');     // [NOVO] Para lidar com caminhos de pastas
const fs = require('fs');         // [NOVO] Para criar a pasta se não existir
const authMiddleware = require('./middleware/auth');

const app = express();
app.use(cors());
app.use(express.json());

// [NOVO] Servir a pasta 'uploads' estaticamente (para o celular ver a foto)
app.use('/uploads', express.static('uploads'));

// [NOVO] Configuração do Multer (Onde salvar as fotos)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = './uploads';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir); // Cria a pasta se não existir
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        // Gera um nome único: id_do_usuario + data + extensão original
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// --- 1. CONEXÃO SEQUELIZE ---
const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS, {
    host: process.env.DB_HOST,
    dialect: 'mysql',
    logging: false
});

// --- MODELOS ---
const User = sequelize.define('User', {
    name: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    password: { type: DataTypes.STRING, allowNull: false },
    avatar: { type: DataTypes.STRING, allowNull: true } // [NOVO] Campo para guardar o nome da foto
});

const Session = require('./models/Session')(sequelize); 
User.hasMany(Session);
Session.belongsTo(User);

const Leitura = sequelize.define('Leitura', {
    velocidade: DataTypes.FLOAT,
    tensao: DataTypes.FLOAT,
    corrente: DataTypes.FLOAT,
    temperatura: DataTypes.FLOAT,
    data_hora: { type: DataTypes.DATE, defaultValue: Sequelize.NOW }
}, { timestamps: false, tableName: 'leituras' });

// Sincroniza (alter: true cria a coluna avatar sozinha)
sequelize.sync({ alter: true }).then(() => console.log('Banco de Dados Sincronizado!'));

// --- 2. MQTT ---
const mqttClient = mqtt.connect('mqtt://192.168.0.15'); // SEU IP
const TOPICO_TELEMETRIA = 'esp32/painel/telemetria';
const TOPICO_COMANDO = 'esp32/painel/comando';

mqttClient.on('connect', () => mqttClient.subscribe(TOPICO_TELEMETRIA));
mqttClient.on('message', async (topic, message) => {
    if (topic === TOPICO_TELEMETRIA) {
        try {
            const dados = JSON.parse(message.toString());
            await Leitura.create(dados);
        } catch (e) { console.error('Erro MQTT:', e); }
    }
});

// --- 3. ROTAS DE AUTENTICAÇÃO ---

// [NOVO] Rota de Upload de Avatar
app.post('/auth/upload-avatar', authMiddleware, upload.single('avatar'), async (req, res) => {
    try {
        const user = await User.findByPk(req.userId);
        if (!user) return res.status(404).json({ error: "Usuário não encontrado" });

        // Salva o caminho no banco (Ex: /uploads/avatar-123123.jpg)
        const avatarPath = `/uploads/${req.file.filename}`;
        user.avatar = avatarPath;
        await user.save();

        res.json({ message: "Foto atualizada!", avatar: avatarPath });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erro ao salvar imagem." });
    }
});

app.post('/auth/register', async (req, res) => {
    const { name, email, password } = req.body;
    try {
        const hashPassword = await bcrypt.hash(password, 10);
        const user = await User.create({ name, email, password: hashPassword });
        res.json({ message: "Usuário criado!", id: user.id });
    } catch (err) {
        res.status(400).json({ error: "Erro ao criar usuário." });
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
        
        // [ALTERADO] Devolve também o avatar se existir
        res.json({ token, email: user.email, name: user.name, avatar: user.avatar });
    } catch (err) {
        res.status(500).json({ error: "Erro no login" });
    }
});

// [Outras rotas mantidas iguais...]
app.post('/auth/change-password', authMiddleware, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.userId; 
    try {
        const user = await User.findByPk(userId);
        if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
        const isValid = await bcrypt.compare(currentPassword, user.password);
        if (!isValid) return res.status(401).json({ error: "Senha incorreta" });
        const hashNewPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashNewPassword;
        await user.save();
        res.json({ message: "Senha alterada com sucesso!" });
    } catch (err) { res.status(500).json({ error: "Erro." }); }
});

app.get('/api/telemetria', authMiddleware, async (req, res) => {
    const leituras = await Leitura.findAll({ order: [['id', 'DESC']], limit: 20 });
    res.json(leituras.reverse());
});

app.post('/api/comando', authMiddleware, (req, res) => {
    const { acao } = req.body;
    mqttClient.publish(TOPICO_COMANDO, acao);
    res.json({ status: 'Comando enviado' });
});

app.post('/api/sessions', authMiddleware, async (req, res) => {
    const { nome, inicio, fim } = req.body;
    const userId = req.userId;
    try {
        const nomeFinal = nome || `Sessão de ${new Date(inicio).toLocaleString('pt-BR')}`;
        const sessao = await Session.create({ nome: nomeFinal, data_inicio: inicio, data_fim: fim, UserId: userId });
        res.json(sessao);
    } catch (err) { res.status(500).json({ error: "Erro ao salvar sessão" }); }
});

app.get('/api/sessions', authMiddleware, async (req, res) => {
    const userId = req.userId;
    try {
        const sessoes = await Session.findAll({ where: { UserId: userId }, order: [['data_inicio', 'DESC']] });
        res.json(sessoes);
    } catch (err) { res.status(500).json({ error: "Erro ao listar sessões" }); }
});

app.get('/api/sessions/:id/dados', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const userId = req.userId;
    const { Op } = require('sequelize');
    try {
        const sessao = await Session.findOne({ where: { id: id, UserId: userId } });
        if (!sessao) return res.status(404).json({ error: "Sessão não encontrada" });
        const dados = await Leitura.findAll({
            where: { data_hora: { [Op.between]: [sessao.data_inicio, sessao.data_fim] } },
            order: [['data_hora', 'ASC']]
        });
        res.json(dados);
    } catch (err) { res.status(500).json({ error: "Erro ao buscar dados da sessão" }); }
});

app.listen(3001, () => console.log('Servidor com Upload rodando na porta 3001'));