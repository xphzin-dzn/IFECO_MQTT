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

// --- 1. CONEXÃO SEQUELIZE (Novo jeito robusto) ---
const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS, {
    host: process.env.DB_HOST,
    dialect: 'mysql',
    logging: false // Desliga logs chatos no terminal
});

// Importar Modelos
const User = require('./models/User')(sequelize);

// Definindo modelo de Leituras (antigo) via Sequelize agora
const Leitura = sequelize.define('Leitura', {
    velocidade: DataTypes.FLOAT,
    tensao: DataTypes.FLOAT,
    corrente: DataTypes.FLOAT,
    temperatura: DataTypes.FLOAT,
    data_hora: { type: DataTypes.DATE, defaultValue: Sequelize.NOW }
}, { timestamps: false, tableName: 'leituras' });

// Sincroniza o banco (Cria a tabela Users se não existir)
sequelize.sync().then(() => console.log('Banco de Dados Sincronizado!'));

// --- 2. MQTT (Mantivemos a lógica) ---
const mqttClient = mqtt.connect('mqtt://test.mosquitto.org');
const TOPICO_TELEMETRIA = 'esp32/painel/telemetria';
const TOPICO_COMANDO = 'esp32/painel/comando';

mqttClient.on('connect', () => mqttClient.subscribe(TOPICO_TELEMETRIA));

mqttClient.on('message', async (topic, message) => {
    if (topic === TOPICO_TELEMETRIA) {
        try {
            const dados = JSON.parse(message.toString());
            // Salva usando Sequelize (Mais limpo!)
            await Leitura.create(dados);
        } catch (e) {
            console.error('Erro MQTT:', e);
        }
    }
});

// --- 3. ROTAS DE AUTENTICAÇÃO (Públicas) ---

// Registro de Usuário
app.post('/auth/register', async (req, res) => {
    const { email, password } = req.body;
    try {
        // Criptografa a senha antes de salvar
        const hashPassword = await bcrypt.hash(password, 10);
        const user = await User.create({ email, password: hashPassword });
        res.json({ message: "Usuário criado!", id: user.id });
    } catch (err) {
        res.status(400).json({ error: "Erro ao criar usuário (Email já existe?)" });
    }
});

// Login
app.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ where: { email } });
        if (!user) return res.status(404).json({ error: "Usuário não encontrado" });

        // Compara a senha enviada com a criptografada no banco
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) return res.status(401).json({ error: "Senha incorreta" });

        // Gera o Token JWT
        const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '1d' });
        
        res.json({ token, email: user.email });
    } catch (err) {
        res.status(500).json({ error: "Erro no login" });
    }
});




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

app.get('/api/exportar', authMiddleware, async (req, res) => {
    const { inicio, fim } = req.query;
    const { Op } = require('sequelize'); 
    
    const dados = await Leitura.findAll({
        where: {
            data_hora: {
                [Op.between]: [inicio, fim]
            }
        }
    });
    res.json(dados);
});

app.listen(3001, () => console.log('Servidor Seguro rodando na porta 3001'));