import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, Play, Square, FileText, CheckCircle, AlertCircle, Loader2, ChevronRight, User, LogOut, Plus, GraduationCap, Shield, Mail, Lock, Bot, Headphones, Menu } from 'lucide-react';
import { GeminiLiveService } from '../services/geminiLiveService';
import { MASTER_EXAMINER_PROMPT, SILENT_PROCTOR_PROMPT, TOOLS } from '../constants';
import { auth, db, collection, setDoc, doc, updateDoc, Timestamp, serverTimestamp, handleFirestoreError, OperationType, googleProvider, microsoftProvider, facebookProvider, appleProvider, getDoc, query, where, getDocs, onSnapshot, storage, ref, uploadBytes, getDownloadURL, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from '../firebase';
import { onAuthStateChanged, signInWithPopup, signOut, User as FirebaseUser } from 'firebase/auth';
import AcademicRecords from './AcademicRecords';
import ScoreDashboard from './ScoreDashboard';
import Sidebar, { AppView } from './Sidebar';
import ReadingTest from './ReadingTest';
import AITranslator from './AITranslator';
import LinguisticsBot from './LinguisticsBot';
import AccentTrainer from './AccentTrainer';
import PronunciationTrainer from './PronunciationTrainer';
import VocabularyTraining from './VocabularyTraining';
import CommunicationHub from './CommunicationHub';
import AuditHub from './AuditHub';
import AdminDashboard from './AdminDashboard';
import Dashboard from './Dashboard';
import AzureAssessments from './AzureAssessments';
import StudentHistory from './StudentHistory';
import LiveAITutor from './LiveAITutor';
import VisualLab from './VisualLab';
import AdminHub from './AdminHub';
import Students from './Students';
import TheVault from './TheVault';
import Leaderboard from './Leaderboard';
import CalibrationRoom from './CalibrationRoom';
import Marks from './Marks';
import GlobalProctorAssessment from './GlobalProctorAssessment';
import OmareyahLiveAssessment from './OmareyahLiveAssessment';
import AdvancedTestCreator from './AdvancedTestCreator';
import ForensicReviewVault from './ForensicReviewVault';
import SettingsPage from './SettingsPage';

const AssessmentInterface: React.FC = () => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userRole, setUserRole] = useState<'student' | 'teacher' | 'admin' | null>(null);
  const [currentView, setCurrentView] = useState<AppView>('dashboard');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [selectedPortal, setSelectedPortal] = useState<'teacher' | 'student' | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [generatedId, setGeneratedId] = useState('');

  const generateUniqueId = () => {
    return `OM-${Math.floor(10000 + Math.random() * 90000)}`;
  };

  const logActivity = async (action: string, details: string, userData: any) => {
    try {
      await setDoc(doc(collection(db, 'logs')), {
        userId: userData.uid,
        userName: userData.displayName || userData.email,
        userRole: userData.role || 'student',
        action,
        details,
        timestamp: serverTimestamp()
      });
    } catch (err) {
      console.error("Failed to log activity:", err);
    }
  };
  const [selectedTool, setSelectedTool] = useState(TOOLS[0]);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [transcription, setTranscription] = useState<{ text: string; isModel: boolean }[]>([]);
  const [report, setReport] = useState<string | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTopic, setActiveTopic] = useState<{ topic: string; questions: string[] } | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [showVerification, setShowVerification] = useState(false);
  const [loginMode, setLoginMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [adminCredentials, setAdminCredentials] = useState({ email: '', password: '' });
  
  const [signupData, setSignupData] = useState({ displayName: '', email: '', password: '', role: 'student' as 'student' | 'teacher' });
  
  const liveServiceRef = useRef<GeminiLiveService | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          const userEmail = user.email?.toLowerCase();
          const isAdmin = userEmail === "ibrahimmaani337@gmail.com" || userEmail === "ibrahemmatooq@gmail.com";

          if (userDoc.exists()) {
            const data = userDoc.data();
            setUserRole(data.role || (isAdmin ? 'admin' : 'student'));
            setIsPending(data.is_pending || false);
            if (data.role === 'admin') setCurrentView('admin-hub');
            // Log login activity
            logActivity('login', 'User logged into the platform', { uid: user.uid, ...data });
          } else {
            // New user logic
            const role: 'student' | 'teacher' | 'admin' = isAdmin ? 'admin' : 'student';
            const isPending = false;
            
            await setDoc(doc(db, 'users', user.uid), {
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
              role: role,
              is_pending: isPending,
              createdAt: serverTimestamp()
            });
            
            // Log signup activity
            logActivity('signup', `New ${role} account created`, { uid: user.uid, email: user.email, role: role });

            setUserRole(role);
            setIsPending(isPending);
            if (role === 'admin') setCurrentView('admin-hub');
          }
        } catch (err) {
          console.error("Error fetching user role:", err);
        }
      } else {
        setUserRole(null);
        setIsPending(false);
      }
      setIsAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setActiveTopic(null);
      return;
    }

    const unsubscribeTopic = onSnapshot(query(collection(db, 'speaking_topics'), where('isActive', '==', true)), (snapshot) => {
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        setActiveTopic({ topic: data.topic, questions: data.questions });
      } else {
        setActiveTopic(null);
      }
    }, (error) => {
      console.error("Error fetching active topic:", error);
    });

    return () => unsubscribeTopic();
  }, [user]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcription]);

  const handleLogin = async (provider: 'google' | 'microsoft' | 'facebook' | 'apple') => {
    try {
      let authProvider;
      switch(provider) {
        case 'google': authProvider = googleProvider; break;
        case 'microsoft': authProvider = microsoftProvider; break;
        case 'facebook': authProvider = facebookProvider; break;
        case 'apple': authProvider = appleProvider; break;
      }
      
      const result = await signInWithPopup(auth, authProvider);
      const user = result.user;
      
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) {
        const newId = generateUniqueId();
        const userEmail = user.email?.toLowerCase();
        const isAdmin = userEmail === "ibrahimmaani337@gmail.com" || userEmail === "ibrahemmatooq@gmail.com";
        const finalRole = isAdmin ? 'admin' : 'student';
        const isPending = false;
        
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          role: finalRole,
          uniqueId: newId,
          is_pending: isPending,
          createdAt: serverTimestamp(),
          grade: '8th',
          section: 'A',
          cefr: 'A1'
        });

        setGeneratedId(newId);
        setShowSuccessModal(true);
        setUserRole(finalRole);
        setIsPending(isPending);
        if (finalRole === 'admin') setCurrentView('admin-hub');
      } else {
        const data = userDoc.data();
        setUserRole(data.role || 'student');
        setIsPending(data.is_pending || false);
      }
    } catch (err: any) {
      if (err.code === 'auth/operation-not-allowed') {
        setError(`${provider.charAt(0).toUpperCase() + provider.slice(1)} sign-in is not enabled in your Firebase Console. Please go to Authentication > Sign-in method and enable it.`);
      } else {
        setError(`Failed to sign in with ${provider}.`);
      }
      console.error(err);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    
    const { email, password } = adminCredentials;

    try {
      if (loginMode === 'signup') {
        const userCredential = await createUserWithEmailAndPassword(auth, signupData.email, signupData.password);
        const user = userCredential.user;
        const newId = generateUniqueId();
        const isTeacher = signupData.role === 'teacher';
        
        // Generate a simple 6-digit verification code for teachers
        const vCode = isTeacher ? Math.floor(100000 + Math.random() * 900000).toString() : null;
        
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          email: user.email,
          displayName: signupData.displayName || signupData.email.split('@')[0],
          role: signupData.role,
          uniqueId: newId,
          is_pending: isTeacher,
          verificationCode: vCode,
          createdAt: serverTimestamp(),
          grade: isTeacher ? '' : '8th',
          section: isTeacher ? '' : 'A',
          cefr: isTeacher ? '' : 'A1'
        });

        logActivity('signup', `New ${signupData.role} account created via email: ${newId}`, { uid: user.uid, email: user.email });
        
        if (isTeacher) {
          setSuccess("Teacher account created! Please check your email for the verification code (Demo: " + vCode + ")");
        } else {
          setSuccess("Account created successfully! You can now sign in.");
        }
        
        setLoginMode('login');
        setSignupData({ displayName: '', email: '', password: '', role: 'student' });
      } else if (loginMode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
      } else if (loginMode === 'forgot') {
        await sendPasswordResetEmail(auth, email);
        setSuccess("Password reset email sent!");
        setLoginMode('login');
      }
    } catch (err: any) {
      if (err.code === 'auth/operation-not-allowed') {
        setError("Email/Password sign-in is not enabled in your Firebase Console.");
      } else if (err.code === 'auth/email-already-in-use') {
        setError("This email is already registered.");
      } else if (err.code === 'auth/weak-password') {
        setError("Password should be at least 6 characters.");
      } else if (err.code === 'auth/invalid-credential') {
        setError("Invalid email or password.");
      } else if (err.code === 'auth/user-not-found') {
        setError("No user found with this email.");
      } else {
        setError("Authentication failed. Please try again.");
      }
      console.error(err);
    }
  };

  const verifyTeacherCode = async () => {
    if (!user) return;
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists() && userDoc.data().verificationCode === verificationCode) {
        await updateDoc(doc(db, 'users', user.uid), { is_pending: false });
        setIsPending(false);
        setSuccess("Account verified! Please wait for an administrator to assign your Grade and Section.");
      } else {
        setError("Invalid verification code.");
      }
    } catch (err) {
      console.error(err);
      setError("Verification failed.");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setCurrentView('dashboard');
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  const startAssessment = async () => {
    if (!user) return;
    
    setError(null);
    setReport(null);
    setTranscription([]);
    setIsSessionActive(true);
    
    let systemInstruction = '';
    let disableVAD = false;

    if (selectedTool.id === 'silent') {
      if (!activeTopic) {
        setError("No active speaking topic found. Please ask your teacher to set a topic.");
        setIsSessionActive(false);
        return;
      }
      systemInstruction = SILENT_PROCTOR_PROMPT
        .replace('{TOPIC}', activeTopic.topic)
        .replace('{QUESTIONS}', activeTopic.questions.map((q, i) => `${i + 1}. ${q}`).join('\n'));
      disableVAD = true;
    } else {
      systemInstruction = `${MASTER_EXAMINER_PROMPT}\n\n${selectedTool.modifier}`;
    }
    
    try {
      if (!liveServiceRef.current) {
        liveServiceRef.current = new GeminiLiveService();
      }
      
      // Mobile user gesture check
      await liveServiceRef.current.resumeAudioContext();
      
      const voiceName = selectedTool.id === 'silent' ? 'Fenrir' : 'Zephyr';
      
      await liveServiceRef.current.connect(systemInstruction, {
        onTranscription: (text, isModel) => {
          setTranscription(prev => [...prev, { text, isModel }]);
          
          if (isModel && text.includes("The assessment is now complete. Generating your report...")) {
            setIsGeneratingReport(true);
          }
        },
        onMessage: (message) => {
          if (message.serverContent?.modelTurn?.parts?.[0]?.text) {
            const text = message.serverContent.modelTurn.parts[0].text;
            if (text.includes("[DATA_REPORT]") || text.includes("[DATA_BLOCK]")) {
              saveReport(text);
            }
          }
        },
        onError: (err) => {
          setError("An error occurred during the session.");
          setIsSessionActive(false);
        }
      }, { disableVAD, voiceName });
    } catch (err) {
      setError("Failed to start assessment session.");
      setIsSessionActive(false);
    }
  };

  const stopAssessment = () => {
    liveServiceRef.current?.disconnect();
    setIsSessionActive(false);
  };

  const saveReport = async (fullText: string) => {
    if (!user) return;
    
    try {
      let reportData: any = null;

      // Try parsing [DATA_REPORT] block
      const reportMatch = fullText.match(/\[DATA_REPORT\]([\s\S]*?)\[\/DATA_REPORT\]/i);
      if (reportMatch) {
        try {
          reportData = JSON.parse(reportMatch[1].trim());
        } catch (e) {
          console.error("Failed to parse [DATA_REPORT] JSON", e);
        }
      }

      // Try parsing [DATA_BLOCK] block if reportData is still null
      if (!reportData) {
        const blockMatch = fullText.match(/\[DATA_BLOCK\]([\s\S]*?)\[\/DATA_BLOCK\]/i);
        if (blockMatch) {
          try {
            const rawData = JSON.parse(blockMatch[1].trim());
            // Map [DATA_BLOCK] fields to standard fields
            reportData = {
              fluency: rawData.f,
              vocabulary: rawData.v,
              accuracy: rawData.a,
              intonation: rawData.i,
              cefr_level: rawData.level || "N/A"
            };
          } catch (e) {
            console.error("Failed to parse [DATA_BLOCK] JSON", e);
          }
        }
      }

      if (!reportData) {
        console.error("No valid data block found in text");
        return;
      }

      const { accuracy, fluency, intonation, vocabulary, cefr_level, strengths, weaknesses, improvement_plan, exam_score } = reportData;

      // Handle audio recording upload
      let audioUrl = null;
      if (liveServiceRef.current) {
        const audioBlob = await liveServiceRef.current.getRecordedAudio();
        if (audioBlob) {
          const audioRef = ref(storage, `assessments/${user.uid}/${Date.now()}.webm`);
          const uploadResult = await uploadBytes(audioRef, audioBlob);
          audioUrl = await getDownloadURL(uploadResult.ref);
        }
      }

      const resultData = {
        studentId: user.uid,
        studentEmail: user.email,
        overallLevel: cefr_level || "N/A",
        examScore: exam_score || null,
        strengths: strengths || "",
        weaknesses: weaknesses || "",
        improvementPlan: Array.isArray(improvement_plan) ? improvement_plan : [improvement_plan],
        createdAt: Timestamp.now(),
        toolId: selectedTool.name,
        fullReport: fullText,
        type: 'speaking',
        audioUrl: audioUrl,
        scores: {
          accuracy: accuracy || 0,
          fluency: fluency || 0,
          intonation: intonation || 0,
          vocabulary: vocabulary || 0,
        }
      };

      const resultId = `result_${Date.now()}`;
      // Save to student_assessment_log for the new dashboard
      await setDoc(doc(db, 'student_assessment_log', resultId), resultData);
      // Also save to student_records for unified academic history
      await setDoc(doc(db, 'student_records', resultId), resultData);
      
      setReport(fullText);
      setIsGeneratingReport(false);
      setIsSessionActive(false);
      liveServiceRef.current?.disconnect();
      
      // Show notification
      setSuccess("Your assessment has been recorded! Check your Score Dashboard for details.");
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'student_assessment_log');
    }
  };

  if (!isAuthReady) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f8f9fa] text-[#0f172a] relative overflow-hidden">
        <div className="atmospheric-bg" />
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#f1f5f9] p-6 font-sans relative overflow-hidden">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-[440px] w-full bg-white p-10 rounded-[24px] shadow-xl border border-slate-200 text-center space-y-8 relative z-10"
        >
          {/* Circular School Logo */}
          <div className="flex justify-center">
            <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-slate-100 shadow-lg bg-white flex items-center justify-center">
              <img 
                src="https://ais-dev-hck56wcvz74mjwrtn3h6q4-664313155157.europe-west2.run.app/omareyah-campus.jpg" 
                alt="Omareyah Logo" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-slate-900 leading-tight">Welcome to Omarehya Schools</h1>
            <p className="text-slate-500 text-sm font-medium">Sign in to continue</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-xl text-xs font-medium">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-100 text-green-600 p-4 rounded-xl text-xs font-medium">
              {success}
            </div>
          )}

          {/* Social Buttons */}
          <div className="space-y-3">
            <button
              onClick={() => handleLogin('google')}
              className="w-full py-3 px-6 bg-white border border-slate-200 rounded-xl text-slate-700 font-semibold text-sm hover:bg-slate-50 transition-all flex items-center justify-center gap-3 group"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
              Continue with Google
            </button>
            <button
              onClick={() => handleLogin('microsoft')}
              className="w-full py-3 px-6 bg-white border border-slate-200 rounded-xl text-slate-700 font-semibold text-sm hover:bg-slate-50 transition-all flex items-center justify-center gap-3 group"
            >
              <img src="https://www.gstatic.com/images/branding/product/1x/ms_outlook_64dp.png" className="w-5 h-5" alt="Microsoft" />
              Continue with Microsoft
            </button>
            <button
              onClick={() => handleLogin('facebook')}
              className="w-full py-3 px-6 bg-white border border-slate-200 rounded-xl text-slate-700 font-semibold text-sm hover:bg-slate-50 transition-all flex items-center justify-center gap-3 group"
            >
              <img src="https://www.gstatic.com/images/branding/product/1x/facebook_64dp.png" className="w-5 h-5" alt="Facebook" />
              Continue with Facebook
            </button>
            <button
              onClick={() => handleLogin('apple')}
              className="w-full py-3 px-6 bg-white border border-slate-200 rounded-xl text-slate-700 font-semibold text-sm hover:bg-slate-50 transition-all flex items-center justify-center gap-3 group"
            >
              <img src="https://www.gstatic.com/images/branding/product/1x/apple_64dp.png" className="w-5 h-5" alt="Apple" />
              Continue with Apple
            </button>
          </div>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-[10px] uppercase">
              <span className="bg-white px-4 text-slate-400 font-bold tracking-[0.2em]">OR</span>
            </div>
          </div>

          {/* Traditional Login/Signup Fields */}
          <form onSubmit={handleEmailAuth} className="space-y-5 text-left">
            {loginMode === 'signup' && (
              <>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 ml-1">Account Type</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setSignupData({...signupData, role: 'student'})}
                      className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${signupData.role === 'student' ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-500/20' : 'bg-slate-50 text-slate-400 border-slate-200'}`}
                    >
                      Student
                    </button>
                    <button
                      type="button"
                      onClick={() => setSignupData({...signupData, role: 'teacher'})}
                      className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${signupData.role === 'teacher' ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-500/20' : 'bg-slate-50 text-slate-400 border-slate-200'}`}
                    >
                      Teacher
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 ml-1">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="John Doe"
                      required
                      value={signupData.displayName}
                      onChange={(e) => setSignupData({...signupData, displayName: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-4 py-3 text-sm outline-none focus:border-slate-400 transition-all text-slate-900 placeholder:text-slate-400"
                    />
                  </div>
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 ml-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="email" 
                  placeholder="you@example.com"
                  required
                  value={loginMode === 'signup' ? signupData.email : adminCredentials.email}
                  onChange={(e) => loginMode === 'signup' 
                    ? setSignupData({...signupData, email: e.target.value})
                    : setAdminCredentials({...adminCredentials, email: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-4 py-3 text-sm outline-none focus:border-slate-400 transition-all text-slate-900 placeholder:text-slate-400"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 ml-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="password" 
                  placeholder="••••••••"
                  required
                  value={loginMode === 'signup' ? signupData.password : adminCredentials.password}
                  onChange={(e) => loginMode === 'signup'
                    ? setSignupData({...signupData, password: e.target.value})
                    : setAdminCredentials({...adminCredentials, password: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-4 py-3 text-sm outline-none focus:border-slate-400 transition-all text-slate-900 placeholder:text-slate-400"
                />
              </div>
            </div>

            <button 
              type="submit"
              className="w-full py-3.5 bg-[#0f172a] text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
            >
              {loginMode === 'login' ? 'Sign in' : loginMode === 'signup' ? 'Create Account' : 'Reset Password'}
            </button>
            
            <div className="flex items-center justify-between pt-1">
              <button 
                type="button" 
                onClick={() => setLoginMode(loginMode === 'forgot' ? 'login' : 'forgot')}
                className="text-[11px] font-bold text-slate-500 hover:text-slate-900 transition-colors"
              >
                {loginMode === 'forgot' ? 'Back to login' : 'Forgot password?'}
              </button>
              <button
                type="button"
                onClick={() => setLoginMode(loginMode === 'signup' ? 'login' : 'signup')}
                className="text-[11px] font-medium text-slate-500 hover:text-slate-900 transition-colors"
              >
                {loginMode === 'signup' ? (
                  <>Already have an account? <span className="font-bold">Sign in</span></>
                ) : (
                  <>Need an account? <span className="font-bold">Sign up</span></>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    );
  }

  if (isPending) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0f172a] text-white p-6 relative overflow-hidden">
        <div className="atmospheric-bg" />
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-slate-900/40 backdrop-blur-2xl p-12 rounded-[48px] text-center space-y-8 relative z-10 shadow-2xl border border-white/5"
        >
          <div className="w-20 h-20 bg-amber-500/10 rounded-[32px] flex items-center justify-center mx-auto border border-amber-500/20">
            <Shield className="w-10 h-10 text-amber-500" />
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-black tracking-tighter text-white">Account Pending</h2>
            <p className="text-slate-400 text-sm font-bold uppercase tracking-widest leading-relaxed">
              Your teacher account is awaiting activation. 
              <br />
              <span className="text-indigo-400">Enter your 6-digit verification code</span> or wait for administrator approval.
            </p>
          </div>

          {!showVerification ? (
            <button 
              onClick={() => setShowVerification(true)}
              className="accent-button w-full py-4 text-xs uppercase tracking-[0.3em]"
            >
              Enter Verification Code
            </button>
          ) : (
            <div className="space-y-4">
              <input 
                type="text" 
                maxLength={6}
                placeholder="000000"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                className="w-full bg-slate-900/50 border border-white/5 rounded-2xl px-4 py-4 text-center text-2xl font-black tracking-[0.5em] outline-none focus:border-purple-500 text-white placeholder:text-slate-700"
              />
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowVerification(false)}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-slate-400 font-black py-4 rounded-2xl transition-all text-[10px] uppercase tracking-widest"
                >
                  Cancel
                </button>
                <button 
                  onClick={verifyTeacherCode}
                  className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-black py-4 rounded-2xl transition-all shadow-lg shadow-purple-500/20 text-[10px] uppercase tracking-widest"
                >
                  Verify
                </button>
              </div>
            </div>
          )}

          <button 
            onClick={handleLogout}
            className="text-slate-500 hover:text-white text-[10px] font-black uppercase tracking-[0.3em] transition-colors"
          >
            Sign out and try again
          </button>
        </motion.div>
      </div>
    );
  }

  if (user && !selectedPortal) {
    // Skip portal selection per request
    setSelectedPortal('student');
    return null;
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <Dashboard 
            user={user} 
            userRole={userRole} 
            onLogout={handleLogout} 
            onViewChange={setCurrentView} 
          />
        );
      case 'hub':
        return <CommunicationHub />;
      case 'audit':
        return <AuditHub />;
      case 'azure-assessments':
        return <AzureAssessments />;
      case 'history':
        return <StudentHistory />;
      case 'live-tutor':
        return <LiveAITutor />;
      case 'visual-lab':
        return <VisualLab />;
      case 'admin-hub':
        return <AdminHub />;
      case 'students':
        return <Students onViewChange={setCurrentView} />;
      case 'speaking':
        return renderAssessment();
      case 'reading':
        return <ReadingTest />;
      case 'progress':
        return <ScoreDashboard />;
      case 'marks':
        return <Marks />;
      case 'records':
        return <TheVault />;
      case 'leaderboard':
        return <Leaderboard />;
      case 'calibration':
        return <CalibrationRoom />;
      case 'test-creator':
        return <AdvancedTestCreator />;
      case 'forensic-vault':
        return <ForensicReviewVault />;
      case 'proctor':
        return <OmareyahLiveAssessment student={{ uid: user?.uid || '', displayName: user?.displayName || user?.email || 'Student' }} />;
      case 'translator':
        return <AITranslator />;
      case 'bot':
        return <LinguisticsBot />;
      case 'accent':
        return <AccentTrainer />;
      case 'pronunciation':
        return <PronunciationTrainer missedWords={[]} onClose={() => setCurrentView('dashboard')} />;
      case 'vocabulary':
        return <VocabularyTraining />;
      case 'reports':
        return <AcademicRecords />;
      case 'analytics':
        return <ScoreDashboard />;
      case 'settings':
        return <SettingsPage user={user} userRole={userRole} />;
      default:
        return (
          <Dashboard 
            user={user} 
            userRole={userRole} 
            onLogout={handleLogout} 
            onViewChange={setCurrentView} 
          />
        );
    }
  };

  const renderAssessment = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Sidebar: Tool Selection & Status */}
      <div className="lg:col-span-1 space-y-6">
        <div className="glass-panel rounded-[40px] p-8 space-y-8">
          <div className="space-y-2">
            <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1">Assessment Mode</h2>
            <div className="space-y-6">
              {['General', 'Exam Prep', 'Specialized'].map(category => (
                <div key={category} className="space-y-3">
                  <h3 className="text-[9px] font-black text-slate-600 uppercase tracking-widest px-2">{category}</h3>
                  <div className="space-y-2">
                    {TOOLS.filter(t => t.category === category).map(tool => (
                      <div key={tool.id} className="space-y-2">
                        <button
                          onClick={() => setSelectedTool(tool)}
                          disabled={isSessionActive}
                          className={`w-full text-left p-5 rounded-3xl transition-all border ${
                            selectedTool.id === tool.id 
                              ? 'bg-purple-600/10 border-purple-500/30 text-purple-400' 
                              : 'bg-slate-900/50 border-white/5 text-slate-400 hover:bg-white/5'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-black uppercase tracking-widest">{tool.name}</span>
                            {selectedTool.id === tool.id && <CheckCircle className="w-4 h-4" />}
                          </div>
                          <p className="text-[10px] font-bold opacity-60 leading-relaxed">{tool.description}</p>
                        </button>
                        
                        {selectedTool.id === 'silent' && tool.id === 'silent' && (userRole === 'teacher' || userRole === 'admin') && (
                          <button 
                            onClick={() => setCurrentView('students')}
                            className="w-full py-3 px-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-[10px] font-black text-slate-400 hover:text-white flex items-center justify-center gap-2 transition-all uppercase tracking-widest"
                          >
                            <Plus className="w-3 h-3" />
                            Manage Topics
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {!isSessionActive && !report && (
            <button
              onClick={startAssessment}
              className="w-full flex items-center justify-center gap-4 bg-purple-600 text-white hover:bg-purple-700 font-black py-7 rounded-[32px] transition-all shadow-2xl shadow-purple-500/20 group active:scale-[0.98]"
            >
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                <Play className="w-5 h-5 text-purple-600 fill-current ml-1" />
              </div>
              <span className="text-lg tracking-tighter uppercase">Start Session</span>
            </button>
          )}

          {isSessionActive && (
            <button
              onClick={stopAssessment}
              className="w-full flex items-center justify-center gap-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 font-black py-7 rounded-[32px] transition-all shadow-2xl active:scale-[0.98]"
            >
              <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center animate-pulse shadow-lg shadow-red-500/20">
                <Square className="w-5 h-5 text-white fill-current" />
              </div>
              <span className="text-lg tracking-tighter uppercase">End Session</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="lg:col-span-2 space-y-6">
        <AnimatePresence mode="wait">
          {error && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-red-500/10 border border-red-500/20 p-6 rounded-[32px] flex items-start gap-4"
            >
              <AlertCircle className="w-6 h-6 text-red-400 mt-1" />
              <div className="space-y-1">
                <h4 className="text-sm font-black text-red-400 uppercase tracking-widest">System Error</h4>
                <p className="text-xs font-bold text-red-400/80 leading-relaxed">{error}</p>
              </div>
            </motion.div>
          )}

          {isSessionActive ? (
            <motion.div 
              key="active"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-panel rounded-[48px] h-[700px] flex flex-col overflow-hidden"
            >
              <div className="p-8 border-b border-white/5 flex items-center justify-between bg-slate-900/20">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-purple-600/20 rounded-2xl flex items-center justify-center border border-purple-500/30">
                    <Mic className="w-6 h-6 text-purple-400 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white tracking-tight">Live Assessment</h3>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">AI Examiner Active</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-red-500/10 rounded-xl border border-red-500/20">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
                  <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">Recording</span>
                </div>
              </div>

              <div 
                ref={scrollRef}
                className="flex-1 p-10 overflow-y-auto custom-scrollbar space-y-8"
              >
                {transcription.map((t, i) => (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, x: t.isModel ? -20 : 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`flex ${t.isModel ? 'justify-start' : 'justify-end'}`}
                  >
                    <div className={`max-w-[80%] space-y-2 ${t.isModel ? 'items-start' : 'items-end'}`}>
                      <div className={`flex items-center gap-2 text-[9px] font-black uppercase tracking-widest ${t.isModel ? 'text-purple-400' : 'text-slate-500'}`}>
                        {t.isModel ? <Bot className="w-3 h-3" /> : <User className="w-3 h-3" />}
                        {t.isModel ? 'AI Assessor' : 'Student'}
                      </div>
                      <div className={`p-6 rounded-[32px] text-sm font-medium leading-relaxed ${
                        t.isModel 
                          ? 'bg-slate-800 text-slate-200 rounded-tl-none border border-white/5' 
                          : 'bg-purple-600 text-white rounded-tr-none shadow-xl shadow-purple-500/20'
                      }`}>
                        {t.text}
                      </div>
                    </div>
                  </motion.div>
                ))}
                {transcription.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-6 opacity-40">
                    <div className="w-20 h-20 bg-slate-800 rounded-[32px] flex items-center justify-center border border-white/5">
                      <Headphones className="w-10 h-10 text-slate-600" />
                    </div>
                    <p className="text-sm font-black uppercase tracking-widest text-slate-500">Waiting for speech...</p>
                  </div>
                )}
              </div>
            </motion.div>
          ) : isGeneratingReport ? (
            <motion.div 
              key="generating"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="glass-panel rounded-[48px] h-[700px] flex flex-col items-center justify-center p-12 text-center space-y-8"
            >
              <div className="relative">
                <div className="w-24 h-24 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
                <FileText className="absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 text-purple-500" />
              </div>
              <div className="space-y-2">
                <h3 className="text-3xl font-black text-white tracking-tighter">Generating Report</h3>
                <p className="text-slate-500 text-sm font-bold uppercase tracking-widest animate-pulse">Gemini 3 Flash Analyzing Performance...</p>
              </div>
            </motion.div>
          ) : report ? (
            <motion.div 
              key="report"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-panel rounded-[48px] p-12 space-y-10 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/5 blur-[120px] -mr-48 -mt-48" />
              
              <div className="flex items-center justify-between relative z-10">
                <div className="space-y-1">
                  <h2 className="text-4xl font-black tracking-tighter text-white">Assessment Report</h2>
                  <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">{selectedTool.name} • {new Date().toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <div className="text-5xl font-black text-purple-400 tracking-tighter">
                      {report.match(/CEFR Level: (.*)/)?.[1] || "N/A"}
                    </div>
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">CEFR Level</div>
                  </div>
                  {report.match(/Exam Score: (.*)/)?.[1] && (
                    <div className="text-center border-l border-white/10 pl-6">
                      <div className="text-5xl font-black text-blue-400 tracking-tighter">
                        {report.match(/Exam Score: (.*)/)?.[1]}
                      </div>
                      <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Exam Score</div>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-emerald-500" />
                    Strengths
                  </h3>
                  <div className="text-sm font-medium text-slate-300 bg-slate-900/50 p-6 rounded-[32px] border border-white/5 leading-relaxed">
                    {report.match(/Strengths: (.*)/)?.[1] || "No data available"}
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] flex items-center gap-2">
                    <AlertCircle className="w-3 h-3 text-amber-500" />
                    Areas for Improvement
                  </h3>
                  <div className="text-sm font-medium text-slate-300 bg-slate-900/50 p-6 rounded-[32px] border border-white/5 leading-relaxed">
                    {report.match(/Weaknesses: (.*)/)?.[1] || "No data available"}
                  </div>
                </div>
              </div>

              <div className="space-y-4 relative z-10">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] flex items-center gap-2">
                  <FileText className="w-3 h-3 text-blue-500" />
                  Improvement Plan
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {report.split('Improvement Plan:')[1]?.split('\n').filter(l => l.trim().length > 0).map((step, i) => (
                    <div key={i} className="flex items-start gap-4 bg-slate-900/50 p-5 rounded-2xl border border-white/5">
                      <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-black flex-shrink-0 text-slate-400">
                        {i + 1}
                      </div>
                      <p className="text-slate-300 text-xs font-bold leading-relaxed">{step.replace(/^\d+\.\s*/, '').trim()}</p>
                    </div>
                  ))}
                </div>
              </div>

              <button 
                onClick={() => setReport(null)}
                className="w-full py-5 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-black rounded-2xl transition-all uppercase tracking-[0.2em] text-xs"
              >
                Start New Assessment
              </button>
            </motion.div>
          ) : (
            <motion.div 
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="glass-panel rounded-[48px] h-[700px] flex flex-col items-center justify-center text-center p-12 space-y-8"
            >
              <div className="w-24 h-24 bg-slate-800 rounded-[40px] flex items-center justify-center border border-white/5">
                <Mic className="w-10 h-10 text-slate-600" />
              </div>
              <div className="max-w-sm space-y-2">
                <h3 className="text-3xl font-black tracking-tighter text-white">Ready to Begin?</h3>
                <p className="text-slate-500 text-sm font-bold uppercase tracking-widest">
                  Professional CEFR Speaking Evaluation
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-8 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                <span className="flex items-center gap-2"><div className="w-1 h-1 bg-purple-500 rounded-full" /> Real-time Feedback</span>
                <span className="flex items-center gap-2"><div className="w-1 h-1 bg-purple-500 rounded-full" /> CEFR Standards</span>
                <span className="flex items-center gap-2"><div className="w-1 h-1 bg-purple-500 rounded-full" /> Detailed Reports</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-950 flex relative overflow-hidden">
      <div className="atmospheric-bg" />
      
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-zinc-950/80 backdrop-blur-md border-b border-white/5 z-30 flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-purple-600/20 rounded-lg flex items-center justify-center border border-purple-500/30">
            <GraduationCap className="w-5 h-5 text-purple-400" />
          </div>
          <span className="text-sm font-black tracking-tighter uppercase">Omareyah</span>
        </div>
        <button 
          onClick={() => setIsSidebarOpen(true)}
          className="p-2 text-slate-400 hover:text-white transition-colors"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      <Sidebar 
        currentView={currentView} 
        onViewChange={setCurrentView} 
        user={user} 
        userRole={userRole}
        onLogout={handleLogout} 
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      
      <main className="flex-1 h-screen overflow-y-auto p-6 lg:p-12 pt-24 lg:pt-12 custom-scrollbar relative z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentView}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          >
            {renderView()}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
};

export default AssessmentInterface;
