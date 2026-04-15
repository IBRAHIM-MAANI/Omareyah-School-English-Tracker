import React, { useState, useEffect } from "react";
import { 
  Settings, User, Save, CheckCircle, Shield, 
  Palette, Lock, Bell, Loader2
} from "lucide-react";
import { auth, db, doc, updateDoc, handleFirestoreError, OperationType } from "../firebase";

interface SettingsPageProps {
  user: any;
  userRole: 'student' | 'teacher' | 'admin' | null;
}

export default function SettingsPage({ user, userRole }: SettingsPageProps) {
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ full_name: user?.displayName || "" });

  useEffect(() => {
    if (user) {
      setForm({ full_name: user?.displayName || "" });
    }
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Update display name in Firebase Auth (optional, but good for consistency)
      // Note: updateProfile is usually used for Auth, but we also store in Firestore
      
      // Update in Firestore users collection
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        displayName: form.full_name
      });

      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-8">
      
      {/* Sidebar Navigation */}
      <div className="md:col-span-4 space-y-2">
        <h1 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-2">
          <Settings className="text-indigo-600" /> Settings
        </h1>
        <NavButton active icon={<User size={18}/>} label="Personal Profile" />
        <NavButton icon={<Lock size={18}/>} label="Security & PIN" />
        <NavButton icon={<Bell size={18}/>} label="Notifications" />
      </div>

      {/* Main Content Area */}
      <div className="md:col-span-8 space-y-6">
        
        {/* Profile Section */}
        <section className="bg-white rounded-[2rem] border border-slate-100 p-8 shadow-sm">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black text-white bg-indigo-600 shadow-lg">
              {form.full_name?.[0] || user?.email?.[0] || "U"}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">{form.full_name || 'User'}</h2>
              <p className="text-sm text-slate-400">{user?.email}</p>
            </div>
          </div>

          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputBlock 
                label="Full Name" 
                value={form.full_name} 
                onChange={e => setForm({ ...form, full_name: e.target.value })} 
              />
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Role</label>
                <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold border ${userRole === "admin" ? "bg-amber-500/10 text-amber-500 border-amber-500/20" : "bg-indigo-50 text-indigo-600 border-indigo-100"}`}>
                  {userRole === "admin" ? <Shield size={16} /> : <User size={16} />}
                  {userRole === "admin" ? "Super Admin" : userRole === "teacher" ? "Teacher" : "Student"}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">System Email</label>
              <input value={user?.email || ""} disabled className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm text-slate-400 cursor-not-allowed" />
            </div>
          </div>
        </section>

        {/* Theme Customization Section (Simplified for now) */}
        <section className="bg-white rounded-[2rem] border border-slate-100 p-8 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <Palette className="text-indigo-600" size={20} />
            <h3 className="font-bold text-slate-800">Visual Appearance</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <button className="flex flex-col items-center gap-3 p-4 rounded-2xl border-2 border-indigo-600 bg-indigo-50">
              <div className="w-10 h-10 rounded-full shadow-inner bg-indigo-600" />
              <span className="text-xs font-bold text-indigo-700">Classic Purple</span>
            </button>
            <button className="flex flex-col items-center gap-3 p-4 rounded-2xl border-2 border-slate-100 bg-white hover:border-slate-300">
              <div className="w-10 h-10 rounded-full shadow-inner bg-blue-600" />
              <span className="text-xs font-bold text-slate-500">Deep Ocean</span>
            </button>
            <button className="flex flex-col items-center gap-3 p-4 rounded-2xl border-2 border-slate-100 bg-white hover:border-slate-300">
              <div className="w-10 h-10 rounded-full shadow-inner bg-slate-900" />
              <span className="text-xs font-bold text-slate-500">Midnight</span>
            </button>
          </div>
        </section>

        {/* Global Save Button */}
        <button 
          onClick={handleSave}
          disabled={loading}
          className="w-full py-4 rounded-2xl text-white font-black text-sm tracking-widest uppercase transition-all shadow-lg flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 disabled:opacity-50"
        >
          {loading ? <Loader2 className="animate-spin" size={18} /> : saved ? <><CheckCircle size={18} /> Settings Updated</> : <><Save size={18} /> Synchronize Profile</>}
        </button>

        {/* System Info Footnote */}
        <div className="text-center pt-4">
           <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">
             Omareyah English Evolution Tracker v4.0.2
           </p>
        </div>
      </div>
    </div>
  );
}

// Sub-components for cleaner code
function NavButton({ icon, label, active }: { icon: React.ReactNode; label: string; active?: boolean }) {
  return (
    <button className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${active ? 'bg-white shadow-sm border border-slate-100' : 'text-slate-400 hover:bg-indigo-50 hover:text-indigo-600'}`}>
      <span className={active ? 'text-indigo-600' : 'text-slate-400'}>{icon}</span>
      <span className={active ? 'text-slate-900' : ''}>{label}</span>
    </button>
  );
}

function InputBlock({ label, value, onChange }: { label: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <div>
      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{label}</label>
      <input 
        value={value} 
        onChange={onChange}
        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 transition-all" 
      />
    </div>
  );
}
