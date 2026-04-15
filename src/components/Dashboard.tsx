import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Users, 
  BarChart3, 
  BookOpen, 
  Star, 
  Mic, 
  FileText, 
  Activity, 
  Headphones, 
  Settings,
  ChevronRight,
  Shield,
  LogOut,
  TrendingUp,
  Plus,
  ClipboardList,
  BarChart2,
  Trophy,
  Brain
} from 'lucide-react';
import { AppView } from './Sidebar';
import { db, collection, query, where, onSnapshot, getDocs } from '../firebase';

interface DashboardProps {
  user: any;
  userRole: string | null;
  onLogout: () => void;
  onViewChange: (view: AppView) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, userRole, onLogout, onViewChange }) => {
  const [stats, setStats] = useState({ students: 0, assessments: 0, reading: 0, avgScore: 0 });

  useEffect(() => {
    if (!user || !userRole || userRole === 'student') return;

    const isAdmin = userRole === 'admin';
    
    // 1. Students Count
    const studentQuery = isAdmin 
      ? query(collection(db, 'users'), where('role', '==', 'student'))
      : query(collection(db, 'users'), where('role', '==', 'student'), where('teacherId', '==', user.uid));
    
    const unsubscribeStudents = onSnapshot(studentQuery, (snapshot) => {
      setStats(prev => ({ ...prev, students: snapshot.size }));
    });

    // 2. Assessments Stats
    const assessmentQuery = isAdmin
      ? query(collection(db, 'academic_records'))
      : query(collection(db, 'academic_records'), where('teacherId', '==', user.uid));

    const unsubscribeAssessments = onSnapshot(assessmentQuery, (snapshot) => {
      const docs = snapshot.docs.map(doc => doc.data());
      const reading = docs.filter(d => d.type === 'reading').length;
      const scores = docs.filter(d => d.examScore != null).map(d => d.examScore);
      const avgScore = scores.length ? (scores.reduce((s, v) => s + v, 0) / scores.length).toFixed(1) : 0;
      
      setStats(prev => ({ 
        ...prev, 
        assessments: snapshot.size,
        reading,
        avgScore: Number(avgScore)
      }));
    });

    return () => {
      unsubscribeStudents();
      unsubscribeAssessments();
    };
  }, [user, userRole]);

  const quickActions = [
    { label: "Manage Students", icon: Users, view: "students" as AppView, color: "#3b82f6" },
    { label: "Speaking Assessment", icon: Mic, view: "speaking" as AppView, color: "#ec4899" },
    { label: "Reading Assessment", icon: BookOpen, view: "reading" as AppView, color: "#f97316" },
    { label: "Reading Practice", icon: BookOpen, view: "reading" as AppView, color: "#22c55e" },
    { label: "View Reports", icon: FileText, view: "reports" as AppView, color: "#a78bfa" },
    { label: "Analytics", icon: BarChart2, view: "analytics" as AppView, color: "#06b6d4" },
    { label: "Student Progress", icon: TrendingUp, view: "progress" as AppView, color: "#84cc16" },
    { label: "Marks", icon: ClipboardList, view: "marks" as AppView, color: "#fbbf24" },
    { label: "Leaderboard", icon: Trophy, view: "leaderboard" as AppView, color: "#f59e0b" },
    { label: "Calibration Room", icon: Brain, view: "calibration" as AppView, color: "#8b5cf6" },
    { label: "Recordings", icon: Headphones, view: "records" as AppView, color: "#818cf8" },
  ];

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-[48px] p-12 bg-slate-900/40 border border-white/5">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/10 blur-[120px] -mr-48 -mt-48" />
        
        <div className="relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black tracking-widest uppercase bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            ⚡ AI-Powered Assessment
          </div>
          
          <div className="space-y-4">
            <h1 className="text-6xl font-black tracking-tighter text-white leading-none">
              Welcome to the <br />
              <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                Evolution Tracker
              </span>
            </h1>
            <p className="text-slate-500 text-lg font-bold uppercase tracking-tight max-w-xl">
              Assess speaking and reading skills with AI precision. Results in under 10 seconds.
            </p>
          </div>

          <div className="flex flex-wrap gap-4 pt-4">
            <button 
              onClick={() => onViewChange('speaking')}
              className="bg-purple-600 hover:bg-purple-700 px-8 py-4 rounded-2xl flex items-center gap-3 font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-purple-500/20 active:scale-95"
            >
              🎙️ Start Speaking Test
            </button>
            <button 
              onClick={() => onViewChange('reading')}
              className="bg-white/5 hover:bg-white/10 px-8 py-4 rounded-2xl flex items-center gap-3 font-black text-xs uppercase tracking-widest border border-white/10 transition-all active:scale-95"
            >
              📖 Start Reading Test
            </button>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: "Total Students", value: stats.students, icon: "👥", color: "text-purple-400", bg: "bg-purple-500/10" },
          { label: "Total Assessments", value: stats.assessments, icon: "📊", color: "text-emerald-400", bg: "bg-emerald-500/10" },
          { label: "Reading Tests", value: stats.reading, icon: "📖", color: "text-orange-400", bg: "bg-orange-500/10" },
          { label: "Avg Score", value: `${stats.avgScore}/10`, icon: "⭐", color: "text-amber-400", bg: "bg-amber-500/10" },
        ].map((s, i) => (
          <motion.div 
            key={i}
            whileHover={{ y: -5 }}
            className="bg-slate-800/40 backdrop-blur-md border border-white/5 p-8 rounded-[32px] space-y-4 group hover:border-white/20 transition-all"
          >
            <div className={`w-12 h-12 ${s.bg} rounded-2xl flex items-center justify-center text-xl border border-white/5`}>
              {s.icon}
            </div>
            <div>
              <div className="text-4xl font-black text-white tracking-tighter">{s.value}</div>
              <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{s.label}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="space-y-6">
        <h3 className="text-[10px] font-black text-slate-500 tracking-[0.3em] uppercase ml-2">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickActions.map((a) => (
            <button 
              key={a.label}
              onClick={() => onViewChange(a.view)}
              className="bg-slate-800/40 border border-white/5 p-6 rounded-2xl flex items-center justify-between hover:bg-slate-800/60 transition-all group active:scale-[0.98] hover:border-white/20"
              style={{ '--hover-color': a.color } as any}
            >
              <div className="flex items-center gap-4">
                <div 
                  className="p-3 rounded-xl border border-white/5 transition-all"
                  style={{ backgroundColor: `${a.color}15`, borderColor: `${a.color}30` }}
                >
                  <a.icon className="w-5 h-5" style={{ color: a.color }} />
                </div>
                <span className="text-xs font-black text-white uppercase tracking-widest">{a.label}</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-white group-hover:translate-x-1 transition-all" />
            </button>
          ))}
        </div>
      </div>

      {/* CEFR Guide */}
      <div className="bg-slate-900/40 border border-white/5 p-8 rounded-[32px] space-y-6">
        <h3 className="text-[10px] font-black text-slate-500 tracking-[0.3em] uppercase">CEFR Level Guide</h3>
        <div className="flex flex-wrap gap-3">
          {[
            { level: "A1", label: "Beginner", color: "text-red-400", border: "border-red-500/30", bg: "bg-red-500/10" },
            { level: "A2", label: "Elementary", color: "text-orange-400", border: "border-orange-500/30", bg: "bg-orange-500/10" },
            { level: "B1", label: "Intermediate", color: "text-yellow-400", border: "border-yellow-500/30", bg: "bg-yellow-500/10" },
            { level: "B2", label: "Upper-Int.", color: "text-green-400", border: "border-green-500/30", bg: "bg-green-500/10" },
            { level: "C1", label: "Advanced", color: "text-purple-400", border: "border-purple-500/30", bg: "bg-purple-500/10" },
          ].map(c => (
            <span key={c.level} className={`px-4 py-2 rounded-xl text-[10px] font-black border ${c.border} ${c.bg} ${c.color} uppercase tracking-widest`}>
              {c.level} – {c.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
