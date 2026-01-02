import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  Calendar, 
  CheckCircle, 
  XCircle, 
  Clock, 
  User, 
  Send, 
  FileText,
  LogOut,
  School,
  Hash,
  Book,
  KeyRound,
  Lock,
  Wifi,
  WifiOff
} from 'lucide-react';

// Firebase Imports
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
  signInWithCustomToken
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  onSnapshot,
  query,
  orderBy
} from 'firebase/firestore';

// --- Firebase Initialization (SECURE VERSION) ---
let firebaseConfig;

// 1. Canvas Environment (ဒီမှာ စမ်းသပ်ဖို့)
if (typeof __firebase_config !== 'undefined') {
  firebaseConfig = JSON.parse(__firebase_config);
} 
// 2. Local/GitHub/Production Environment (အပြင်မှာသုံးဖို့)
else {
  // ဒီအပိုင်းက .env ဖိုင်ထဲက Key တွေကို လှမ်းယူပါလိမ့်မယ်
  firebaseConfig = {
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
    storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.REACT_APP_FIREBASE_APP_ID
  };
}

// Initialize Firebase
// Key မရှိရင် Error မတက်အောင် စစ်ပေးထားပါတယ်
const app = initializeApp(firebaseConfig.apiKey ? firebaseConfig : { apiKey: "dummy", appId: "dummy" }); // Prevents crash if keys missing
const auth = getAuth(app);
const db = getFirestore(app);

// App ID
const appId = typeof __app_id !== 'undefined' ? __app_id : 'school-leave-app';

