import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, UserPlus, LogOut, Send, Check, CheckCheck, 
  Search, Shield, Copy, CheckCircle2, ChevronLeft, Settings, 
  Lock, Bell, Image as ImageIcon, Users, Plus, Camera, Trash2, Download, Info, UserX
} from 'lucide-react';
import { App as CapApp } from '@capacitor/app';
import { getSupabase } from './supabaseClient';

export default function App() {
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('register');
  const [inputName, setInputName] = useState('');
  const [inputPassword, setInputPassword] = useState('');
  const [inputPin, setInputPin] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // App Lock state
  const [isLocked, setIsLocked] = useState(false);
  const [enterPasscode, setEnterPasscode] = useState('');
  const [lockError, setLockError] = useState('');

  // Settings state
  const [showSettings, setShowSettings] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [appLockEnabled, setAppLockEnabled] = useState(false);
  const [newPasscode, setNewPasscode] = useState('');

  // Chat state
  const [activeTab, setActiveTab] = useState('chats'); // 'chats' or 'groups'
  const [contacts, setContacts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [groupMessages, setGroupMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [unreadCounts, setUnreadCounts] = useState({}); // contact_pin -> count
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [newContactPin, setNewContactPin] = useState('');
  const [addError, setAddError] = useState('');

  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [joinGroupId, setJoinGroupId] = useState('');
  const [groupError, setGroupError] = useState('');

  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [groupMembers, setGroupMembers] = useState([]);

  // Typing & Status
  const [typingUser, setTypingUser] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Android Physical Back Button Handling
  useEffect(() => {
    const backListener = CapApp.addListener('backButton', () => {
      if (selectedContact || selectedGroup) {
        setSelectedContact(null);
        setSelectedGroup(null);
        setShowGroupInfo(false);
      } else if (showSettings || showAddModal || showGroupModal || showGroupInfo) {
        setShowSettings(false);
        setShowAddModal(false);
        setShowGroupModal(false);
        setShowGroupInfo(false);
      } else {
        CapApp.exitApp();
      }
    });

    return () => {
      backListener.then(listener => listener.remove());
    };
  }, [selectedContact, selectedGroup, showSettings, showAddModal, showGroupModal, showGroupInfo]);

  // Initialize session
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('schatpin_chat_user_v8');
      const settings = JSON.parse(localStorage.getItem('schatpin_settings_v8') || '{}');
      
      if (settings.notificationsEnabled !== undefined) {
        setNotificationsEnabled(settings.notificationsEnabled);
      }
      
      if (settings.appLockEnabled && settings.passcode) {
        setAppLockEnabled(true);
        setIsLocked(true);
      } else {
        setIsLocked(false);
      }

      if (savedUser) {
        const userData = JSON.parse(savedUser);
        if (userData && userData.pin) {
          verifyUser(userData.pin);
        }
      }
    } catch (e) {
      console.error('Initialization error:', e);
      setIsLocked(false);
    }
  }, []);

  // Presence heartbeat (update last_seen every 8s)
  useEffect(() => {
    if (!user) return;
    const supabase = getSupabase();
    const updatePresence = async () => {
      await supabase
        .from('schatpin_users')
        .update({ last_seen: new Date().toISOString() })
        .eq('pin', user.pin);
    };

    updatePresence();
    const interval = setInterval(updatePresence, 8000);
    return () => clearInterval(interval);
  }, [user]);

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
        localStorage.setItem('schatpin_chat_user_v8', JSON.stringify(data));
      } else {
        localStorage.removeItem('schatpin_chat_user_v8');
      }
    } catch (err) {
      console.error('Failed to verify user', err);
    }
  };

  const updateSettings = (newNotif, newLock, newPin) => {
    try {
      const current = JSON.parse(localStorage.getItem('schatpin_settings_v8') || '{}');
      const settings = {
        notificationsEnabled: newNotif !== undefined ? newNotif : notificationsEnabled,
        appLockEnabled: newLock !== undefined ? newLock : appLockEnabled,
        passcode: newPin !== undefined ? newPin : (current.passcode || '')
      };
      localStorage.setItem('schatpin_settings_v8', JSON.stringify(settings));
      setNotificationsEnabled(settings.notificationsEnabled);
      setAppLockEnabled(settings.appLockEnabled);
    } catch (e) {
      console.error('Save settings error:', e);
    }
  };

  const handleUnlock = (e) => {
    e.preventDefault();
    try {
      const settings = JSON.parse(localStorage.getItem('schatpin_settings_v8') || '{}');
      if (enterPasscode === settings.passcode) {
        setIsLocked(false);
        setEnterPasscode('');
        setLockError('');
      } else {
        setLockError('PIN Keamanan salah!');
      }
    } catch (e) {
      setIsLocked(false);
    }
  };

  const playNotificationSound = () => {
    if (!notificationsEnabled) return;
    try {
      if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
        navigator.vibrate([250, 100, 250]);
      }
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch (e) {
      // Audio context policy
    }
  };

  // Realtime subscriptions & Messaging
  useEffect(() => {
    if (!user) return;
    const supabase = getSupabase();

    fetchContacts();
    fetchGroups();
    fetchUnreadCounts();

    const msgChannel = supabase
      .channel('public:schatpin_messages_v8')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'schatpin_messages' },
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
            if (newMsg.receiver_pin === user.pin) {
              markAsRead(newMsg.id);
              playNotificationSound();
            }
          } else if (newMsg.receiver_pin === user.pin) {
            playNotificationSound();
            fetchUnreadCounts();
            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              new Notification('Pesan Baru - PIN Chat v1.8', { body: newMsg.message });
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'schatpin_messages' },
        (payload) => {
          const updated = payload.new;
          setMessages(prev => prev.map(m => m.id === updated.id ? updated : m));
        }
      )
      .subscribe();

    const groupMsgChannel = supabase
      .channel('public:schatpin_group_messages_v8')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'schatpin_group_messages' },
        (payload) => {
          const newMsg = payload.new;
          if (selectedGroup && newMsg.group_id === selectedGroup.group_id) {
            setGroupMessages(prev => {
              const exists = prev.some(m => m.id === newMsg.id);
              if (!exists) return [...prev, newMsg];
              return prev;
            });
            if (newMsg.sender_pin !== user.pin) {
              playNotificationSound();
            }
          }
        }
      )
      .subscribe();

    const typingChannel = supabase.channel('room:typing_v8')
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (selectedContact && payload.sender_pin === selectedContact.contact_pin && payload.receiver_pin === user.pin) {
          setTypingUser(payload.isTyping ? selectedContact.name : '');
        }
      })
      .subscribe();

    const periodicInterval = setInterval(() => {
      fetchContacts();
      fetchUnreadCounts();
    }, 8000);

    return () => {
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(groupMsgChannel);
      supabase.removeChannel(typingChannel);
      clearInterval(periodicInterval);
    };
  }, [user, selectedContact, selectedGroup, notificationsEnabled]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, groupMessages]);

  const markAsRead = async (msgId) => {
    const supabase = getSupabase();
    await supabase.from('schatpin_messages').update({ is_read: true }).eq('id', msgId);
    fetchUnreadCounts();
  };

  const fetchUnreadCounts = async () => {
    if (!user) return;
    const supabase = getSupabase();
    try {
      const { data } = await supabase
        .from('schatpin_messages')
        .select('sender_pin')
        .eq('receiver_pin', user.pin)
        .eq('is_read', false);

      if (data) {
        const counts = {};
        data.forEach(m => {
          counts[m.sender_pin] = (counts[m.sender_pin] || 0) + 1;
        });
        setUnreadCounts(counts);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Mark all unread messages from selectedContact as read instantly
  useEffect(() => {
    if (!user || !selectedContact) return;
    const markUnreadAsRead = async () => {
      const supabase = getSupabase();
      await supabase
        .from('schatpin_messages')
        .update({ is_read: true })
        .eq('sender_pin', selectedContact.contact_pin)
        .eq('receiver_pin', user.pin)
        .eq('is_read', false);
      
      fetchMessages();
      fetchUnreadCounts();
    };
    markUnreadAsRead();
  }, [user, selectedContact]);

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
    if (!inputName.trim() || !inputPassword.trim()) {
      setError('Nama dan Kata Sandi wajib diisi');
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
          .insert([{ pin, name: inputName.trim(), password: inputPassword.trim(), avatar, last_seen: new Date().toISOString() }])
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
      localStorage.setItem('schatpin_chat_user_v8', JSON.stringify(userData));
    } catch (err) {
      setError(err.message || 'Gagal mendaftar');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    if (!inputPin.trim() || !inputPassword.trim()) {
      setError('PIN dan Kata Sandi wajib diisi');
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

      if (data.password !== inputPassword.trim()) {
        throw new Error('Kata sandi salah!');
      }

      setUser(data);
      localStorage.setItem('schatpin_chat_user_v8', JSON.stringify(data));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('schatpin_chat_user_v8');
    setUser(null);
    setSelectedContact(null);
    setSelectedGroup(null);
    setMessages([]);
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Image = reader.result;
      const supabase = getSupabase();
      try {
        const { data, error } = await supabase
          .from('schatpin_users')
          .update({ avatar: base64Image })
          .eq('pin', user.pin)
          .select()
          .single();

        if (!error && data) {
          setUser(data);
          localStorage.setItem('schatpin_chat_user_v8', JSON.stringify(data));
        }
      } catch (err) {
        console.error('Failed to update avatar', err);
      }
    };
    reader.readAsDataURL(file);
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
          const now = new Date().getTime();
          setContacts(usersData.map(u => {
            const lastSeenTime = u.last_seen ? new Date(u.last_seen).getTime() : 0;
            // Online if last_seen within 45 seconds
            const online = (now - lastSeenTime) < 45000;
            return { contact_pin: u.pin, ...u, online };
          }));
        }
      } else {
        setContacts([]);
      }
    } catch (err) {
      console.error('Failed to fetch contacts', err);
    }
  };

  const fetchGroups = async () => {
    if (!user) return;
    const supabase = getSupabase();
    try {
      const { data, error } = await supabase
        .from('schatpin_group_members')
        .select('group_id')
        .eq('user_pin', user.pin);

      if (error) throw error;
      if (data && data.length > 0) {
        const gIds = data.map(g => g.group_id);
        const { data: groupsData } = await supabase
          .from('schatpin_groups')
          .select('*')
          .in('group_id', gIds);

        if (groupsData) setGroups(groupsData);
      } else {
        setGroups([]);
      }
    } catch (err) {
      console.error('Failed to fetch groups', err);
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

  const fetchGroupMessages = async () => {
    if (!selectedGroup) return;
    const supabase = getSupabase();
    try {
      const { data, error } = await supabase
        .from('schatpin_group_messages')
        .select('*')
        .eq('group_id', selectedGroup.group_id)
        .order('timestamp', { ascending: true });

      if (!error && data) {
        setGroupMessages(data);
      }
    } catch (err) {
      console.error('Failed to fetch group messages', err);
    }
  };

  useEffect(() => {
    if (selectedContact) fetchMessages();
  }, [selectedContact]);

  useEffect(() => {
    if (selectedGroup) fetchGroupMessages();
  }, [selectedGroup]);

  const handleTypingInput = (e) => {
    setMessageInput(e.target.value);
    if (!selectedContact) return;

    const supabase = getSupabase();
    const channel = supabase.channel('room:typing_v8');
    channel.send({
      type: 'broadcast',
      event: 'typing',
      payload: { sender_pin: user.pin, receiver_pin: selectedContact.contact_pin, isTyping: true }
    });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      channel.send({
        type: 'broadcast',
        event: 'typing',
        payload: { sender_pin: user.pin, receiver_pin: selectedContact.contact_pin, isTyping: false }
      });
    }, 2000);
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!messageInput.trim() || (!selectedContact && !selectedGroup)) return;

    const supabase = getSupabase();
    const msgText = messageInput.trim();
    setMessageInput('');

    if (selectedContact) {
      try {
        const { data, error } = await supabase
          .from('schatpin_messages')
          .insert([{ sender_pin: user.pin, receiver_pin: selectedContact.contact_pin, message: msgText, is_read: false }])
          .select()
          .single();

        if (error) throw error;
        if (data) {
          setMessages(prev => [...prev, data]);
        }
      } catch (err) {
        console.error('Failed to send message', err);
      }
    } else if (selectedGroup) {
      try {
        const { data, error } = await supabase
          .from('schatpin_group_messages')
          .insert([{ group_id: selectedGroup.group_id, sender_pin: user.pin, sender_name: user.name, message: msgText }])
          .select()
          .single();

        if (error) throw error;
        if (data) {
          setGroupMessages(prev => [...prev, data]);
        }
      } catch (err) {
        console.error('Failed to send group message', err);
      }
    }
  };

  // Robust Image Sending with Canvas Compression
  const handleImageSend = async (e) => {
    const file = e.target.files[0];
    if (!file || (!selectedContact && !selectedGroup)) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 400;

        if (width > height && width > maxDim) {
          height *= maxDim / width;
          width = maxDim;
        } else if (height > maxDim) {
          width *= maxDim / height;
          height = maxDim;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.5);

        const supabase = getSupabase();
        const mediaNotice = "[Foto Dikirim]";

        try {
          if (selectedContact) {
            const { data, error } = await supabase
              .from('schatpin_messages')
              .insert([{ sender_pin: user.pin, receiver_pin: selectedContact.contact_pin, message: mediaNotice, media_url: compressedBase64, media_type: 'image', is_read: false }])
              .select()
              .single();
            if (error) console.error('Image insert error:', error);
            if (data) setMessages(prev => [...prev, data]);
          } else if (selectedGroup) {
            const { data, error } = await supabase
              .from('schatpin_group_messages')
              .insert([{ group_id: selectedGroup.group_id, sender_pin: user.pin, sender_name: user.name, message: mediaNotice, media_url: compressedBase64, media_type: 'image' }])
              .select()
              .single();
            if (error) console.error('Group image insert error:', error);
            if (data) setGroupMessages(prev => [...prev, data]);
          }
        } catch (err) {
          console.error('Image send catch error:', err);
        }
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

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

      if (uErr || !targetUser) throw new Error('PIN kontak tidak ditemukan!');

      await supabase.from('schatpin_contacts').insert([{ user_pin: user.pin, contact_pin: cleanContactPin }]);
      await fetchContacts();
      setNewContactPin('');
      setShowAddModal(false);
      setSelectedContact({ contact_pin: targetUser.pin, ...targetUser });
    } catch (err) {
      setAddError(err.message);
    }
  };

  // Clear Chat History
  const handleClearChat = async () => {
    if (!confirm('Hapus semua riwayat pesan dengan kontak ini?')) return;
    const supabase = getSupabase();
    try {
      await supabase
        .from('schatpin_messages')
        .delete()
        .or(`and(sender_pin.eq.${user.pin},receiver_pin.eq.${selectedContact.contact_pin}),and(sender_pin.eq.${selectedContact.contact_pin},receiver_pin.eq.${user.pin})`);
      setMessages([]);
    } catch (e) {
      console.error(e);
    }
  };

  // Unfriend (Hapus Pertemanan)
  const handleUnfriend = async () => {
    if (!confirm(`Hapus ${selectedContact.name} dari daftar kontak?`)) return;
    const supabase = getSupabase();
    try {
      await supabase
        .from('schatpin_contacts')
        .delete()
        .eq('user_pin', user.pin)
        .eq('contact_pin', selectedContact.contact_pin);
      
      setSelectedContact(null);
      await fetchContacts();
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!groupName.trim()) return;

    const supabase = getSupabase();
    const gId = 'GRP-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const avatar = `https://api.dicebear.com/7.x/identicon/svg?seed=${groupName}`;

    try {
      await supabase.from('schatpin_groups').insert([{ group_id: gId, name: groupName.trim(), admin_pin: user.pin, avatar }]);
      await supabase.from('schatpin_group_members').insert([{ group_id: gId, user_pin: user.pin, user_name: user.name }]);
      await fetchGroups();
      setGroupName('');
      setShowGroupModal(false);
    } catch (err) {
      setGroupError(err.message);
    }
  };

  const handleJoinGroup = async (e) => {
    e.preventDefault();
    if (!joinGroupId.trim()) return;

    const supabase = getSupabase();
    const cleanGId = joinGroupId.trim().toUpperCase();

    try {
      const { data: grp } = await supabase.from('schatpin_groups').select('*').eq('group_id', cleanGId).single();
      if (!grp) throw new Error('ID Grup tidak ditemukan!');

      await supabase.from('schatpin_group_members').insert([{ group_id: cleanGId, user_pin: user.pin, user_name: user.name }]);
      await fetchGroups();
      setJoinGroupId('');
      setShowGroupModal(false);
    } catch (err) {
      setGroupError(err.message);
    }
  };

  const fetchGroupMembers = async (groupId) => {
    const supabase = getSupabase();
    const { data } = await supabase
      .from('schatpin_group_members')
      .select('user_pin')
      .eq('group_id', groupId);

    if (data && data.length > 0) {
      const pins = data.map(m => m.user_pin);
      const { data: usersData } = await supabase
        .from('schatpin_users')
        .select('pin, name, avatar')
        .in('pin', pins);
      if (usersData) {
        setGroupMembers(usersData.map(u => ({ user_pin: u.pin, user_name: u.name, avatar: u.avatar })));
      } else {
        setGroupMembers(data.map(m => ({ user_pin: m.user_pin, user_name: m.user_name || 'User' })));
      }
    } else {
      setGroupMembers([]);
    }
    setShowGroupInfo(true);
  };

  const handleDeleteGroup = async (groupId) => {
    if (!confirm('Yakin ingin menghapus grup ini?')) return;
    const supabase = getSupabase();
    await supabase.from('schatpin_groups').delete().eq('group_id', groupId);
    await supabase.from('schatpin_group_members').delete().eq('group_id', groupId);
    await supabase.from('schatpin_group_messages').delete().eq('group_id', groupId);
    setSelectedGroup(null);
    setShowGroupInfo(false);
    await fetchGroups();
  };

  const handleLeaveGroup = async (groupId) => {
    if (!confirm('Yakin ingin keluar dari grup ini?')) return;
    const supabase = getSupabase();
    await supabase.from('schatpin_group_members').delete().eq('group_id', groupId).eq('user_pin', user.pin);
    setSelectedGroup(null);
    setShowGroupInfo(false);
    await fetchGroups();
  };

  const copyPin = () => {
    navigator.clipboard.writeText(user.pin);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLocked) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-whatsapp-chat p-4">
        <div className="w-full max-w-md bg-whatsapp-panel rounded-2xl shadow-2xl border border-whatsapp-border p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-whatsapp-accent rounded-full text-white mb-4 shadow-lg">
            <Lock className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-whatsapp-text">Aplikasi Dikunci</h1>
          <p className="text-whatsapp-muted text-sm mt-1 mb-6">Masukkan PIN Keamanan untuk membuka aplikasi</p>

          {lockError && <div className="mb-4 p-3 bg-red-900/50 border border-red-500 text-red-200 rounded-lg text-sm">{lockError}</div>}

          <form onSubmit={handleUnlock} className="space-y-4">
            <input
              type="password"
              maxLength={6}
              value={enterPasscode}
              onChange={(e) => setEnterPasscode(e.target.value)}
              placeholder="••••"
              className="w-full px-4 py-3 bg-whatsapp-dark border border-whatsapp-border rounded-xl text-whatsapp-text text-center text-2xl tracking-widest focus:outline-none focus:border-whatsapp-accent transition"
              required
            />
            <button type="submit" className="w-full py-3 bg-whatsapp-accent hover:bg-emerald-600 text-white font-medium rounded-xl shadow-lg transition">Buka Kunci</button>
          </form>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-whatsapp-chat p-4">
        <div className="w-full max-w-md bg-whatsapp-panel rounded-2xl shadow-2xl border border-whatsapp-border p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-whatsapp-accent rounded-full text-white mb-4 shadow-lg">
              <Shield className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-whatsapp-text">PIN Chat v1.8</h1>
            <p className="text-whatsapp-muted text-sm mt-1">Chat aman dengan perlindungan kata sandi</p>
          </div>

          <div className="flex rounded-lg bg-whatsapp-dark p-1 mb-6 border border-whatsapp-border">
            <button type="button" onClick={() => { setAuthMode('register'); setError(''); }} className={`flex-1 py-2 text-sm font-medium rounded-md transition ${authMode === 'register' ? 'bg-whatsapp-accent text-white shadow' : 'text-whatsapp-muted hover:text-white'}`}>Buat PIN Baru</button>
            <button type="button" onClick={() => { setAuthMode('login'); setError(''); }} className={`flex-1 py-2 text-sm font-medium rounded-md transition ${authMode === 'login' ? 'bg-whatsapp-accent text-white shadow' : 'text-whatsapp-muted hover:text-white'}`}>Masuk dengan PIN</button>
          </div>

          {error && <div className="mb-4 p-3 bg-red-900/50 border border-red-500 text-red-200 rounded-lg text-sm text-center">{error}</div>}

          {authMode === 'register' ? (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-whatsapp-muted mb-1 uppercase tracking-wider">Nama Kamu</label>
                <input type="text" value={inputName} onChange={(e) => setInputName(e.target.value)} placeholder="Contoh: Arda Eko" className="w-full px-4 py-3 bg-whatsapp-dark border border-whatsapp-border rounded-xl text-whatsapp-text focus:outline-none focus:border-whatsapp-accent transition" required />
              </div>
              <div>
                <label className="block text-xs font-medium text-whatsapp-muted mb-1 uppercase tracking-wider">Kata Sandi Rahasia</label>
                <input type="password" value={inputPassword} onChange={(e) => setInputPassword(e.target.value)} placeholder="Kata sandi akun" className="w-full px-4 py-3 bg-whatsapp-dark border border-whatsapp-border rounded-xl text-whatsapp-text focus:outline-none focus:border-whatsapp-accent transition" required />
              </div>
              <button type="submit" className="w-full py-3 bg-whatsapp-accent hover:bg-emerald-600 text-white font-medium rounded-xl shadow-lg transition flex items-center justify-center gap-2">Buat PIN & Masuk</button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-whatsapp-muted mb-1 uppercase tracking-wider">PIN Kamu</label>
                <input type="text" value={inputPin} onChange={(e) => setInputPin(e.target.value)} placeholder="Contoh: PIN7A8B2" className="w-full px-4 py-3 bg-whatsapp-dark border border-whatsapp-border rounded-xl text-whatsapp-text uppercase font-mono tracking-widest focus:outline-none focus:border-whatsapp-accent transition" required />
              </div>
              <div>
                <label className="block text-xs font-medium text-whatsapp-muted mb-1 uppercase tracking-wider">Kata Sandi</label>
                <input type="password" value={inputPassword} onChange={(e) => setInputPassword(e.target.value)} placeholder="Kata sandi akun" className="w-full px-4 py-3 bg-whatsapp-dark border border-whatsapp-border rounded-xl text-whatsapp-text focus:outline-none focus:border-whatsapp-accent transition" required />
              </div>
              <button type="submit" className="w-full py-3 bg-whatsapp-accent hover:bg-emerald-600 text-white font-medium rounded-xl shadow-lg transition flex items-center justify-center gap-2">Masuk Chat</button>
            </form>
          )}
        </div>
      </div>
    );
  }

  const filteredContacts = contacts.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.contact_pin.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredGroups = groups.filter(g => g.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="flex h-screen w-screen bg-whatsapp-dark overflow-hidden">
      {/* Sidebar */}
      <div className={`w-full md:w-96 flex flex-col bg-whatsapp-panel border-r border-whatsapp-border ${(selectedContact || selectedGroup) ? 'hidden md:flex' : 'flex'}`}>
        <div className="flex items-center justify-between px-4 py-3 bg-whatsapp-panel border-b border-whatsapp-border">
          <div className="flex items-center gap-3">
            <div className="relative group cursor-pointer" title="Ubah Foto Profil">
              <img src={user.avatar} alt={user.name} className="w-10 h-10 rounded-full bg-whatsapp-dark border border-whatsapp-border object-cover" />
              <label className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition cursor-pointer">
                <Camera className="w-4 h-4 text-white" />
                <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
              </label>
            </div>
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
            <button onClick={() => setShowAddModal(true)} className="p-2 text-whatsapp-muted hover:text-whatsapp-text hover:bg-whatsapp-dark/50 rounded-full transition" title="Tambah Kontak"><UserPlus className="w-5 h-5" /></button>
            <button onClick={() => setShowGroupModal(true)} className="p-2 text-whatsapp-muted hover:text-whatsapp-text hover:bg-whatsapp-dark/50 rounded-full transition" title="Grup Chat"><Users className="w-5 h-5" /></button>
            <button onClick={() => setShowSettings(true)} className="p-2 text-whatsapp-muted hover:text-whatsapp-text hover:bg-whatsapp-dark/50 rounded-full transition" title="Pengaturan"><Settings className="w-5 h-5" /></button>
            <button onClick={handleLogout} className="p-2 text-whatsapp-muted hover:text-red-400 hover:bg-whatsapp-dark/50 rounded-full transition" title="Keluar"><LogOut className="w-5 h-5" /></button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-whatsapp-border bg-whatsapp-dark/50">
          <button onClick={() => setActiveTab('chats')} className={`flex-1 py-2 text-xs font-semibold uppercase tracking-wider transition ${activeTab === 'chats' ? 'text-whatsapp-accent border-b-2 border-whatsapp-accent bg-whatsapp-dark' : 'text-whatsapp-muted hover:text-white'}`}>Personal</button>
          <button onClick={() => setActiveTab('groups')} className={`flex-1 py-2 text-xs font-semibold uppercase tracking-wider transition ${activeTab === 'groups' ? 'text-whatsapp-accent border-b-2 border-whatsapp-accent bg-whatsapp-dark' : 'text-whatsapp-muted hover:text-white'}`}>Grup ({groups.length})</button>
        </div>

        {/* Search */}
        <div className="p-3 bg-whatsapp-dark/40 border-b border-whatsapp-border">
          <div className="flex items-center gap-2 px-3 py-2 bg-whatsapp-dark rounded-xl border border-whatsapp-border">
            <Search className="w-4 h-4 text-whatsapp-muted" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Cari..." className="w-full bg-transparent text-whatsapp-text text-sm focus:outline-none placeholder-whatsapp-muted" />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto divide-y divide-whatsapp-border/40">
          {activeTab === 'chats' ? (
            filteredContacts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center p-6 text-whatsapp-muted">
                <MessageSquare className="w-12 h-12 mb-2 opacity-40" />
                <p className="text-sm">Belum ada kontak.</p>
              </div>
            ) : (
              filteredContacts.map(contact => {
                const unreadCount = unreadCounts[contact.contact_pin] || 0;
                return (
                  <div key={contact.contact_pin} onClick={() => { setSelectedContact(contact); setSelectedGroup(null); }} className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition hover:bg-whatsapp-dark/60 ${selectedContact?.contact_pin === contact.contact_pin ? 'bg-whatsapp-dark/80' : ''}`}>
                    <div className="relative">
                      <img src={contact.avatar} alt={contact.name} className="w-12 h-12 rounded-full bg-whatsapp-dark border border-whatsapp-border object-cover" />
                      {contact.online && <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-whatsapp-green border-2 border-whatsapp-panel rounded-full" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <h3 className="font-semibold text-whatsapp-text text-sm truncate">{contact.name}</h3>
                        <span className="text-xs text-whatsapp-muted font-mono">{contact.contact_pin}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-whatsapp-muted truncate">{contact.online ? 'Online' : 'Offline'}</p>
                        {unreadCount > 0 && (
                          <span className="px-2 py-0.5 bg-whatsapp-accent text-white font-bold text-[10px] rounded-full shadow">
                            {unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )
          ) : (
            filteredGroups.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center p-6 text-whatsapp-muted">
                <Users className="w-12 h-12 mb-2 opacity-40" />
                <p className="text-sm">Belum ada grup.</p>
              </div>
            ) : (
              filteredGroups.map(group => (
                <div key={group.group_id} onClick={() => { setSelectedGroup(group); setSelectedContact(null); }} className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition hover:bg-whatsapp-dark/60 ${selectedGroup?.group_id === group.group_id ? 'bg-whatsapp-dark/80' : ''}`}>
                  <img src={group.avatar} alt={group.name} className="w-12 h-12 rounded-full bg-whatsapp-dark border border-whatsapp-border object-cover" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <h3 className="font-semibold text-whatsapp-text text-sm truncate">{group.name}</h3>
                      <span className="text-xs text-whatsapp-accent font-mono">{group.group_id}</span>
                    </div>
                    <p className="text-xs text-whatsapp-muted truncate">Grup Obrolan</p>
                  </div>
                </div>
              ))
            )
          )}
        </div>
      </div>

      {/* Main Chat */}
      <div className={`flex-1 flex flex-col bg-whatsapp-chat ${(!selectedContact && !selectedGroup) ? 'hidden md:flex' : 'flex'}`}>
        {(selectedContact || selectedGroup) ? (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-whatsapp-panel border-b border-whatsapp-border shadow-sm">
              <div className="flex items-center gap-3">
                <button onClick={() => { setSelectedContact(null); setSelectedGroup(null); setShowGroupInfo(false); }} className="md:hidden p-1.5 text-whatsapp-muted hover:text-white rounded-full transition"><ChevronLeft className="w-6 h-6" /></button>
                <img src={selectedContact ? selectedContact.avatar : selectedGroup.avatar} alt="Avatar" className="w-10 h-10 rounded-full bg-whatsapp-dark border border-whatsapp-border object-cover" />
                <div>
                  <h3 className="font-semibold text-whatsapp-text text-sm">{selectedContact ? selectedContact.name : selectedGroup.name}</h3>
                  <p className="text-xs text-whatsapp-muted font-mono">
                    {selectedContact ? `PIN: ${selectedContact.contact_pin} • ${selectedContact.online ? 'Online' : 'Offline'}` : `ID Grup: ${selectedGroup.group_id}`}
                    {typingUser && <span className="text-whatsapp-accent ml-2 italic">({typingUser} sedang mengetik...)</span>}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {selectedContact && (
                  <>
                    <button onClick={handleClearChat} className="p-2 text-whatsapp-muted hover:text-amber-400 rounded-full transition" title="Hapus Riwayat Chat">
                      <Trash2 className="w-5 h-5" />
                    </button>
                    <button onClick={handleUnfriend} className="p-2 text-whatsapp-muted hover:text-red-400 rounded-full transition" title="Hapus Pertemanan (Unfriend)">
                      <UserX className="w-5 h-5" />
                    </button>
                  </>
                )}
                {selectedGroup && (
                  <button onClick={() => fetchGroupMembers(selectedGroup.group_id)} className="p-2 text-whatsapp-muted hover:text-white rounded-full transition" title="Info Grup">
                    <Info className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[radial-gradient(#202c33_1px,transparent_1px)] bg-[size:16px_16px]">
              <div className="flex justify-center my-2">
                <span className="px-3 py-1 bg-whatsapp-panel text-whatsapp-muted text-xs rounded-lg shadow border border-whatsapp-border flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-whatsapp-accent" /> PIN Chat v1.8 • Fitur Lengkap & Stabil
                </span>
              </div>

              {selectedContact ? (
                messages.map((msg, index) => {
                  const isMe = msg.sender_pin === user.pin;
                  return (
                    <div key={msg.id || index} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] md:max-w-md rounded-2xl px-4 py-2 shadow text-sm ${isMe ? 'bg-whatsapp-outgoing text-whatsapp-text rounded-tr-none' : 'bg-whatsapp-incoming text-whatsapp-text rounded-tl-none border border-whatsapp-border'}`}>
                        {msg.media_url && (
                          <div className="mb-2">
                            <img src={msg.media_url} alt="Media" className="rounded-xl max-h-64 object-cover w-full" />
                            <a href={msg.media_url} download="schatpin_media.jpg" className="flex items-center gap-1 text-xs text-whatsapp-accent mt-1 hover:underline">
                              <Download className="w-3 h-3" /> Download Gambar
                            </a>
                          </div>
                        )}
                        <p className="break-words whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                        <div className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${isMe ? 'text-emerald-200/70' : 'text-whatsapp-muted'}`}>
                          <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          {isMe && (
                            <span className={msg.is_read ? 'text-blue-400 font-bold' : ''}>
                              {msg.is_read ? <CheckCheck className="w-3.5 h-3.5 text-blue-400 inline" /> : <Check className="w-3.5 h-3.5 inline" />}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                groupMessages.map((msg, index) => {
                  const isMe = msg.sender_pin === user.pin;
                  return (
                    <div key={msg.id || index} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] md:max-w-md rounded-2xl px-4 py-2 shadow text-sm ${isMe ? 'bg-whatsapp-outgoing text-whatsapp-text rounded-tr-none' : 'bg-whatsapp-incoming text-whatsapp-text rounded-tl-none border border-whatsapp-border'}`}>
                        {!isMe && <p className="text-xs font-semibold text-whatsapp-accent mb-0.5">{msg.sender_name}</p>}
                        {msg.media_url && (
                          <div className="mb-2">
                            <img src={msg.media_url} alt="Media" className="rounded-xl max-h-64 object-cover w-full" />
                            <a href={msg.media_url} download="schatpin_media.jpg" className="flex items-center gap-1 text-xs text-whatsapp-accent mt-1 hover:underline">
                              <Download className="w-3 h-3" /> Download Gambar
                            </a>
                          </div>
                        )}
                        <p className="break-words whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                        <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-whatsapp-muted">
                          <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Footer Input */}
            <form onSubmit={sendMessage} className="px-4 py-3 bg-whatsapp-panel border-t border-whatsapp-border flex items-center gap-3">
              <label className="p-2.5 text-whatsapp-muted hover:text-white cursor-pointer transition rounded-xl bg-whatsapp-dark border border-whatsapp-border" title="Kirim Gambar">
                <ImageIcon className="w-5 h-5" />
                <input type="file" accept="image/*" onChange={handleImageSend} className="hidden" />
              </label>
              <input
                type="text"
                value={messageInput}
                onChange={handleTypingInput}
                placeholder="Ketik pesan..."
                className="flex-1 px-4 py-3 bg-whatsapp-dark border border-whatsapp-border rounded-xl text-whatsapp-text text-sm focus:outline-none focus:border-whatsapp-accent transition"
              />
              <button type="submit" disabled={!messageInput?.trim()} className={`p-3 rounded-xl bg-whatsapp-accent text-white shadow transition flex items-center justify-center ${!messageInput?.trim() ? 'opacity-50 cursor-not-allowed' : 'hover:bg-emerald-600'}`}>
                <Send className="w-5 h-5" />
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-whatsapp-muted">
            <div className="w-20 h-20 bg-whatsapp-panel rounded-full flex items-center justify-center mb-4 border border-whatsapp-border shadow">
              <MessageSquare className="w-10 h-10 text-whatsapp-accent" />
            </div>
            <h2 className="text-xl font-bold text-whatsapp-text mb-1">PIN Chat v1.8</h2>
            <p className="text-sm max-w-sm">Pilih kontak atau grup di sebelah kiri untuk mulai mengobrol.</p>
          </div>
        )}
      </div>

      {/* Add Contact Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-whatsapp-panel border border-whatsapp-border rounded-2xl shadow-2xl p-6">
            <h3 className="text-lg font-bold text-whatsapp-text mb-2">Tambah Kontak Baru</h3>
            <p className="text-xs text-whatsapp-muted mb-4">Masukkan PIN teman kamu untuk menambahkannya.</p>
            {addError && <div className="mb-4 p-3 bg-red-900/50 border border-red-500 text-red-200 rounded-lg text-sm">{addError}</div>}
            <form onSubmit={handleAddContact} className="space-y-4">
              <input type="text" value={newContactPin} onChange={(e) => setNewContactPin(e.target.value)} placeholder="Contoh: PIN3B2A1" className="w-full px-4 py-3 bg-whatsapp-dark border border-whatsapp-border rounded-xl text-whatsapp-text uppercase font-mono tracking-widest focus:outline-none focus:border-whatsapp-accent transition" required />
              <div className="flex items-center justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2.5 rounded-xl bg-whatsapp-dark text-whatsapp-muted hover:text-white text-sm transition">Batal</button>
                <button type="submit" className="px-5 py-2.5 rounded-xl bg-whatsapp-accent hover:bg-emerald-600 text-white font-medium text-sm shadow transition">Tambah</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Group Modal */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-whatsapp-panel border border-whatsapp-border rounded-2xl shadow-2xl p-6 space-y-6">
            <h3 className="text-lg font-bold text-whatsapp-text">Grup Obrolan</h3>
            {groupError && <div className="p-3 bg-red-900/50 border border-red-500 text-red-200 rounded-lg text-sm">{groupError}</div>}
            
            <form onSubmit={handleCreateGroup} className="space-y-3">
              <h4 className="text-xs font-semibold text-whatsapp-muted uppercase tracking-wider">Buat Grup Baru</h4>
              <input type="text" value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Nama Grup" className="w-full px-4 py-3 bg-whatsapp-dark border border-whatsapp-border rounded-xl text-whatsapp-text text-sm focus:outline-none focus:border-whatsapp-accent transition" required />
              <button type="submit" className="w-full py-2.5 bg-whatsapp-accent hover:bg-emerald-600 text-white font-medium rounded-xl text-sm transition">Buat Grup</button>
            </form>

            <hr className="border-whatsapp-border" />

            <form onSubmit={handleJoinGroup} className="space-y-3">
              <h4 className="text-xs font-semibold text-whatsapp-muted uppercase tracking-wider">Gabung Grup via ID</h4>
              <input type="text" value={joinGroupId} onChange={(e) => setJoinGroupId(e.target.value)} placeholder="ID Grup (Contoh: GRP-XYZ123)" className="w-full px-4 py-3 bg-whatsapp-dark border border-whatsapp-border rounded-xl text-whatsapp-text text-sm uppercase font-mono tracking-wider focus:outline-none focus:border-whatsapp-accent transition" required />
              <button type="submit" className="w-full py-2.5 bg-whatsapp-dark hover:bg-whatsapp-border text-whatsapp-text font-medium rounded-xl text-sm transition border border-whatsapp-border">Gabung Grup</button>
            </form>

            <div className="flex justify-end pt-2">
              <button type="button" onClick={() => setShowGroupModal(false)} className="px-4 py-2 rounded-xl bg-whatsapp-dark text-whatsapp-muted hover:text-white text-sm transition">Tutup</button>
            </div>
          </div>
        </div>
      )}

      {/* Group Info Modal */}
      {showGroupInfo && selectedGroup && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-whatsapp-panel border border-whatsapp-border rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-whatsapp-text">Info Grup: {selectedGroup.name}</h3>
              <button onClick={() => setShowGroupInfo(false)} className="text-whatsapp-muted hover:text-white">✕</button>
            </div>
            <p className="text-xs text-whatsapp-muted font-mono">ID Grup: {selectedGroup.group_id}</p>
            
            <div>
              <h4 className="text-xs font-semibold text-whatsapp-muted uppercase tracking-wider mb-2">Anggota Bergabung ({groupMembers.length})</h4>
              <div className="max-h-40 overflow-y-auto divide-y divide-whatsapp-border/40 bg-whatsapp-dark rounded-xl p-2">
                {groupMembers.map(m => (
                  <div key={m.user_pin} className="py-2 px-2 flex items-center justify-between text-sm text-whatsapp-text">
                    <span className="flex items-center gap-2">
                      {m.avatar && <img src={m.avatar} alt="" className="w-6 h-6 rounded-full object-cover" />}
                      {m.user_name || 'User'}
                    </span>
                    <span className="text-xs font-mono text-whatsapp-accent">{m.user_pin}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between">
              {selectedGroup.admin_pin === user.pin ? (
                <button onClick={() => handleDeleteGroup(selectedGroup.group_id)} className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition flex items-center gap-1">
                  <Trash2 className="w-4 h-4" /> Hapus Grup
                </button>
              ) : (
                <button onClick={() => handleLeaveGroup(selectedGroup.group_id)} className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition flex items-center gap-1">
                  <LogOut className="w-4 h-4" /> Keluar Grup
                </button>
              )}
              <button onClick={() => setShowGroupInfo(false)} className="px-4 py-2 rounded-xl bg-whatsapp-dark text-whatsapp-muted hover:text-white text-sm transition">Tutup</button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-whatsapp-panel border border-whatsapp-border rounded-2xl shadow-2xl p-6 space-y-6">
            <h3 className="text-lg font-bold text-whatsapp-text">Pengaturan Aplikasi</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-whatsapp-text">Notifikasi Audio & Getar</h4>
                  <p className="text-xs text-whatsapp-muted">Bunyikan suara saat pesan baru</p>
                </div>
                <input type="checkbox" checked={notificationsEnabled} onChange={(e) => updateSettings(e.target.checked, undefined, undefined)} className="w-5 h-5 accent-whatsapp-accent cursor-pointer" />
              </div>

              <div className="border-t border-whatsapp-border pt-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-sm font-medium text-whatsapp-text">Kunci Keamanan App (PIN)</h4>
                    <p className="text-xs text-whatsapp-muted">Lindungi aplikasi dengan PIN sandi</p>
                  </div>
                  <input type="checkbox" checked={appLockEnabled} onChange={(e) => { const enabled = e.target.checked; if (!enabled) updateSettings(undefined, false, ''); else updateSettings(undefined, true, newPasscode || '1234'); }} className="w-5 h-5 accent-whatsapp-accent cursor-pointer" />
                </div>
                {appLockEnabled && (
                  <div>
                    <label className="block text-xs text-whatsapp-muted mb-1">Set PIN Keamanan Baru (4-6 digit)</label>
                    <input type="password" maxLength={6} value={newPasscode} onChange={(e) => { setNewPasscode(e.target.value); updateSettings(undefined, true, e.target.value); }} placeholder="Contoh: 1234" className="w-full px-3 py-2 bg-whatsapp-dark border border-whatsapp-border rounded-xl text-whatsapp-text text-sm focus:outline-none focus:border-whatsapp-accent" />
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button onClick={() => setShowSettings(false)} className="px-5 py-2.5 rounded-xl bg-whatsapp-accent text-white hover:bg-emerald-600 text-sm font-medium transition">Simpan & Tutup</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
