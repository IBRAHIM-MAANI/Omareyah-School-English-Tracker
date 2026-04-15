import React, { useState, useEffect, useRef, useCallback } from "react";
import { 
  db, 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  limit, 
  addDoc, 
  serverTimestamp, 
  auth,
  handleFirestoreError,
  OperationType,
  doc,
  deleteDoc,
  setDoc
} from "../firebase";
import { 
  Brain, 
  Lock, 
  Plus, 
  Trash2, 
  CheckCircle, 
  Loader2, 
  MessageSquare, 
  Sparkles, 
  RefreshCw,
  ChevronRight,
  ShieldAlert,
  Key,
  Settings as SettingsIcon,
  Save
} from "lucide-react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "motion/react";

const PAGE_SIZE = 20;

export default function CalibrationRoom() {
  const [unlocked, setUnlocked] = useState(false);
  const [activeTab, setActiveTab] = useState("rules");
  const [rules, setRules] = useState<any[]>([]);
  const [gradingConfig, setGradingConfig] = useState<any>({
    A1: 40,
    A2: 50,
    B1: 60,
    B2: 70,
    C1: 80
  });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // 1. Initial Load from Firebase
  useEffect(() => {
    if (unlocked) {
      fetchRules();
      fetchGradingConfig();
    }
  }, [unlocked]);

  const fetchGradingConfig = async () => {
    try {
      const snapshot = await getDocs(query(collection(db, 'configs'), where('type', '==', 'grading')));
      if (!snapshot.empty) {
        setGradingConfig(snapshot.docs[0].data().levels);
      }
    } catch (err) {
      console.error("Error fetching grading config:", err);
    }
  };

  const saveGradingConfig = async (newLevels: any) => {
    try {
      const q = query(collection(db, 'configs'), where('type', '==', 'grading'));
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        await addDoc(collection(db, 'configs'), {
          type: 'grading',
          levels: newLevels,
          updatedAt: serverTimestamp()
        });
      } else {
        await setDoc(doc(db, 'configs', snapshot.docs[0].id), {
          type: 'grading',
          levels: newLevels,
          updatedAt: serverTimestamp()
        });
      }
      setGradingConfig(newLevels);
    } catch (err) {
      console.error("Error saving grading config:", err);
    }
  };

  const fetchRules = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'logs'), 
        where('action_type', '==', 'calibration_rule'), 
        orderBy('timestamp', 'desc')
      );
      const snapshot = await getDocs(q);
      setRules(snapshot.docs.map(doc => ({ id: doc.id, text: doc.data().action })));
    } catch (err) {
      console.error("Error fetching rules:", err);
    } finally {
      setLoading(false);
    }
  };

  const saveRuleToBackend = async (text: string) => {
    if (!auth.currentUser) return;
    try {
      const docRef = await addDoc(collection(db, 'logs'), {
        action: text,
        action_type: "calibration_rule",
        userId: auth.currentUser.uid,
        userName: auth.currentUser.displayName || auth.currentUser.email,
        timestamp: serverTimestamp(),
        metadata: JSON.stringify({ category: "pedagogy" })
      });
      setRules(prev => [{ id: docRef.id, text }, ...prev]);
    } catch (err) {
      console.error("Error saving rule:", err);
    }
  };

  const removeRuleFromBackend = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'logs', id));
      setRules(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      console.error("Error removing rule:", err);
    }
  };

  if (!unlocked) return <PinEntry onUnlock={() => setUnlocked(true)} />;

  return (
    <div className="max-w-5xl mx-auto p-8 min-h-screen space-y-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-violet-600 rounded-[24px] flex items-center justify-center shadow-2xl shadow-violet-500/20 border border-violet-400/30">
            <Brain className="text-white w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tighter">Calibration Room</h1>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-1">Fine-tuning the Gemini AI Grading Engine</p>
          </div>
        </div>
        <div className="px-6 py-3 bg-emerald-500/10 text-emerald-400 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-emerald-500/20 flex items-center gap-3">
          <Lock size={14} /> SYSTEM UNLOCKED
        </div>
      </div>

      {/* Navigation */}
      <div className="flex p-1.5 bg-slate-900/40 border border-white/5 rounded-[24px] w-fit overflow-x-auto">
        <TabButton active={activeTab === "rules"} onClick={() => setActiveTab("rules")} icon={<Sparkles size={16}/>} label="AI Rules" />
        <TabButton active={activeTab === "criteria"} onClick={() => setActiveTab("criteria")} icon={<SettingsIcon size={16}/>} label="Grading Criteria" />
        <TabButton active={activeTab === "audit"} onClick={() => setActiveTab("audit")} icon={<MessageSquare size={16}/>} label="Score Audit" />
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "audit" ? (
          <motion.div
            key="audit"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <PaginatedScoreAudit gradingConfig={gradingConfig} />
          </motion.div>
        ) : activeTab === "criteria" ? (
          <motion.div
            key="criteria"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <GradingCriteriaManager 
              config={gradingConfig} 
              onSave={saveGradingConfig} 
            />
          </motion.div>
        ) : (
          <motion.div 
            key="rules"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            <RuleManager 
              title="🧠 Active AI Logic" 
              description="High-level pedagogical constraints for the LLM."
              items={rules} 
              onAdd={saveRuleToBackend} 
              onRemove={removeRuleFromBackend}
              loading={loading}
            />
            
            <button 
              onClick={() => {
                setSyncing(true);
                setTimeout(() => setSyncing(false), 2000);
              }}
              disabled={syncing}
              className="w-full py-5 bg-white text-slate-900 rounded-[24px] font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-100 transition-all flex items-center justify-center gap-4 shadow-2xl shadow-white/5 disabled:opacity-50"
            >
              {syncing ? <Loader2 className="animate-spin w-5 h-5" /> : <RefreshCw size={20} />}
              Synchronize Calibration with Gemini
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PinEntry({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === "1234") {
      onUnlock();
    } else {
      setError(true);
      setPin("");
      setTimeout(() => setError(false), 2000);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-slate-900/40 backdrop-blur-2xl p-12 rounded-[48px] border border-white/5 shadow-2xl space-y-10 text-center"
      >
        <div className="w-20 h-20 bg-violet-500/10 rounded-[32px] flex items-center justify-center mx-auto border border-violet-500/20">
          <Key className="w-10 h-10 text-violet-500" />
        </div>
        <div className="space-y-2">
          <h2 className="text-3xl font-black text-white tracking-tighter">Restricted Access</h2>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Enter Calibration PIN to proceed</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <input 
            type="password"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="••••"
            className={`w-full bg-slate-950 border ${error ? 'border-rose-500 shadow-rose-500/20' : 'border-white/5'} rounded-3xl px-6 py-5 text-center text-4xl font-black tracking-[0.5em] text-white outline-none focus:border-violet-500 transition-all placeholder:text-slate-800`}
          />
          {error && (
            <p className="text-rose-500 text-[10px] font-black uppercase tracking-widest animate-bounce">Invalid PIN Code</p>
          )}
          <button 
            type="submit"
            className="w-full py-5 bg-violet-600 hover:bg-violet-500 text-white rounded-3xl font-black text-xs uppercase tracking-[0.3em] transition-all shadow-xl shadow-violet-500/20"
          >
            Unlock System
          </button>
        </form>

        <div className="flex items-center gap-3 justify-center text-slate-600">
          <ShieldAlert size={14} />
          <p className="text-[9px] font-black uppercase tracking-widest">Encrypted Session</p>
        </div>
      </motion.div>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: any) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-3 px-8 py-3.5 rounded-[20px] transition-all duration-300 ${
        active 
          ? 'bg-white text-slate-900 shadow-xl' 
          : 'text-slate-500 hover:text-white hover:bg-white/5'
      }`}
    >
      {React.cloneElement(icon, { className: active ? 'text-violet-600' : 'text-slate-500' })}
      <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
    </button>
  );
}

function GradingCriteriaManager({ config, onSave }: any) {
  const [localConfig, setLocalConfig] = useState(config);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  const handleSave = async () => {
    setSaving(true);
    await onSave(localConfig);
    setSaving(false);
  };

  const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1"];
  const COLORS: any = {
    A1: "text-rose-400 border-rose-500/20 bg-rose-500/5",
    A2: "text-orange-400 border-orange-500/20 bg-orange-500/5",
    B1: "text-amber-400 border-amber-500/20 bg-amber-500/5",
    B2: "text-emerald-400 border-emerald-500/20 bg-emerald-500/5",
    C1: "text-violet-400 border-violet-500/20 bg-violet-500/5"
  };

  return (
    <div className="bg-slate-900/40 rounded-[40px] border border-white/5 p-10 space-y-10 shadow-2xl">
      <div className="flex justify-between items-end">
        <div className="space-y-2">
          <h3 className="text-xl font-black text-white tracking-tight">Grading Criteria</h3>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Define passing scores for each CEFR level</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-3 px-8 py-4 bg-violet-600 hover:bg-violet-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-xl shadow-violet-500/20 disabled:opacity-50"
        >
          {saving ? <Loader2 className="animate-spin w-4 h-4" /> : <Save size={16} />}
          Save Criteria
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {CEFR_LEVELS.map(level => (
          <div key={level} className={`p-8 rounded-[32px] border ${COLORS[level]} space-y-6 transition-all hover:scale-[1.02]`}>
            <div className="flex justify-between items-center">
              <span className="text-2xl font-black tracking-tighter">{level}</span>
              <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Passing Score</span>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-end justify-between">
                <span className="text-4xl font-black tracking-tighter">{localConfig[level]}</span>
                <span className="text-xs font-bold opacity-40 mb-1">/ 100</span>
              </div>
              
              <input 
                type="range"
                min="0"
                max="100"
                value={localConfig[level]}
                onChange={(e) => setLocalConfig({ ...localConfig, [level]: parseInt(e.target.value) })}
                className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-white"
              />
            </div>

            <p className="text-[9px] font-medium opacity-50 leading-relaxed italic">
              Students at {level} level must achieve at least {localConfig[level]}% to pass their assessments.
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function RuleManager({ title, description, items, onAdd, onRemove, loading }: any) {
  const [newRule, setNewRule] = useState("");

  const handleAdd = () => {
    if (newRule.trim()) {
      onAdd(newRule.trim());
      setNewRule("");
    }
  };

  return (
    <div className="bg-slate-900/40 rounded-[40px] border border-white/5 p-10 space-y-8 shadow-2xl">
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <h3 className="text-xl font-black text-white tracking-tight">{title}</h3>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">{description}</p>
        </div>
      </div>

      <div className="flex gap-4">
        <input 
          value={newRule}
          onChange={(e) => setNewRule(e.target.value)}
          placeholder="Add new calibration logic..."
          className="flex-1 bg-slate-950 border border-white/5 rounded-2xl px-6 py-4 text-sm font-medium text-white outline-none focus:border-violet-500 transition-all"
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <button 
          onClick={handleAdd}
          className="px-8 bg-violet-600 hover:bg-violet-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-violet-500/20"
        >
          Add Rule
        </button>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="py-12 flex justify-center">
            <Loader2 className="animate-spin text-violet-500" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-slate-700 font-black uppercase tracking-[0.4em] text-[10px]">
            No active rules found
          </div>
        ) : (
          items.map((item: any) => (
            <motion.div 
              key={item.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center justify-between bg-white/5 p-5 rounded-2xl border border-white/5 group hover:border-violet-500/30 transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="w-2 h-2 bg-violet-500 rounded-full" />
                <p className="text-sm font-medium text-slate-300">{item.text}</p>
              </div>
              <button 
                onClick={() => onRemove(item.id)}
                className="p-2 text-slate-600 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
              >
                <Trash2 size={16} />
              </button>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}

function PaginatedScoreAudit({ gradingConfig }: any) {
  const [assessments, setAssessments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);

  const loadPage = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'student_records'),
        orderBy('createdAt', 'desc'),
        limit(PAGE_SIZE)
      );
      // Note: For real pagination we'd use startAfter, but keeping it simple for now
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAssessments(prev => p === 0 ? data : [...prev, ...data]);
    } catch (err) {
      console.error("Error loading audit records:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPage(0); }, [loadPage]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4">
        {assessments.map(a => (
          <AuditCard key={a.id} assessment={a} gradingConfig={gradingConfig} />
        ))}
      </div>
      
      {assessments.length > 0 && (
        <button 
          onClick={() => { setPage(p => p + 1); loadPage(page + 1); }}
          className="w-full py-6 bg-slate-900/40 border border-white/5 rounded-[24px] text-slate-500 font-black text-[10px] uppercase tracking-[0.3em] hover:text-white hover:bg-white/5 transition-all"
        >
          {loading ? <Loader2 className="animate-spin mx-auto" /> : "Load More Records"}
        </button>
      )}

      {assessments.length === 0 && !loading && (
        <div className="py-24 text-center text-slate-700 font-black uppercase tracking-[0.4em] text-[10px]">
          No assessment records found for audit
        </div>
      )}
    </div>
  );
}

function AuditCard({ assessment, gradingConfig }: any) {
  const score = parseFloat(assessment.examScore || 0);
  const getScoreColor = (s: number, level: string) => {
    const passing = gradingConfig?.[level] || 60;
    if (s >= passing) return "text-emerald-400";
    if (s >= passing - 10) return "text-blue-400";
    return "text-rose-400";
  };

  return (
    <div className="bg-slate-900/40 rounded-3xl border border-white/5 p-6 flex items-center justify-between hover:border-violet-500/30 transition-all group shadow-xl">
      <div className="flex items-center gap-6">
        <div className={`w-14 h-14 rounded-2xl bg-white/5 flex flex-col items-center justify-center border border-white/5 ${getScoreColor(score, assessment.overallLevel)}`}>
          <span className="text-lg font-black">{score.toFixed(0)}</span>
          <span className="text-[8px] font-black uppercase tracking-tighter opacity-60">Score</span>
        </div>
        <div>
          <h4 className="text-sm font-black text-white group-hover:text-violet-400 transition-colors">{assessment.studentName || assessment.studentEmail}</h4>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{assessment.type || 'speaking'}</span>
            <div className="w-1 h-1 bg-slate-700 rounded-full" />
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{assessment.overallLevel}</span>
            <div className="w-1 h-1 bg-slate-700 rounded-full" />
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
              {assessment.createdAt?.toDate ? format(assessment.createdAt.toDate(), "MMM d, HH:mm") : "Archive"}
            </span>
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="text-right hidden md:block">
          <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">AI Confidence</p>
          <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-violet-500" style={{ width: '92%' }} />
          </div>
        </div>
        <button className="p-3 bg-white/5 rounded-xl text-slate-500 hover:text-white hover:bg-white/10 transition-all">
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
