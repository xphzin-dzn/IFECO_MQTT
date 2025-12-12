require('dotenv').config();
const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const mqtt = require('mqtt');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const authMiddleware = require('./middleware/auth');

const app = express();
app.use(cors());
app.use(express.json());

// --- 1. CONEXÃO SEQUELIZE ---
const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS, {
    host: process.env.DB_HOST,
    dialect: 'mysql',
    logging: false
});

// --- IMPORTAR MODELOS ---
const User = require('./models/User')(sequelize);
const Session = require('./models/Session')(sequelize); 

// [NOVO] RELACIONAMENTO: Uma Sessão pertence a um Usuário
User.hasMany(Session);
Session.belongsTo(User);

// Definindo modelo de Leituras
const Leitura = sequelize.define('Leitura', {
    velocidade: DataTypes.FLOAT,
    tensao: DataTypes.FLOAT,
    corrente: DataTypes.FLOAT,
    temperatura: DataTypes.FLOAT,
    data_hora: { type: DataTypes.DATE, defaultValue: Sequelize.NOW }
}, { timestamps: false, tableName: 'leituras' });

// Sincroniza o banco (Use alter: true para tentar atualizar a tabela sem apagar dados)
sequelize.sync({ alter: true }).then(() => console.log('Banco de Dados Sincronizado!'));

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

// --- 3. ROTAS DE AUTENTICAÇÃO ---

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

// [NOVO] Rota para Alterar Senha
app.post('/auth/change-password', authMiddleware, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.userId; 

    try {
        const user = await User.findByPk(userId);
        if (!user) return res.status(404).json({ error: "Usuário não encontrado" });

        const isValid = await bcrypt.compare(currentPassword, user.password);
        if (!isValid) {
            return res.status(401).json({ error: "A senha atual está incorreta." });
        }

        const hashNewPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashNewPassword;
        await user.save();

        res.json({ message: "Senha alterada com sucesso!" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erro ao atualizar senha." });
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
    res.json({ status: 'Comando enviado' });
});

// --- 5. ROTAS DE HISTÓRICO (CORRIGIDAS PARA FILTRAR POR USUÁRIO) ---

// A. Salvar uma nova sessão (VINCULANDO AO USUÁRIO)
app.post('/api/sessions', authMiddleware, async (req, res) => {
    const { nome, inicio, fim } = req.body;
    const userId = req.userId; // [NOVO] Pegamos o ID do usuário logado pelo token

    try {
        const nomeFinal = nome || `Sessão de ${new Date(inicio).toLocaleString('pt-BR')}`;
        
        const sessao = await Session.create({ 
            nome: nomeFinal,
            data_inicio: inicio, 
            data_fim: fim,
            UserId: userId // [NOVO] Salvamos quem é o dono da sessão
        });
        res.json(sessao);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erro ao salvar sessão" });
    }
});

// B. Listar APENAS as sessões do usuário logado
app.get('/api/sessions', authMiddleware, async (req, res) => {
    const userId = req.userId; // [NOVO] ID do usuário

    try {
        const sessoes = await Session.findAll({ 
            where: { UserId: userId }, // [NOVO] Filtro mágico: Só traz se for desse usuário
            order: [['data_inicio', 'DESC']] 
        });
        res.json(sessoes);
    } catch (err) {
        res.status(500).json({ error: "Erro ao listar sessões" });
    }
});

// C. Pegar os dados de UMA sessão específica (Validando se pertence ao usuário)
app.get('/api/sessions/:id/dados', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const userId = req.userId;
    const { Op } = require('sequelize');
    
    try {
        // 1. Busca a sessão e verifica se pertence ao usuário
        const sessao = await Session.findOne({ 
            where: { 
                id: id,
                UserId: userId // [NOVO] Garante que não posso ver sessão dos outros
            } 
        });

        if (!sessao) return res.status(404).json({ error: "Sessão não encontrada ou acesso negado" });

        // 2. Busca os dados (Leituras são gerais, filtradas pelo tempo da sessão)
        const dados = await Leitura.findAll({
            where: {
                data_hora: {
                    [Op.between]: [sessao.data_inicio, sessao.data_fim]
                }
            },
            order: [['data_hora', 'ASC']]
        });
        
        res.json(dados);
    } catch (err) {
        res.status(500).json({ error: "Erro ao buscar dados da sessão" });
    }
});

app.listen(3001, () => console.log('Servidor Seguro rodando na porta 3001'));