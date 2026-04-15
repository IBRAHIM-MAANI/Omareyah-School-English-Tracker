import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bot, 
  Send, 
  User, 
  Loader2, 
  Sparkles, 
  Mic, 
  MicOff,
  Trash2,
  MessageSquare,
  Search,
  BrainCircuit,
  Zap
} from 'lucide-react';
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import ReactMarkdown from 'react-markdown';

interface Message {
  id: string;
  text: string;
  isModel: boolean;
  timestamp: Date;
  isThinking?: boolean;
}

const LinguisticsBot: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "Hello! I'm your AI Linguistics Bot 🤖 I can help with English grammar, vocabulary, pronunciation, CEFR levels, linguistics concepts, and more. What would you like to know?",
      isModel: true,
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [mode, setMode] = useState<'fast' | 'deep' | 'search'>('fast');
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;
    
    const userMsg: Message = {
      id: Date.now().toString(),
      text: inputText,
      isModel: false,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMsg]);
    const currentInput = inputText;
    setInputText('');
    setIsTyping(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      
      let modelName = "gemini-3.1-flash-lite-preview";
      let config: any = {
        systemInstruction: "You are a professional linguistics expert and English teacher. Answer student questions clearly and accurately. Use examples. If the question is about pronunciation, explain the phonetic breakdown. Keep your tone encouraging and academic yet accessible."
      };
      let tools: any[] = [];

      if (mode === 'deep') {
        modelName = "gemini-3.1-pro-preview";
        config.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
      } else if (mode === 'search') {
        modelName = "gemini-3-flash-preview";
        tools = [{ googleSearch: {} }];
      }

      const history = messages.map(msg => ({
        role: msg.isModel ? 'model' : 'user',
        parts: [{ text: msg.text }]
      }));

      const response = await ai.models.generateContent({
        model: modelName,
        config,
        tools,
        contents: [...history, { role: 'user', parts: [{ text: currentInput }] }]
      } as any);

      const responseText = response.text;

      const modelMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: responseText,
        isModel: true,
        timestamp: new Date(),
        isThinking: mode === 'deep'
      };

      setMessages(prev => [...prev, modelMsg]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, {
        id: 'error',
        text: "Sorry, I encountered an error. Please try again.",
        isModel: true,
        timestamp: new Date()
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const clearChat = () => {
    setMessages([messages[0]]);
  };

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-120px)] flex flex-col space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <div className="w-12 h-12 bg-indigo-500 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Bot className="w-7 h-7 text-white" />
            </div>
            AI Linguistics Bot
          </h1>
          <p className="text-zinc-500 font-bold mt-1">Ask anything about English language, linguistics, or teaching</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5">
            <button 
              onClick={() => setMode('fast')}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${mode === 'fast' ? 'bg-indigo-500 text-white' : 'text-zinc-500 hover:text-white'}`}
            >
              <Zap className="w-3 h-3" /> Fast
            </button>
            <button 
              onClick={() => setMode('deep')}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${mode === 'deep' ? 'bg-indigo-500 text-white' : 'text-zinc-500 hover:text-white'}`}
            >
              <BrainCircuit className="w-3 h-3" /> Deep
            </button>
            <button 
              onClick={() => setMode('search')}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${mode === 'search' ? 'bg-indigo-500 text-white' : 'text-zinc-500 hover:text-white'}`}
            >
              <Search className="w-3 h-3" /> Search
            </button>
          </div>
          <button 
            onClick={clearChat}
            className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl text-zinc-500 hover:text-red-400 transition-all border border-white/5"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 bg-[#1a1635] border border-white/5 rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden">
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar" ref={scrollRef}>
          {messages.map((msg, i) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={`flex items-start gap-4 ${msg.isModel ? 'justify-start' : 'justify-end flex-row-reverse'}`}
            >
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg ${
                msg.isModel ? 'bg-indigo-500 text-white' : 'bg-white/10 text-zinc-300'
              }`}>
                {msg.isModel ? <Bot className="w-5 h-5" /> : <User className="w-5 h-5" />}
              </div>
              <div className={`max-w-[80%] p-6 rounded-3xl space-y-2 ${
                msg.isModel 
                  ? 'bg-white/5 text-zinc-100 border border-white/10 rounded-tl-none' 
                  : 'bg-indigo-500 text-white font-bold rounded-tr-none shadow-lg shadow-indigo-500/20'
              }`}>
                {msg.isThinking && (
                  <div className="flex items-center gap-2 text-[9px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-2">
                    <BrainCircuit className="w-3 h-3" /> Deep Analysis Mode
                  </div>
                )}
                <div className="prose prose-invert prose-sm max-w-none leading-relaxed">
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                </div>
                <p className={`text-[10px] font-black uppercase tracking-widest ${msg.isModel ? 'text-zinc-500' : 'text-indigo-200'}`}>
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </motion.div>
          ))}
          {isTyping && (
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500 flex items-center justify-center text-white">
                <Bot className="w-5 h-5" />
              </div>
              <div className="bg-white/5 border border-white/10 p-4 rounded-3xl rounded-tl-none">
                <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
              </div>
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="p-8 bg-black/20 border-t border-white/5">
          <div className="relative group">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Ask about grammar, pronunciation, CEFR levels..."
              className="w-full bg-black/40 border border-white/10 rounded-3xl px-8 py-5 text-white font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all pr-32"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <button 
                onClick={() => setIsListening(!isListening)}
                className={`p-3 rounded-2xl transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-white/5 text-zinc-500 hover:bg-white/10'}`}
              >
                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
              <button 
                onClick={handleSendMessage}
                disabled={!inputText.trim() || isTyping}
                className="p-3 bg-indigo-500 hover:bg-indigo-400 text-white rounded-2xl transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LinguisticsBot;
