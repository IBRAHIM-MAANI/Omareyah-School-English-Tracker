import React, { useState, useEffect } from "react";
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  X, 
  Flag, 
  LayoutGrid, 
  Table2, 
  MessageSquare,
  Loader2,
  ChevronRight
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { db, collection, query, where, onSnapshot, orderBy, auth, doc, setDoc, updateDoc, deleteDoc, serverTimestamp, handleFirestoreError, OperationType } from "../firebase";
import { AppView } from "./Sidebar";

const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1"];
const SECTIONS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const TEST_CYCLES = ["Test 1", "Test 2", "Test 3", "Test 4"];

const CEFR_COLORS: Record<string, string> = { 
  A1: "bg-red-100 text-red-700", 
  A2: "bg-orange-100 text-orange-700", 
  B1: "bg-yellow-100 text-yellow-700", 
  B2: "bg-green-100 text-green-700", 
  C1: "bg-violet-100 text-violet-700" 
};

const SECTION_COLORS: Record<string, string> = { 
  A: "bg-blue-100 text-blue-700", 
  B: "bg-teal-100 text-teal-700", 
  C: "bg-pink-100 text-pink-700", 
  D: "bg-amber-100 text-amber-700", 
  E: "bg-cyan-100 text-cyan-700", 
  F: "bg-lime-100 text-lime-700", 
  G: "bg-rose-100 text-rose-700", 
  H: "bg-indigo-100 text-indigo-700" 
};

const emptyForm = { 
  displayName: "", 
  uniqueId: "", 
  grade: "", 
  section: "", 
  level: "A1", 
  notes: "" 
};

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ─── Student Universe (Glassmorphism view) ─────────────────────────────────────
interface StudentCardProps {
  student: any;
  assessments: any[];
  testCycle: string;
  onEdit: (s: any) => void;
  onDM: (s: any) => void;
}