export default function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null); // 'student' or 'teacher' or null
  const [requests, setRequests] = useState([]);
  const [notification, setNotification] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Login State
  const [activeLoginTab, setActiveLoginTab] = useState('student');
  const [loginId, setLoginId] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    studentName: '',
    studentId: '', 
    leaveType: 'ဆေးခွင့်',
    startDate: '',
    endDate: '',
    totalDays: '', 
    missedSubjects: '', 
    reason: ''
  });

  // --- 1. Authentication Effect ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (!firebaseConfig.apiKey) {
            console.warn("Firebase Keys missing! Please check .env file.");
            setLoading(false);
            return;
        }

        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth Error:", error);
        setLoading(false);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- 2. Data Sync Effect (Listen to Firestore) ---
  useEffect(() => {
    if (!user) return;

    // RULE 1: Use specific public data path for shared access
    const q = collection(db, 'artifacts', appId, 'public', 'data', 'leave_requests');

    // Real-time listener
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedRequests = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Sort by timestamp descending (newest first)
      fetchedRequests.sort((a, b) => b.timestamp - a.timestamp);
      setRequests(fetchedRequests);
    }, (error) => {
      console.error("Data fetch error:", error);
      // showNotification("ဒေတာဆွဲယူရာတွင် အမှားရှိနေပါသည်။");
    });

    return () => unsubscribe();
  }, [user]);

  const showNotification = (message) => {
    setNotification(message);
    setTimeout(() => setNotification(null), 3000);
  };

  // Login Function
  const handleLogin = (e) => {
    e.preventDefault();
    if (!loginId.trim()) {
      showNotification("ကျေးဇူးပြု၍ ID ထည့်သွင်းပါ။");
      return;
    }

    if (activeLoginTab === 'student') {
        if (!loginId.toUpperCase().startsWith('STU')) {
             showNotification("Student ID သည် 'STU' ဖြင့် စရပါမည်။ (ဥပမာ: STU-001)");
             return;
        }
        setRole('student');
        setFormData(prev => ({ ...prev, studentId: loginId.toUpperCase() }));
    } else {
        if (!loginId.toUpperCase().startsWith('TCH')) {
            showNotification("Teacher ID သည် 'TCH' ဖြင့် စရပါမည်။ (ဥပမာ: TCH-001)");
            return;
       }
        setRole('teacher');
    }
    showNotification("ဝင်ရောက်မှု အောင်မြင်ပါသည်။");
  };

  const handleLogout = () => {
      setRole(null);
      setLoginId('');
      setFormData({
        studentName: '',
        studentId: '',
        leaveType: 'ဆေးခွင့်',
        startDate: '',
        endDate: '',
        totalDays: '',
        missedSubjects: '',
        reason: ''
      });
  };

  // Submit to Firestore
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
        showNotification("အင်တာနက်ချိတ်ဆက်မှု အခက်အခဲရှိနေပါသည်။");
        return;
    }
    if (!formData.studentName || !formData.studentId || !formData.startDate || !formData.reason) {
      showNotification("ကျေးဇူးပြု၍ အချက်အလက်များကို ပြည့်စုံစွာ ဖြည့်စွက်ပါ။");
      return;
    }

    try {
        const newRequest = {
            ...formData,
            status: 'pending',
            requestDate: new Date().toISOString().split('T')[0],
            timestamp: Date.now() // For sorting
        };

        // Add to Firestore
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'leave_requests'), newRequest);

        // Reset Form
        setFormData(prev => ({
            ...prev,
            studentName: '',
            leaveType: 'ဆေးခွင့်',
            startDate: '',
            endDate: '',
            totalDays: '',
            missedSubjects: '',
            reason: ''
        }));
        showNotification("ခွင့်တိုင်ကြားစာ ပေးပို့ပြီးပါပြီ။");

    } catch (error) {
        console.error("Error adding document: ", error);
        showNotification("ပေးပို့မှု မအောင်မြင်ပါ။ ပြန်လည်ကြိုးစားပါ။");
    }
  };

  // Approve/Reject in Firestore
  const handleAction = async (id, action) => {
    if (!user) return;
    try {
        const reqRef = doc(db, 'artifacts', appId, 'public', 'data', 'leave_requests', id);
        await updateDoc(reqRef, {
            status: action
        });
        showNotification(action === 'approved' ? "ခွင့်ပြုလိုက်ပါပြီ။" : "ပယ်ချလိုက်ပါပြီ။");
    } catch (error) {
        console.error("Error updating document: ", error);
        showNotification("လုပ်ဆောင်ချက် မအောင်မြင်ပါ။");
    }
  };

  // Filter requests based on Role
  const displayedRequests = role === 'student' 
    ? requests.filter(r => r.studentId === formData.studentId) // Student sees only their own
    : requests; // Teacher sees all

  // Login Screen
  if (!role) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-blue-600 p-6 text-center relative">
            <School size={48} className="text-white mx-auto mb-2" />
            <h1 className="text-xl font-bold text-white">ကျောင်းသား ခွင့်တိုင်ကြားမှု စနစ်</h1>
            <p className="text-blue-100 text-sm">Online Database Version</p>
            
            <div className="absolute top-4 right-4 text-white/80">
                {user ? <Wifi size={16} /> : <WifiOff size={16} />}
            </div>
          </div>

          <div className="p-6">
            <div className="flex bg-slate-100 p-1 rounded-lg mb-6">
                <button 
                    onClick={() => setActiveLoginTab('student')}
                    className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all flex items-center justify-center gap-2
                    ${activeLoginTab === 'student' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <User size={16} /> ကျောင်းသား
                </button>
                <button 
                    onClick={() => setActiveLoginTab('teacher')}
                    className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all flex items-center justify-center gap-2
                    ${activeLoginTab === 'teacher' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <BookOpen size={16} /> ဆရာ/ဆရာမ
                </button>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        {activeLoginTab === 'student' ? 'Student ID' : 'Teacher ID'}
                    </label>
                    <div className="relative">
                        <KeyRound className="absolute left-3 top-2.5 text-slate-400" size={18} />
                        <input 
                            type="text"
                            required
                            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                            placeholder={activeLoginTab === 'student' ? 'STU-001' : 'TCH-001'}
                            value={loginId}
                            onChange={(e) => setLoginId(e.target.value)}
                        />
                    </div>
                </div>

                <button 
                    type="submit"
                    disabled={loading}
                    className={`w-full text-white p-3 rounded-lg font-semibold shadow-md transition-colors flex items-center justify-center gap-2
                    ${activeLoginTab === 'student' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700'}
                    ${loading ? 'opacity-70 cursor-wait' : ''}`}
                >
                    {loading ? 'ချိတ်ဆက်နေသည်...' : 'ဝင်ရောက်မည်'}
                </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 font-sans">
      {/* Notification Toast */}
      {notification && (
        <div className="fixed top-4 right-4 bg-slate-800 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-bounce">
          {notification}
        </div>
      )}

      {/* Navbar */}
      <nav className={`${role === 'student' ? 'bg-blue-600' : 'bg-emerald-600'} text-white p-4 shadow-md sticky top-0 z-10`}>
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <School size={28} />
            <h1 className="text-lg font-bold hidden sm:block">
              {role === 'student' ? 'ကျောင်းသား ခွင့်တိုင်ကြားလွှာ' : 'ဆရာများအတွက် ခွင့်စီမံခန့်ခွဲမှု'}
            </h1>
          </div>
          <div className="flex items-center gap-4">
             <span className="text-sm bg-white/20 px-3 py-1 rounded-full flex items-center gap-2">
                <User size={14} />
                {activeLoginTab === 'student' ? formData.studentId : 'Teacher'}
             </span>
            <button 
                onClick={handleLogout}
                className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg text-sm transition-colors"
            >
                <LogOut size={16} />
                <span>ထွက်မည်</span>
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto p-4 md:p-6">
        
        {/* ================= STUDENT VIEW ================= */}
        {role === 'student' && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Left: Application Form */}
            <div className="bg-white rounded-xl shadow-sm p-6 h-fit">
              <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2 border-b pb-3">
                <FileText className="text-blue-600" />
                ခွင့်တိုင်ရန်
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">အမည်</label>
                  <input 
                    type="text" 
                    required
                    className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="မောင်မောင်"
                    value={formData.studentName}
                    onChange={(e) => setFormData({...formData, studentName: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Student ID</label>
                    <div className="relative">
                        <input 
                        type="text" 
                        required
                        disabled 
                        className="w-full border border-slate-200 bg-slate-50 text-slate-500 rounded-lg p-2.5 pl-9 outline-none cursor-not-allowed"
                        value={formData.studentId}
                        />
                        <Lock className="absolute left-3 top-3 text-slate-400" size={14} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">ခွင့်အမျိုးအစား</label>
                    <select 
                      className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                      value={formData.leaveType}
                      onChange={(e) => setFormData({...formData, leaveType: e.target.value})}
                    >
                      <option value="ဆေးခွင့်">ဆေးခွင့်</option>
                      <option value="ကိစ္စရပ်ခွင့်">ကိစ္စရပ်ခွင့်</option>
                      <option value="အခြား">အခြား</option>
                    </select>
                  </div>
                </div>

                {/* Date Selection */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">မှ</label>
                    <input 
                      type="date" 
                      required
                      className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                      value={formData.startDate}
                      onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">ထိ</label>
                    <input 
                      type="date" 
                      required
                      className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                      value={formData.endDate}
                      onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                    />
                  </div>
                </div>

                {/* New Fields: Total Days & Missed Subjects */}
                <div className="grid grid-cols-3 gap-4">
                   <div className="col-span-1">
                    <label className="block text-sm font-medium text-slate-700 mb-1">ခွင့်ရက်</label>
                    <input 
                      type="number" 
                      min="0.5"
                      step="0.5"
                      required
                      className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="3"
                      value={formData.totalDays}
                      onChange={(e) => setFormData({...formData, totalDays: e.target.value})}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">ပျက်မည့်ဘာသာရပ်များ</label>
                    <input 
                      type="text" 
                      required
                      className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Maths, English"
                      value={formData.missedSubjects}
                      onChange={(e) => setFormData({...formData, missedSubjects: e.target.value})}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">အကြောင်းပြချက်</label>
                  <textarea 
                    required
                    rows="3"
                    className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="ခွင့်ယူရသည့် အကြောင်းအရင်း..."
                    value={formData.reason}
                    onChange={(e) => setFormData({...formData, reason: e.target.value})}
                  ></textarea>
                </div>
                <button 
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-md"
                >
                  <Send size={18} />
                  ပေးပို့မည်
                </button>
              </form>
            </div>

            {/* Right: History */}
            <div className="space-y-4">
               <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Clock className="text-blue-600" />
                ခွင့်ရာဇဝင်များ
              </h2>
              {/* Show requests filtered by ID */}
              {displayedRequests.length === 0 ? (
                  <p className="text-slate-500 text-center py-4 bg-white rounded-xl">ခွင့်ရာဇဝင် မရှိသေးပါ။</p>
              ) : (
                displayedRequests.map((req) => (
                    <div key={req.id} className="bg-white rounded-xl p-5 shadow-sm border-l-4 border-l-slate-300 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-1 rounded">
                        {req.requestDate}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider
                        ${req.status === 'approved' ? 'bg-green-100 text-green-700' : 
                            req.status === 'rejected' ? 'bg-red-100 text-red-700' : 
                            'bg-yellow-100 text-yellow-700'}`}>
                        {req.status === 'approved' ? 'ခွင့်ပြု' : req.status === 'rejected' ? 'ပယ်ချ' : 'စောင့်ဆိုင်းဆဲ'}
                        </span>
                    </div>
                    <div className="flex flex-col gap-1 mb-2">
                        <div className="flex justify-between items-center">
                            <h3 className="font-bold text-slate-800">{req.leaveType}</h3>
                            <span className="text-sm font-medium bg-blue-50 text-blue-600 px-2 py-0.5 rounded">
                                {req.totalDays} ရက်
                            </span>
                        </div>
                        <span className="text-sm text-slate-600 flex items-center gap-1">
                        <Calendar size={14} />
                        {req.startDate} မှ {req.endDate}
                        </span>
                        <span className="text-sm text-slate-600 flex items-center gap-1">
                        <Book size={14} />
                        <span className="truncate max-w-[200px]">{req.missedSubjects}</span>
                        </span>
                    </div>
                    <p className="text-slate-600 text-sm mt-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                        {req.reason}
                    </p>
                    </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ================= TEACHER VIEW ================= */}
        {role === 'teacher' && (
          <div>
            <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">ခွင့်တိုင်ကြားစာများ</h2>
                  <p className="text-slate-500">ကျောင်းသားများ ပေးပို့ထားသော ခွင့်စာများကို စစ်ဆေးပါ။</p>
                </div>
                <div className="flex gap-2">
                  <div className="bg-yellow-50 text-yellow-700 px-4 py-2 rounded-lg text-sm font-medium">
                    စောင့်ဆိုင်းဆဲ: {requests.filter(r => r.status === 'pending').length}
                  </div>
                  <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg text-sm font-medium">
                    စုစုပေါင်း: {requests.length}
                  </div>
                </div>
              </div>

              <div className="grid gap-4">
                {requests.length === 0 ? (
                  <div className="text-center py-10 text-slate-400">
                    ခွင့်တိုင်ကြားစာများ မရှိသေးပါ။
                  </div>
                ) : (
                  requests.map((req) => (
                    <div key={req.id} className="border border-slate-200 rounded-xl p-5 hover:border-emerald-200 transition-colors bg-white">
                      <div className="flex flex-col md:flex-row justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-bold text-slate-800">{req.studentName}</h3>
                            <span className="text-sm bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200 flex items-center gap-1">
                              <Hash size={12} />
                              {req.studentId}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase
                              ${req.status === 'pending' ? 'bg-yellow-100 text-yellow-700 animate-pulse' : 
                                req.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {req.status}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm text-slate-600 mb-3">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-500">အမျိုးအစား:</span> {req.leaveType}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-500">ရက်ပေါင်း:</span> {req.totalDays} ရက်
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-500">ကာလ:</span> {req.startDate} မှ {req.endDate}
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="font-medium text-slate-500">ပျက်ကွက်မည့် ဘာသာရပ်:</span> 
                                <span className="text-red-500">{req.missedSubjects}</span>
                            </div>
                            <div className="col-span-2 mt-2">
                              <span className="font-medium text-slate-500 block mb-1">အကြောင်းပြချက်:</span>
                              <p className="bg-slate-50 p-3 rounded-lg border border-slate-100 italic">"{req.reason}"</p>
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons - Only show for Pending */}
                        {req.status === 'pending' ? (
                          <div className="flex md:flex-col gap-2 justify-center min-w-[140px]">
                            <button 
                              onClick={() => handleAction(req.id, 'approved')}
                              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                            >
                              <CheckCircle size={16} />
                              ခွင့်ပြု
                            </button>
                            <button 
                              onClick={() => handleAction(req.id, 'rejected')}
                              className="flex-1 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                            >
                              <XCircle size={16} />
                              ပယ်ချ
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center min-w-[140px] text-slate-400 text-sm font-medium">
                            {req.status === 'approved' ? (
                              <span className="flex items-center gap-1 text-emerald-600">
                                <CheckCircle size={18} /> အတည်ပြုပြီး
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-red-500">
                                <XCircle size={18} /> ပယ်ချထားသည်
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}