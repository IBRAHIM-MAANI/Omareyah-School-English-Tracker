import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Mic, 
  BookOpen, 
  TrendingUp, 
  ClipboardList, 
  Headphones, 
  Languages, 
  Bot, 
  Target,
  Brain,
  LogOut,
  Shield,
  ShieldCheck,
  ShieldAlert,
  BarChart3,
  LineChart,
  Clock,
  Book,
  FileText,
  PenTool,
  Crown,
  Settings,
  Plus,
  GraduationCap,
  MessageSquare,
  Camera,
  Trophy
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export type AppView = 
  | 'dashboard' 
  | 'admin'
  | 'students' 
  | 'speaking' 
  | 'reading' 
  | 'progress' 
  | 'marks' 
  | 'records' 
  | 'translator' 
  | 'bot' 
  | 'accent'
  | 'pronunciation'
  | 'vocabulary'
  | 'reports'
  | 'analytics'
  | 'hub'
  | 'audit'
  | 'azure-assessments'
  | 'history'
  | 'live-tutor'
  | 'visual-lab'
  | 'admin-hub'
  | 'premium'
  | 'leaderboard'
  | 'calibration'
  | 'proctor'
  | 'test-creator'
  | 'forensic-vault'
  | 'settings';

interface SidebarProps {
  currentView: AppView;
  onViewChange: (view: AppView) => void;
  user: any;
  userRole: 'student' | 'teacher' | 'admin' | null;
  onLogout: () => void;
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange, user, userRole, onLogout, isOpen, onClose }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['student', 'teacher', 'admin'] },
    { id: 'hub', label: 'Communication Hub', icon: MessageSquare, roles: ['student', 'teacher', 'admin'] },
    { id: 'azure-assessments', label: 'Azure Assessments', icon: Shield, roles: ['teacher', 'admin'] },
    { id: 'live-tutor', label: 'Live AI Tutor', icon: Headphones, roles: ['student', 'teacher', 'admin'] },
    { id: 'visual-lab', label: 'Visual English Lab', icon: Camera, roles: ['student', 'teacher', 'admin'] },
    { id: 'admin-hub', label: '🛡️ Admin Hub', icon: ShieldCheck, roles: ['admin'] },
    { id: 'history', label: 'Student History', icon: Clock, roles: ['teacher', 'admin'] },
    { id: 'audit', label: 'AI Audit Hub', icon: Shield, roles: ['teacher', 'admin'] },
    { id: 'students', label: 'Students', icon: Users, roles: ['teacher', 'admin'] },
    { id: 'speaking', label: 'Speaking Test', icon: Mic, roles: ['student', 'teacher', 'admin'] },
    { id: 'reading', label: 'Reading Test', icon: BookOpen, roles: ['student', 'teacher', 'admin'] },
    { id: 'reports', label: 'Reports', icon: FileText, roles: ['teacher', 'admin'] },
    { id: 'analytics', label: 'Analytics', icon: BarChart3, roles: ['teacher', 'admin'] },
    { id: 'progress', label: 'Student Progress', icon: LineChart, roles: ['student', 'teacher', 'admin'] },
    { id: 'pronunciation', label: 'Pronunciation Training', icon: Target, roles: ['student', 'teacher', 'admin'] },
    { id: 'vocabulary', label: 'Vocabulary Training', icon: Book, roles: ['student', 'teacher', 'admin'] },
    { id: 'marks', label: 'Marks', icon: ClipboardList, roles: ['teacher', 'admin'] },
    { id: 'records', label: 'Saved Recordings', icon: Headphones, roles: ['student', 'teacher', 'admin'] },
    { id: 'accent', label: 'Accent Trainer', icon: PenTool, roles: ['student', 'teacher', 'admin'] },
    { id: 'bot', label: 'AI Linguistics Bot', icon: Bot, roles: ['student', 'teacher', 'admin'] },
    { id: 'translator', label: 'AI Translator', icon: Languages, roles: ['student', 'teacher', 'admin'] },
    { id: 'premium', label: 'Premium', icon: Crown, roles: ['student', 'teacher', 'admin'] },
    { id: 'leaderboard', label: 'Leaderboard', icon: Trophy, roles: ['student', 'teacher', 'admin'] },
    { id: 'calibration', label: 'Calibration Room', icon: Brain, roles: ['teacher', 'admin'] },
    { id: 'test-creator', label: 'Test Creator', icon: PenTool, roles: ['teacher', 'admin'] },
    { id: 'forensic-vault', label: 'Forensic Review Vault', icon: ShieldAlert, roles: ['teacher', 'admin'] },
    { id: 'proctor', label: 'Omareyah Live assessment', icon: ShieldCheck, roles: ['student', 'teacher', 'admin'] },
    { id: 'settings', label: 'Settings', icon: Settings, roles: ['student', 'teacher', 'admin'] },
  ];

  const filteredItems = menuItems.filter(item => item.roles.includes(userRole || 'student'));

  const handleViewChange = (view: AppView) => {
    onViewChange(view);
    if (window.innerWidth < 1024) {
      onClose();
    }
  };

  return (
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      <div className={`fixed lg:sticky top-0 left-0 h-screen w-[280px] bg-[#110d2e] flex flex-col border-r border-white/5 z-50 transition-all duration-300 transform ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} text-slate-400`}>
        <div className="p-8 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-600/20 rounded-2xl flex items-center justify-center border border-purple-500/30">
              <GraduationCap className="w-7 h-7 text-purple-400" />
            </div>
            <div>
              <h1 className="text-base font-black text-white leading-tight tracking-tighter">Omareyah</h1>
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">English Dept</p>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden p-2 text-slate-500 hover:text-rose-500">
            <LogOut className="w-5 h-5 rotate-180" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-1 custom-scrollbar">
          {filteredItems.map(item => (
            <button
              key={item.id}
              onClick={() => handleViewChange(item.id as AppView)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 group relative ${
                currentView === item.id
                  ? 'bg-purple-600/10 text-purple-400'
                  : 'hover:bg-white/5 hover:text-white'
              }`}
            >
              <item.icon className={`w-5 h-5 transition-colors ${currentView === item.id ? 'text-purple-400' : 'text-slate-500 group-hover:text-white'}`} />
              <span className="font-black text-xs uppercase tracking-widest">{item.label}</span>
              {currentView === item.id && (
                <motion.div 
                  layoutId="sidebar-active"
                  className="absolute right-0 w-1 h-6 bg-purple-500 rounded-l-full shadow-[0_0_15px_rgba(168,85,247,0.5)]" 
                />
              )}
            </button>
          ))}
        </div>

      <div className="p-6 border-t border-white/5 bg-slate-900/40">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-600 flex items-center justify-center text-white font-black text-lg shadow-lg">
            {user?.displayName?.[0] || user?.email?.[0] || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-white truncate">{user?.displayName || 'User'}</p>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{userRole || 'Student'}</p>
          </div>
          <button 
            onClick={onLogout}
            className="p-2 text-slate-500 hover:text-red-400 transition-all hover:bg-red-500/10 rounded-xl"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
    </>
  );
};

export default Sidebar;