function StudentCard({ student, assessments, testCycle, onEdit, onDM }: StudentCardProps) {
  const [expanded, setExpanded] = useState(false);

  const studentTests = assessments.filter(a => a.studentId === student.uid || a.studentId === student.uniqueId);
  const sorted = [...studentTests].sort((a, b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0));
  const cycleIndex = TEST_CYCLES.indexOf(testCycle);
  const hasDone = cycleIndex >= 0 ? sorted.length > cycleIndex : sorted.length > 0;
  
  const latestScore = sorted[sorted.length - 1]?.overallScore || sorted[sorted.length - 1]?.accuracyScore;
  const firstScore = sorted[0]?.overallScore || sorted[0]?.accuracyScore;
  const improvement = sorted.length >= 2 ? +((latestScore - firstScore)).toFixed(1) : null;

  const ringColor = hasDone ? "#00FFAB" : sorted.length > 0 ? "#FFD700" : "#FF577F";
  const ringLabel = hasDone ? "completed" : sorted.length > 0 ? "in-progress" : "pending";

  return (
    <motion.div
      layout
      onClick={() => setExpanded(e => !e)}
      className="relative cursor-pointer transition-all duration-300 hover:-translate-y-2"
      style={{
        background: "rgba(255,255,255,0.08)",
        backdropFilter: "blur(15px)",
        border: "1px solid rgba(255,255,255,0.18)",
        borderRadius: "20px",
        padding: "20px",
        color: "white",
        boxShadow: expanded ? "0 20px 40px rgba(0,0,0,0.3)" : "0 4px 15px rgba(0,0,0,0.15)",
      }}>

      <div className="flex items-start justify-between mb-3">
        <div className="relative">
          <div className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-black"
            style={{ background: "rgba(255,255,255,0.15)", border: `3px solid ${ringColor}`, boxShadow: `0 0 10px ${ringColor}` }}>
            {student.displayName?.[0] || "?"}
          </div>
          <div className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white"
            style={{ background: ringColor, boxShadow: `0 0 6px ${ringColor}` }} />
        </div>
        <div className="flex gap-1.5">
          <button onClick={e => { e.stopPropagation(); onDM(student); }}
            className="p-1.5 rounded-lg hover:bg-white/20 transition text-white/60 hover:text-white">
            <MessageSquare className="w-3.5 h-3.5" />
          </button>
          <button onClick={e => { e.stopPropagation(); onEdit(student); }}
            className="p-1.5 rounded-lg hover:bg-white/20 transition text-white/60 hover:text-white">
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <h3 className="font-bold text-base leading-tight mb-0.5">{student.displayName}</h3>
      <p className="text-xs opacity-60 mb-3">{student.grade}{student.section ? ` · Section ${student.section}` : ""}</p>

      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }}>
          {student.level}
        </span>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: hasDone ? "rgba(0,255,171,0.2)" : "rgba(255,87,127,0.2)", color: ringColor }}>
          {ringLabel}
        </span>
      </div>

      <div className="mb-3">
        <div className="flex justify-between text-[10px] opacity-60 mb-1">
          <span>Tests completed</span>
          <span>{studentTests.length}</span>
        </div>
        <div className="h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }}>
          <div className="h-1.5 rounded-full transition-all"
            style={{ width: `${Math.min((studentTests.length / 4) * 100, 100)}%`, background: `linear-gradient(90deg, ${ringColor}, #00D1FF)` }} />
        </div>
      </div>

      {latestScore != null && (
        <div className="flex items-center justify-between">
          <span className="text-[10px] opacity-60">Latest score</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-black" style={{ color: "#FFD700" }}>{latestScore.toFixed(1)}/10</span>
            {improvement != null && (
              <span className="text-[10px] font-bold" style={{ color: improvement >= 0 ? "#00FFAB" : "#FF577F" }}>
                {improvement >= 0 ? "↑" : "↓"}{Math.abs(improvement)}
              </span>
            )}
          </div>
        </div>
      )}

      <AnimatePresence>
        {expanded && sorted.length >= 2 && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-4 pt-4 overflow-hidden" 
            style={{ borderTop: "1px solid rgba(255,255,255,0.12)" }}
          >
            <p className="text-[10px] font-bold opacity-50 uppercase tracking-widest mb-2">Progress History</p>
            <div className="space-y-1.5">
              {sorted.slice(0, 4).map((a, i) => (
                <div key={a.id} className="flex items-center gap-2">
                  <span className="text-[10px] opacity-50 w-12 flex-shrink-0">Test {i + 1}</span>
                  <div className="flex-1 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.1)" }}>
                    <div className="h-1 rounded-full" style={{ width: `${((a.overallScore || a.accuracyScore) / 10) * 100}%`, background: "#00FFAB" }} />
                  </div>
                  <span className="text-[10px] font-bold w-8 text-right">{(a.overallScore || a.accuracyScore)?.toFixed(1)}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Performance Heatmap (nebula bar)
function PerformanceNebula({ assessments }: { assessments: any[] }) {
  const avg = (key: string) => {
    const vals = assessments.filter(a => a.scores && a.scores[key] != null).map(a => a.scores[key]);
    return vals.length ? +(vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(1) : 0;
  };
  const metrics = [
    { label: "Pronunciation", key: "accuracy", value: avg("accuracy") },
    { label: "Fluency", key: "fluency", value: avg("fluency") },
    { label: "Intonation", key: "intonation", value: avg("intonation") },
    { label: "Vocabulary", key: "vocabulary", value: avg("vocabulary") },
  ];

  return (
    <div className="mb-6 p-6 rounded-[32px]" style={{ background: "rgba(255,255,255,0.07)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.12)" }}>
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/50 mb-4">📡 Class Performance Nebula</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
        {metrics.map(m => (
          <div key={m.key} className="space-y-2">
            <div className="flex justify-between text-[10px] text-white/60 font-black uppercase tracking-widest">
              <span>{m.label}</span><span>{m.value}/10</span>
            </div>
            <div className="h-2 rounded-full" style={{ background: "rgba(255,255,255,0.1)" }}>
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${(m.value / 10) * 100}%` }}
                className="h-2 rounded-full transition-all" 
                style={{ background: "linear-gradient(90deg, #00FFAB, #00D1FF)" }} 
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface StudentsProps {
  onViewChange: (view: AppView) => void;
}

export default function Students({ onViewChange }: StudentsProps) {
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [assessments, setAssessments] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [cefrFilter, setCefrFilter] = useState("all");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [testCycle, setTestCycle] = useState("all");
  const [viewMode, setViewMode] = useState<"table" | "universe">("table");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<any>(null);

  const debouncedSearch = useDebounce(search, 250);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(async (u) => {
      if (u) {
        setUser(u);
        const userDoc = await doc(db, 'users', u.uid);
        onSnapshot(userDoc, (snapshot) => {
          setUserRole(snapshot.data()?.role || 'student');
        });
      }
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user || !userRole) return;

    const isAdmin = userRole === "admin";
    
    const studentQuery = isAdmin 
      ? query(collection(db, 'users'), where('role', '==', 'student'), orderBy('createdAt', 'desc'))
      : query(collection(db, 'users'), where('role', '==', 'student'), where('teacherId', '==', user.uid), orderBy('createdAt', 'desc'));

    const unsubscribeStudents = onSnapshot(studentQuery, (snapshot) => {
      setStudents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const assessmentQuery = isAdmin
      ? query(collection(db, 'academic_records'), orderBy('createdAt', 'desc'))
      : query(collection(db, 'academic_records'), where('teacherId', '==', user.uid), orderBy('createdAt', 'desc'));

    const unsubscribeAssessments = onSnapshot(assessmentQuery, (snapshot) => {
      setAssessments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribeStudents();
      unsubscribeAssessments();
    };
  }, [user, userRole]);

  const grades = [...new Set(students.map(s => s.grade).filter(Boolean))].sort();

  const getCycleStatus = (student: any, cycle: string) => {
    if (cycle === "all") return null;
    const studentAssessments = assessments.filter(a => a.studentId === student.uid || a.studentId === student.uniqueId);
    const cycleIndex = TEST_CYCLES.indexOf(cycle);
    const sorted = [...studentAssessments].sort((a, b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0));
    if (sorted.length > cycleIndex) return "completed";
    if (studentAssessments.length > 0) return "in_progress";
    return "pending";
  };

  useEffect(() => {
    let list = students;
    if (debouncedSearch) list = list.filter(s => s.displayName?.toLowerCase().includes(debouncedSearch.toLowerCase()) || s.uniqueId?.includes(debouncedSearch));
    if (gradeFilter !== "all") list = list.filter(s => s.grade === gradeFilter);
    if (cefrFilter !== "all") list = list.filter(s => s.level === cefrFilter);
    if (sectionFilter !== "all") list = list.filter(s => s.section === sectionFilter);
    list = [...list].sort((a, b) => {
      if ((a.section || "") !== (b.section || "")) return (a.section || "").localeCompare(b.section || "");
      return (a.displayName || "").localeCompare(b.displayName || "");
    });
    setFiltered(list);
  }, [students, debouncedSearch, gradeFilter, cefrFilter, sectionFilter]);

  const completedCount = testCycle !== "all" ? filtered.filter(s => getCycleStatus(s, testCycle) === "completed").length : 0;
  const missingStudents = testCycle !== "all" ? filtered.filter(s => getCycleStatus(s, testCycle) === "pending") : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    
    const data = { 
      ...form, 
      role: 'student',
      teacherId: user.uid, 
      teacherEmail: user.email,
      updatedAt: serverTimestamp()
    };

    try {
      if (editing) {
        await updateDoc(doc(db, 'users', editing.id), data);
        // Log activity
        await setDoc(doc(collection(db, 'logs')), {
          userId: user.uid,
          userName: user.displayName || user.email,
          userRole: userRole,
          action: `Edited student: ${form.displayName}`,
          details: `Updated student ${form.uniqueId}`,
          timestamp: serverTimestamp()
        });
      } else {
        const newStudentId = `student_${Date.now()}`;
        await setDoc(doc(db, 'users', newStudentId), {
          ...data,
          uid: newStudentId,
          createdAt: serverTimestamp()
        });
        // Log activity
        await setDoc(doc(collection(db, 'logs')), {
          userId: user.uid,
          userName: user.displayName || user.email,
          userRole: userRole,
          action: `Added student: ${form.displayName}`,
          details: `Created student ${form.uniqueId}`,
          timestamp: serverTimestamp()
        });
      }
      setShowForm(false);
      setForm(emptyForm);
      setEditing(null);
    } catch (err) {
      console.error("Failed to save student:", err);
      handleFirestoreError(err, editing ? OperationType.UPDATE : OperationType.CREATE, editing ? `users/${editing.id}` : 'users');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (s: any) => {
    setEditing(s);
    setForm({ 
      displayName: s.displayName || "", 
      uniqueId: s.uniqueId || "", 
      grade: s.grade || "", 
      section: s.section || "", 
      level: s.level || "A1", 
      notes: s.notes || "" 
    });
    setShowForm(true);
  };

  const handleDelete = (s: any) => {
    setStudentToDelete(s);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!studentToDelete || !user) return;
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'users', studentToDelete.id));
      await setDoc(doc(collection(db, 'logs')), {
        userId: user.uid,
        userName: user.displayName || user.email,
        userRole: userRole,
        action: `Deleted student: ${studentToDelete.displayName}`,
        details: `Removed student ${studentToDelete.uniqueId}`,
        timestamp: serverTimestamp()
      });
      setShowDeleteConfirm(false);
      setStudentToDelete(null);
    } catch (err) {
      console.error("Failed to delete student:", err);
      handleFirestoreError(err, OperationType.DELETE, `users/${studentToDelete.id}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDM = (student: any) => {
    onViewChange("hub");
  };

  // ── Universe View ──────────────────────────────────────────────────────────
  const UniverseView = () => (
    <div className="min-h-screen p-8 rounded-[48px] mt-6" style={{ background: "linear-gradient(135deg, #1a1635 0%, #2e1065 50%, #1e1b4b 100%)", border: "1px solid rgba(255,255,255,0.05)" }}>
      <PerformanceNebula assessments={assessments} />

      <div className="flex justify-center mb-8">
        <div className="flex items-center gap-1 p-1.5 rounded-full bg-white/5 backdrop-blur-xl border border-white/10">
          <button onClick={() => setTestCycle("all")}
            className={`px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${testCycle === "all" ? "bg-gradient-to-r from-emerald-400 to-cyan-400 text-slate-900 shadow-lg shadow-emerald-500/20" : "text-white/60 hover:text-white"}`}>
            All Cycles
          </button>
          {TEST_CYCLES.map(c => (
            <button key={c} onClick={() => setTestCycle(c)}
              className={`px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${testCycle === c ? "bg-gradient-to-r from-emerald-400 to-cyan-400 text-slate-900 shadow-lg shadow-emerald-500/20" : "text-white/60 hover:text-white"}`}>
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="relative max-w-xl mx-auto mb-12">
        <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Spotlight search students..."
          className="w-full pl-14 pr-6 py-5 rounded-[2rem] text-sm text-white placeholder-white/40 focus:outline-none bg-white/5 backdrop-blur-xl border border-white/10 focus:border-emerald-500/50 transition-all shadow-2xl" />
      </div>

      {testCycle !== "all" && (
        <div className="max-w-2xl mx-auto mb-12 p-6 rounded-[2rem] bg-white/5 backdrop-blur-xl border border-white/10">
          <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-white/70 mb-3">
            <span>{testCycle} Completion</span>
            <span className="text-emerald-400">{completedCount}/{filtered.length}</span>
          </div>
          <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: filtered.length ? `${(completedCount / filtered.length) * 100}%` : "0%" }}
              className="h-full transition-all" 
              style={{ background: "linear-gradient(90deg,#00FFAB,#00D1FF)" }} 
            />
          </div>
          {missingStudents.length > 0 && (
            <p className="text-[10px] mt-4 font-black uppercase tracking-widest flex items-center gap-2 text-rose-400">
              <Flag className="w-3 h-3" /> Pending: {missingStudents.slice(0, 5).map(s => s.displayName).join(", ")}{missingStudents.length > 5 ? ` +${missingStudents.length - 5} more` : ""}
            </p>
          )}
        </div>
      )}

      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map(s => (
          <StudentCard key={s.id} student={s} assessments={assessments} testCycle={testCycle} onEdit={handleEdit} onDM={handleDM} />
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-24 text-white/20 font-black uppercase tracking-[0.5em]">No students found</div>
        )}
      </div>
    </div>
  );

  // ── Table View ──────────────────────────────────────────────────────────
  const TableView = () => (
    <div className="space-y-6 mt-6">
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[300px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or ID..." className="w-full pl-11 pr-4 py-3.5 bg-slate-900/40 border border-white/5 rounded-2xl text-xs font-bold text-white outline-none focus:border-purple-500 transition-all" />
        </div>
        <select value={gradeFilter} onChange={e => setGradeFilter(e.target.value)} className="px-6 py-3.5 bg-slate-900/40 border border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 outline-none focus:border-purple-500">
          <option value="all">All Grades</option>
          {grades.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <select value={sectionFilter} onChange={e => setSectionFilter(e.target.value)} className="px-6 py-3.5 bg-slate-900/40 border border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 outline-none focus:border-purple-500">
          <option value="all">All Sections</option>
          {SECTIONS.map(s => <option key={s} value={s}>Section {s}</option>)}
        </select>
        <select value={cefrFilter} onChange={e => setCefrFilter(e.target.value)} className="px-6 py-3.5 bg-slate-900/40 border border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 outline-none focus:border-purple-500">
          <option value="all">All CEFR</option>
          {CEFR_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <select value={testCycle} onChange={e => setTestCycle(e.target.value)} className="px-6 py-3.5 bg-purple-600/10 border border-purple-500/30 rounded-2xl text-[10px] font-black uppercase tracking-widest text-purple-400 outline-none">
          <option value="all">All Test Cycles</option>
          {TEST_CYCLES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {testCycle !== "all" && (
        <div className="flex flex-wrap gap-6">
          <div className="flex-1 bg-slate-900/40 rounded-[2rem] border border-white/5 p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{testCycle} Completion</span>
              <span className="text-[10px] font-black text-purple-400">{completedCount}/{filtered.length}</span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: filtered.length ? `${(completedCount / filtered.length) * 100}%` : "0%" }}
                className="h-full bg-gradient-to-r from-purple-500 to-emerald-500 rounded-full transition-all" 
              />
            </div>
          </div>
          {missingStudents.length > 0 && (
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-[2rem] px-6 py-4 flex items-center gap-4">
              <Flag className="w-5 h-5 text-rose-400 flex-shrink-0" />
              <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">
                {missingStudents.length} pending: {missingStudents.slice(0, 3).map(s => s.displayName).join(", ")}{missingStudents.length > 3 ? ` +${missingStudents.length - 3}` : ""}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="bg-slate-900/40 rounded-[32px] border border-white/5 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-24 text-slate-600 font-black uppercase tracking-[0.5em]">
            No students found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-800/50 border-b border-white/5">
                <tr>
                  {["Name", "Student ID", "Grade", "Section", "CEFR Level", testCycle !== "all" ? testCycle : null, userRole === "admin" ? "Teacher" : null, "Actions"].filter(Boolean).map(h => (
                    <th key={h} className="px-8 py-5 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map(s => {
                  const status = getCycleStatus(s, testCycle);
                  return (
                    <tr key={s.id} className="hover:bg-white/5 transition-colors group">
                      <td className="px-8 py-6 font-black text-xs text-white">{s.displayName}</td>
                      <td className="px-8 py-6 text-slate-500 font-mono text-[10px]">{s.uniqueId}</td>
                      <td className="px-8 py-6 text-slate-400 text-xs font-bold">{s.grade}</td>
                      <td className="px-8 py-6">
                        {s.section ? <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${SECTION_COLORS[s.section] || "bg-slate-800 text-slate-500"}`}>Section {s.section}</span>
                          : <span className="text-slate-700 text-xs">—</span>}
                      </td>
                      <td className="px-8 py-6">
                        <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${CEFR_COLORS[s.level] || "bg-slate-800 text-slate-500"}`}>{s.level}</span>
                      </td>
                      {testCycle !== "all" && (
                        <td className="px-8 py-6">
                          {status === "completed" && <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full uppercase tracking-widest border border-emerald-500/20">🟢 Done</span>}
                          {status === "in_progress" && <span className="text-[10px] font-black text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full uppercase tracking-widest border border-amber-500/20">🟡 Started</span>}
                          {status === "pending" && <span className="text-[10px] font-black text-rose-400 bg-rose-500/10 px-3 py-1 rounded-full uppercase tracking-widest border border-rose-500/20">🔴 Pending</span>}
                        </td>
                      )}
                      {userRole === "admin" && <td className="px-8 py-6 text-slate-500 text-[10px] font-bold">{s.teacherEmail}</td>}
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                          <button onClick={() => handleEdit(s)} className="p-2 text-slate-500 hover:text-purple-400 hover:bg-purple-500/10 rounded-xl transition-all"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => handleDelete(s)} className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Top bar */}
      <div className={`flex flex-col md:flex-row md:items-center justify-between gap-6 p-8 rounded-[40px] ${viewMode === "universe" ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-2xl shadow-purple-500/20" : "bg-slate-900/40 border border-white/5"}`}>
        <div>
          <h1 className="text-4xl font-black tracking-tighter">Students</h1>
          <p className={`text-[10px] font-black uppercase tracking-[0.3em] mt-2 ${viewMode === "universe" ? "text-white/60" : "text-slate-500"}`}>
            {filtered.length} student{filtered.length !== 1 ? "s" : ""} in the system
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex bg-black/20 p-1.5 rounded-2xl border border-white/5">
            <button onClick={() => setViewMode("table")}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === "table" ? "bg-white text-slate-900 shadow-xl" : "text-white/60 hover:text-white"}`}>
              <Table2 className="w-4 h-4" /> Table
            </button>
            <button onClick={() => setViewMode("universe")}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === "universe" ? "bg-white text-slate-900 shadow-xl" : "text-white/60 hover:text-white"}`}>
              <LayoutGrid className="w-4 h-4" /> Universe 🌌
            </button>
          </div>
          <button onClick={() => { setShowForm(true); setEditing(null); setForm(emptyForm); }}
            className="flex items-center gap-2 px-8 py-4 bg-emerald-500 text-slate-900 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-400 transition-all shadow-xl shadow-emerald-500/20 active:scale-95">
            <Plus className="w-5 h-5" /> Add Student
          </button>
        </div>
      </div>

      {viewMode === "universe" ? <UniverseView /> : <TableView />}

      {/* Modal */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowForm(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-slate-900 border border-white/10 rounded-[40px] shadow-2xl w-full max-w-xl p-10 overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/10 blur-[100px] -mr-32 -mt-32" />
              
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-10">
                  <div>
                    <h2 className="text-2xl font-black text-white tracking-tight">{editing ? "Edit Student" : "Add New Student"}</h2>
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">Student Profile Management</p>
                  </div>
                  <button onClick={() => setShowForm(false)} className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl text-slate-400 hover:text-white transition-all">
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Full Name</label>
                    <input type="text" value={form.displayName} onChange={e => setForm({ ...form, displayName: e.target.value })}
                      placeholder="e.g. Ahmed Al-Hassan" required
                      className="w-full px-6 py-4 bg-slate-800/50 border border-white/5 rounded-2xl text-sm font-bold text-white outline-none focus:border-purple-500 transition-all" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Student ID</label>
                    <input type="text" value={form.uniqueId} onChange={e => setForm({ ...form, uniqueId: e.target.value })}
                      placeholder="e.g. OM-12345" required
                      className="w-full px-6 py-4 bg-slate-800/50 border border-white/5 rounded-2xl text-sm font-bold text-white outline-none focus:border-purple-500 transition-all" />
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Grade Level</label>
                      <input type="text" value={form.grade} onChange={e => setForm({ ...form, grade: e.target.value })}
                        placeholder="e.g. Grade 8" required
                        className="w-full px-6 py-4 bg-slate-800/50 border border-white/5 rounded-2xl text-sm font-bold text-white outline-none focus:border-purple-500 transition-all" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Section</label>
                      <select value={form.section} onChange={e => setForm({ ...form, section: e.target.value })}
                        className="w-full px-6 py-4 bg-slate-800/50 border border-white/5 rounded-2xl text-sm font-bold text-white outline-none focus:border-purple-500 transition-all">
                        <option value="">Select Section</option>
                        {SECTIONS.map(s => <option key={s} value={s}>Section {s}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">CEFR Level</label>
                    <select value={form.level} onChange={e => setForm({ ...form, level: e.target.value })}
                      className="w-full px-6 py-4 bg-slate-800/50 border border-white/5 rounded-2xl text-sm font-bold text-white outline-none focus:border-purple-500 transition-all">
                      {CEFR_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Notes (optional)</label>
                    <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                      rows={3} className="w-full px-6 py-4 bg-slate-800/50 border border-white/5 rounded-2xl text-sm font-bold text-white outline-none focus:border-purple-500 transition-all resize-none" />
                  </div>
                  <div className="flex gap-4 pt-6">
                    <button type="button" onClick={() => setShowForm(false)}
                      className="flex-1 px-8 py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border border-white/5">Cancel</button>
                    <button type="submit" disabled={loading}
                      className="flex-1 px-8 py-4 bg-purple-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-purple-500 disabled:opacity-50 transition-all shadow-xl shadow-purple-500/20">
                      {loading ? "Saving..." : editing ? "Update Profile" : "Create Student"}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && studentToDelete && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDeleteConfirm(false)}
              className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative bg-slate-900 border border-rose-500/20 rounded-[40px] shadow-2xl w-full max-w-md p-10 text-center"
            >
              <div className="w-20 h-20 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-rose-500/20">
                <Trash2 className="w-10 h-10 text-rose-500" />
              </div>
              <h2 className="text-2xl font-black text-white mb-2">Delete Student?</h2>
              <p className="text-slate-400 text-sm mb-8 leading-relaxed">
                Are you sure you want to remove <span className="text-white font-bold">{studentToDelete.displayName}</span>? This action cannot be undone.
              </p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-8 py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmDelete}
                  disabled={loading}
                  className="flex-1 px-8 py-4 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-rose-500/20 disabled:opacity-50"
                >
                  {loading ? "Deleting..." : "Yes, Delete"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
