import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  UserPlus, 
  Users, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  Shield, 
  GraduationCap, 
  Layers,
  Search,
  Filter,
  Activity,
  Clock,
  User
} from 'lucide-react';
import { db, collection, query, where, onSnapshot, updateDoc, doc, setDoc, Timestamp, handleFirestoreError, OperationType, orderBy, limit } from '../firebase';

const AdminDashboard: React.FC = () => {
  const [teachers, setTeachers] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState<'teacher' | 'student' | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    displayName: '',
    password: '',
    grade: '',
    section: '',
    teacherId: '',
    uniqueId: ''
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribeTeachers = onSnapshot(query(collection(db, 'users'), where('role', '==', 'teacher')), (snapshot) => {
      setTeachers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'users');
    });

    const unsubscribeStudents = onSnapshot(query(collection(db, 'users'), where('role', '==', 'student')), (snapshot) => {
      setStudents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'users');
    });

    const unsubscribeLogs = onSnapshot(query(collection(db, 'logs'), orderBy('timestamp', 'desc'), limit(50)), (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'logs');
    });

    return () => {
      unsubscribeTeachers();
      unsubscribeStudents();
      unsubscribeLogs();
    };
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      const userId = `user_${Date.now()}`;
      const finalUniqueId = formData.uniqueId || `OM-${Math.floor(10000 + Math.random() * 90000)}`;
      
      const userData: any = {
        uid: userId,
        email: formData.email,
        displayName: formData.displayName,
        password: formData.password, // Note: In a real app, passwords should not be stored in plain text in Firestore.
        role: showAddForm,
        uniqueId: finalUniqueId,
        createdAt: Timestamp.now(),
        is_pending: showAddForm === 'teacher'
      };

      if (showAddForm === 'student') {
        userData.grade = formData.grade;
        userData.section = formData.section;
        userData.teacherId = formData.teacherId;
      }

      await setDoc(doc(db, 'users', userId), userData);
      
      setSuccess(`${showAddForm === 'teacher' ? 'Teacher' : 'Student'} added successfully! ID: ${finalUniqueId}`);
      setShowAddForm(null);
      setFormData({ email: '', displayName: '', password: '', grade: '', section: '', teacherId: '', uniqueId: '' });
    } catch (err) {
      setError("Failed to add user.");
      console.error(err);
    }
  };

  const verifyTeacher = async (teacherId: string, grade: string, section: string) => {
    try {
      await updateDoc(doc(db, 'users', teacherId), {
        is_pending: false,
        grade,
        section
      });
      setSuccess("Teacher verified and assigned!");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'users');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tighter text-[#0f172a]">Admin Dashboard</h1>
          <p className="text-[#64748b] text-sm font-bold uppercase tracking-widest mt-1">Platform Management</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => setShowAddForm('teacher')}
            className="flex items-center gap-2 bg-white hover:bg-gray-50 border border-gray-200 px-6 py-3 rounded-2xl transition-all group shadow-sm"
          >
            <UserPlus className="w-4 h-4 text-indigo-500 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-black uppercase tracking-widest text-[#0f172a]">Add Teacher</span>
          </button>
          <button 
            onClick={() => setShowAddForm('student')}
            className="flex items-center gap-2 bg-white hover:bg-gray-50 border border-gray-200 px-6 py-3 rounded-2xl transition-all group shadow-sm"
          >
            <UserPlus className="w-4 h-4 text-emerald-500 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-black uppercase tracking-widest text-[#0f172a]">Add Student</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-4 rounded-2xl flex items-center gap-3">
          <XCircle className="w-5 h-5" />
          <p className="text-sm font-bold">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/50 text-emerald-500 p-4 rounded-2xl flex items-center gap-3">
          <CheckCircle className="w-5 h-5" />
          <p className="text-sm font-bold">{success}</p>
        </div>
      )}

      {showAddForm && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel p-8 rounded-[32px] border-indigo-100 bg-white/80"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-black tracking-tight text-[#0f172a]">Add New {showAddForm === 'teacher' ? 'Teacher' : 'Student'}</h2>
            <button onClick={() => setShowAddForm(null)} className="text-[#64748b] hover:text-[#0f172a]">
              <XCircle className="w-6 h-6" />
            </button>
          </div>
          <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-[#64748b] uppercase tracking-widest">Full Name</label>
              <input 
                type="text" 
                required
                value={formData.displayName}
                onChange={(e) => setFormData({...formData, displayName: e.target.value})}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition-all text-[#0f172a]"
                placeholder="e.g. John Doe"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-[#64748b] uppercase tracking-widest">Email Address</label>
              <input 
                type="email" 
                required
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition-all text-[#0f172a]"
                placeholder="email@example.com"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-[#64748b] uppercase tracking-widest">Password</label>
              <input 
                type="password" 
                required
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition-all text-[#0f172a]"
                placeholder="••••••••"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-[#64748b] uppercase tracking-widest">Manual OM-ID (Optional)</label>
              <input 
                type="text" 
                value={formData.uniqueId}
                onChange={(e) => setFormData({...formData, uniqueId: e.target.value})}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition-all text-[#0f172a]"
                placeholder="e.g. OM-12345"
              />
            </div>
            {showAddForm === 'student' && (
              <>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[#64748b] uppercase tracking-widest">Grade</label>
                  <input 
                    type="text" 
                    required
                    value={formData.grade}
                    onChange={(e) => setFormData({...formData, grade: e.target.value})}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition-all text-[#0f172a]"
                    placeholder="e.g. 10"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[#64748b] uppercase tracking-widest">Section</label>
                  <input 
                    type="text" 
                    required
                    value={formData.section}
                    onChange={(e) => setFormData({...formData, section: e.target.value})}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition-all text-[#0f172a]"
                    placeholder="e.g. A"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black text-[#64748b] uppercase tracking-widest">Assign Teacher</label>
                  <select 
                    value={formData.teacherId}
                    onChange={(e) => setFormData({...formData, teacherId: e.target.value})}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition-all appearance-none text-[#0f172a]"
                  >
                    <option value="" className="bg-white">Select a teacher</option>
                    {teachers.filter(t => !t.is_pending).map(t => (
                      <option key={t.id} value={t.id} className="bg-white">{t.displayName} ({t.grade}-{t.section})</option>
                    ))}
                  </select>
                </div>
              </>
            )}
            <div className="md:col-span-2 flex justify-end">
              <button 
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-black px-8 py-3 rounded-xl transition-all shadow-lg shadow-indigo-500/20"
              >
                Create Account
              </button>
            </div>
          </form>
        </motion.div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Pending Teachers */}
        <div className="glass-panel rounded-[32px] p-8 space-y-6">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-amber-500" />
            <h2 className="text-xl font-black tracking-tight text-[#0f172a]">Pending Teachers</h2>
          </div>
          <div className="space-y-4">
            {teachers.filter(t => t.is_pending).length === 0 ? (
              <p className="text-[#64748b] text-sm font-bold italic">No pending teacher requests.</p>
            ) : (
              teachers.filter(t => t.is_pending).map(teacher => (
                <div key={teacher.id} className="bg-gray-50 border border-gray-100 p-6 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-black text-[#0f172a]">{teacher.displayName}</p>
                      <p className="text-[10px] text-[#64748b] font-bold uppercase tracking-widest">{teacher.email}</p>
                    </div>
                    <div className="bg-amber-50 text-amber-600 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border border-amber-100">
                      Pending {teacher.verificationCode && `(Code: ${teacher.verificationCode})`}
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1 space-y-1">
                      <label className="text-[9px] font-black text-[#64748b] uppercase tracking-widest">Assign Grade</label>
                      <input 
                        type="text" 
                        id={`grade-${teacher.id}`}
                        placeholder="Grade"
                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-500 text-[#0f172a]"
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <label className="text-[9px] font-black text-[#64748b] uppercase tracking-widest">Assign Section</label>
                      <input 
                        type="text" 
                        id={`section-${teacher.id}`}
                        placeholder="Section"
                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-500 text-[#0f172a]"
                      />
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      const g = (document.getElementById(`grade-${teacher.id}`) as HTMLInputElement).value;
                      const s = (document.getElementById(`section-${teacher.id}`) as HTMLInputElement).value;
                      if (g && s) verifyTeacher(teacher.id, g, s);
                      else setError("Please specify Grade and Section.");
                    }}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded-xl transition-all text-xs uppercase tracking-widest"
                  >
                    Verify & Assign
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Active Teachers */}
        <div className="glass-panel rounded-[32px] p-8 space-y-6">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-indigo-500" />
            <h2 className="text-xl font-black tracking-tight text-[#0f172a]">Active Teachers</h2>
          </div>
          <div className="space-y-3">
            {teachers.filter(t => !t.is_pending).map(teacher => (
              <div key={teacher.id} className="flex items-center justify-between bg-gray-50 border border-gray-100 p-4 rounded-2xl">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500 font-black border border-indigo-100">
                    {teacher.displayName[0]}
                  </div>
                  <div>
                    <p className="font-black text-[#0f172a] text-sm">{teacher.displayName}</p>
                    <p className="text-[9px] text-[#64748b] font-bold uppercase tracking-widest">{teacher.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-[10px] font-black text-[#0f172a] uppercase tracking-widest">Grade {teacher.grade}</p>
                    <p className="text-[9px] text-[#64748b] font-bold uppercase tracking-widest">Section {teacher.section}</p>
                  </div>
                  <button className="text-[#64748b] hover:text-[#0f172a] transition-colors">
                    <Layers className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Global Move Tracker */}
        <div className="glass-panel rounded-[32px] p-8 space-y-6 xl:col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Activity className="w-5 h-5 text-indigo-500" />
              <h2 className="text-xl font-black tracking-tight text-[#0f172a]">Global Move Tracker</h2>
            </div>
            <div className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border border-indigo-100">
              Live Feed
            </div>
          </div>
          
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-separate border-spacing-y-2">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-[10px] font-black text-[#64748b] uppercase tracking-widest">User</th>
                  <th className="px-4 py-2 text-[10px] font-black text-[#64748b] uppercase tracking-widest">Action</th>
                  <th className="px-4 py-2 text-[10px] font-black text-[#64748b] uppercase tracking-widest">Details</th>
                  <th className="px-4 py-2 text-[10px] font-black text-[#64748b] uppercase tracking-widest">Time</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-[#64748b] text-sm font-bold italic">
                      No activity logs found.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="bg-gray-50 group hover:bg-gray-100 transition-colors">
                      <td className="px-4 py-3 rounded-l-2xl">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500 border border-indigo-100">
                            <User className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-xs font-black text-[#0f172a]">{log.userName}</p>
                            <p className="text-[9px] text-[#64748b] font-bold uppercase tracking-widest">{log.userRole}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md border ${
                          log.action === 'login' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                          log.action === 'assessment' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                          'bg-gray-100 text-[#64748b] border-gray-200'
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-[#64748b] font-medium">{log.details}</p>
                      </td>
                      <td className="px-4 py-3 rounded-r-2xl">
                        <div className="flex items-center gap-2 text-[#64748b]">
                          <Clock className="w-3 h-3" />
                          <span className="text-[10px] font-bold">
                            {log.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Student Directory */}
        <div className="glass-panel rounded-[32px] p-8 space-y-6 xl:col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <GraduationCap className="w-5 h-5 text-emerald-500" />
              <h2 className="text-xl font-black tracking-tight text-[#0f172a]">Student Directory</h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b]" />
                <input 
                  type="text" 
                  placeholder="Search students..."
                  className="bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2 text-xs outline-none focus:border-indigo-500 w-64 text-[#0f172a]"
                />
              </div>
              <button className="p-2 bg-gray-50 border border-gray-200 rounded-xl text-[#64748b] hover:text-[#0f172a]">
                <Filter className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {students.map(student => (
              <div key={student.id} className="bg-gray-50 border border-gray-100 p-5 rounded-2xl space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-500 font-black text-xs border border-emerald-100">
                    {student.displayName[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="font-black text-[#0f172a] text-sm truncate">{student.displayName}</p>
                    <p className="text-[9px] text-[#64748b] font-bold uppercase tracking-widest truncate">{student.email}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <div className="flex gap-3">
                    <div className="text-center">
                      <p className="text-[8px] font-black text-[#64748b] uppercase tracking-widest">Grade</p>
                      <p className="text-xs font-black text-[#0f172a]">{student.grade}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[8px] font-black text-[#64748b] uppercase tracking-widest">Section</p>
                      <p className="text-xs font-black text-[#0f172a]">{student.section}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] font-black text-[#64748b] uppercase tracking-widest">Teacher</p>
                    <p className="text-[10px] font-black text-indigo-600 truncate max-w-[100px]">
                      {teachers.find(t => t.id === student.teacherId)?.displayName || 'Unassigned'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
