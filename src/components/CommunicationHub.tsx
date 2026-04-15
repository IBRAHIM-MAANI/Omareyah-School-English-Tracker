import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Mic, Paperclip, Search, User, MessageSquare, Download, Loader2, X, Plus } from 'lucide-react';
import { auth, db, collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, getDocs, Timestamp } from '../firebase';

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  text: string;
  fileUrl?: string;
  fileType?: string;
  isVoice?: boolean;
  timestamp: Timestamp;
}

interface ChatUser {
  uid: string;
  displayName: string;
  email: string;
  role: string;
  uniqueId: string;
}

const CommunicationHub: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeChat, setActiveChat] = useState<ChatUser | null>(null);
  const [searchId, setSearchId] = useState('');
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentChats, setRecentChats] = useState<ChatUser[]>([]);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!auth.currentUser || !activeChat) return;

    const q = query(
      collection(db, 'messages'),
      where('participants', 'array-contains', auth.currentUser.uid),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Message))
        .filter(m => 
          (m.senderId === auth.currentUser?.uid && m.receiverId === activeChat.uid) ||
          (m.senderId === activeChat.uid && m.receiverId === auth.currentUser?.uid)
        );
      setMessages(msgs);
      setTimeout(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }, 100);
    });

    return () => unsubscribe();
  }, [activeChat]);

  const handleSearch = async () => {
    if (!searchId.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const q = query(collection(db, 'users'), where('uniqueId', '==', searchId.trim()));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const userData = snapshot.docs[0].data() as ChatUser;
        setActiveChat(userData);
        if (!recentChats.find(c => c.uid === userData.uid)) {
          setRecentChats(prev => [userData, ...prev]);
        }
      } else {
        setError("User not found with this ID.");
      }
    } catch (err) {
      setError("Search failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim() || !activeChat || !auth.currentUser) return;

    const text = inputText;
    setInputText('');

    try {
      await addDoc(collection(db, 'messages'), {
        senderId: auth.currentUser.uid,
        senderName: auth.currentUser.displayName || auth.currentUser.email,
        receiverId: activeChat.uid,
        participants: [auth.currentUser.uid, activeChat.uid],
        text,
        timestamp: serverTimestamp()
      });
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  };

  return (
    <div className="flex h-[calc(100vh-120px)] gap-6">
      {/* Sidebar: Search & Recent Chats */}
      <div className="w-80 flex flex-col gap-4">
        <div className="glass-panel rounded-3xl p-6 space-y-4">
          <h2 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500">Communication Hub</h2>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input 
              type="text" 
              placeholder="Enter OM-ID..." 
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full bg-slate-900/50 border border-white/5 rounded-2xl pl-12 pr-4 py-3 text-sm outline-none focus:border-purple-500 transition-all"
            />
          </div>
          {error && <p className="text-xs text-red-400 font-bold">{error}</p>}
          <button 
            onClick={handleSearch}
            disabled={isLoading}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-black py-3 rounded-2xl text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Find User
          </button>
        </div>

        <div className="glass-panel rounded-3xl p-6 flex-1 overflow-y-auto custom-scrollbar space-y-4">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Recent Chats</h3>
          <div className="space-y-2">
            {recentChats.map(chatUser => (
              <button 
                key={chatUser.uid}
                onClick={() => setActiveChat(chatUser)}
                className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all ${activeChat?.uid === chatUser.uid ? 'bg-purple-600/20 border border-purple-500/30' : 'hover:bg-white/5 border border-transparent'}`}
              >
                <div className="w-10 h-10 bg-slate-700 rounded-xl flex items-center justify-center border border-white/10">
                  <User className="w-5 h-5 text-slate-400" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-black text-white">{chatUser.displayName}</div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{chatUser.uniqueId}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 glass-panel rounded-[40px] flex flex-col overflow-hidden relative">
        {activeChat ? (
          <>
            {/* Chat Header */}
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-slate-900/20">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-purple-600/20 rounded-2xl flex items-center justify-center border border-purple-500/30">
                  <User className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white">{activeChat.displayName}</h2>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Online</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setActiveChat(null)} className="p-2 hover:bg-white/5 rounded-xl transition-all">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* Messages */}
            <div 
              ref={scrollRef}
              className="flex-1 p-8 overflow-y-auto custom-scrollbar space-y-6"
            >
              {messages.map((msg, i) => (
                <motion.div 
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.senderId === auth.currentUser?.uid ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[70%] space-y-1 ${msg.senderId === auth.currentUser?.uid ? 'items-end' : 'items-start'}`}>
                    <div className={`p-4 rounded-3xl text-sm font-medium ${
                      msg.senderId === auth.currentUser?.uid 
                        ? 'bg-purple-600 text-white rounded-tr-none shadow-lg shadow-purple-500/20' 
                        : 'bg-slate-800 text-slate-200 rounded-tl-none border border-white/5'
                    }`}>
                      {msg.text}
                    </div>
                    <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-2">
                      {msg.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Input Bar */}
            <div className="p-6 bg-slate-900/40 border-t border-white/5">
              <div className="flex items-center gap-4 bg-slate-800/50 border border-white/5 rounded-[24px] p-2 pl-6">
                <input 
                  type="text" 
                  placeholder="Type a message..." 
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  className="flex-1 bg-transparent border-none outline-none text-sm text-white placeholder:text-slate-500"
                />
                <div className="flex items-center gap-1">
                  <button className="p-3 hover:bg-white/5 rounded-xl transition-all text-slate-400 hover:text-white">
                    <Paperclip className="w-5 h-5" />
                  </button>
                  <button className="p-3 hover:bg-white/5 rounded-xl transition-all text-slate-400 hover:text-white">
                    <Mic className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={sendMessage}
                    className="bg-purple-600 p-3 rounded-xl text-white shadow-lg shadow-purple-500/20 hover:bg-purple-500 transition-all active:scale-95"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12 space-y-6">
            <div className="w-24 h-24 bg-slate-800 rounded-[40px] flex items-center justify-center border border-white/5">
              <MessageSquare className="w-10 h-10 text-slate-600" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-white tracking-tighter">Omareyah Hub</h2>
              <p className="text-slate-500 text-sm max-w-xs mx-auto font-medium">
                Search for a student or teacher by their unique OM-ID to start a real-time conversation.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CommunicationHub;
