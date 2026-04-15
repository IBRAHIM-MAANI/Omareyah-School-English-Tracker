import React, { useState, useEffect, useMemo } from "react";
import { Trophy, Star, TrendingUp, Filter, Search, Loader2, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  db, 
  collection, 
  query, 
  where, 
  getDocs, 
  auth, 
  handleFirestoreError, 
  OperationType 
} from "../firebase";

const SECTIONS = ["All", "A", "B", "C", "D"];

/**
 * Optimized computation functions
 */
function computePoints(studentAssessments: any[]) {
  return studentAssessments.reduce((sum, a) => {
    const score = parseFloat(a.examScore || a.scores?.accuracy || 0);
    const base = 10;
    const bonus = score >= 80 ? 5 : score >= 60 ? 2 : 0; // Adjusted for 0-100 scale if needed
    return sum + base + bonus;
  }, 0);
}

function computeImprovement(studentAssessments: any[]) {
  if (studentAssessments.length < 2) return 0;
  // Assumes assessments are already sorted by date from API
  const first = parseFloat(studentAssessments[studentAssessments.length - 1].examScore || studentAssessments[studentAssessments.length - 1].scores?.accuracy || 0);
  const last = parseFloat(studentAssessments[0].examScore || studentAssessments[0].scores?.accuracy || 0);
  return +(last - first).toFixed(1);
}

