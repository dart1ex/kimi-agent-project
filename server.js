/**
 * КОНТРОЛЬ - Backend Server
 * Express API only (Telegram Bot runs separately via bot.py)
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Admin ID for notifications
const ADMIN_ID = process.env.ADMIN_ID || '123456789';

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Data storage (in production use database)
const DATA_FILE = path.join(__dirname, 'data.json');

// Load or initialize data
function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('Error loading data:', e);
    }
    return {
        reports: [],
        suggestions: [],
        users: [],
        admins: [{ login: 'admin', password: 'admin', name: 'Администратор' }],
        sessions: {}
    };
}

function saveData(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Error saving data:', e);
    }
}

let data = loadData();

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${uuidv4()}-${file.originalname}`;
        cb(null, uniqueName);
    }
});

const upload = multer({ 
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only images allowed.'));
        }
    }
});

// ==================== API ROUTES ====================

// Auth middleware
function authMiddleware(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token || !data.sessions[token]) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    req.admin = data.sessions[token];
    next();
}

// Admin login
app.post('/api/admin/login', (req, res) => {
    const { login, password } = req.body;
    
    const admin = data.admins.find(a => a.login === login && a.password === password);
    
    if (!admin) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = uuidv4();
    data.sessions[token] = { 
        login: admin.login, 
        name: admin.name,
        loginAt: new Date().toISOString()
    };
    saveData(data);
    
    res.json({ 
        token, 
        admin: { login: admin.login, name: admin.name } 
    });
});

// Admin logout
app.post('/api/admin/logout', authMiddleware, (req, res) => {
    const token = req.headers.authorization.replace('Bearer ', '');
    delete data.sessions[token];
    saveData(data);
    res.json({ success: true });
});

// Get all reports (admin)
app.get('/api/admin/reports', authMiddleware, (req, res) => {
    const { status, page = 1, limit = 20 } = req.query;
    
    let reports = data.reports;
    
    if (status && status !== 'all') {
        reports = reports.filter(r => r.status === status);
    }
    
    // Sort by date (newest first)
    reports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    const start = (page - 1) * limit;
    const end = start + parseInt(limit);
    
    res.json({
        reports: reports.slice(start, end),
        total: reports.length,
        page: parseInt(page),
        totalPages: Math.ceil(reports.length / limit)
    });
});

// Get suggestions/inbox (admin)
app.get('/api/admin/suggestions', authMiddleware, (req, res) => {
    const { filter = 'all' } = req.query;
    
    let suggestions = data.suggestions;
    
    if (filter === 'unread') {
        suggestions = suggestions.filter(s => !s.read);
    } else if (filter === 'telegram') {
        suggestions = suggestions.filter(s => s.source === 'telegram');
    } else if (filter === 'website') {
        suggestions = suggestions.filter(s => s.source === 'website');
    }
    
    // Sort by date (newest first)
    suggestions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json({ suggestions });
});

// Mark suggestion as read
app.patch('/api/admin/suggestions/:id', authMiddleware, (req, res) => {
    const { id } = req.params;
    const { read } = req.body;
    
    const suggestion = data.suggestions.find(s => s.id === id);
    
    if (!suggestion) {
        return res.status(404).json({ error: 'Suggestion not found' });
    }
    
    suggestion.read = read;
    saveData(data);
    
    res.json(suggestion);
});

// Create report from suggestion
app.post('/api/admin/suggestions/:id/convert', authMiddleware, (req, res) => {
    const { id } = req.params;
    
    const suggestion = data.suggestions.find(s => s.id === id);
    
    if (!suggestion) {
        return res.status(404).json({ error: 'Suggestion not found' });
    }
    
    // Mark as read
    suggestion.read = true;
    
    // Create report from suggestion
    const report = {
        id: uuidv4(),
        telegramId: suggestion.telegramId,
        telegramUsername: suggestion.telegramUsername,
        authorName: suggestion.authorName,
        title: suggestion.title || 'Заявка из предложки',
        description: suggestion.description,
        address: suggestion.address,
        imageUrl: suggestion.imageUrl,
        status: 'pending',
        type: 'warning',
        createdAt: new Date().toISOString(),
        lat: null,
        lng: null,
        source: suggestion.source
    };
    
    data.reports.push(report);
    saveData(data);
    
    res.json({ success: true, report });
});

// Update report status (admin)
app.patch('/api/admin/reports/:id', authMiddleware, (req, res) => {
    const { id } = req.params;
    const { status, lat, lng, type } = req.body;
    
    const report = data.reports.find(r => r.id === id);
    
    if (!report) {
        return res.status(404).json({ error: 'Report not found' });
    }
    
    if (status) report.status = status;
    if (lat !== undefined) report.lat = lat;
    if (lng !== undefined) report.lng = lng;
    if (type) report.type = type;
    
    saveData(data);
    
    res.json(report);
});

// Delete report (admin)
app.delete('/api/admin/reports/:id', authMiddleware, (req, res) => {
    const { id } = req.params;
    
    const index = data.reports.findIndex(r => r.id === id);
    
    if (index === -1) {
        return res.status(404).json({ error: 'Report not found' });
    }
    
    // Delete associated image
    const report = data.reports[index];
    if (report.imageUrl) {
        const imagePath = path.join(__dirname, report.imageUrl);
        if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
        }
    }
    
    data.reports.splice(index, 1);
    saveData(data);
    
    res.json({ success: true });
});

// Get statistics (admin)
app.get('/api/admin/stats', authMiddleware, (req, res) => {
    const stats = {
        total: data.reports.length,
        pending: data.reports.filter(r => r.status === 'pending').length,
        approved: data.reports.filter(r => r.status === 'approved').length,
        rejected: data.reports.filter(r => r.status === 'rejected').length,
        inProgress: data.reports.filter(r => r.status === 'in_progress').length,
        suggestions: data.suggestions.length,
        unreadSuggestions: data.suggestions.filter(s => !s.read).length,
        byType: {
            accident: data.reports.filter(r => r.type === 'accident').length,
            warning: data.reports.filter(r => r.type === 'warning').length,
            repair: data.reports.filter(r => r.type === 'repair').length
        }
    };
    
    res.json(stats);
});

// Public API - Get approved reports
app.get('/api/reports', (req, res) => {
    const { city, type, limit = 50 } = req.query;
    
    let reports = data.reports.filter(r => r.status === 'approved');
    
    if (type && type !== 'all') {
        reports = reports.filter(r => r.type === type);
    }
    
    reports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json(reports.slice(0, parseInt(limit)));
});

// Public API - Get single report
app.get('/api/reports/:id', (req, res) => {
    const report = data.reports.find(r => r.id === req.params.id);
    
    if (!report) {
        return res.status(404).json({ error: 'Report not found' });
    }
    
    res.json(report);
});

// Create report from website
app.post('/api/reports', upload.single('image'), (req, res) => {
    const { title, description, address, type, lat, lng, authorName } = req.body;
    
    const report = {
        id: uuidv4(),
        telegramId: null,
        telegramUsername: null,
        authorName: authorName || 'Горожанин',
        title: title || 'Без названия',
        description: description || '',
        address: address || '',
        imageUrl: req.file ? `/uploads/${req.file.filename}` : null,
        status: 'pending',
        type: type || 'warning',
        createdAt: new Date().toISOString(),
        lat: lat ? parseFloat(lat) : null,
        lng: lng ? parseFloat(lng) : null,
        source: 'website'
    };
    
    data.reports.push(report);
    
    // Also add to suggestions
    const suggestion = {
        id: uuidv4(),
        source: 'website',
        telegramId: null,
        telegramUsername: null,
        authorName: authorName || 'Горожанин',
        title: title || 'Без названия',
        description: description || '',
        address: address || '',
        imageUrl: req.file ? `/uploads/${req.file.filename}` : null,
        createdAt: new Date().toISOString(),
        read: false
    };
    
    data.suggestions.push(suggestion);
    saveData(data);
    
    res.json({ success: true, report });
});

// Get bot info
app.get('/api/bot-info', (req, res) => {
    res.json({
        username: 'kontrol_city_bot',
        link: 'https://t.me/kontrol_city_bot'
    });
});

// Get streets for city
app.get('/api/streets', (req, res) => {
    const { city = 'moscow' } = req.query;
    
    const streetsByCity = {
        moscow: ['Ленина', 'Гагарина', 'Мира', 'Победы', 'Советская', 'Кирова', 'Московская', 'Красная', 'Парковая', 'Тверская', 'Арбат', 'Охотный Ряд'],
        spb: ['Невский проспект', 'Литейный проспект', 'Владимирский проспект', 'Московский проспект', 'Лиговский проспект', 'Садовая улица', 'Васильевский остров'],
        kazan: ['Кремлёвская', 'Баумана', 'Пушкина', 'Горького', 'Декабристов', 'Эсперанто', 'Тукая'],
        novosibirsk: ['Красный проспект', 'Советская', 'Гоголя', 'Кирова', 'Державина', 'Выборная', 'Площадь Ленина'],
        yekaterinburg: ['Проспект Ленина', 'Улица Малышева', 'Улица Вайнера', 'Улица 8 Марта', 'Улица Куйбышева'],
        nizhny: ['Большая Покровская', 'Улица Минина', 'Варварская', 'Рождественская', 'Ильинская', 'Верхне-Волжская']
    };
    
    res.json({ streets: streetsByCity[city] || streetsByCity.moscow });
});

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: err.message || 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📁 Data file: ${DATA_FILE}`);
});

module.exports = app;
