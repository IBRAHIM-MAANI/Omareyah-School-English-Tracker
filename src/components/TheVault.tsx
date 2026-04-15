import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Search, Play, Pause, Download, Loader2, Sparkles, FileAudio, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import debounce from "lodash/debounce";
import { format } from "date-fns";
import { 
  db, 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  limit, 
  startAfter, 
  auth, 
  handleFirestoreError, 
  OperationType 
} from "../firebase";

const PAGE_SIZE = 25;

export default function TheVault() {
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [assessments, setAssessments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastDoc, setLastDoc] = useState<any>(null);

  // Filter State
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [playing, setPlaying] = useState<string | null>(null);
  const [audioRef] = useState(() => new Audio());

  // Refs for infinite scroll
  const observer = useRef<IntersectionObserver | null>(null);
  const lastElementRef = useCallback((node: HTMLTableRowElement) => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore) {
        fetchData(false);
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, hasMore]);

  // 1. Initial Load & Auth
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (u) => {
      setUser(u);
      if (u) {
        const userDoc = await getDocs(query(collection(db, 'users'), where('uid', '==', u.uid)));
        setUserRole(userDoc.docs[0]?.data()?.role || 'student');
      }
    });
    return () => {
      unsubscribe();
      audioRef.pause();
    };
  }, [audioRef]);

  // 2. Fetch Logic
  const fetchData = useCallback(async (isNewSearch = false) => {
    if (!auth.currentUser) return;
    setLoading(true);

    try {
      const isAdmin = userRole === "admin";
      
      let q = query(
        collection(db, 'azure_recordings'),
        orderBy('createdAt', 'desc'),
        limit(PAGE_SIZE)
      );

      if (!isAdmin) {
        if (userRole === 'teacher') {
          q = query(q, where('teacherId', '==', auth.currentUser.uid));
        } else {
          q = query(q, where('studentId', '==', auth.currentUser.uid));
        }
      }

      if (typeFilter !== "all") {
        q = query(q, where('testType', '==', typeFilter));
      }

      if (!isNewSearch && lastDoc) {
        q = query(q, startAfter(lastDoc));
      }

      const snapshot = await getDocs(q);
      const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      
      // Client-side search filtering
      let filteredResults = results;
      if (search) {
        const lowQuery = search.toLowerCase();
        filteredResults = results.filter(r => 
          (r.studentName as string)?.toLowerCase().includes(lowQuery) || 
          (r.cefr as string)?.toLowerCase().includes(lowQuery)
        );
      }

      setAssessments((prev) => (isNewSearch ? filteredResults : [...prev, ...filteredResults]));
      setHasMore(snapshot.docs.length === PAGE_SIZE);
      setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
    } catch (err) {
      console.error("The Vault Retrieval Error:", err);
      handleFirestoreError(err, OperationType.GET, 'azure_recordings');
    } finally {
      setLoading(false);
    }
  }, [userRole, typeFilter, search, lastDoc]);

  // 3. Debounced Search Handler
  const debouncedFetch = useMemo(
    () => debounce(() => fetchData(true), 400),
    [fetchData]
  );

  useEffect(() => {
    if (user && userRole) {
      setLastDoc(null);
      debouncedFetch();
    }
    return () => debouncedFetch.cancel();
  }, [search, typeFilter, user, userRole]);

  const togglePlay = (a: any) => {
    if (playing === a.id) {
      audioRef.pause();
      setPlaying(null);
    } else {
      audioRef.src = a.audioUrl;
      audioRef.play();
      setPlaying(a.id);
      audioRef.onended = () => setPlaying(null);
    }
  };

  const blobName = (a: any) => {
    const ts = a.createdAt ? format(a.createdAt.toDate(), "yyyy-MM-dd") : "no-date";
    return `${a.studentName || "Student"}_${a.grade || "NA"}_${ts}`.replace(/\s+/g, "_");
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-indigo-600 rounded-[24px] flex items-center justify-center shadow-2xl shadow-indigo-500/40 border border-white/10">
            <FileAudio className="text-white w-8 h-8" />
          </div>
          <div>
            <h1 className="text-4xl font-black text-white tracking-tighter">The Vault</h1>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-2 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Powered by Gemini Search
            </p>
          </div>
        </div>
        <div className="bg-slate-900/40 px-6 py-3 rounded-2xl text-[10px] font-black text-slate-400 border border-white/5 uppercase tracking-widest">
          INDEXED: {assessments.length}{hasMore ? "+" : ""} RECORDS
        </div>
      </div>

      {/* Sticky Filters */}
      <div className="sticky top-6 z-30 flex flex-wrap gap-4 bg-slate-900/60 backdrop-blur-2xl p-4 rounded-[32px] border border-white/5 shadow-2xl">
        <div className="relative flex-1 min-w-[300px]">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <input 
            value={search} 
            onChange={e => setSearch(e.target.value)}
            placeholder="AI Search: Student, grade, or specific date..."
            className="w-full pl-14 pr-6 py-4 bg-slate-800/50 border border-white/5 rounded-2xl text-sm font-bold text-white outline-none focus:border-indigo-500 transition-all" 
          />
        </div>
        <select 
          value={typeFilter} 
          onChange={e => setTypeFilter(e.target.value)}
          className="px-8 py-4 bg-slate-800/50 border border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 outline-none focus:border-indigo-500"
        >
          <option value="all">All Modes</option>
          <option value="reading">Reading</option>
          <option value="speaking">Speaking</option>
        </select>
      </div>

      {/* Optimized Table */}
      <div className="bg-slate-900/40 rounded-[40px] border border-white/5 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead className="bg-slate-800/50 border-b border-white/5">
              <tr>
                {["Student Info", "Type", "Performance", "Date", "Actions"].map(h => (
                  <th key={h} className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {assessments.map((a, index) => (
                <tr 
                  key={a.id} 
                  ref={index === assessments.length - 1 ? lastElementRef : null}
                  className="group hover:bg-white/5 transition-all duration-300"
                >
                  <td className="px-8 py-6">
                    <div className="font-black text-white group-hover:text-indigo-400 transition-colors">{a.studentName}</div>
                    <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest mt-1 opacity-60">{blobName(a)}</div>
                  </td>
                  <td className="px-8 py-6">
                    <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${
                      a.testType === "reading" 
                        ? "bg-orange-500/10 text-orange-400 border-orange-500/20" 
                        : "bg-violet-500/10 text-violet-400 border-violet-500/20"
                    }`}>
                      {a.testType}
                    </span>
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-2">{a.grade || 'N/A'}</div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-6">
                      <div className="bg-black/20 px-4 py-2 rounded-xl border border-white/5">
                        <div className="text-lg font-black text-white leading-none">{(a.overallScore || a.accuracyScore || 0).toFixed(1)}</div>
                        <div className="text-[8px] text-slate-500 font-black uppercase tracking-widest mt-1">Score</div>
                      </div>
                      {a.wcpm && (
                        <div className="bg-orange-500/5 px-4 py-2 rounded-xl border border-orange-500/10">
                          <div className="text-lg font-black text-orange-400 leading-none">{a.wcpm}</div>
                          <div className="text-[8px] text-slate-500 font-black uppercase tracking-widest mt-1">WCPM</div>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-8 py-6 text-slate-500 text-[10px] font-black uppercase tracking-widest">
                    {a.createdAt ? format(a.createdAt.toDate(), "MMM d, yyyy") : "No date"}
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => togglePlay(a)}
                        className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                          playing === a.id 
                          ? "bg-rose-600 text-white shadow-xl shadow-rose-500/30" 
                          : "bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-600 hover:text-white"
                        }`}
                      >
                        {playing === a.id ? <><Pause size={14} /> Playing</> : <><Play size={14} /> Listen</>}
                      </button>
                      <a 
                        href={a.audioUrl} 
                        download={blobName(a)}
                        className="p-3 text-slate-500 hover:text-indigo-400 hover:bg-white/5 rounded-2xl transition-all border border-transparent hover:border-white/10"
                      >
                        <Download size={18} />
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center p-24 space-y-4">
            <div className="relative">
              <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
              <Sparkles className="absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 text-indigo-500" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Retrieving from Vault...</span>
          </div>
        )}

        {!hasMore && assessments.length > 0 && (
          <div className="py-12 text-center text-slate-600 text-[10px] font-black uppercase tracking-[0.5em] bg-slate-800/20">
            End of Archive
          </div>
        )}

        {!loading && assessments.length === 0 && (
          <div className="py-32 text-center text-slate-600 font-black uppercase tracking-[0.5em]">
            The Vault is empty
          </div>
        )}
      </div>
    </div>
  );
}
