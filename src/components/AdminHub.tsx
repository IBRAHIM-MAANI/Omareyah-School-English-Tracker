import React, { useState, useEffect } from "react";
import { ShieldCheck, Users, GraduationCap, Activity, Headphones, BarChart2, Loader2, Search, Mic, BookOpen } from "lucide-react";
import { format } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { db, collection, query, where, onSnapshot, orderBy, limit, auth, doc } from "../firebase";

const ACTION_COLORS: Record<string, string> = {
  add_student: "bg-green-100 text-green-700",
  edit_student: "bg-yellow-100 text-yellow-700",
  delete_student: "bg-red-100 text-red-700",
  speaking_test: "bg-violet-100 text-violet-700",
  reading_test: "bg-orange-100 text-orange-700",
  export_report: "bg-blue-100 text-blue-700",
  login: "bg-slate-100 text-slate-600",
  other: "bg-slate-100 text-slate-600",
};

const AdminHub: React.FC = () => {
  const [userRole, setUserRole] = useState<string | null>(null);
  const [tab, setTab] = useState("overview");
  const [teachers, setTeachers] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [assessments, setAssessments] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!auth.currentUser) return;

    const unsubscribeRole = onSnapshot(doc(db, 'users', auth.currentUser.uid), (doc) => {
      const data = doc.data();
      setUserRole(data?.role || 'student');
    });

    const unsubscribeTeachers = onSnapshot(query(collection(db, 'users'), where('role', '==', 'teacher')), (snapshot) => {
      setTeachers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubscribeStudents = onSnapshot(query(collection(db, 'users'), where('role', '==', 'student')), (snapshot) => {
      setStudents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubscribeAssessments = onSnapshot(query(collection(db, 'academic_records'), orderBy('createdAt', 'desc'), limit(200)), (snapshot) => {
      setAssessments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubscribeLogs = onSnapshot(query(collection(db, 'logs'), orderBy('timestamp', 'desc'), limit(100)), (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    return () => {
      unsubscribeRole();
      unsubscribeTeachers();
      unsubscribeStudents();
      unsubscribeAssessments();
      unsubscribeLogs();
    };
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
    </div>
  );

  if (userRole !== "admin") return (
    <div className="p-6 text-center">
      <ShieldCheck className="w-16 h-16 mx-auto text-slate-200 mb-4" />
      <h2 className="text-xl font-bold text-slate-800">Access Restricted</h2>
      <p className="text-slate-500 mt-2">Admin access required to view this page.</p>
    </div>
  );

  const tabs = [
    { id: "overview", label: "Overview", icon: BarChart2 },
    { id: "teachers", label: "Teachers", icon: Users },
    { id: "students", label: "All Students", icon: GraduationCap },
    { id: "activity", label: "Activity Logs", icon: Activity },
    { id: "recordings", label: "Recordings", icon: Headphones },
  ];

  const todayTests = assessments.filter(a => {
    const d = a.createdAt?.toDate().toISOString().split("T")[0];
    return d === new Date().toISOString().split("T")[0];
  });

  const teacherStats = teachers.map(t => ({
    name: t.displayName?.split(" ")[0] || t.email?.split("@")[0],
    students: students.filter(s => s.teacherId === t.uid).length,
    tests: assessments.filter(a => a.teacherId === t.uid).length,
  }));

  const filteredStudents = search
    ? students.filter(s => 
        s.displayName?.toLowerCase().includes(search.toLowerCase()) || 
        s.uniqueId?.includes(search) || 
        s.email?.includes(search)
      )
    : students;

  const filteredLogs = search
    ? logs.filter(l => 
        l.userName?.toLowerCase().includes(search.toLowerCase()) || 
        l.details?.toLowerCase().includes(search.toLowerCase())
      )
    : logs;

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-500/20">
          <ShieldCheck className="w-7 h-7 text-amber-500" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Admin Hub</h1>
          <p className="text-zinc-500 font-bold text-sm uppercase tracking-widest">Full school oversight — Omareyah Schools</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-8 bg-white/5 p-1.5 rounded-2xl border border-white/5 w-fit overflow-x-auto">
        {tabs.map(t => (
          <button 
            key={t.id} 
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${
              tab === t.id 
                ? "bg-amber-500 text-white shadow-lg shadow-amber-500/20" 
                : "text-zinc-500 hover:text-white hover:bg-white/5"
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === "overview" && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: "Total Teachers", value: teachers.length, color: "text-blue-400", bg: "bg-blue-500/10" },
              { label: "Total Students", value: students.length, color: "text-purple-400", bg: "bg-purple-500/10" },
              { label: "Total Assessments", value: assessments.length, color: "text-emerald-400", bg: "bg-emerald-500/10" },
              { label: "Tests Today", value: todayTests.length, color: "text-amber-400", bg: "bg-amber-500/10" },
            ].map(c => (
              <div key={c.label} className="bg-[#1a1635] rounded-[2rem] border border-white/5 p-6 shadow-xl">
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">{c.label}</p>
                <p className={`text-4xl font-black ${c.color}`}>{c.value}</p>
              </div>
            ))}
          </div>

          <div className="bg-[#1a1635] rounded-[2.5rem] border border-white/5 p-8 shadow-2xl">
            <h2 className="text-xl font-black text-white tracking-tight mb-8">Teacher Activity Overview</h2>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={teacherStats}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#71717a', fontSize: 10, fontWeight: 900 }} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#71717a', fontSize: 10, fontWeight: 900 }} 
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                    itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                  />
                  <Bar dataKey="students" fill="#8b5cf6" name="Students" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="tests" fill="#f59e0b" name="Tests" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-[#1a1635] rounded-[2.5rem] border border-white/5 p-8 shadow-2xl">
            <h2 className="text-xl font-black text-white tracking-tight mb-6">Recent Activity</h2>
            <div className="space-y-3">
              {logs.slice(0, 10).map(log => (
                <div key={log.id} className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5 group hover:bg-white/10 transition-all">
                  <span className={`text-[10px] px-3 py-1 rounded-lg font-black uppercase tracking-widest whitespace-nowrap ${ACTION_COLORS[log.action] || "bg-zinc-500/10 text-zinc-400"}`}>
                    {log.action?.replace(/_/g, " ")}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{log.details}</p>
                    <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mt-0.5">
                      {log.userName} · {log.timestamp ? format(log.timestamp.toDate(), "MMM d, HH:mm") : "—"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Teachers */}
      {tab === "teachers" && (
        <div className="bg-[#1a1635] rounded-[2.5rem] border border-white/5 shadow-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-white/5 border-b border-white/5">
                <tr>
                  {["Teacher", "Email", "Students", "Tests", "Role"].map(h => (
                    <th key={h} className="px-8 py-5 text-[10px] font-black text-zinc-500 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {teachers.map(t => (
                  <tr key={t.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-8 py-5 font-black text-white">{t.displayName}</td>
                    <td className="px-8 py-5 text-sm text-zinc-400 font-medium">{t.email}</td>
                    <td className="px-8 py-5 text-sm font-black text-purple-400">{students.filter(s => s.teacherId === t.uid).length}</td>
                    <td className="px-8 py-5 text-sm font-black text-amber-400">{assessments.filter(a => a.teacherId === t.uid).length}</td>
                    <td className="px-8 py-5">
                      <span className="text-[10px] bg-white/5 text-zinc-500 px-3 py-1 rounded-lg font-black uppercase tracking-widest border border-white/5">
                        {t.role}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Students */}
      {tab === "students" && (
        <div className="space-y-6">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 group-focus-within:text-amber-500 transition-colors" />
            <input 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              placeholder="Search students by name, ID or email..."
              className="w-full pl-12 pr-6 py-4 bg-[#1a1635] border border-white/10 rounded-2xl text-white font-bold focus:ring-2 focus:ring-amber-500 outline-none transition-all" 
            />
          </div>
          <div className="bg-[#1a1635] rounded-[2.5rem] border border-white/5 shadow-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-white/5 border-b border-white/5">
                  <tr>
                    {["Name", "ID", "Grade", "CEFR", "Teacher", "Tests"].map(h => (
                      <th key={h} className="px-6 py-5 text-[10px] font-black text-zinc-500 uppercase tracking-widest">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredStudents.map(s => (
                    <tr key={s.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-5 font-black text-white">{s.displayName}</td>
                      <td className="px-6 py-5 text-sm text-zinc-400 font-mono font-bold">{s.uniqueId}</td>
                      <td className="px-6 py-5 text-sm text-zinc-300 font-bold">{s.grade}</td>
                      <td className="px-6 py-5">
                        <span className={`text-[10px] px-3 py-1 rounded-lg font-black uppercase tracking-widest ${
                          {"A1":"bg-red-500/10 text-red-400","A2":"bg-orange-500/10 text-orange-400","B1":"bg-yellow-500/10 text-yellow-400","B2":"bg-green-500/10 text-green-400","C1":"bg-purple-500/10 text-purple-400"}[s.cefr_level] || "bg-zinc-500/10 text-zinc-400"
                        }`}>
                          {s.cefr_level || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                        {teachers.find(t => t.uid === s.teacherId)?.displayName || "Unassigned"}
                      </td>
                      <td className="px-6 py-5 text-sm font-black text-amber-400">
                        {assessments.filter(a => a.studentId === s.uid).length}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Activity Logs */}
      {tab === "activity" && (
        <div className="space-y-6">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 group-focus-within:text-amber-500 transition-colors" />
            <input 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              placeholder="Search logs..."
              className="w-full pl-12 pr-6 py-4 bg-[#1a1635] border border-white/10 rounded-2xl text-white font-bold focus:ring-2 focus:ring-amber-500 outline-none transition-all" 
            />
          </div>
          <div className="bg-[#1a1635] rounded-[2.5rem] border border-white/5 shadow-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-white/5 border-b border-white/5">
                  <tr>
                    {["Action", "User", "Details", "Timestamp"].map(h => (
                      <th key={h} className="px-6 py-5 text-[10px] font-black text-zinc-500 uppercase tracking-widest">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredLogs.map(log => (
                    <tr key={log.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-5">
                        <span className={`text-[10px] px-3 py-1 rounded-lg font-black uppercase tracking-widest ${ACTION_COLORS[log.action] || "bg-zinc-500/10 text-zinc-400"}`}>
                          {log.action?.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <p className="text-sm font-black text-white">{log.userName}</p>
                        <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">{log.userRole}</p>
                      </td>
                      <td className="px-6 py-5 text-sm text-zinc-300 font-medium">{log.details}</td>
                      <td className="px-6 py-5 text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                        {log.timestamp ? format(log.timestamp.toDate(), "MMM d, yyyy HH:mm") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Recordings */}
      {tab === "recordings" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {assessments.filter(a => a.audioUrl).map(a => (
            <div key={a.id} className="bg-[#1a1635] rounded-[2rem] border border-white/5 p-6 shadow-xl space-y-4 group hover:border-amber-500/30 transition-all">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${
                    a.type === "speaking" 
                      ? "bg-purple-500/10 border-purple-500/20 text-purple-400" 
                      : "bg-orange-500/10 border-orange-500/20 text-orange-400"
                  }`}>
                    {a.type === "speaking" ? <Mic className="w-6 h-6" /> : <BookOpen className="w-6 h-6" />}
                  </div>
                  <div>
                    <p className="font-black text-white text-lg tracking-tight">
                      {students.find(s => s.uid === a.studentId)?.displayName || "Unknown Student"}
                    </p>
                    <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">
                      {a.type} · {a.createdAt ? format(a.createdAt.toDate(), "MMM d, yyyy") : "—"}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">CEFR</p>
                  <span className="text-sm font-black text-amber-500">{a.overallLevel || 'N/A'}</span>
                </div>
              </div>
              <audio src={a.audioUrl} controls className="w-full h-10 rounded-xl opacity-80 hover:opacity-100 transition-opacity" />
            </div>
          ))}
          {assessments.filter(a => a.audioUrl).length === 0 && (
            <div className="col-span-full py-20 text-center space-y-4 opacity-30">
              <Headphones className="w-16 h-16 mx-auto text-zinc-500" />
              <p className="text-zinc-500 font-black uppercase tracking-widest text-xs">No recordings found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminHub;
