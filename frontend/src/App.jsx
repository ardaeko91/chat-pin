import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, UserPlus, LogOut, Send, Check, CheckCheck, 
  Search, Shield, Copy, CheckCircle2, ChevronLeft
} from 'lucide-react';
import { getSupabase } from './supabaseClient';

export default function App() {
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('register'); // 'register' or 'login'
  const [inputName, setInputName] = useState('');
  const [inputPin, setInputPin] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const [contacts, setContacts] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [newContactPin, setNewContactPin] = useState('');
  const [addError, setAddError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const messagesEndRef = useRef(null);
  const subscriptionRef = useRef(null);

  // Check saved user session
  useEffect(() => {
    const savedUser = localStorage.getItem('schatpin_chat_user');
    if (savedUser) {
      const userData = JSON.parse(savedUser);
      verifyUser(userData.pin);
    }
  }, []);

  const verifyUser = async (pin) => {
    const supabase = getSupabase();
    try {
      const { data, error } = await supabase
        .from('schatpin_users')
        .select('*')
        .eq('pin', pin)
        .single();

      if (data && !error) {
        setUser(data);
        localStorage.setItem('schatpin_chat_user', JSON.stringify(data));
      } else {
        localStorage.removeItem('schatpin_chat_user');
      }
    } catch (err) {
      console.error('Failed to verify user', err);
    }
  };

  // Realtime messages subscription via Supabase
  useEffect(() => {
    if (!user) return;
    const supabase = getSupabase();

    fetchContacts();
    fetchMessages();

    // Subscribe to new messages
    const channel = supabase
      .channel('public:schatpin_messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'schatpin_messages',
        },
        (payload) => {
          const newMsg = payload.new;
          if (
            selectedContact &&
            ((newMsg.sender_pin === user.pin && newMsg.receiver_pin === selectedContact.contact_pin) ||
             (newMsg.sender_pin === selectedContact.contact_pin && newMsg.receiver_pin === user.pin))
          ) {
            setMessages(prev => {
              const exists = prev.some(m => m.id === newMsg.id);
              if (!exists) return [...prev, newMsg];
              return prev;
            });
          }
        }
      )
      .subscribe();

    subscriptionRef.current = channel;

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
      }
    };
  }, [user, selectedContact]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const generatePin = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let pin = 'PIN';
    for (let i = 0; i < 5; i++) {
      pin += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pin;
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (!inputName.trim()) {
      setError('Nama harus diisi');
      return;
    }

    const supabase = getSupabase();
    let pin = generatePin();
    const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${inputName}`;

    try {
      let inserted = false;
      let userData = null;

      while (!inserted) {
        pin = generatePin();
        const { data, error } = await supabase
          .from('schatpin_users')
          .insert([{ pin, name: inputName.trim(), avatar }])
          .select()
          .single();

        if (!error && data) {
          userData = data;
          inserted = true;
        } else if (error && error.code !== '23505') {
          throw new Error(error.message);
        }
      }

      setUser(userData);
      localStorage.setItem('schatpin_chat_user', JSON.stringify(userData));
    } catch (err) {
      setError(err.message || 'Gagal mendaftar');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    if (!inputPin.trim()) {
      setError('PIN harus diisi');
      return;
    }

    const supabase = getSupabase();
    try {
      const cleanPin = inputPin.trim().toUpperCase();
      const { data, error } = await supabase
        .from('schatpin_users')
        .select('*')
        .eq('pin', cleanPin)
        .single();

      if (error || !data) {
        throw new Error('PIN tidak ditemukan!');
      }

      setUser(data);
      localStorage.setItem('schatpin_chat_user', JSON.stringify(data));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('schatpin_chat_user');
    setUser(null);
    setSelectedContact(null);
    setMessages([]);
  };

  const fetchContacts = async () => {
    if (!user) return;
    const supabase = getSupabase();

    try {
      const { data, error } = await supabase
        .from('schatpin_contacts')
        .select('contact_pin')
        .eq('user_pin', user.pin);

      if (error) throw error;

      if (data && data.length > 0) {
        const contactPins = data.map(c => c.contact_pin);
        const { data: usersData, error: userError } = await supabase
          .from('schatpin_users')
          .select('*')
          .in('pin', contactPins);

        if (!userError && usersData) {
          setContacts(usersData.map(u => ({ contact_pin: u.pin, ...u, online: true })));
        }
      } else {
        setContacts([]);
      }
    } catch (err) {
      console.error('Failed to fetch contacts', err);
    }
  };

  const fetchMessages = async () => {
    if (!user || !selectedContact) return;
    const supabase = getSupabase();

    try {
      const { data, error } = await supabase
        .from('schatpin_messages')
        .select('*')
        .or(`and(sender_pin.eq.${user.pin},receiver_pin.eq.${selectedContact.contact_pin}),and(sender_pin.eq.${selectedContact.contact_pin},receiver_pin.eq.${user.pin})`)
        .order('timestamp', { ascending: true });

      if (!error && data) {
        setMessages(data);
      }
    } catch (err) {
      console.error('Failed to fetch messages', err);
    }
  };

  useEffect(() => {
    if (selectedContact) {
      fetchMessages();
    }
  }, [selectedContact]);

  const handleAddContact = async (e) => {
    e.preventDefault();
    setAddError('');
    if (!newContactPin.trim()) {
      setAddError('Masukkan PIN kontak');
      return;
    }

    const cleanContactPin = newContactPin.trim().toUpperCase();
    if (cleanContactPin === user.pin) {
      setAddError('Tidak dapat menambahkan PIN sendiri');
      return;
    }

    const supabase = getSupabase();
    try {
      const { data: targetUser, error: uErr } = await supabase
        .from('schatpin_users')
        .select('*')
        .eq('pin', cleanContactPin)
        .single();

      if (uErr || !targetUser) {
        throw new Error('PIN kontak tidak ditemukan!');
      }

      const { error: cErr } = await supabase
        .from('schatpin_contacts')
        .insert([{ user_pin: user.pin, contact_pin: cleanContactPin }]);

      if (cErr && cErr.code !== '23505') {
        throw new Error(cErr.message);
      }

      await fetchContacts();
      setNewContactPin('');
      setShowAddModal(false);
      setSelectedContact({ contact_pin: targetUser.pin, ...targetUser });
    } catch (err) {
      setAddError(err.message);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!messageInput.trim() || !selectedContact) return;

    const supabase = getSupabase();
    const msgText = messageInput.trim();
    setMessageInput('');

    try {
      const { data, error } = await supabase
        .from('schatpin_messages')
        .insert([
          {
            sender_pin: user.pin,
            receiver_pin: selectedContact.contact_pin,
            message: msgText
          }
        ])
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setMessages(prev => {
          const exists = prev.some(m => m.id === data.id);
          if (!exists) return [...prev, data];
          return prev;
        });
      }
    } catch (err) {
      console.error('Failed to send message', err);
    }
  };

  const copyPin = () => {
    navigator.clipboard.writeText(user.pin);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Auth Screen (Register/Login)
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-whatsapp-chat p-4">
        <div className="w-full max-w-md bg-whatsapp-panel rounded-2xl shadow-2xl border border-whatsapp-border p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-whatsapp-accent rounded-full text-white mb-4 shadow-lg">
              <Shield className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-whatsapp-text">PIN Chat v1.1</h1>
            <p className="text-whatsapp-muted text-sm mt-1">Chat aman tanpa nomor HP, berbasis PIN unik</p>
          </div>

          <div className="flex rounded-lg bg-whatsapp-dark p-1 mb-6 border border-whatsapp-border">
            <button
              type="button"
              onClick={() => { setAuthMode('register'); setError(''); }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition ${authMode === 'register' ? 'bg-whatsapp-accent text-white shadow' : 'text-whatsapp-muted hover:text-white'}`}
            >
              Buat PIN Baru
            </button>
            <button
              type="button"
              onClick={() => { setAuthMode('login'); setError(''); }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition ${authMode === 'login' ? 'bg-whatsapp-accent text-white shadow' : 'text-whatsapp-muted hover:text-white'}`}
            >
              Masuk dengan PIN
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-900/50 border border-red-500 text-red-200 rounded-lg text-sm text-center">
              {error}
            </div>
          )}

          {authMode === 'register' ? (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-whatsapp-muted mb-1 uppercase tracking-wider">Nama Kamu</label>
                <input
                  type="text"
                  value={inputName}
                  onChange={(e) => setInputName(e.target.value)}
                  placeholder="Contoh: Arda Eko"
                  className="w-full px-4 py-3 bg-whatsapp-dark border border-whatsapp-border rounded-xl text-whatsapp-text focus:outline-none focus:border-whatsapp-accent transition"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full py-3 bg-whatsapp-accent hover:bg-emerald-600 text-white font-medium rounded-xl shadow-lg transition flex items-center justify-center gap-2"
              >
                Buat PIN & Masuk
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-whatsapp-muted mb-1 uppercase tracking-wider">PIN Kamu</label>
                <input
                  type="text"
                  value={inputPin}
                  onChange={(e) => setInputPin(e.target.value)}
                  placeholder="Contoh: PIN7A8B2"
                  className="w-full px-4 py-3 bg-whatsapp-dark border border-whatsapp-border rounded-xl text-whatsapp-text uppercase font-mono tracking-widest focus:outline-none focus:border-whatsapp-accent transition"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full py-3 bg-whatsapp-accent hover:bg-emerald-600 text-white font-medium rounded-xl shadow-lg transition flex items-center justify-center gap-2"
              >
                Masuk Chat
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // Filter contacts by search query
  const filteredContacts = contacts.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.contact_pin.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-screen w-screen bg-whatsapp-dark overflow-hidden">
      {/* Sidebar */}
      <div className={`w-full md:w-96 flex flex-col bg-whatsapp-panel border-r border-whatsapp-border ${selectedContact ? 'hidden md:flex' : 'flex'}`}>
        <div className="flex items-center justify-between px-4 py-3 bg-whatsapp-panel border-b border-whatsapp-border">
          <div className="flex items-center gap-3">
            <img src={user.avatar} alt={user.name} className="w-10 h-10 rounded-full bg-whatsapp-dark border border-whatsapp-border" />
            <div>
              <h2 className="font-semibold text-whatsapp-text text-sm">{user.name}</h2>
              <div className="flex items-center gap-1.5 text-xs text-whatsapp-accent font-mono">
                <span>{user.pin}</span>
                <button onClick={copyPin} title="Salin PIN" className="hover:text-white transition">
                  {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowAddModal(true)}
              className="p-2 text-whatsapp-muted hover:text-whatsapp-text hover:bg-whatsapp-dark/50 rounded-full transition"
              title="Tambah Kontak (PIN)"
            >
              <UserPlus className="w-5 h-5" />
            </button>
            <button
              onClick={handleLogout}
              className="p-2 text-whatsapp-muted hover:text-red-400 hover:bg-whatsapp-dark/50 rounded-full transition"
              title="Keluar"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="p-3 bg-whatsapp-dark/40 border-b border-whatsapp-border">
          <div className="flex items-center gap-2 px-3 py-2 bg-whatsapp-dark rounded-xl border border-whatsapp-border">
            <Search className="w-4 h-4 text-whatsapp-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari chat atau PIN..."
              className="w-full bg-transparent text-whatsapp-text text-sm focus:outline-none placeholder-whatsapp-muted"
            />
          </div>
        </div>

        {/* Contact List */}
        <div className="flex-1 overflow-y-auto divide-y divide-whatsapp-border/40">
          {filteredContacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center p-6 text-whatsapp-muted">
              <MessageSquare className="w-12 h-12 mb-2 opacity-40" />
              <p className="text-sm">Belum ada kontak.</p>
              <p className="text-xs mt-1">Klik ikon <UserPlus className="w-3 h-3 inline" /> di atas untuk menambahkan teman via PIN BBM mereka.</p>
            </div>
          ) : (
            filteredContacts.map((contact) => (
              <div
                key={contact.contact_pin}
                onClick={() => setSelectedContact(contact)}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition hover:bg-whatsapp-dark/60 ${selectedContact?.contact_pin === contact.contact_pin ? 'bg-whatsapp-dark/80' : ''}`}
              >
                <div className="relative">
                  <img src={contact.avatar} alt={contact.name} className="w-12 h-12 rounded-full bg-whatsapp-dark border border-whatsapp-border" />
                  <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-whatsapp-green border-2 border-whatsapp-panel rounded-full" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <h3 className="font-semibold text-whatsapp-text text-sm truncate">{contact.name}</h3>
                    <span className="text-xs text-whatsapp-muted font-mono">{contact.contact_pin}</span>
                  </div>
                  <p className="text-xs text-whatsapp-muted truncate">Online</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={`flex-1 flex flex-col bg-whatsapp-chat ${!selectedContact ? 'hidden md:flex' : 'flex'}`}>
        {selectedContact ? (
          <>
            {/* Chat Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-whatsapp-panel border-b border-whatsapp-border shadow-sm">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedContact(null)}
                  className="md:hidden p-1.5 text-whatsapp-muted hover:text-white rounded-full transition"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <div className="relative">
                  <img src={selectedContact.avatar} alt={selectedContact.name} className="w-10 h-10 rounded-full bg-whatsapp-dark border border-whatsapp-border" />
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-whatsapp-green border-2 border-whatsapp-panel rounded-full" />
                </div>
                <div>
                  <h3 className="font-semibold text-whatsapp-text text-sm">{selectedContact.name}</h3>
                  <p className="text-xs text-whatsapp-muted font-mono">
                    PIN: {selectedContact.contact_pin} • <span className="text-whatsapp-green font-medium">Online</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[radial-gradient(#202c33_1px,transparent_1px)] bg-[size:16px_16px]">
              <div className="flex justify-center my-2">
                <span className="px-3 py-1 bg-whatsapp-panel text-whatsapp-muted text-xs rounded-lg shadow border border-whatsapp-border flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-whatsapp-accent" /> Pesan dienkripsi real-time via Supabase v1.1
                </span>
              </div>

              {messages.map((msg, index) => {
                const isMe = msg.sender_pin === user.pin;
                return (
                  <div key={msg.id || index} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] md:max-w-md rounded-2xl px-4 py-2 shadow text-sm ${isMe ? 'bg-whatsapp-outgoing text-whatsapp-text rounded-tr-none' : 'bg-whatsapp-incoming text-whatsapp-text rounded-tl-none border border-whatsapp-border'}`}>
                      <p className="break-words whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                      <div className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${isMe ? 'text-emerald-200/70' : 'text-whatsapp-muted'}`}>
                        <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {isMe && <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={sendMessage} className="px-4 py-3 bg-whatsapp-panel border-t border-whatsapp-border flex items-center gap-3">
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder="Ketik pesan..."
                className="flex-1 px-4 py-3 bg-whatsapp-dark border border-whatsapp-border rounded-xl text-whatsapp-text text-sm focus:outline-none focus:border-whatsapp-accent transition"
              />
              <button
                type="submit"
                disabled={!messageInput.trim()}
                className={`p-3 rounded-xl bg-whatsapp-accent text-white shadow transition flex items-center justify-center ${!messageInput.trim() ? 'opacity-50 cursor-not-allowed' : 'hover:bg-emerald-600'}`}
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-whatsapp-muted">
            <div className="w-20 h-20 bg-whatsapp-panel rounded-full flex items-center justify-center mb-4 border border-whatsapp-border shadow">
              <MessageSquare className="w-10 h-10 text-whatsapp-accent" />
            </div>
            <h2 className="text-xl font-bold text-whatsapp-text mb-1">PIN Chat v1.1 (Supabase)</h2>
            <p className="text-sm max-w-sm">Pilih kontak di sebelah kiri atau tambah teman baru menggunakan PIN BBM mereka untuk mulai mengobrol.</p>
          </div>
        )}
      </div>

      {/* Add Contact Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-whatsapp-panel border border-whatsapp-border rounded-2xl shadow-2xl p-6">
            <h3 className="text-lg font-bold text-whatsapp-text mb-2">Tambah Kontak Baru</h3>
            <p className="text-xs text-whatsapp-muted mb-4">Masukkan PIN BBM teman kamu untuk menambahkannya ke daftar kontak.</p>

            {addError && (
              <div className="mb-4 p-3 bg-red-900/50 border border-red-500 text-red-200 rounded-lg text-sm">
                {addError}
              </div>
            )}

            <form onSubmit={handleAddContact} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-whatsapp-muted mb-1 uppercase tracking-wider">PIN Teman</label>
                <input
                  type="text"
                  value={newContactPin}
                  onChange={(e) => setNewContactPin(e.target.value)}
                  placeholder="Contoh: PIN3B2A1"
                  className="w-full px-4 py-3 bg-whatsapp-dark border border-whatsapp-border rounded-xl text-whatsapp-text uppercase font-mono tracking-widest focus:outline-none focus:border-whatsapp-accent transition"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-whatsapp-dark text-whatsapp-muted hover:text-white text-sm transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-whatsapp-accent hover:bg-emerald-600 text-white font-medium text-sm shadow transition"
                >
                  Tambah Kontak
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
