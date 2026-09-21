const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// Database setup
const dbPath = path.join(__dirname, 'chat.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to SQLite database.');
    initDb();
  }
});

function initDb() {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pin TEXT UNIQUE,
    name TEXT,
    avatar TEXT,
    status TEXT DEFAULT 'Available',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_pin TEXT,
    contact_pin TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_pin, contact_pin)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_pin TEXT,
    receiver_pin TEXT,
    message TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_read INTEGER DEFAULT 0
  )`);
}

// Generate random BBM-style PIN (e.g., PIN8F23A)
function generatePin() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let pin = 'PIN';
  for (let i = 0; i < 5; i++) {
    pin += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pin;
}

// Active online users map: pin -> socketId
const onlineUsers = new Map();

// API Routes
app.post('/api/register', (req, res) => {
  const { name, pin: existingPin } = req.body;

  if (existingPin) {
    // Login with existing PIN
    db.get(`SELECT * FROM users WHERE pin = ?`, [existingPin], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: 'PIN tidak ditemukan!' });
      res.json(row);
    });
  } else {
    // Register new user
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Nama harus diisi!' });
    }
    
    let pin = generatePin();
    // Ensure unique PIN
    const tryInsert = () => {
      const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`;
      db.run(`INSERT INTO users (pin, name, avatar) VALUES (?, ?, ?)`, [pin, name.trim(), avatar], function(err) {
        if (err) {
          // If PIN collision, retry
          pin = generatePin();
          tryInsert();
        } else {
          db.get(`SELECT * FROM users WHERE id = ?`, [this.lastID], (err, row) => {
            res.json(row);
          });
        }
      });
    };
    tryInsert();
  }
});

app.get('/api/user/:pin', (req, res) => {
  const { pin } = req.params;
  db.get(`SELECT * FROM users WHERE pin = ?`, [pin], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'User not found' });
    res.json(row);
  });
});

// Get contacts for a user with online status and last message
app.get('/api/contacts/:pin', (req, res) => {
  const { pin } = req.params;
  const query = `
    c.contact_pin, u.name, u.avatar, u.status
    FROM contacts c
    JOIN users u ON c.contact_pin = u.pin
    WHERE c.user_pin = ?
  `;
  db.all(`SELECT ${query}`, [pin], (err, contacts) => {
    if (err) return res.status(500).json({ error: err.message });

    // Add online status
    const result = contacts.map(c => ({
      ...c,
      online: onlineUsers.has(c.contact_pin)
    }));
    res.json(result);
  });
});

// Add contact by PIN
app.post('/api/contacts/add', (req, res) => {
  const { user_pin, contact_pin } = req.body;
  if (!user_pin || !contact_pin) {
    return res.status(400).json({ error: 'PIN tidak boleh kosong' });
  }

  const cleanContactPin = contact_pin.trim().toUpperCase();
  if (user_pin === cleanContactPin) {
    return res.status(400).json({ error: 'Tidak dapat menambahkan PIN sendiri' });
  }

  // Check if contact exists in users table
  db.get(`SELECT * FROM users WHERE pin = ?`, [cleanContactPin], (err, targetUser) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!targetUser) return res.status(404).json({ error: 'PIN kontak tidak ditemukan!' });

    // Insert contact
    db.run(`INSERT OR IGNORE INTO contacts (user_pin, contact_pin) VALUES (?, ?)`, [user_pin, cleanContactPin], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, contact: { ...targetUser, online: onlineUsers.has(cleanContactPin) } });
    });
  });
});

// Get messages between two users
app.get('/api/messages/:pin1/:pin2', (req, res) => {
  const { pin1, pin2 } = req.params;
  db.all(`
    SELECT * FROM messages 
    WHERE (sender_pin = ? AND receiver_pin = ?) 
       OR (sender_pin = ? AND receiver_pin = ?)
    ORDER BY timestamp ASC
  `, [pin1, pin2, pin2, pin1], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('join', (pin) => {
    if (pin) {
      onlineUsers.set(pin, socket.id);
      socket.pin = pin;
      console.log(`User with PIN ${pin} online`);
      io.emit('presence_update', { pin, online: true });
    }
  });

  socket.on('private_message', (data) => {
    const { sender_pin, receiver_pin, message } = data;
    
    // Save to DB
    db.run(
      `INSERT INTO messages (sender_pin, receiver_pin, message) VALUES (?, ?, ?)`,
      [sender_pin, receiver_pin, message],
      function(err) {
        if (!err) {
          const msgObj = {
            id: this.lastID,
            sender_pin,
            receiver_pin,
            message,
            timestamp: new Date().toISOString(),
            is_read: 0
          };

          // Send to receiver if online
          const receiverSocketId = onlineUsers.get(receiver_pin);
          if (receiverSocketId) {
            io.to(receiverSocketId).emit('private_message', msgObj);
          }
          // Send back to sender (for multiple tabs/devices or confirmation)
          socket.emit('message_sent', msgObj);
        }
      }
    );
  });

  socket.on('typing', ({ sender_pin, receiver_pin, isTyping }) => {
    const receiverSocketId = onlineUsers.get(receiver_pin);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('typing', { sender_pin, isTyping });
    }
  });

  socket.on('disconnect', () => {
    if (socket.pin) {
      onlineUsers.delete(socket.pin);
      console.log(`User with PIN ${socket.pin} offline`);
      io.emit('presence_update', { pin: socket.pin, online: false });
    }
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Chat server running on port ${PORT}`);
});
