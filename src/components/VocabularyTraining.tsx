import React, { useState } from "react";
import { Loader2, ArrowRight, CheckCircle, Sparkles, Brain, RefreshCw } from "lucide-react";
import { GoogleGenAI } from "@google/genai";
import { motion, AnimatePresence } from "motion/react";

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// The local list acts as a "fallback" or "quick-start" for the UI
const QUICK_UPGRADES = [
  { weak: "good", advanced: "exceptional" },
  { weak: "bad", advanced: "atrocious" },
  { weak: "happy", advanced: "elated" },
  { weak: "important", advanced: "pivotal" },
];

export default function VocabularyTraining() {
  const [customText, setCustomText] = useState("");
  const [suggestions, setSuggestions] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // AI Quiz State
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizWord, setQuizWord] = useState<any>(null);
  const [quizInput, setQuizInput] = useState("");
  const [quizResult, setQuizResult] = useState<any>(null);

  /**
   * AI Analysis: Boost existing text
   */
  const analyseText = async () => {
    if (!customText.trim()) return;
    setLoading(true);
    try {
      const prompt = `Analyse this text and identify 5 basic words to replace with C1/C2 level alternatives.
      Text: "${customText}"
      Return a JSON object with this structure:
      {
        "suggestions": [
          {
            "original": "string",
            "suggested": "string",
            "definition": "string",
            "example": "string"
          }
        ],
        "overall_feedback": "string"
      }`;

      const result = await genAI.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }]
      });
      const text = result.text;
      // Extract JSON from markdown code block if present
      const jsonStr = text.replace(/```json|```/g, "").trim();
      setSuggestions(JSON.parse(jsonStr));
    } catch (err) {
      console.error("AI Analysis error:", err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * AI Quiz: Generate a random challenge from Gemini
   */
  const generateAIQuiz = async () => {
    setQuizLoading(true);
    setQuizResult(null);
    setQuizInput("");
    
    try {
      const prompt = `Generate a vocabulary quiz challenge. Provide 1 common/basic English word and 3 advanced (C1/C2) synonyms for it.
      Return a JSON object with this structure:
      {
        "weak": "string",
        "advanced_options": ["string", "string", "string"],
        "hint": "string"
      }`;

      const result = await genAI.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }]
      });
      const text = result.text;
      const jsonStr = text.replace(/```json|```/g, "").trim();
      setQuizWord(JSON.parse(jsonStr));
    } catch (err) {
      console.error("AI Quiz generation error:", err);
    } finally {
      setQuizLoading(false);
    }
  };

  const checkAIQuiz = () => {
    if (!quizWord) return;
    const isCorrect = quizWord.advanced_options.some(
      (a: string) => a.toLowerCase().trim() === quizInput.toLowerCase().trim()
    );
    setQuizResult({
      correct: isCorrect,
      alternatives: quizWord.advanced_options
    });
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-10">
      {/* Header */}
      <header className="space-y-2">
        <h1 className="text-4xl font-black text-white tracking-tighter flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-500/20">
            <Brain className="text-amber-500 w-7 h-7" />
          </div>
          Vocab Labs
        </h1>
        <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] ml-1">
          Precision vocabulary upgrades powered by Gemini AI
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Left Column: Booster */}
        <div className="lg:col-span-3 space-y-6">
          <section className="bg-slate-900/40 rounded-[40px] border border-white/5 p-8 shadow-2xl space-y-6">
            <div className="flex items-center gap-3 text-amber-500">
              <Sparkles size={18} />
              <h2 className="font-black uppercase tracking-widest text-[10px]">AI Text Booster</h2>
            </div>
            
            <textarea 
              value={customText} 
              onChange={e => setCustomText(e.target.value)} 
              rows={6}
              placeholder="Paste your draft here..."
              className="w-full px-6 py-4 bg-slate-900/50 border border-white/5 rounded-3xl text-sm font-medium text-white outline-none focus:border-amber-500 transition-all resize-none leading-relaxed" 
            />
            
            <button 
              onClick={analyseText} 
              disabled={loading || !customText.trim()}
              className="w-full py-4 bg-amber-600 hover:bg-amber-500 disabled:opacity-30 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-3"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Analyse & Upgrade"}
            </button>

            <AnimatePresence>
              {suggestions && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-8 space-y-4"
                >
                  {suggestions.suggestions?.map((s: any, i: number) => (
                    <motion.div 
                      key={i} 
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="group flex items-start gap-6 bg-white/5 rounded-3xl p-6 border border-white/5 hover:border-amber-500/30 transition-all"
                    >
                      <div className="flex flex-col items-center min-w-[80px]">
                         <span className="text-[10px] font-black text-rose-400/50 line-through uppercase tracking-tighter">{s.original}</span>
                         <ArrowRight size={14} className="text-slate-600 my-2" />
                         <span className="text-sm font-black text-emerald-400 uppercase tracking-tight">{s.suggested}</span>
                      </div>
                      <div className="flex-1 border-l border-white/5 pl-6 space-y-2">
                        <p className="text-xs text-slate-300 leading-relaxed font-medium">{s.definition}</p>
                        <p className="text-[10px] text-slate-500 italic group-hover:text-slate-400 transition-colors">"{s.example}"</p>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        </div>

        {/* Right Column: AI Quiz & Reference */}
        <div className="lg:col-span-2 space-y-6">
          {/* AI-Generated Quiz */}
          <section className="bg-indigo-600 rounded-[40px] p-8 text-white shadow-2xl shadow-indigo-500/20 space-y-8">
            <div className="flex justify-between items-center">
              <h2 className="font-black uppercase tracking-widest text-[10px] opacity-80">Daily Challenge</h2>
              <button 
                onClick={generateAIQuiz} 
                className="p-3 bg-indigo-500 hover:bg-indigo-400 rounded-2xl transition-all border border-indigo-400/30"
                title="New Word"
              >
                <RefreshCw size={16} className={quizLoading ? "animate-spin" : ""} />
              </button>
            </div>

            {!quizWord ? (
              <div className="text-center py-12 space-y-4">
                <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto border border-white/10">
                  <Brain className="w-8 h-8 opacity-40" />
                </div>
                <button 
                  onClick={generateAIQuiz} 
                  className="px-8 py-3 bg-white text-indigo-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-transform shadow-xl"
                >
                  Start AI Quiz
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-indigo-700/50 rounded-3xl p-8 text-center border border-indigo-400/30 space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Advanced alternative for:</p>
                  <p className="text-4xl font-black italic tracking-tighter">"{quizWord.weak}"</p>
                  {quizWord.hint && (
                    <div className="mt-4 px-4 py-2 bg-indigo-500/50 rounded-xl inline-block">
                      <p className="text-[10px] font-bold italic">Hint: {quizWord.hint}</p>
                    </div>
                  )}
                </div>

                {!quizResult ? (
                  <div className="space-y-4">
                    <input 
                      value={quizInput} 
                      onChange={e => setQuizInput(e.target.value)}
                      placeholder="Type advanced word..."
                      className="w-full px-6 py-4 bg-white/10 border border-white/20 rounded-2xl text-sm font-bold placeholder:text-indigo-300 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all"
                      onKeyDown={e => e.key === "Enter" && checkAIQuiz()}
                    />
                    <button 
                      onClick={checkAIQuiz}
                      disabled={!quizInput.trim()}
                      className="w-full py-4 bg-white text-indigo-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-50 transition-all disabled:opacity-50 shadow-xl"
                    >
                      Check Answer
                    </button>
                  </div>
                ) : (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`p-6 rounded-3xl border ${quizResult.correct ? "bg-emerald-500/20 border-emerald-400/30" : "bg-rose-500/20 border-rose-400/30"} space-y-4`}
                  >
                    <div className="flex items-center gap-3">
                      {quizResult.correct ? <CheckCircle size={24} className="text-emerald-400" /> : <RefreshCw size={24} className="text-rose-400" />}
                      <p className="font-black text-sm uppercase tracking-widest">
                        {quizResult.correct ? "Spot on!" : "Nice try!"}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Valid options:</p>
                      <div className="flex flex-wrap gap-2">
                        {quizResult.alternatives.map((alt: string) => (
                          <span key={alt} className="px-3 py-1 bg-white/10 rounded-lg text-xs font-bold">{alt}</span>
                        ))}
                      </div>
                    </div>
                    <button 
                      onClick={generateAIQuiz} 
                      className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-white/10"
                    >
                      Next Challenge
                    </button>
                  </motion.div>
                )}
              </div>
            )}
          </section>

          {/* Quick Ref */}
          <section className="bg-slate-900/40 rounded-[40px] p-8 border border-white/5 space-y-6">
            <h2 className="font-black text-slate-500 text-[10px] uppercase tracking-widest ml-1">Quick Upgrades</h2>
            <div className="space-y-3">
              {QUICK_UPGRADES.map(item => (
                <div key={item.weak} className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/5 group hover:border-indigo-500/30 transition-all">
                  <span className="text-xs font-bold text-slate-600 line-through uppercase tracking-tighter">{item.weak}</span>
                  <ArrowRight size={14} className="text-slate-700 group-hover:text-indigo-500 transition-colors" />
                  <span className="text-xs font-black text-indigo-400 uppercase tracking-tight">{item.advanced}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