export default function Leaderboard() {
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [assessments, setAssessments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filter States
  const [section, setSection] = useState("All");
  const [testType, setTestType] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (u) => {
      setUser(u);
      if (u) {
        setLoading(true);
        try {
          const userDoc = await getDocs(query(collection(db, 'users'), where('uid', '==', u.uid)));
          const role = userDoc.docs[0]?.data()?.role || 'student';
          setUserRole(role);
          const isAdmin = role === "admin";
          
          // Fetch data in parallel for speed
          const studentQuery = isAdmin 
            ? query(collection(db, 'users'), where('role', '==', 'student'))
            : query(collection(db, 'users'), where('role', '==', 'student'), where('teacherId', '==', u.uid));
            
          const assessmentQuery = isAdmin
            ? query(collection(db, 'student_records'))
            : query(collection(db, 'student_records'), where('teacherId', '==', u.uid));

          const [sSnap, aSnap] = await Promise.all([
            getDocs(studentQuery),
            getDocs(assessmentQuery)
          ]);
          
          setStudents(sSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
          setAssessments(aSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a: any, b: any) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)));
        } catch (err) {
          console.error("Leaderboard Data Fetch Error:", err);
          handleFirestoreError(err, OperationType.GET, 'student_records');
        } finally {
          setLoading(false);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  /**
   * PERFORMANCE UPGRADE: useMemo
   * This ensures the heavy sorting/mapping only happens when data actually changes.
   */
  const leaderboard = useMemo(() => {
    // 1. Group assessments by studentId once to avoid O(n^2) lookups
    const assessmentsByStudent = assessments.reduce((acc, curr) => {
      if (!acc[curr.studentId]) acc[curr.studentId] = [];
      acc[curr.studentId].push(curr);
      return acc;
    }, {});

    // 2. Map and Calculate
    return students
      .filter(s => {
        const matchSection = section === "All" || s.section === section;
        const matchSearch = (s.displayName || s.name || "").toLowerCase().includes(searchQuery.toLowerCase());
        return matchSection && matchSearch;
      })
      .map(student => {
        let sAssessments = assessmentsByStudent[student.uid || student.id] || [];
        if (testType !== "all") sAssessments = sAssessments.filter(a => a.type === testType);
        
        const points = computePoints(sAssessments);
        const improvement = computeImprovement(sAssessments);
        const avgScore = sAssessments.length
          ? +(sAssessments.reduce((s, a) => s + parseFloat(a.examScore || a.scores?.accuracy || 0), 0) / sAssessments.length).toFixed(1)
          : 0;

        return { ...student, points, improvement, avgScore, testCount: sAssessments.length };
      })
      .sort((a, b) => b.points - a.points || b.improvement - a.improvement);
  }, [students, assessments, section, testType, searchQuery]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-400">
      <Loader2 className="w-10 h-10 animate-spin mb-4 text-indigo-500" />
      <p className="font-black uppercase tracking-widest text-[10px] animate-pulse">Gemini is calculating rankings...</p>
    </div>
  );

  const top3 = leaderboard.slice(0, 3);

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-amber-500/10 rounded-[24px] flex items-center justify-center text-3xl shadow-2xl shadow-amber-500/10 border border-amber-500/20">🏆</div>
          <div>
            <h1 className="text-4xl font-black text-white tracking-tighter">Leaderboard</h1>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-2 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" /> Powered by Gemini AI Ranking
            </p>
          </div>
        </div>
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-500 transition-colors" />
          <input 
            type="text"
            placeholder="Search student name..."
            className="pl-12 pr-6 py-4 bg-slate-900/40 border border-white/5 rounded-2xl text-xs font-bold text-white focus:border-indigo-500 outline-none w-full md:w-72 transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Control Bar */}
      <div className="bg-slate-900/40 p-2 rounded-[24px] border border-white/5 shadow-2xl flex flex-wrap items-center gap-3">
        <div className="flex bg-black/20 p-1 rounded-xl">
          {SECTIONS.map(s => (
            <button key={s} onClick={() => setSection(s)}
              className={`px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${section === s ? "bg-indigo-600 text-white shadow-lg" : "text-slate-500 hover:text-white"}`}>
              {s === "All" ? "All Sections" : `Sec ${s}`}
            </button>
          ))}
        </div>
        <div className="h-6 w-[1px] bg-white/5 mx-2 hidden md:block" />
        <div className="flex bg-black/20 p-1 rounded-xl">
          {[["all", "All"], ["speaking", "Speaking"], ["reading", "Reading"]].map(([v, l]) => (
            <button key={v} onClick={() => setTestType(v)}
              className={`px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${testType === v ? "bg-indigo-600 text-white shadow-lg" : "text-slate-500 hover:text-white"}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Podium Layout */}
      {leaderboard.length > 0 && !searchQuery && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-end pt-12 pb-6">
            {/* Rank 2 */}
            {top3[1] && <PodiumCard student={top3[1]} rank={2} color="bg-slate-800/40" border="border-slate-700/50" text="text-slate-400" />}
            {/* Rank 1 */}
            {top3[0] && <PodiumCard student={top3[0]} rank={1} color="bg-amber-500/10" border="border-amber-500/20" text="text-amber-500" large />}
            {/* Rank 3 */}
            {top3[2] && <PodiumCard student={top3[2]} rank={3} color="bg-orange-500/10" border="border-orange-500/20" text="text-orange-500" />}
        </div>
      )}

      {/* Point System Legend */}
      <div className="flex flex-wrap justify-center gap-8 py-6 border-y border-white/5 text-[9px] font-black uppercase tracking-[0.3em] text-slate-500">
        <div className="flex items-center gap-2"><Star size={14} className="text-amber-400" /> 10 Base Pts</div>
        <div className="flex items-center gap-2"><Star size={14} className="text-emerald-500" /> +5 Bonus (Score 80+)</div>
        <div className="flex items-center gap-2"><Star size={14} className="text-blue-500" /> +2 Bonus (Score 60+)</div>
      </div>

      {/* Table List */}
      <div className="bg-slate-900/40 rounded-[40px] border border-white/5 overflow-hidden shadow-2xl">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-800/50">
            <tr>
              <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Rank</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Student</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] text-center">Avg</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] text-center">Growth</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] text-right">Points</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {leaderboard.map((s, i) => (
              <tr key={s.id} className="group hover:bg-white/5 transition-all duration-300">
                <td className="px-8 py-6">
                  <span className={`font-black text-lg ${i < 3 ? "text-indigo-400" : "text-slate-700"}`}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                </td>
                <td className="px-8 py-6">
                  <div className="font-black text-white group-hover:text-indigo-400 transition-colors">{s.displayName || s.name}</div>
                  <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest mt-1">{s.grade || s.grade_level || 'N/A'} • Sec {s.section || 'N/A'}</div>
                </td>
                <td className="px-8 py-6 text-center">
                    <span className="text-sm font-black text-slate-300">{s.avgScore}</span>
                </td>
                <td className="px-8 py-6 text-center">
                  <span className={`text-xs font-black ${s.improvement > 0 ? "text-emerald-400" : "text-slate-600"}`}>
                    {s.improvement > 0 ? `+${s.improvement}` : s.improvement}
                  </span>
                </td>
                <td className="px-8 py-6 text-right">
                  <span className="inline-block px-5 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-500/20">
                    {s.points}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {leaderboard.length === 0 && (
          <div className="py-32 text-center text-slate-600 font-black uppercase tracking-[0.5em]">
            No rankings found
          </div>
        )}
      </div>
    </div>
  );
}

function PodiumCard({ student, rank, color, border, text, large }: any) {
    return (
        <div className={`${color} ${border} border rounded-[40px] p-8 text-center relative shadow-2xl transition-all duration-500 ${large ? 'scale-110 z-10 -translate-y-6 bg-slate-800/60' : ''}`}>
            <div className={`absolute -top-5 left-1/2 -translate-x-1/2 w-10 h-10 rounded-2xl ${color} ${border} border flex items-center justify-center font-black text-xs ${text} shadow-xl`}>
                {rank}
            </div>
            <div className="w-20 h-20 bg-white/5 rounded-[24px] flex items-center justify-center text-3xl mx-auto mb-4 shadow-inner font-black text-indigo-400 border border-white/5">
                {(student.displayName || student.name)?.[0]}
            </div>
            <h3 className="font-black text-white truncate text-lg tracking-tight">{student.displayName || student.name}</h3>
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-4 mt-1">{student.testCount} Tests Taken</p>
            <div className={`text-4xl font-black ${text} tracking-tighter`}>{student.points}</div>
            <div className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mt-1">Total Points</div>
        </div>
    );
}
