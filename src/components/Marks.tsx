import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { 
  db, 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  limit, 
  startAfter, 
  updateDoc, 
  doc, 
  addDoc, 
  serverTimestamp, 
  auth,
  handleFirestoreError,
  OperationType
} from "../firebase";
import { Search, Mic, BookOpen, Pencil, Check, X, Brain, Loader2, Sparkles, ClipboardList, CheckSquare, Square } from "lucide-react";
import { format } from "date-fns";
import debounce from "lodash/debounce";
import ReportExportManager from "./ReportExportManager";

const CEFR_COLORS: Record<string, string> = { 
  A1: "bg-red-100 text-red-700", 
  A2: "bg-orange-100 text-orange-700", 
  B1: "bg-yellow-100 text-yellow-700", 
  B2: "bg-green-100 text-green-700", 
  C1: "bg-violet-100 text-violet-700",
  C2: "bg-purple-100 text-purple-700"
};
const PAGE_SIZE = 30;

export default function Marks() {
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [assessments, setAssessments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastDoc, setLastDoc] = useState<any>(null);

  // Filters & UI State
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [cefrFilter, setCefrFilter] = useState("all");
  const [selected, setSelected] = useState<any>(null);
  const [selectedAssessments, setSelectedAssessments] = useState<any[]>([]);
  const [gradingConfig, setGradingConfig] = useState<any>({
    A1: 40, A2: 50, B1: 60, B2: 70, C1: 80
  });
  
  // Override State
  const [editingScore, setEditingScore] = useState(false);
  const [newScore, setNewScore] = useState("");
  const [overrideNote, setOverrideNote] = useState("");
  const [saving, setSaving] = useState(false);

  const observer = useRef<IntersectionObserver | null>(null);

  // 1. Fetching Logic (Firestore)
  const fetchMarks = useCallback(async (isNewSearch = false) => {
    if (!auth.currentUser) return;
    setLoading(true);

    try {
      const isAdmin = userRole === "admin";
      let q = query(
        collection(db, 'student_records'),
        orderBy('createdAt', 'desc'),
        limit(PAGE_SIZE)
      );

      if (!isAdmin) {
        q = query(q, where('teacherId', '==', auth.currentUser.uid));
      }

      if (typeFilter !== "all") {
        q = query(q, where('type', '==', typeFilter));
      }

      if (cefrFilter !== "all") {
        q = query(q, where('overallLevel', '==', cefrFilter));
      }

      if (!isNewSearch && lastDoc) {
        q = query(q, startAfter(lastDoc));
      }

      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      
      // Client-side search for student name (Firestore doesn't support icontains easily without extra indexing)
      let filteredData = data;
      if (search) {
        filteredData = data.filter(a => 
          (a.studentEmail || "").toLowerCase().includes(search.toLowerCase()) ||
          (a.studentName || "").toLowerCase().includes(search.toLowerCase())
        );
      }

      setAssessments(prev => isNewSearch ? filteredData : [...prev, ...filteredData]);
      setHasMore(snapshot.docs.length === PAGE_SIZE);
      setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
    } catch (err) {
      console.error("Fetch error:", err);
      handleFirestoreError(err, OperationType.GET, 'student_records');
    } finally {
      setLoading(false);
    }
  }, [userRole, typeFilter, cefrFilter, lastDoc, search]);

  // 2. Debounced filter handlers
  const debouncedSearch = useMemo(() => 
    debounce(() => {
      setLastDoc(null);
      fetchMarks(true);
    }, 400), [fetchMarks]
  );

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (u) => {
      setUser(u);
      if (u) {
        const userDoc = await getDocs(query(collection(db, 'users'), where('uid', '==', u.uid)));
        if (!userDoc.empty) {
          setUserRole(userDoc.docs[0].data().role);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (userRole) debouncedSearch();
  }, [search, typeFilter, cefrFilter, userRole, debouncedSearch]);

  // 3. Infinite Scroll Observer
  const lastElementRef = useCallback((node: any) => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        fetchMarks();
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, hasMore, fetchMarks]);

  const normalize = (v: number) => v == null ? 0 : v > 100 ? 100 : v < 0 ? 0 : parseFloat(v.toFixed(1));

  const saveOverride = async () => {
    if (!selected || newScore === "" || !auth.currentUser) return;
    setSaving(true);
    const fixed = normalize(parseFloat(newScore));
    
    try {
      await updateDoc(doc(db, 'student_records', selected.id), { 
        examScore: fixed.toString(),
        overallScore: fixed // Keep both for compatibility
      });

      await addDoc(collection(db, 'logs'), {
        userId: auth.currentUser.uid,
        userName: auth.currentUser.displayName || auth.currentUser.email,
        userRole: userRole,
        action: 'override_score',
        details: `Teacher Override: ${selected.studentEmail} (${selected.examScore || 0} → ${fixed}). Note: ${overrideNote}`,
        timestamp: serverTimestamp(),
        studentId: selected.studentId
      });

      setAssessments(prev => prev.map(a => a.id === selected.id ? { ...a, examScore: fixed.toString() } : a));
      setSelected(prev => ({ ...prev, examScore: fixed.toString() }));
      setEditingScore(false);
      setOverrideNote("");
    } catch (err) {
      console.error("Override save error:", err);
      handleFirestoreError(err, OperationType.UPDATE, 'student_records');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const snapshot = await getDocs(query(collection(db, 'configs'), where('type', '==', 'grading')));
        if (!snapshot.empty) {
          setGradingConfig(snapshot.docs[0].data().levels);
        }
      } catch (err) {
        console.error("Error fetching grading config:", err);
      }
    };
    fetchConfig();
  }, []);

  const getScoreColor = (score: any, level?: string) => {
    const val = parseFloat(score || 0);
    const passingScore = level && gradingConfig[level] ? gradingConfig[level] : 60;
    
    if (val >= passingScore) return "text-emerald-400 bg-emerald-500/10";
    if (val >= passingScore - 10) return "text-blue-400 bg-blue-500/10";
    return "text-rose-400 bg-rose-500/10";
  };

  const toggleSelection = (e: React.MouseEvent, assessment: any) => {
    e.stopPropagation();
    setSelectedAssessments(prev => {
      const exists = prev.find(a => a.id === assessment.id);
      if (exists) return prev.filter(a => a.id !== assessment.id);
      return [...prev, assessment];
    });
  };

  const isSelected = (id: string) => selectedAssessments.some(a => a.id === id);

  return (
    <div className="max-w-[1600px] mx-auto p-8 min-h-screen space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tighter flex items-center gap-3">
            <ClipboardList className="w-10 h-10 text-indigo-500" />
            Marks & Grading
          </h1>
          <p className="text-slate-500 flex items-center gap-2 mt-2 font-black uppercase tracking-widest text-[10px]">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            Syncing teacher overrides with Gemini AI weights
          </p>
        </div>
      </div>

      <div className="sticky top-0 z-20 bg-[#0f172a]/80 backdrop-blur-xl py-6 flex flex-wrap gap-4 border-b border-white/5">
        <div className="relative flex-1 min-w-[300px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            placeholder="Search student archives..."
            className="w-full pl-12 pr-6 py-4 bg-slate-900/40 border border-white/5 rounded-2xl text-xs font-bold text-white focus:border-indigo-500 outline-none transition-all" 
          />
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="px-6 py-4 bg-slate-900/40 border border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white outline-none focus:border-indigo-500">
          <option value="all" className="bg-slate-900">All Modes</option>
          <option value="speaking" className="bg-slate-900">Speaking</option>
          <option value="reading" className="bg-slate-900">Reading</option>
        </select>
        <select value={cefrFilter} onChange={e => setCefrFilter(e.target.value)} className="px-6 py-4 bg-slate-900/40 border border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white outline-none focus:border-indigo-500">
          <option value="all" className="bg-slate-900">All Levels</option>
          {["A1","A2","B1","B2","C1","C2"].map(l => <option key={l} value={l} className="bg-slate-900">{l}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Table Section */}
        <div className="lg:col-span-7 bg-slate-900/40 rounded-[40px] border border-white/5 shadow-2xl overflow-hidden h-fit">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-800/50 border-b border-white/5">
                <tr>
                  <th className="px-8 py-6 w-10">
                    <div className="w-5 h-5 border border-white/10 rounded flex items-center justify-center">
                      <Square className="w-3 h-3 text-slate-700" />
                    </div>
                  </th>
                  {["Student", "Type", "Score", "Level"].map(h => (
                    <th key={h} className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {assessments.map((a, index) => (
                  <tr 
                    key={a.id} 
                    ref={index === assessments.length - 1 ? lastElementRef : null}
                    onClick={() => setSelected(a)}
                    className={`group cursor-pointer transition-all ${selected?.id === a.id ? "bg-indigo-500/10" : "hover:bg-white/5"}`}
                  >
                    <td className="px-8 py-6" onClick={(e) => toggleSelection(e, a)}>
                      <div className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all ${isSelected(a.id) ? 'bg-indigo-600 border-indigo-500' : 'border-white/10 hover:border-white/30'}`}>
                        {isSelected(a.id) && <CheckSquare className="w-4 h-4 text-white" />}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="font-black text-white text-sm group-hover:text-indigo-400 transition-colors">{a.studentName || a.studentEmail}</div>
                      <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest mt-1">
                        {a.createdAt?.toDate ? format(a.createdAt.toDate(), "MMM d, yyyy") : "Archive"}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className={`text-[9px] px-3 py-1 rounded-lg font-black uppercase tracking-widest border ${a.type === 'speaking' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-orange-500/10 text-orange-400 border-orange-500/20'}`}>
                        {a.type || 'speaking'}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <span className={`text-xs font-black px-3 py-1 rounded-lg border ${getScoreColor(a.examScore, a.overallLevel)}`}>
                        {parseFloat(a.examScore || 0).toFixed(1)}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                       <span className={`text-[9px] font-black px-3 py-1 rounded-lg border uppercase tracking-widest ${CEFR_COLORS[a.overallLevel] || 'bg-slate-800 text-slate-400 border-white/5'}`}>
                        {a.overallLevel}
                       </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {loading && (
            <div className="p-12 flex justify-center border-t border-white/5">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
          )}
          {!loading && assessments.length === 0 && (
            <div className="p-20 text-center text-slate-600 font-black uppercase tracking-[0.4em]">
              No assessment records found
            </div>
          )}
        </div>

        {/* Detail/Override Panel */}
        <div className="lg:col-span-5">
          {!selected ? (
            <div className="bg-slate-900/20 border-2 border-dashed border-white/5 rounded-[40px] p-24 text-center sticky top-32 flex flex-col items-center gap-4">
              <ClipboardList className="w-12 h-12 text-slate-800" />
              <p className="text-slate-600 font-black uppercase tracking-widest text-[10px]">Select a record to view breakdown</p>
            </div>
          ) : (
            <div className="bg-slate-900/40 rounded-[40px] border border-white/5 p-10 sticky top-32 shadow-2xl shadow-indigo-500/5 max-h-[calc(100vh-160px)] overflow-y-auto custom-scrollbar space-y-10">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <h2 className="text-2xl font-black text-white tracking-tighter">{selected.studentName || selected.studentEmail}</h2>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{selected.toolId} • {selected.overallLevel} LEVEL</p>
                </div>
                
                <div className="text-right">
                  {!editingScore ? (
                    <div className="flex flex-col items-end gap-3">
                      <div className={`text-4xl font-black px-6 py-3 rounded-3xl border ${getScoreColor(selected.examScore, selected.overallLevel)}`}>
                        {parseFloat(selected.examScore || 0).toFixed(1)}
                      </div>
                      <button onClick={() => { setEditingScore(true); setNewScore(selected.examScore || "0"); }} className="text-[10px] font-black text-indigo-400 hover:text-indigo-300 flex items-center gap-2 uppercase tracking-widest transition-colors">
                        <Pencil size={12} /> Override Score
                      </button>
                    </div>
                  ) : (
                    <div className="bg-indigo-500/10 p-6 rounded-3xl border border-indigo-500/20 animate-in zoom-in-95 space-y-4">
                       <div className="flex items-center gap-3">
                          <input 
                            type="number" step="0.1" value={newScore} 
                            onChange={e => setNewScore(e.target.value)}
                            className="w-20 p-3 bg-slate-900 rounded-xl border border-white/10 focus:border-indigo-500 outline-none font-black text-center text-white"
                          />
                          <button onClick={saveOverride} disabled={saving} className="p-3 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-500/20 hover:bg-indigo-500 transition-all">
                             {saving ? <Loader2 className="animate-spin w-5 h-5" /> : <Check size={20} />}
                          </button>
                          <button onClick={() => setEditingScore(false)} className="p-3 bg-white/5 text-slate-400 rounded-xl hover:text-white transition-all">
                             <X size={20} />
                          </button>
                       </div>
                       <input 
                        placeholder="Explain reason to Gemini..." 
                        value={overrideNote} 
                        onChange={e => setOverrideNote(e.target.value)}
                        className="w-full text-[10px] p-3 bg-slate-900 rounded-xl border border-white/10 focus:border-indigo-500 outline-none text-white font-bold"
                       />
                       <p className="text-[9px] font-black text-indigo-400 flex items-center gap-2 uppercase tracking-widest">
                          <Brain size={12} /> Active Learning: AI is observing adjustment
                       </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Sub-scores */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Accuracy", key: "accuracy" },
                  { label: "Fluency", key: "fluency" },
                  { label: "Intonation", key: "intonation" },
                  { label: "Vocabulary", key: "vocabulary" }
                ].map((stat) => (
                  <div key={stat.key} className="bg-white/5 p-5 rounded-3xl border border-white/5 space-y-3">
                    <div className="flex justify-between items-end">
                       <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{stat.label}</span>
                       <span className="text-sm font-black text-white">{(selected.scores?.[stat.key] || 0)}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                       <div className="h-full bg-indigo-500" style={{ width: `${(selected.scores?.[stat.key] || 0)}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Plan & Text */}
              <div className="space-y-6">
                 <div className="p-6 bg-indigo-500/5 rounded-3xl border border-indigo-500/10 space-y-3">
                    <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] flex items-center gap-2">
                       <Sparkles size={14} /> Gemini Improvement Plan
                    </h4>
                    <div className="space-y-2">
                      {(Array.isArray(selected.improvementPlan) ? selected.improvementPlan : [selected.improvementPlan]).map((step, i) => (
                        <p key={i} className="text-xs text-slate-300 leading-relaxed font-medium flex gap-3">
                          <span className="text-indigo-500 font-black">{i + 1}.</span>
                          {step}
                        </p>
                      ))}
                    </div>
                 </div>
                 
                 <div className="p-6 bg-white/5 rounded-3xl border border-white/5 space-y-3">
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Forensic Audit Feedback</h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed italic">"{selected.strengths}"</p>
                 </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <ReportExportManager 
        selectedAssessments={selectedAssessments} 
        onClearSelection={() => setSelectedAssessments([])} 
      />
    </div>
  );
}
