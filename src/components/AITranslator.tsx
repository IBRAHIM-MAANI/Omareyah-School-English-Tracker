import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Languages, 
  ArrowRightLeft, 
  Mic, 
  MicOff, 
  Volume2, 
  Loader2, 
  Copy, 
  Check,
  Info,
  Sparkles,
  Zap
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import ReactMarkdown from 'react-markdown';

const AITranslator: React.FC = () => {
  const [sourceLang, setSourceLang] = useState<'ar' | 'en'>('ar');
  const [inputText, setInputText] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [translation, setTranslation] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleTranslate = async () => {
    if (!inputText.trim()) return;
    setIsTranslating(true);
    setTranslation(null);
    setNotes(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      
      const response = await ai.models.generateContent({ 
        model: "gemini-3.1-flash-lite-preview",
        config: {
          systemInstruction: "You are a professional Arabic-English translator and linguistic expert. Provide a direct translation and a short linguistic note."
        },
        contents: [{ role: 'user', parts: [{ text: `Translate the following ${sourceLang === 'ar' ? 'Arabic' : 'English'} text into ${sourceLang === 'ar' ? 'English' : 'Arabic'}.
      
      Format your response as:
      [TRANSLATION]
      (The translation here)
      [/TRANSLATION]
      [NOTES]
      (The notes here)
      [/NOTES]
      
      Text to translate: "${inputText}"` }] }]
      });

      const text = response.text;

      if (text.includes('[TRANSLATION]')) {
        const trans = text.split('[TRANSLATION]')[1].split('[/TRANSLATION]')[0];
        setTranslation(trans.trim());
      }
      if (text.includes('[NOTES]')) {
        const n = text.split('[NOTES]')[1].split('[/NOTES]')[0];
        setNotes(n.trim());
      }

    } catch (err) {
      console.error(err);
    } finally {
      setIsTranslating(false);
    }
  };

  const swapLanguages = () => {
    setSourceLang(prev => prev === 'ar' ? 'en' : 'ar');
    setInputText('');
    setTranslation(null);
    setNotes(null);
  };

  const copyToClipboard = () => {
    if (translation) {
      navigator.clipboard.writeText(translation);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Languages className="w-7 h-7 text-white" />
            </div>
            AI Translator
          </h1>
          <p className="text-zinc-500 font-bold mt-1">Arabic ⇄ English — with pronunciation & linguistic notes</p>
        </div>
      </div>

      <div className="bg-[#1a1635] border border-white/5 rounded-[2.5rem] p-8 shadow-2xl space-y-8">
        {/* Language Selector */}
        <div className="flex items-center justify-center gap-4">
          <div className={`px-6 py-3 rounded-2xl font-black text-sm transition-all flex items-center gap-2 ${sourceLang === 'ar' ? 'bg-orange-500 text-white' : 'bg-white/5 text-zinc-500'}`}>
            <span className="text-lg">🇸🇦</span> Arabic
          </div>
          
          <button 
            onClick={swapLanguages}
            className="p-3 bg-white/5 hover:bg-white/10 rounded-full text-zinc-400 transition-all border border-white/10"
          >
            <ArrowRightLeft className="w-5 h-5" />
          </button>

          <div className={`px-6 py-3 rounded-2xl font-black text-sm transition-all flex items-center gap-2 ${sourceLang === 'en' ? 'bg-orange-500 text-white' : 'bg-white/5 text-zinc-500'}`}>
            <span className="text-lg">🇬🇧</span> English
          </div>
        </div>

        {/* Input Area */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
              <span className="text-sm">{sourceLang === 'ar' ? '🇸🇦' : '🇬🇧'}</span>
              Enter {sourceLang === 'ar' ? 'Arabic' : 'English'} text
            </label>
          </div>
          <div className="relative group">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={sourceLang === 'ar' ? 'اكتب النص العربي هنا...' : 'Type English text here...'}
              dir={sourceLang === 'ar' ? 'rtl' : 'ltr'}
              className="w-full bg-black/20 border border-white/10 rounded-3xl px-8 py-6 text-white text-xl font-medium focus:ring-2 focus:ring-orange-500 outline-none min-h-[180px] transition-all resize-none custom-scrollbar"
            />
            <div className="absolute bottom-4 right-4 flex gap-2">
              <button 
                onClick={() => setIsListening(!isListening)}
                className={`p-3 rounded-2xl transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-white/5 text-zinc-400 hover:bg-white/10'}`}
              >
                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        <button 
          onClick={handleTranslate}
          disabled={isTranslating || !inputText.trim()}
          className="w-full py-5 bg-orange-500 hover:bg-orange-400 text-white font-black rounded-3xl transition-all flex items-center justify-center gap-3 shadow-lg shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed group"
        >
          {isTranslating ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <>
              <Sparkles className="w-6 h-6 group-hover:rotate-12 transition-transform" />
              Translate
            </>
          )}
        </button>

        {/* Results Area */}
        <AnimatePresence>
          {translation && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="space-y-6 pt-8 border-t border-white/5"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                    <span className="text-sm">{sourceLang === 'ar' ? '🇬🇧' : '🇸🇦'}</span>
                    Translation
                  </label>
                  <button 
                    onClick={copyToClipboard}
                    className="p-2 text-zinc-500 hover:text-white transition-colors flex items-center gap-2 text-xs font-bold"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <div className="bg-black/40 border border-white/5 rounded-3xl p-8">
                  <p className={`text-2xl font-bold text-white leading-relaxed ${sourceLang === 'en' ? 'text-right' : 'text-left'}`} dir={sourceLang === 'en' ? 'rtl' : 'ltr'}>
                    {translation}
                  </p>
                </div>
              </div>

              {notes && (
                <div className="bg-blue-500/5 border border-blue-500/10 rounded-3xl p-6 space-y-3">
                  <h3 className="text-xs font-black text-blue-400 uppercase tracking-widest flex items-center gap-2">
                    <Info className="w-4 h-4" />
                    Linguistic Note
                  </h3>
                  <div className="text-zinc-300 text-sm leading-relaxed prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown>{notes}</ReactMarkdown>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Tips */}
      <div className="bg-orange-500/5 border border-orange-500/10 rounded-3xl p-6 space-y-4">
        <h3 className="text-sm font-black text-orange-400 flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          Tips for Better Translation
        </h3>
        <ul className="space-y-2 text-zinc-400 text-sm font-medium">
          <li className="flex items-center gap-2">
            <div className="w-1 h-1 bg-orange-500 rounded-full"></div>
            Write complete sentences for better context
          </li>
          <li className="flex items-center gap-2">
            <div className="w-1 h-1 bg-orange-500 rounded-full"></div>
            Use the <Volume2 className="w-4 h-4 inline" /> button to hear pronunciation after translating
          </li>
          <li className="flex items-center gap-2">
            <div className="w-1 h-1 bg-orange-500 rounded-full"></div>
            Use the swap button to reverse translation direction
          </li>
        </ul>
      </div>
    </div>
  );
};

export default AITranslator;
