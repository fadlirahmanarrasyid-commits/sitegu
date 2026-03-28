import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, BookOpen, Calendar, CheckSquare, Book, 
  FileSpreadsheet, Activity, Printer, Settings, Info, 
  LogOut, LayoutDashboard, UserPlus, Database, UserCheck, 
  Plus, Trash2, Edit, Save, Download, Upload, X, Cloud, Smartphone, School, Shield, Link as LinkIcon, Menu
} from 'lucide-react';

// --- FIREBASE IMPORTS ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';

// --- FIREBASE INITIALIZATION ---
const firebaseConfig = {
  apiKey: "AIzaSyAfxCjqU8P8Ujell1oVKeZkgDyheHKRY-w",
  authDomain: "sitegu-68079.firebaseapp.com",
  projectId: "sitegu-68079",
  storageBucket: "sitegu-68079.firebasestorage.app",
  messagingSenderId: "436297805243",
  appId: "1:436297805243:web:74f32cf937b52d95d1289e",
  measurementId: "G-WZGVTFKQ1G"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'sitegu-app-v1'; // Beri nama ID unik untuk aplikasi Anda

// --- INITIAL DATA GENERATOR UNTUK SEKOLAH ---
const getInitialData = () => ({
  users: [
    { id: 1, username: 'admin', password: '123', role: 'admin', isActive: true, name: 'Administrator Sekolah' }
  ],
  classes: [],
  subjects: [],
  students: [],
  ptms: [],
  attendances: [],
  journals: [],
  assessments: [],
  grades: [],
  assignments: [], 
  settings: {
    schoolName: 'Sekolah Menengah Pertama (Default)',
    schoolAddress: 'Alamat belum diatur',
    principalName: 'Nama Kepsek',
    principalNip: '-',
    academicYear: '2025/2026',
    semester: 'Ganjil',
    schoolLogo: ''
  }
});

export default function App() {
  // Data State
  const [data, setData] = useState(null);

  // Auth & Session State
  const [currentUser, setCurrentUser] = useState(null);
  const [firebaseUser, setFirebaseUser] = useState(null);
  
  // UI State
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isCloudReady, setIsCloudReady] = useState(false);
  const [savingStatus, setSavingStatus] = useState('idle');
  const [selectedTerm, setSelectedTerm] = useState(''); // POSISI DIPERBAIKI (Sesuai Aturan Hooks React)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // <--- TAMBAHKAN BARIS INI
 
  // PWA State
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  // --- 1. SETUP AUTHENTICATION FIREBASE ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Gagal inisialisasi Auth", error);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, user => {
      setFirebaseUser(user);
    });
    return () => unsubscribe();
  }, []);

    // --- SETUP PWA LISTENER ---
  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault(); // Mencegah Chrome memunculkan popup otomatis bawaan
      setDeferredPrompt(e); // Simpan event agar bisa dipicu oleh tombol kita
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  // --- 2. FETCH REAL-TIME DATA (SINGLE TENANT) ---
  useEffect(() => {
    if (!firebaseUser) return;

    setIsCloudReady(false);
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'appState', 'schoolData');
    
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setData(docSnap.data());
      } else {
        setDoc(docRef, getInitialData());
        setData(getInitialData());
      }
      setIsCloudReady(true);
    }, (err) => {
      console.error("Gagal mengambil data dari Cloud:", err);
    });

    return () => unsubscribe();
  }, [firebaseUser]);

  // Cek Auto-Login dari LocalStorage
  useEffect(() => {
    if (firebaseUser && !currentUser && isCloudReady && data) {
      const session = localStorage.getItem('aio_single_session');
      if (session) {
        const parsed = JSON.parse(session);
        const user = data.users.find(x => x.username === parsed.username && x.password === parsed.password);
        if (user && user.isActive) {
           setCurrentUser(user);
        }
      }
    }
  }, [firebaseUser, isCloudReady, data, currentUser]);

  // --- IDENTIFIKASI PERIODE & FILTER MESIN WAKTU (DIPINDAHKAN KE ATAS UNTUK ATURAN HOOKS) ---
  const activeTerm = data ? `${data.settings.academicYear} - ${data.settings.semester}` : '';
  const displayTerm = selectedTerm || activeTerm;

  // Ekstrak semua Term (Periode) yang pernah ada di database agar muncul di Dropdown Sidebar
  const allTerms = useMemo(() => {
    if (!data) return [];
    const terms = new Set();
    if (activeTerm) terms.add(activeTerm); // Pastikan semester aktif sekarang selalu ada
    if (data.assignments) data.assignments.forEach(a => a.term && terms.add(a.term));
    if (data.journals) data.journals.forEach(j => j.term && terms.add(j.term));
    if (data.ptms) data.ptms.forEach(p => p.term && terms.add(p.term));
    if (data.assessments) data.assessments.forEach(a => a.term && terms.add(a.term));
    // Sort reverse agar yang terbaru (biasanya abjadnya terbesar) di atas
    return Array.from(terms).sort().reverse();
  }, [data, activeTerm]);

  // --- 3. FUNGSI UNTUK UPDATE DATA KE CLOUD ---
  const updateData = async (key, value) => {
    if (!data) return;
    setSavingStatus('saving');
    const newData = { ...data, [key]: value };
    setData(newData); // Optimistic UI Update
    
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'appState', 'schoolData');
      await setDoc(docRef, newData);
      setSavingStatus('saved');
      setTimeout(() => setSavingStatus('idle'), 2000);
    } catch (error) {
      console.error("Gagal menyimpan ke Cloud:", error);
      alert("Terjadi kesalahan saat menyimpan data ke server.");
      setSavingStatus('idle');
    }
  };

  // --- AUTHENTICATION ---
  const handleLoginSubmit = (e) => {
    e.preventDefault();
    const username = e.target.username.value;
    const password = e.target.password.value;

    const user = data.users.find(x => x.username === username && x.password === password);
    
    if (user) {
      if (!user.isActive) {
        alert('Akun Anda belum diaktifkan oleh Administrator.');
        return;
      }
      setCurrentUser(user);
      setActiveTab('dashboard');
      localStorage.setItem('aio_single_session', JSON.stringify({ username, password }));
    } else {
      alert('Username atau password salah!');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('aio_single_session');
  };

  // --- BACKUP & RESTORE MANUAL (Khusus Admin) ---
  const handleBackup = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `Backup_AIO_${new Date().toISOString().slice(0,10)}.json`);
    dlAnchorElem.click();
  };

  const handleRestore = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const restoredData = JSON.parse(event.target.result);
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'appState', 'schoolData');
        await setDoc(docRef, restoredData);
        alert('Database Cloud berhasil di-restore!');
      } catch (err) {
        alert('Gagal membaca file backup.');
      }
    };
    reader.readAsText(file);
  };

  // --- RENDERERS ---
  // Pengecekan kondisi diletakkan setelah deklarasi SEMUA Hooks
  if (!firebaseUser || !isCloudReady || !data) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
        <Cloud className="w-16 h-16 text-blue-500 animate-pulse mb-4" />
        <h2 className="text-xl font-bold text-gray-700">Memuat Sistem...</h2>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
          <div className="text-center mb-8">
            <School className="w-12 h-12 text-blue-600 mx-auto mb-2" />
            <h1 className="text-2xl font-bold text-blue-600 mb-1">SiTeGu</h1>
            <p className="text-gray-500 text-sm font-medium">Sinergi Teknologi, Dedikasi untuk Guru</p>
            <p className="text-gray-400 text-xs mt-1">{data.settings.schoolName}</p>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4 animate-fade-in">
            <div>
              <label className="block text-sm font-medium text-gray-700">Username Login</label>
              <input name="username" type="text" required className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <input name="password" type="password" required className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <button type="submit" className="w-full bg-blue-600 text-white rounded-md py-2 hover:bg-blue-700 font-bold mt-6 shadow">Masuk Aplikasi</button>
            <p className="text-xs text-center text-gray-400 mt-4">Gunakan "admin" / "123" untuk login administrator default.</p>
          </form>
        </div>
      </div>
    );
  }

  // --- KONFIGURASI MENU BERDASARKAN ROLE ---
  const menuItems = currentUser.role === 'admin' 
    ? [
        { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard Admin' },
        { id: 'users', icon: UserCheck, label: 'Kelola Akun Guru' },
        { id: 'kelas', icon: BookOpen, label: 'Master Kelas & Mapel' },
        { id: 'siswa', icon: Users, label: 'Master Data Siswa' },
        { id: 'penugasan', icon: LinkIcon, label: 'Penugasan Mengajar' },
        { id: 'pengaturan', icon: Settings, label: 'Pengaturan Sekolah' },
      ]
    : [
        { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard Guru' },
        { id: 'ptm', icon: Calendar, label: 'Jadwal PTM' },
        { id: 'absensi', icon: CheckSquare, label: 'Input Absensi' },
        { id: 'jurnal', icon: Book, label: 'Jurnal Mengajar' },
        { id: 'nilai', icon: FileSpreadsheet, label: 'Input Penilaian' },
        { id: 'rekap_absen', icon: Activity, label: 'Rekap Kehadiran' },
        { id: 'pantau', icon: Activity, label: 'Pantau Siswa' },
        { id: 'cetak', icon: Printer, label: 'Menu Cetak' },
        { id: 'pengaturan', icon: Settings, label: 'Pengaturan Akun' },
        { id: 'tentang', icon: Info, label: 'Tentang' },
      ];

  // Filter Penugasan Berdasarkan Periode yang dipilih di Dropdown (displayTerm)
  const assignments = data.assignments || [];
  const activeAssignments = assignments.filter(a => !a.term || a.term === displayTerm);

  // --- FILTER DATA KHUSUS GURU YANG LOGIN (BERDASARKAN PENUGASAN AKTIF) ---
  const myAssignments = activeAssignments.filter(a => a.teacherId === currentUser.id);
  const myClassIds = [...new Set(myAssignments.map(a => a.classId))];
  const mySubjectIds = [...new Set(myAssignments.map(a => a.subjectId))];
  
  const myClasses = data.classes.filter(c => myClassIds.includes(c.id));
  const mySubjects = data.subjects.filter(s => mySubjectIds.includes(s.id));
  const myStudents = data.students.filter(s => myClassIds.includes(s.classId));
  
  // Filter PTM berdasarkan periode yang dipilih di Dropdown (displayTerm)
  const activePtms = data.ptms ? data.ptms.filter(p => !p.term || p.term === displayTerm) : [];
  const myPtms = activePtms.filter(p => myAssignments.some(a => a.classId === p.classId && a.subjectId === p.subjectId));

  const renderModule = () => {
    if (currentUser.role === 'admin') {
      switch (activeTab) {
        case 'dashboard': return <AdminDashboard data={data} activeAssignments={activeAssignments} handleBackup={handleBackup} handleRestore={handleRestore} displayTerm={displayTerm} />;
        case 'users': return <AdminUsers data={data} updateData={updateData} />;
        case 'kelas': return <ModulKelasMapel data={data} updateData={updateData} />;
        case 'siswa': return <ModulSiswa data={data} updateData={updateData} />;
        case 'penugasan': return <AdminPenugasan data={data} updateData={updateData} activeAssignments={activeAssignments} currentTerm={displayTerm} />;
        case 'pengaturan': return <ModulPengaturan data={data} updateData={updateData} currentUser={currentUser} isAdmin={true} currentTerm={activeTerm} />;
        default: return <div>Modul Admin belum tersedia</div>;
      }
    }

    // MODULES FOR TEACHER
    switch (activeTab) {
      case 'dashboard': return <ModulDashboard data={data} currentUser={currentUser} myClasses={myClasses} myStudents={myStudents} mySubjects={mySubjects} myPtms={myPtms} deferredPrompt={deferredPrompt} setDeferredPrompt={setDeferredPrompt} displayTerm={displayTerm} />;
      case 'ptm': return <ModulPTM data={data} updateData={updateData} myClasses={myClasses} mySubjects={mySubjects} myAssignments={myAssignments} myPtms={myPtms} currentTerm={displayTerm} />;
      case 'absensi': return <ModulAbsensi data={data} updateData={updateData} myPtms={myPtms} myStudents={myStudents} />;
      case 'jurnal': return <ModulJurnal data={data} updateData={updateData} myClasses={myClasses} mySubjects={mySubjects} myPtms={myPtms} myAssignments={myAssignments} currentUser={currentUser} currentTerm={displayTerm} />;
      case 'nilai': return <ModulNilai data={data} updateData={updateData} myClasses={myClasses} myStudents={myStudents} currentUser={currentUser} currentTerm={displayTerm} />;
      case 'rekap_absen': return <ModulRekapAbsen data={data} myClasses={myClasses} myStudents={myStudents} myPtms={myPtms} />;
      case 'pantau': return <ModulPantau data={data} myClasses={myClasses} myStudents={myStudents} myPtms={myPtms} />;
      case 'cetak': return <ModulCetak data={data} currentUser={currentUser} myClasses={myClasses} mySubjects={mySubjects} myPtms={myPtms} myStudents={myStudents} currentTerm={displayTerm} />;
      case 'pengaturan': return <ModulPengaturan data={data} updateData={updateData} currentUser={currentUser} isAdmin={false} />;
      case 'tentang': return <ModulTentang />;
      default: return <div>Modul belum tersedia</div>;
    }
  };

return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      
      {/* OVERLAY GELAP UNTUK HP (Menutup sidebar jika diklik di luar) */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 z-40 md:hidden transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar Responsive */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-800 text-white flex flex-col print:hidden transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}>
        <div className="p-4 bg-slate-900 border-b border-slate-700 text-center relative">
          
          {/* TOMBOL SILANG (X) KHUSUS DI HP */}
          <button 
            onClick={() => setIsSidebarOpen(false)} 
            className="absolute top-4 right-4 text-slate-400 hover:text-white md:hidden"
          >
            <X className="w-5 h-5" />
          </button>

          <h1 className="text-xl font-bold text-blue-400">SiTeGu</h1>
          <p className="text-[10px] text-blue-200 mt-1 italic">Sinergi Teknologi, Dedikasi untuk Guru</p>
          <p className="text-xs text-slate-400 mt-1 truncate">{data.settings.schoolName}</p>
          
          {/* FITUR DROPDOWN FILTER MESIN WAKTU */}
          <div className="mt-4 text-left">
            <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Tahun & Semester</label>
            <select 
              value={displayTerm} 
              onChange={e => setSelectedTerm(e.target.value)}
              className="mt-1 w-full bg-slate-800 border border-slate-600 text-blue-300 text-xs rounded p-1.5 focus:outline-none focus:border-blue-500"
            >
              {allTerms.map(t => (
                <option key={t} value={t}>{t} {t === activeTerm ? '(Aktif)' : '(Arsip)'}</option>
              ))}
            </select>
          </div>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1">
            {menuItems.map(item => (
              <li key={item.id}>
                <button
                  onClick={() => { 
                    setActiveTab(item.id); 
                    setIsSidebarOpen(false); // Otomatis tutup sidebar di HP saat menu diklik
                  }}
                  className={`w-full flex items-center px-6 py-3 text-sm transition-colors ${
                    activeTab === item.id ? 'bg-blue-600 text-white border-r-4 border-blue-300' : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  <item.icon className="w-5 h-5 mr-3" />
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="p-4 bg-slate-900 border-t border-slate-700">
          <div className="flex items-center text-sm mb-4">
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center mr-3 uppercase font-bold text-white flex-shrink-0">
              {currentUser.name.charAt(0)}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="font-medium truncate text-white">{currentUser.name}</p>
              <div className="flex items-center text-xs text-slate-400">
                <span className="capitalize mr-2">{currentUser.role}</span>
                {savingStatus === 'saving' && <Cloud className="w-3 h-3 text-yellow-400 animate-pulse" title="Menyimpan ke Cloud..." />}
                {savingStatus === 'saved' && <Cloud className="w-3 h-3 text-green-400" title="Tersimpan di Cloud" />}
              </div>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center justify-center py-2 bg-red-600/20 text-red-400 hover:bg-red-600/40 rounded transition-colors">
            <LogOut className="w-4 h-4 mr-2" /> Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto print:bg-white print:m-0 print:p-0 bg-slate-50">
        
        {/* HEADER KHUSUS MOBILE (Muncul jika layar kecil) */}
        <div className="md:hidden flex items-center justify-between bg-white p-4 shadow-sm border-b sticky top-0 z-30 print:hidden">
          <div className="flex items-center overflow-hidden">
            <div className="w-8 h-8 bg-blue-50 flex items-center justify-center rounded border border-blue-100 mr-2 flex-shrink-0">
              <School className="w-5 h-5 text-blue-600" />
            </div>
            <div className="overflow-hidden">
              <h2 className="font-bold text-blue-800 text-sm leading-tight truncate">SiTeGu</h2>
              <p className="text-[10px] text-gray-500 truncate w-40">{data.settings.schoolName}</p>
            </div>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(true)} 
            className="p-2 bg-slate-100 rounded-md text-slate-600 hover:bg-slate-200 focus:outline-none"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>

        {/* Padding disesuaikan: p-4 untuk HP, p-8 untuk Laptop */}
        <div className="p-4 md:p-8 print:p-0 relative">
          
          {/* Status Menyimpan di Kanan Atas */}
          {savingStatus === 'saving' && (
            <div className="absolute top-2 right-4 bg-yellow-100 text-yellow-800 text-xs px-3 py-1 rounded-full flex items-center shadow print:hidden">
              <Cloud className="w-3 h-3 mr-1 animate-pulse" /> Menyimpan...
            </div>
          )}
          {savingStatus === 'saved' && (
            <div className="absolute top-2 right-4 bg-green-100 text-green-800 text-xs px-3 py-1 rounded-full flex items-center shadow print:hidden transition-opacity duration-1000 opacity-0 animate-fade-out">
              <Cloud className="w-3 h-3 mr-1" /> Tersimpan
            </div>
          )}

          {/* BANNER PERINGATAN JIKA MELIHAT DATA SEMESTER LAMA */}
          {displayTerm !== activeTerm && (
            <div className="bg-orange-100 border-l-4 border-orange-500 text-orange-800 p-4 mb-6 shadow-sm rounded print:hidden flex items-start">
              <Info className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-bold text-sm">Mode Arsip Aktif (Melihat Data Lampau)</p>
                <p className="text-xs mt-1">Anda saat ini sedang melihat dan mengelola data untuk semester <strong>{displayTerm}</strong>. Periode aktif sekolah saat ini adalah <strong>{activeTerm}</strong>. Harap berhati-hati jika Anda mengubah atau menambah data agar tidak terjadi kesalahan administrasi.</p>
              </div>
            </div>
          )}
          
          {/* Render Komponen Utama */}
          {renderModule()}
        </div>
      </main>
    </div>
  );
}

// ==========================================
// SUB-COMPONENTS KHUSUS ADMIN
// ==========================================

function AdminDashboard({ data, activeAssignments, handleBackup, handleRestore, displayTerm }) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Dashboard Administrator Sekolah</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-blue-500">
          <h3 className="text-gray-500 text-sm">Total Guru</h3>
          <p className="text-3xl font-bold">{data.users.filter(u => u.role === 'teacher').length}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-green-500">
          <h3 className="text-gray-500 text-sm">Total Siswa</h3>
          <p className="text-3xl font-bold">{data.students.length}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-purple-500">
          <h3 className="text-gray-500 text-sm">Total Kelas</h3>
          <p className="text-3xl font-bold">{data.classes.length}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-orange-500">
          <h3 className="text-gray-500 text-sm">Penugasan ({displayTerm.split(' ')[0]})</h3>
          <p className="text-3xl font-bold">{activeAssignments.length}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mt-6 border-t-4 border-red-500">
        <h3 className="text-lg font-bold mb-4 flex items-center"><Database className="w-5 h-5 mr-2 text-red-600"/> Manajemen Database Cloud</h3>
        <p className="text-sm text-gray-600 mb-4">
          Gunakan fitur ini untuk men-download backup seluruh data sistem atau me-restore data dari file JSON lokal ke Server Cloud.
        </p>
        <div className="flex flex-wrap gap-4">
          <button onClick={handleBackup} className="flex items-center px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition font-medium">
            <Download className="w-4 h-4 mr-2"/> Download Backup (.json)
          </button>
          <label className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 cursor-pointer transition font-medium">
            <Upload className="w-4 h-4 mr-2"/> Timpa Data Cloud (.json)
            <input type="file" accept=".json" onChange={handleRestore} className="hidden" />
          </label>
        </div>
      </div>
    </div>
  );
}

function AdminPenugasan({ data, updateData, activeAssignments, currentTerm }) {
  const [form, setForm] = useState({ teacherId: '', classId: '', subjectId: '' });

  const teachers = data.users.filter(u => u.role === 'teacher' && u.isActive);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.teacherId || !form.classId || !form.subjectId) {
       alert("Lengkapi form penugasan!"); return;
    }

    const isExist = activeAssignments.some(a => a.teacherId === Number(form.teacherId) && a.classId === Number(form.classId) && a.subjectId === Number(form.subjectId));
    if (isExist) {
       alert("Penugasan ini sudah ada di semester ini!"); return;
    }

    const newAssignment = {
       id: Date.now(),
       teacherId: Number(form.teacherId),
       classId: Number(form.classId),
       subjectId: Number(form.subjectId),
       term: currentTerm
    };

    updateData('assignments', [newAssignment, ...(data.assignments || [])]);
    setForm({ teacherId: '', classId: '', subjectId: '' });
  };

  const handleDelete = (id) => {
    if(confirm('Hapus penugasan ini? Guru terkait tidak akan bisa lagi melihat data kelas ini pada periode berjalan.')) {
       updateData('assignments', data.assignments.filter(a => a.id !== id));
    }
  };

  const handleImportCSV = (e) => {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const rows = event.target.result.split('\n').filter(r => r.trim() !== '');
      const newAssignments = [];
      let skipped = 0;
      rows.forEach((row, i) => {
         if(i===0 && row.toLowerCase().includes('guru')) return;
         const cols = row.split(',').map(c => c.trim());
         if(cols.length >= 3) {
            const username = cols[0];
            const className = cols[1];
            const subjectName = cols[2];
            
            const t = data.users.find(u => u.role==='teacher' && u.username===username);
            const c = data.classes.find(x => x.name.toLowerCase()===className.toLowerCase());
            const s = data.subjects.find(x => x.name.toLowerCase()===subjectName.toLowerCase());
            
            if(t && c && s) {
               const isExist = activeAssignments.some(a=>a.teacherId===t.id && a.classId===c.id && a.subjectId===s.id) || newAssignments.some(a=>a.teacherId===t.id && a.classId===c.id && a.subjectId===s.id);
               if(!isExist) newAssignments.push({id: Date.now()+i, teacherId: t.id, classId: c.id, subjectId: s.id, term: currentTerm});
               else skipped++;
            } else {
               skipped++;
            }
         }
      });
      if(newAssignments.length) updateData('assignments', [...(data.assignments || []), ...newAssignments]);
      alert(`Berhasil impor ${newAssignments.length} Penugasan!\n(Dilewati: ${skipped} baris karena duplikat atau master tidak ditemukan)`);
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-bold mb-2 flex items-center"><LinkIcon className="w-5 h-5 mr-2 text-blue-600"/> Tambah Penugasan Mengajar ({currentTerm})</h3>
            <p className="text-sm text-gray-600 mb-4">Tautkan Guru dengan Kelas dan Mata Pelajaran yang diajarkan di periode berjalan.</p>
          </div>
          <label className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center text-sm font-bold shadow cursor-pointer transition">
            <Upload className="w-4 h-4 mr-2" /> Import CSV Penugasan
            <input type="file" accept=".csv" onChange={handleImportCSV} className="hidden" />
          </label>
        </div>
        
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-2">
           <div>
             <label className="block text-xs font-bold text-gray-500 mb-1">Pilih Guru</label>
             <select value={form.teacherId} onChange={e=>setForm({...form, teacherId: e.target.value})} className="w-full border rounded p-2 text-sm bg-gray-50">
               <option value="">-- Guru Aktif --</option>
               {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
             </select>
           </div>
           <div>
             <label className="block text-xs font-bold text-gray-500 mb-1">Pilih Kelas</label>
             <select value={form.classId} onChange={e=>setForm({...form, classId: e.target.value})} className="w-full border rounded p-2 text-sm bg-gray-50">
               <option value="">-- Master Kelas --</option>
               {data.classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
             </select>
           </div>
           <div>
             <label className="block text-xs font-bold text-gray-500 mb-1">Pilih Mata Pelajaran</label>
             <select value={form.subjectId} onChange={e=>setForm({...form, subjectId: e.target.value})} className="w-full border rounded p-2 text-sm bg-gray-50">
               <option value="">-- Master Mapel --</option>
               {data.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
             </select>
           </div>
           <div className="flex items-end">
             <button type="submit" className="w-full bg-blue-600 text-white rounded p-2 text-sm font-bold shadow hover:bg-blue-700">Tugaskan</button>
           </div>
        </form>
        <p className="text-xs text-gray-400 mt-3">* Format CSV: Username Guru, Nama Kelas, Nama Mata Pelajaran</p>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
         <div className="p-4 bg-gray-50 border-b">
           <h3 className="font-bold text-gray-700">Daftar Penugasan Aktif Periode {currentTerm}</h3>
         </div>
         <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-100">
               <tr>
                  <th className="px-6 py-3 text-left font-medium text-gray-500">Nama Guru</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-500">Kelas Terhubung</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-500">Mata Pelajaran</th>
                  <th className="px-6 py-3 text-right font-medium text-gray-500">Aksi</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
               {activeAssignments.map(a => {
                  const teacher = data.users.find(u => u.id === a.teacherId)?.name || 'Unknown';
                  const cls = data.classes.find(c => c.id === a.classId)?.name || 'Unknown';
                  const subject = data.subjects.find(s => s.id === a.subjectId)?.name || 'Unknown';

                  return (
                     <tr key={a.id} className="hover:bg-gray-50">
                        <td className="px-6 py-3 font-bold text-blue-800">{teacher}</td>
                        <td className="px-6 py-3">{cls}</td>
                        <td className="px-6 py-3">{subject}</td>
                        <td className="px-6 py-3 text-right">
                           <button onClick={() => handleDelete(a.id)} className="text-red-500 hover:text-red-700 bg-red-50 p-1.5 rounded"><Trash2 className="w-4 h-4"/></button>
                        </td>
                     </tr>
                  )
               })}
               {activeAssignments.length === 0 ? (
                  <tr><td colSpan="4" className="p-8 text-center text-gray-500">Belum ada penugasan guru di periode ini.</td></tr>
               ) : null}
            </tbody>
         </table>
      </div>
    </div>
  );
}

function AdminUsers({ data, updateData }) {
  const [showModal, setShowModal] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [form, setForm] = useState({ name: '', nip: '', username: '', password: '' });

  const toggleActive = (id) => {
    const updated = data.users.map(u => u.id === id ? { ...u, isActive: !u.isActive } : u);
    updateData('users', updated);
  };

  const deleteUser = (id) => {
    if(confirm('Hapus akun guru ini? Penugasan yang terkait juga tidak akan berlaku lagi.')) {
       updateData('users', data.users.filter(u => u.id !== id));
       // Bersihkan assignment terkait jika perlu
       if(data.assignments) {
          updateData('assignments', data.assignments.filter(a => a.teacherId !== id));
       }
    }
  }

  const handleEditUserClick = (u) => {
    setForm({ name: u.name, nip: u.nip || '', username: u.username, password: u.password });
    setEditingUserId(u.id);
    setShowModal(true);
  };

  const handleAddOrEditUser = (e) => {
    e.preventDefault();
    if (editingUserId) {
      if (data.users.find(x => x.username === form.username && x.id !== editingUserId)) { alert('Username sudah digunakan!'); return; }
      const updatedUsers = data.users.map(u => u.id === editingUserId ? { ...u, ...form } : u);
      updateData('users', updatedUsers);
      alert('Data guru berhasil diperbarui ke Cloud!');
    } else {
      if (data.users.find(x => x.username === form.username)) { alert('Username sudah digunakan!'); return; }
      const newUser = { id: Date.now(), ...form, role: 'teacher', isActive: true };
      updateData('users', [...data.users, newUser]);
      alert('Akun guru berhasil ditambahkan & disinkronkan ke Cloud!');
    }
    closeModal();
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingUserId(null);
    setForm({ name: '', nip: '', username: '', password: '' });
  };

  const handleImportCSV = (e) => {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const rows = text.split('\n').filter(r => r.trim() !== '');
      const newUsers = [];
      let skipped = 0;

      rows.forEach((row, idx) => {
         if(idx === 0 && row.toLowerCase().includes('nama')) return; 
         
         const cols = row.split(',').map(c => c.trim());
         if(cols.length >= 4) {
            const username = cols[2];
            if(data.users.find(u => u.username === username) || newUsers.find(u => u.username === username)) {
               skipped++;
            } else {
               newUsers.push({
                  id: Date.now() + idx,
                  name: cols[0],
                  nip: cols[1],
                  username: username,
                  password: cols[3],
                  role: 'teacher',
                  isActive: true
               });
            }
         }
      });

      if(newUsers.length > 0) {
         updateData('users', [...data.users, ...newUsers]);
         alert(`Berhasil mengimpor ${newUsers.length} Guru baru!${skipped > 0 ? ` (${skipped} dilewati karena username duplikat)` : ''}`);
      } else {
         alert('Gagal impor. Format CSV tidak valid, kosong, atau semua username sudah terdaftar.\nGunakan format: Nama, NIP, Username, Password');
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 space-y-2 md:space-y-0">
        <h2 className="text-2xl font-bold">Manajemen Akun Guru</h2>
        <div className="flex space-x-2">
          <label className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center text-sm font-medium cursor-pointer transition">
            <Upload className="w-4 h-4 mr-2" /> Import CSV
            <input type="file" accept=".csv" onChange={handleImportCSV} className="hidden" />
          </label>
          <button onClick={() => setShowModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center text-sm font-medium transition">
            <UserPlus className="w-4 h-4 mr-2" /> Tambah Guru
          </button>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nama / NIP</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Username / Pass</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aksi</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.users.filter(u => u.role === 'teacher').map(user => (
              <tr key={user.id}>
                <td className="px-6 py-4">
                  <div className="font-medium text-gray-900">{user.name}</div>
                  <div className="text-sm text-gray-500">{user.nip || '-'}</div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                   <div>{user.username}</div>
                   <div className="text-xs text-gray-400">Pass: {user.password}</div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 inline-flex text-xs font-semibold rounded-full ${user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {user.isActive ? 'Aktif' : 'Non-aktif'}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm font-medium space-x-2">
                  <button onClick={() => handleEditUserClick(user)} className="text-blue-600 hover:underline">Edit</button>
                  <button onClick={() => toggleActive(user.id)} className={`${user.isActive ? 'text-orange-600' : 'text-green-600'} hover:underline`}>
                    {user.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                  </button>
                  <button onClick={() => deleteUser(user.id)} className="text-red-600 hover:underline">Hapus</button>
                </td>
              </tr>
            ))}
            {data.users.filter(u => u.role === 'teacher').length === 0 ? (
               <tr><td colSpan="4" className="px-6 py-8 text-center text-gray-500 text-sm">Belum ada akun guru. Tambahkan manual atau import CSV.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 bg-blue-600 text-white flex justify-between items-center">
              <h3 className="font-bold text-lg">{editingUserId ? 'Edit Akun Guru' : 'Tambah Akun Guru Baru'}</h3>
              <button onClick={closeModal} className="text-blue-100 hover:text-white font-bold">&times;</button>
            </div>
            <form onSubmit={handleAddOrEditUser} className="p-6 space-y-4">
              <div><label className="block text-sm mb-1">Nama Lengkap</label><input required type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full border rounded-md px-3 py-2 text-sm" /></div>
              <div><label className="block text-sm mb-1">NIP / NIPPPK</label><input type="text" value={form.nip} onChange={e => setForm({...form, nip: e.target.value})} className="w-full border rounded-md px-3 py-2 text-sm" /></div>
              <div><label className="block text-sm mb-1">Username Login</label><input required type="text" value={form.username} onChange={e => setForm({...form, username: e.target.value})} className="w-full border rounded-md px-3 py-2 text-sm" /></div>
              <div><label className="block text-sm mb-1">Password</label><input required type="text" value={form.password} onChange={e => setForm({...form, password: e.target.value})} className="w-full border rounded-md px-3 py-2 text-sm" /></div>
              <div className="pt-4 flex justify-end space-x-3">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200">Batal</button>
                <button type="submit" className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700"><Save className="w-4 h-4 inline mr-2" /> {editingUserId ? 'Update Cloud' : 'Simpan Cloud'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ModulKelasMapel({ data, updateData }) {
  const [newClass, setNewClass] = useState('');
  const [newSubject, setNewSubject] = useState('');

  const addClass = (e) => {
    e.preventDefault();
    if (!newClass) return;
    updateData('classes', [...data.classes, { id: Date.now(), name: newClass }]);
    setNewClass('');
  };
  const addSubject = (e) => {
    e.preventDefault();
    if (!newSubject) return;
    updateData('subjects', [...data.subjects, { id: Date.now(), name: newSubject }]);
    setNewSubject('');
  };
  const deleteItem = (key, id) => {
    if(confirm('Hapus item ini? Peringatan: Data terkait mungkin akan error jika dihapus.')) updateData(key, data[key].filter(item => item.id !== id));
  };

  const handleImportClasses = (e) => {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const rows = event.target.result.split('\n').filter(r => r.trim() !== '');
      const newClasses = [];
      rows.forEach((row, i) => {
         if(i===0 && row.toLowerCase().includes('kelas')) return;
         const name = row.split(',')[0].trim();
         if(name && !data.classes.find(c=>c.name.toLowerCase() === name.toLowerCase()) && !newClasses.find(c=>c.name.toLowerCase() === name.toLowerCase())) {
             newClasses.push({ id: Date.now()+i, name });
         }
      });
      if(newClasses.length) {
         updateData('classes', [...data.classes, ...newClasses]);
         alert(`Berhasil mengimpor ${newClasses.length} Kelas baru!`);
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  const handleImportSubjects = (e) => {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const rows = event.target.result.split('\n').filter(r => r.trim() !== '');
      const newSubjects = [];
      rows.forEach((row, i) => {
         if(i===0 && row.toLowerCase().includes('mata')) return;
         const name = row.split(',')[0].trim();
         if(name && !data.subjects.find(s=>s.name.toLowerCase() === name.toLowerCase()) && !newSubjects.find(s=>s.name.toLowerCase() === name.toLowerCase())) {
             newSubjects.push({ id: Date.now()+i, name });
         }
      });
      if(newSubjects.length) {
         updateData('subjects', [...data.subjects, ...newSubjects]);
         alert(`Berhasil mengimpor ${newSubjects.length} Mata Pelajaran baru!`);
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4 border-b pb-2">
          <h3 className="text-lg font-bold">Master Kelas</h3>
          <label className="text-blue-600 hover:text-blue-800 text-xs font-bold cursor-pointer">
             <Upload className="w-4 h-4 inline mr-1" /> Import CSV
             <input type="file" accept=".csv" onChange={handleImportClasses} className="hidden" />
          </label>
        </div>
        <form onSubmit={addClass} className="flex space-x-2 mb-4">
          <input value={newClass} onChange={e => setNewClass(e.target.value)} placeholder="Nama Kelas Baru" className="flex-1 border rounded px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500" />
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"><Plus className="w-4 h-4"/></button>
        </form>
        <p className="text-xs text-gray-400 mb-2">Format Import: Nama Kelas</p>
        <ul className="divide-y">{data.classes.map(cls => (
            <li key={cls.id} className="py-2 flex justify-between items-center text-sm">
              <span>{cls.name}</span>
              <button onClick={() => deleteItem('classes', cls.id)} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 className="w-4 h-4"/></button>
            </li>
          ))}</ul>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4 border-b pb-2">
          <h3 className="text-lg font-bold">Master Mata Pelajaran</h3>
          <label className="text-blue-600 hover:text-blue-800 text-xs font-bold cursor-pointer">
             <Upload className="w-4 h-4 inline mr-1" /> Import CSV
             <input type="file" accept=".csv" onChange={handleImportSubjects} className="hidden" />
          </label>
        </div>
        <form onSubmit={addSubject} className="flex space-x-2 mb-4">
          <input value={newSubject} onChange={e => setNewSubject(e.target.value)} placeholder="Nama Mapel Baru" className="flex-1 border rounded px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500" />
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"><Plus className="w-4 h-4"/></button>
        </form>
        <p className="text-xs text-gray-400 mb-2">Format Import: Nama Mapel</p>
        <ul className="divide-y">{data.subjects.map(sub => (
            <li key={sub.id} className="py-2 flex justify-between items-center text-sm">
              <span>{sub.name}</span>
              <button onClick={() => deleteItem('subjects', sub.id)} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 className="w-4 h-4"/></button>
            </li>
          ))}</ul>
      </div>
    </div>
  );
}

function ModulSiswa({ data, updateData }) {
  const [form, setForm] = useState({ id: null, nipd: '', nisn: '', name: '', classId: '' });
  const [isEditing, setIsEditing] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.classId) { alert('Pilih kelas!'); return; }
    if (isEditing) updateData('students', data.students.map(s => s.id === form.id ? { ...form, classId: Number(form.classId) } : s));
    else updateData('students', [...data.students, { ...form, id: Date.now(), classId: Number(form.classId) }]);
    setForm({ id: null, nipd: '', nisn: '', name: '', classId: '' });
    setIsEditing(false);
  };

  const handleEdit = (s) => { setForm({ ...s, classId: s.classId.toString() }); setIsEditing(true); };
  const handleDelete = (id) => { if(confirm('Hapus data siswa dari Cloud?')) updateData('students', data.students.filter(s => s.id !== id)); };

  const handleImportCSV = (e) => {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const rows = event.target.result.split('\n').filter(r => r.trim() !== '');
      let added = 0;
      let updated = 0;
      let skipped = 0;
      const updatedStudents = [...data.students];

      rows.forEach((row, idx) => {
         if(idx === 0 && row.toLowerCase().includes('nama')) return; 
         const cols = row.split(',').map(c => c.trim());
         if(cols.length >= 4) {
            const nipd = cols[0];
            const nisn = cols[1];
            const name = cols[2];
            const className = cols[3];
            const classObj = data.classes.find(c => c.name.toLowerCase() === className.toLowerCase());
            
            if(!classObj) {
               skipped++;
            } else {
               const existingIdx = updatedStudents.findIndex(s => s.nipd === nipd);
               if (existingIdx >= 0) {
                  // Sistem Kenaikan Kelas Cerdas
                  updatedStudents[existingIdx].classId = classObj.id;
                  updatedStudents[existingIdx].name = name;
                  updatedStudents[existingIdx].nisn = nisn;
                  updated++;
               } else {
                  updatedStudents.push({
                     id: Date.now() + idx,
                     nipd, nisn, name, classId: classObj.id
                  });
                  added++;
               }
            }
         }
      });

      if(added > 0 || updated > 0) {
         updateData('students', updatedStudents);
         alert(`Selesai!\n- ${added} Siswa Baru Ditambahkan\n- ${updated} Siswa Diperbarui (Naik/Pindah Kelas)\n- ${skipped} Baris Dilewati (Kelas tidak valid)`);
      } else {
         alert('Gagal impor atau tidak ada data baru. Format CSV harus: NIPD, NISN, Nama Lengkap, Nama Kelas');
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex justify-between items-center mb-4">
           <h3 className="text-lg font-bold">{isEditing ? 'Edit Data Siswa' : 'Tambah Data Siswa'}</h3>
           <label className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center text-sm font-bold shadow cursor-pointer transition">
              <Upload className="w-4 h-4 inline mr-2" /> Import CSV Siswa / Naik Kelas
              <input type="file" accept=".csv" onChange={handleImportCSV} className="hidden" />
           </label>
        </div>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <input required placeholder="NIPD" value={form.nipd} onChange={e=>setForm({...form, nipd: e.target.value})} className="border rounded px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500" />
          <input required placeholder="NISN" value={form.nisn} onChange={e=>setForm({...form, nisn: e.target.value})} className="border rounded px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500" />
          <input required placeholder="Nama Lengkap" value={form.name} onChange={e=>setForm({...form, name: e.target.value})} className="border rounded px-3 py-2 text-sm md:col-span-2 focus:ring-blue-500 focus:border-blue-500" />
          <select required value={form.classId} onChange={e=>setForm({...form, classId: e.target.value})} className="border rounded px-3 py-2 text-sm bg-white focus:ring-blue-500 focus:border-blue-500">
            <option value="">-- Pilih Kelas --</option>
            {data.classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="md:col-span-5 flex justify-end space-x-2 mt-2">
            <span className="text-xs text-gray-400 mr-auto self-center">* Format Import CSV: NIPD, NISN, Nama Lengkap, Nama Kelas</span>
            {isEditing && <button type="button" onClick={()=>{setIsEditing(false); setForm({id:null, nipd:'', nisn:'', name:'', classId:''})}} className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded text-sm font-bold">Batal</button>}
            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded text-sm font-bold shadow">{isEditing ? 'Update ke Cloud' : 'Simpan ke Cloud'}</button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase">NIPD / NISN</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase">Nama Siswa</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase">Kelas</th>
              <th className="px-6 py-3 text-right font-medium text-gray-500 uppercase">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data.students.map(s => {
              const cls = data.classes.find(c => c.id === s.classId);
              return (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3">{s.nipd} / {s.nisn}</td>
                  <td className="px-6 py-3 font-medium">{s.name}</td>
                  <td className="px-6 py-3">{cls ? cls.name : '-'}</td>
                  <td className="px-6 py-3 text-right space-x-3">
                    <button onClick={()=>handleEdit(s)} className="text-blue-600 bg-blue-50 p-1.5 rounded"><Edit className="w-4 h-4 inline"/></button>
                    <button onClick={()=>handleDelete(s.id)} className="text-red-600 bg-red-50 p-1.5 rounded"><Trash2 className="w-4 h-4 inline"/></button>
                  </td>
                </tr>
              )
            })}
            {data.students.length === 0 ? (
               <tr><td colSpan="4" className="px-6 py-8 text-center text-gray-500 text-sm">Belum ada siswa terdaftar.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ==========================================
// SUB-COMPONENTS KHUSUS GURU (DIFILTER)
// ==========================================

function ModulDashboard({ data, currentUser, myClasses, myStudents, mySubjects, myPtms, deferredPrompt, setDeferredPrompt, displayTerm }) {
  const handleInstallPWA = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      alert('Fitur Install otomatis tidak tersedia di browser ini atau aplikasi sudah diinstal.\n\nTips: Jika Anda menggunakan HP (Chrome/Safari), buka menu browser (titik tiga atau icon share) lalu pilih "Tambahkan ke Layar Utama" (Add to Home Screen).');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-xl p-8 text-white shadow-lg relative overflow-hidden">
        <Cloud className="absolute -right-4 -top-4 w-32 h-32 text-white/10" />
        <h2 className="text-3xl font-bold mb-2 relative z-10">Selamat Datang, {currentUser.name}!</h2>
        <p className="text-blue-100 relative z-10">Sistem Terpadu Guru (SiTeGu) - {data.settings.schoolName}</p>
        <p className="text-blue-200 relative z-10 italic text-sm mb-4">Sinergi Teknologi, Dedikasi untuk Guru</p>
        <div className="flex space-x-4 mt-4 relative z-10">
          <p className="text-sm text-blue-200">Periode Ditampilkan: {displayTerm}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow border-t-4 border-blue-500 flex items-center justify-between">
          <div><p className="text-sm text-gray-500">Kelas Ditugaskan</p><p className="text-2xl font-bold">{myClasses.length}</p></div>
          <BookOpen className="w-8 h-8 text-blue-200" />
        </div>
        <div className="bg-white p-6 rounded-lg shadow border-t-4 border-green-500 flex items-center justify-between">
          <div><p className="text-sm text-gray-500">Siswa Anda</p><p className="text-2xl font-bold">{myStudents.length}</p></div>
          <Users className="w-8 h-8 text-green-200" />
        </div>
        <div className="bg-white p-6 rounded-lg shadow border-t-4 border-purple-500 flex items-center justify-between">
          <div><p className="text-sm text-gray-500">Mapel Diajarkan</p><p className="text-2xl font-bold">{mySubjects.length}</p></div>
          <Book className="w-8 h-8 text-purple-200" />
        </div>
        <div className="bg-white p-6 rounded-lg shadow border-t-4 border-orange-500 flex items-center justify-between">
          <div><p className="text-sm text-gray-500">Total PTM Anda</p><p className="text-2xl font-bold">{myPtms.length}</p></div>
          <Calendar className="w-8 h-8 text-orange-200" />
        </div>
      </div>

      {/* BANNER INSTALASI PWA KHUSUS GURU */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg shadow p-6 text-white flex flex-col md:flex-row items-center justify-between animate-fade-in">
         <div className="flex items-center mb-4 md:mb-0">
            <Smartphone className="w-10 h-10 mr-4 text-indigo-100" />
            <div>
               <h3 className="text-lg font-bold">Instal Aplikasi (PWA)</h3>
               <p className="text-sm text-indigo-100">Pasang AIO Pembelajaran di HP Anda untuk akses lebih cepat dan layar penuh.</p>
            </div>
         </div>
         <button onClick={handleInstallPWA} className="bg-white text-indigo-600 px-6 py-2 rounded-full font-bold shadow hover:bg-gray-100 transition whitespace-nowrap">
            Pasang Sekarang
         </button>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-bold mb-4">Statistik Kehadiran per Kelas (Tugas Anda)</h3>
        <div className="space-y-4">
          {myClasses.map(cls => {
            const studentsInClass = myStudents.filter(s => s.classId === cls.id).map(s => s.id);
            const classAttendances = data.attendances.filter(a => studentsInClass.includes(a.studentId) && myPtms.map(p=>p.id).includes(a.ptmId));
            const total = classAttendances.length;
            const present = classAttendances.filter(a => a.status === 'Hadir' || a.status === 'Dispensasi').length;
            const percentage = total === 0 ? 0 : Math.round((present / total) * 100);
            
            return (
              <div key={cls.id}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{cls.name}</span><span className="font-bold">{percentage}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-green-500 h-2 rounded-full" style={{ width: `${percentage}%` }}></div>
                </div>
              </div>
            );
          })}
          {myClasses.length === 0 ? <p className="text-sm text-gray-500 italic">Belum ada kelas yang ditugaskan kepada Anda oleh Admin.</p> : null}
        </div>
      </div>
    </div>
  );
}

function ModulPTM({ data, updateData, myClasses, mySubjects, myAssignments, myPtms, currentTerm }) {
  const [form, setForm] = useState({ date: '', classId: '', subjectId: '', topic: '' });

  // Filter mapel yang tersedia hanya berdasarkan penugasan untuk kelas yang dipilih
  const validSubjectIds = form.classId 
    ? myAssignments.filter(a => a.classId === Number(form.classId)).map(a => a.subjectId)
    : mySubjects.map(s => s.id);
  const availableSubjects = form.classId 
    ? mySubjects.filter(s => validSubjectIds.includes(s.id))
    : mySubjects;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.classId || !form.subjectId) { alert("Pilih Kelas dan Mata Pelajaran yang valid!"); return; }
    
    const newPtm = { id: Date.now(), ...form, classId: Number(form.classId), subjectId: Number(form.subjectId), term: currentTerm };
    updateData('ptms', [newPtm, ...data.ptms]);
    setForm({ date: '', classId: '', subjectId: '', topic: '' });
  };

  const deletePtm = (id) => {
    if(confirm('Hapus jadwal PTM?')) updateData('ptms', data.ptms.filter(p => p.id !== id));
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow border-t-4 border-blue-500">
        <h3 className="text-lg font-bold mb-4">Input Jadwal Pertemuan (PTM) Anda</h3>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><label className="block text-sm font-bold text-gray-600 mb-1">Tanggal</label><input type="date" required value={form.date} onChange={e=>setForm({...form, date:e.target.value})} className="w-full border rounded px-3 py-2 text-sm bg-gray-50 focus:ring-blue-500" /></div>
          <div>
            <label className="block text-sm font-bold text-gray-600 mb-1">Pilih Kelas</label>
            <select required value={form.classId} onChange={e=>{ setForm({...form, classId:e.target.value, subjectId: ''}) }} className="w-full border rounded px-3 py-2 text-sm bg-white focus:ring-blue-500">
              <option value="">-- Kelas yang Ditugaskan --</option>
              {myClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-600 mb-1">Pilih Mata Pelajaran</label>
            <select required value={form.subjectId} onChange={e=>setForm({...form, subjectId:e.target.value})} disabled={!form.classId} className="w-full border rounded px-3 py-2 text-sm bg-white focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed">
              <option value="">-- Berdasarkan Kelas --</option>
              {availableSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div><label className="block text-sm font-bold text-gray-600 mb-1">Topik / Materi (Singkat)</label><input type="text" required value={form.topic} onChange={e=>setForm({...form, topic:e.target.value})} className="w-full border rounded px-3 py-2 text-sm bg-gray-50 focus:ring-blue-500" placeholder="Contoh: Pengenalan Aljabar" /></div>
          <div className="md:col-span-2 mt-2"><button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded text-sm font-bold shadow hover:bg-blue-700 w-full md:w-auto"><Save className="w-4 h-4 inline mr-2"/> Simpan Jadwal PTM</button></div>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4 bg-gray-50 border-b">
           <h3 className="font-bold text-gray-700">Daftar PTM Anda (Periode: {currentTerm})</h3>
        </div>
        <ul className="divide-y divide-gray-100">
          {myPtms.map(p => {
            const cls = data.classes.find(c => c.id === p.classId)?.name;
            const sub = data.subjects.find(s => s.id === p.subjectId)?.name;
            return (
              <li key={p.id} className="p-4 flex justify-between items-start hover:bg-blue-50/50">
                <div>
                  <div className="font-bold text-blue-800 text-sm">{p.date} - {sub}</div>
                  <div className="text-xs text-gray-600 font-medium">Kelas: {cls} | Materi: {p.topic}</div>
                </div>
                <button onClick={()=>deletePtm(p.id)} className="text-red-500 bg-red-50 p-2 rounded hover:bg-red-100"><Trash2 className="w-4 h-4"/></button>
              </li>
            );
          })}
          {myPtms.length === 0 ? <p className="p-6 text-center text-sm text-gray-500">Belum ada PTM yang Anda jadwalkan di periode ini.</p> : null}
        </ul>
      </div>
    </div>
  );
}

function ModulAbsensi({ data, updateData, myPtms, myStudents }) {
  const [selectedPtmId, setSelectedPtmId] = useState('');
  const [tempAttendance, setTempAttendance] = useState({});

  useEffect(() => {
    if (selectedPtmId) {
      const existing = data.attendances.filter(a => a.ptmId === Number(selectedPtmId));
      const temp = {};
      existing.forEach(a => { temp[a.studentId] = { status: a.status, note: a.note || '' }; });
      setTempAttendance(temp);
    } else { setTempAttendance({}); }
  }, [selectedPtmId, data.attendances]);

  const ptm = myPtms.find(p => p.id === Number(selectedPtmId));
  const classStudents = ptm ? myStudents.filter(s => s.classId === ptm.classId) : [];

  const handleStatusChange = (studentId, status) => setTempAttendance(prev => ({ ...prev, [studentId]: { status, note: prev[studentId]?.note || '' } }));
  const handleNoteChange = (studentId, note) => setTempAttendance(prev => ({ ...prev, [studentId]: { status: prev[studentId]?.status || 'Hadir', note } }));

  const saveAttendance = () => {
    if (!selectedPtmId) return;
    const ptmIdNum = Number(selectedPtmId);
    let newAttendances = data.attendances.filter(a => a.ptmId !== ptmIdNum);
    
    classStudents.forEach(s => {
      const record = tempAttendance[s.id] || { status: 'Hadir', note: '' };
      newAttendances.push({ id: Date.now() + s.id, ptmId: ptmIdNum, studentId: s.id, status: record.status || 'Hadir', note: record.note });
    });
    updateData('attendances', newAttendances);
  };

  const getColorClass = (status, isSelected) => {
    if (!isSelected) return 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50';
    switch(status) {
      case 'Hadir': return 'bg-green-100 border-green-500 text-green-800 font-bold';
      case 'Sakit': return 'bg-yellow-100 border-yellow-500 text-yellow-800 font-bold';
      case 'Izin': return 'bg-sky-100 border-sky-500 text-sky-800 font-bold';
      case 'Alfa': return 'bg-red-100 border-red-500 text-red-800 font-bold';
      case 'Dispensasi': return 'bg-orange-100 border-orange-500 text-orange-800 font-bold';
      default: return 'bg-white border-gray-300 text-gray-700';
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow">
        <label className="block text-sm font-bold text-gray-700 mb-2">Pilih Jadwal Pertemuan Anda</label>
        <select value={selectedPtmId} onChange={e=>setSelectedPtmId(e.target.value)} className="w-full border rounded px-3 py-3 text-sm bg-gray-50 focus:ring-blue-500">
          <option value="">-- Menampilkan Jadwal Milik Anda Saja --</option>
          {myPtms.map(p => {
            const cls = data.classes.find(c => c.id === p.classId)?.name;
            const sub = data.subjects.find(s => s.id === p.subjectId)?.name;
            return <option key={p.id} value={p.id}>{p.date} | {cls} | {sub} - {p.topic}</option>
          })}
        </select>
      </div>

      {ptm && (
        <div className="bg-white rounded-lg shadow overflow-hidden animate-fade-in">
          <div className="p-4 bg-blue-50 border-b flex justify-between items-center">
            <h3 className="font-bold text-blue-800 flex items-center text-sm">
              <Cloud className="w-5 h-5 mr-2" /> Input Absensi: {data.classes.find(c=>c.id===ptm.classId)?.name}
            </h3>
            <button onClick={saveAttendance} className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-bold shadow hover:bg-blue-700"><Save className="w-4 h-4 inline mr-2"/> Sinkronkan Absensi</button>
          </div>
          <div className="overflow-x-auto">
             <table className="min-w-full divide-y divide-gray-200 text-sm">
               <thead className="bg-gray-100">
                 <tr>
                   <th className="px-4 py-3 text-left">Nama Siswa</th>
                   <th className="px-4 py-3 text-center">Kehadiran</th>
                   <th className="px-4 py-3 text-left">Keterangan</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-gray-200">
                 {classStudents.map(s => {
                   const current = tempAttendance[s.id] || { status: 'Hadir', note: '' };
                   const statuses = ['Hadir', 'Sakit', 'Izin', 'Alfa', 'Dispensasi'];
                   return (
                     <tr key={s.id} className="hover:bg-gray-50">
                       <td className="px-4 py-4 font-medium whitespace-nowrap">{s.name}</td>
                       <td className="px-4 py-4 text-center">
                         <div className="flex justify-center space-x-2">
                           {statuses.map(st => {
                             const isSelected = current.status === st;
                             return (
                               <label key={st} className={`px-2 py-1.5 rounded cursor-pointer border text-xs transition-colors duration-200 ${getColorClass(st, isSelected)}`}>
                                 <input type="radio" name={`status_${s.id}`} className="hidden" checked={isSelected} onChange={() => handleStatusChange(s.id, st)} />
                                 {st}
                               </label>
                             );
                           })}
                         </div>
                       </td>
                       <td className="px-4 py-4"><input type="text" value={current.note || ''} onChange={e=>handleNoteChange(s.id, e.target.value)} placeholder="Catatan opsional..." className="w-full border rounded px-3 py-1.5 text-xs bg-gray-50 focus:bg-white" /></td>
                     </tr>
                   )
                 })}
               </tbody>
             </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ModulJurnal({ data, updateData, myClasses, mySubjects, myPtms, myAssignments, currentUser, currentTerm }) {
  const [form, setForm] = useState({ id: null, date: '', classId: '', subjectId: '', time: '', type: 'Teori', element: '', material: '', activities: '', notes: '', absents: '' });
  const [isEditing, setIsEditing] = useState(false);

  // Ambil hanya Jurnal milik Guru yang login dan yang periodenya sama
  const myJournals = data.journals.filter(j => j.teacherId === currentUser.id && (!j.term || j.term === currentTerm));

  // Dinamis berdasar kelas yang dipilih
  const validSubjectIds = form.classId 
    ? myAssignments.filter(a => a.classId === Number(form.classId)).map(a => a.subjectId)
    : mySubjects.map(s=>s.id);
  const availableSubjects = form.classId 
    ? mySubjects.filter(s => validSubjectIds.includes(s.id))
    : mySubjects;

  const handlePtmSelect = (ptmId) => {
    if (!ptmId) return;
    const ptm = myPtms.find(p => p.id === Number(ptmId));
    if (ptm) {
      const absentsData = data.attendances.filter(a => a.ptmId === ptm.id && a.status !== 'Hadir');
      const absentString = absentsData.map(a => {
        const student = data.students.find(s => s.id === a.studentId);
        return `${student ? student.name : 'Unknown'} (${a.status}${a.note ? ` - ${a.note}` : ''})`;
      }).join(', ');
      
      setForm({
        ...form,
        date: ptm.date,
        classId: ptm.classId.toString(),
        subjectId: ptm.subjectId.toString(),
        material: ptm.topic,
        absents: absentString || 'Nihil'
      });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.classId || !form.subjectId) { alert("Pilih kelas dan mapel!"); return; }

    const journalData = { ...form, classId: Number(form.classId), subjectId: Number(form.subjectId), teacherId: currentUser.id, term: currentTerm };

    if (isEditing) {
      updateData('journals', data.journals.map(j => j.id === form.id ? journalData : j));
      alert('Jurnal berhasil diperbarui di Cloud!');
    } else {
      updateData('journals', [{ ...journalData, id: Date.now() }, ...data.journals]);
      alert('Jurnal baru berhasil disimpan ke Cloud!');
    }
    setForm({ id: null, date: '', classId: '', subjectId: '', time: '', type: 'Teori', element: '', material: '', activities: '', notes: '', absents: '' });
    setIsEditing(false);
  };

  const handleEdit = (j) => {
    setForm({ ...j, classId: j.classId.toString(), subjectId: j.subjectId.toString() });
    setIsEditing(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (id) => {
    if(confirm('Hapus catatan jurnal ini?')) {
      updateData('journals', data.journals.filter(j => j.id !== id));
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow border-t-4 border-blue-500">
        <h3 className="text-lg font-bold mb-4 border-b pb-2">{isEditing ? 'Edit Jurnal Mengajar Anda' : 'Isi Jurnal Mengajar Baru (Cloud)'}</h3>
        
        {!isEditing && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded">
            <label className="text-sm font-bold text-blue-800 block mb-2">Jalan Pintas: Ambil Data dari Pertemuan PTM</label>
            <select onChange={e => handlePtmSelect(e.target.value)} className="w-full border rounded p-2 text-sm bg-white focus:ring-blue-500">
              <option value="">-- Pilih Jadwal PTM milik Anda --</option>
              {myPtms.map(p => {
                const cls = data.classes.find(c => c.id === p.classId)?.name;
                const sub = data.subjects.find(s => s.id === p.subjectId)?.name;
                return <option key={p.id} value={p.id}>{p.date} | {cls} | {sub} - {p.topic}</option>
              })}
            </select>
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div><label className="text-xs font-bold text-gray-500 mb-1 block">Tanggal</label><input type="date" required value={form.date} onChange={e=>setForm({...form, date:e.target.value})} className="w-full border rounded px-3 py-2 text-sm bg-gray-50" /></div>
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1 block">Kelas</label>
              <select required value={form.classId} onChange={e=>setForm({...form, classId:e.target.value, subjectId: ''})} className="w-full border rounded px-3 py-2 text-sm bg-white">
                <option value="">-- Pilih Kelas --</option>{myClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1 block">Mata Pelajaran</label>
              <select required value={form.subjectId} disabled={!form.classId} onChange={e=>setForm({...form, subjectId:e.target.value})} className="w-full border rounded px-3 py-2 text-sm bg-white disabled:bg-gray-100">
                <option value="">-- Pilih Mapel --</option>{availableSubjects.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div><label className="text-xs font-bold text-gray-500 mb-1 block">Jam KBM</label><input placeholder="Misal: 07:00 - 09:30" required value={form.time} onChange={e=>setForm({...form, time:e.target.value})} className="w-full border rounded px-3 py-2 text-sm bg-gray-50" /></div>
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1 block">Jenis KBM</label>
              <select value={form.type} onChange={e=>setForm({...form, type:e.target.value})} className="w-full border rounded px-3 py-2 text-sm bg-white">
                <option>Teori</option><option>Praktek</option><option>Teori & Praktek</option>
              </select>
            </div>
          </div>
          <div className="space-y-4">
            <div><label className="text-xs font-bold text-gray-500 mb-1 block">Elemen / Bab</label><input required value={form.element} onChange={e=>setForm({...form, element:e.target.value})} className="w-full border rounded px-3 py-2 text-sm bg-gray-50" /></div>
            <div><label className="text-xs font-bold text-gray-500 mb-1 block">Materi Pembelajaran</label><input required value={form.material} onChange={e=>setForm({...form, material:e.target.value})} className="w-full border rounded px-3 py-2 text-sm bg-gray-50" /></div>
            <div><label className="text-xs font-bold text-gray-500 mb-1 block">Kegiatan Pembelajaran</label><textarea required value={form.activities} onChange={e=>setForm({...form, activities:e.target.value})} className="w-full border rounded px-3 py-2 text-sm bg-gray-50 h-20" /></div>
            <div><label className="text-xs font-bold text-gray-500 mb-1 block">Catatan Tambahan (Opsional)</label><input value={form.notes} onChange={e=>setForm({...form, notes:e.target.value})} className="w-full border rounded px-3 py-2 text-sm bg-gray-50" /></div>
            <div><label className="text-xs font-bold text-red-500 mb-1 block">Siswa Tidak Hadir</label><input value={form.absents} onChange={e=>setForm({...form, absents:e.target.value})} className="w-full border rounded px-3 py-2 text-sm border-red-200 bg-red-50" placeholder="Otomatis jika memilih PTM" /></div>
          </div>
          <div className="md:col-span-2 mt-2 pt-4 border-t flex justify-end space-x-3">
            {isEditing && (
              <button type="button" onClick={() => { setIsEditing(false); setForm({ id: null, date: '', classId: '', subjectId: '', time: '', type: 'Teori', element: '', material: '', activities: '', notes: '', absents: '' }); }} className="bg-gray-500 text-white px-6 py-2 rounded text-sm font-bold shadow hover:bg-gray-600">
                Batal Edit
              </button>
            )}
            <button type="submit" className="bg-blue-600 text-white px-8 py-2 rounded text-sm font-bold shadow hover:bg-blue-700">
              <Save className="w-4 h-4 inline mr-2"/> {isEditing ? 'Update Jurnal' : 'Simpan Jurnal Baru'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4 bg-gray-50 border-b">
          <h3 className="font-bold text-gray-700">Arsip Jurnal Mengajar Anda (Periode: {currentTerm})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Tanggal & Waktu</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Kelas / Mapel</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Rincian Materi</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {myJournals.map(j => {
                const cls = data.classes.find(c => c.id === j.classId)?.name;
                const sub = data.subjects.find(s => s.id === j.subjectId)?.name;
                return (
                  <tr key={j.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap align-top">
                      <div className="font-bold text-gray-800">{j.date}</div>
                      <div className="text-xs text-gray-500">{j.time}</div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium text-blue-600">{cls}</div>
                      <div className="text-xs text-gray-600 font-bold">{sub} ({j.type})</div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium text-xs text-gray-800">Bab: {j.element}</div>
                      <div className="text-xs text-gray-600 mt-1 line-clamp-2">{j.material}</div>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap align-top">
                      <button onClick={() => handleEdit(j)} className="text-blue-600 bg-blue-50 p-1.5 rounded hover:bg-blue-100" title="Edit"><Edit className="w-4 h-4 inline"/></button>
                      <button onClick={() => handleDelete(j.id)} className="text-red-600 bg-red-50 p-1.5 rounded hover:bg-red-100" title="Hapus"><Trash2 className="w-4 h-4 inline"/></button>
                    </td>
                  </tr>
                )
              })}
              {myJournals.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-4 py-8 text-center text-gray-500">Anda belum memiliki arsip jurnal di periode ini.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ModulNilai({ data, updateData, myClasses, myStudents, currentUser, currentTerm }) {
  const [selectedClass, setSelectedClass] = useState('');
  const [newAssessment, setNewAssessment] = useState({ name: '', weight: '' });
  const [editingAssessmentId, setEditingAssessmentId] = useState(null);
  
  // Penilaian diisolasi per Guru dan periode aktif
  const myAssessments = data.assessments?.filter(a => a.teacherId === currentUser.id && (!a.term || a.term === currentTerm)) || [];
  const classStudents = selectedClass ? myStudents.filter(s => s.classId === Number(selectedClass)) : [];

  const handleAssessmentSubmit = (e) => {
    e.preventDefault();
    if (editingAssessmentId) {
      updateData('assessments', data.assessments.map(a => 
        a.id === editingAssessmentId ? { ...a, name: newAssessment.name, weight: Number(newAssessment.weight) } : a
      ));
      setEditingAssessmentId(null);
    } else {
      updateData('assessments', [...(data.assessments||[]), { id: Date.now(), name: newAssessment.name, weight: Number(newAssessment.weight), teacherId: currentUser.id, term: currentTerm }]);
    }
    setNewAssessment({ name: '', weight: '' });
  };

  const handleEditAssessment = (a) => {
    setNewAssessment({ name: a.name, weight: a.weight });
    setEditingAssessmentId(a.id);
  };

  const delAssessment = (id) => {
    if(confirm('Hapus kolom nilai ini?')) {
       updateData('assessments', data.assessments.filter(a => a.id !== id));
       updateData('grades', data.grades.filter(g => g.assessmentId !== id));
    }
  };

  const handleGradeChange = (studentId, assessmentId, score) => {
    let newGrades = [...data.grades];
    const index = newGrades.findIndex(g => g.studentId === studentId && g.assessmentId === assessmentId);
    if (index >= 0) newGrades[index].score = Number(score);
    else newGrades.push({ studentId, assessmentId, score: Number(score) });
    updateData('grades', newGrades);
  };

  const getScore = (studentId, assessmentId) => {
    const g = data.grades.find(x => x.studentId === studentId && x.assessmentId === assessmentId);
    return g ? g.score : '';
  };

  const calculateFinal = (studentId) => {
    let total = 0, totalWeight = 0;
    myAssessments.forEach(a => {
      const score = Number(getScore(studentId, a.id)) || 0;
      total += score * (a.weight / 100);
      totalWeight += a.weight;
    });
    if (totalWeight === 0) return 0;
    return totalWeight === 100 ? total.toFixed(1) : ((total / (totalWeight/100))).toFixed(1);
  };

  // Helper for Stats
  const getColStats = (assessmentId) => {
    const scores = classStudents.map(s => Number(getScore(s.id, assessmentId)) || 0).filter(v => v > 0);
    if (!scores.length) return { max: '-', min: '-', avg: '-' };
    return { max: Math.max(...scores), min: Math.min(...scores), avg: (scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(1) };
  };

  const getFinalStats = () => {
    const scores = classStudents.map(s => Number(calculateFinal(s.id)) || 0).filter(v => v > 0);
    if (!scores.length) return { max: '-', min: '-', avg: '-' };
    return { max: Math.max(...scores), min: Math.min(...scores), avg: (scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(1) };
  };

  const handleExport = () => {
    let csv = "Nama Siswa," + myAssessments.map(a => `${a.name}(${a.weight}%)`).join(",") + ",Nilai Akhir\n";
    classStudents.forEach(s => {
      let row = s.name + ",";
      row += myAssessments.map(a => getScore(s.id, a.id)).join(",") + ",";
      row += calculateFinal(s.id);
      csv += row + "\n";
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Rekap_Nilai_Kelas_${selectedClass}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow col-span-1 md:col-span-1">
          <h3 className="font-bold mb-4 flex items-center text-sm"><Settings className="w-4 h-4 mr-2"/> Setup Kolom Nilai Anda</h3>
          <form onSubmit={handleAssessmentSubmit} className="flex flex-col space-y-2 mb-4">
            <input required placeholder="Nama Kolom (UH1)" value={newAssessment.name} onChange={e=>setNewAssessment({...newAssessment, name:e.target.value})} className="w-full border p-2 text-sm rounded bg-gray-50 focus:ring-blue-500" />
            <div className="flex space-x-2">
               <input required type="number" placeholder="Bobot (%)" value={newAssessment.weight} onChange={e=>setNewAssessment({...newAssessment, weight:e.target.value})} className="w-1/2 border p-2 text-sm rounded bg-gray-50 focus:ring-blue-500" />
               <button type="submit" className={`flex-1 ${editingAssessmentId ? 'bg-orange-500' : 'bg-blue-600'} text-white text-sm font-bold rounded shadow`}>
                 {editingAssessmentId ? 'Simpan' : 'Tambah'}
               </button>
            </div>
            {editingAssessmentId && (
               <button type="button" onClick={() => { setEditingAssessmentId(null); setNewAssessment({name:'', weight:''})}} className="w-full bg-gray-400 text-white text-xs py-1 rounded">Batal Edit</button>
            )}
          </form>
          <ul className="text-sm divide-y divide-gray-100">
            {myAssessments.map(a => (
              <li key={a.id} className="py-2.5 flex justify-between items-center group">
                <div>
                   <span className="font-medium text-gray-800">{a.name}</span> <span className="text-xs font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">Bobot: {a.weight}%</span>
                </div>
                <div className="space-x-1.5">
                  <button onClick={()=>handleEditAssessment(a)} className="text-blue-500 bg-blue-50 p-1 rounded"><Edit className="w-3.5 h-3.5"/></button>
                  <button onClick={()=>delAssessment(a.id)} className="text-red-500 bg-red-50 p-1 rounded"><Trash2 className="w-3.5 h-3.5"/></button>
                </div>
              </li>
            ))}
            {myAssessments.length===0 ? <p className="text-xs text-gray-500 mt-2">Buat kolom penilaian terlebih dahulu.</p> : null}
          </ul>
        </div>

        <div className="bg-white p-6 rounded-lg shadow col-span-1 md:col-span-3">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 space-y-2 md:space-y-0">
            <select value={selectedClass} onChange={e=>setSelectedClass(e.target.value)} className="border rounded p-2.5 text-sm font-bold bg-blue-50 text-blue-800 w-full md:w-1/2">
              <option value="">-- Pilih Kelas Anda --</option>
              {myClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {selectedClass && (
              <button onClick={handleExport} className="bg-green-600 text-white px-4 py-2.5 rounded text-sm font-bold flex items-center shadow hover:bg-green-700 w-full md:w-auto justify-center">
                <Download className="w-4 h-4 mr-2"/> Download CSV
              </button>
            )}
          </div>

          {selectedClass ? (
            <div className="overflow-x-auto mt-4 border rounded-lg">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-slate-800 text-white">
                  <tr>
                    <th className="px-4 py-3 text-left border-r border-slate-600">Nama Siswa</th>
                    {myAssessments.map(a => <th key={a.id} className="px-3 py-2 text-center border-r border-slate-600 font-bold">{a.name} <br/><span className="text-[10px] font-normal text-blue-200">{a.weight}%</span></th>)}
                    <th className="px-4 py-3 text-center bg-blue-700">Nilai Akhir</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {classStudents.map((s, index) => (
                    <tr key={s.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-2.5 border-r font-medium whitespace-nowrap">{s.name}</td>
                      {myAssessments.map(a => (
                        <td key={a.id} className="px-2 py-1.5 border-r text-center">
                          <input type="number" min="0" max="100" value={getScore(s.id, a.id)} onChange={e=>handleGradeChange(s.id, a.id, e.target.value)} onBlur={() => {
                              updateData('grades', [...data.grades]); // Auto sync to cloud on blur
                          }} className="w-16 text-center border rounded p-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white" />
                        </td>
                      ))}
                      <td className="px-4 py-2.5 text-center font-bold bg-blue-50 text-blue-900">{calculateFinal(s.id)}</td>
                    </tr>
                  ))}
                  {classStudents.length === 0 ? <tr><td colSpan={myAssessments.length + 2} className="p-8 text-center text-gray-500">Tidak ada siswa di kelas ini.</td></tr> : null}
                </tbody>
                {classStudents.length > 0 && (
                   <tfoot className="bg-blue-50 font-bold text-sm border-t-2 border-blue-200">
                     <tr>
                       <td className="px-4 py-2.5 border-r text-right" colSpan="1">Rata-rata Kelas:</td>
                       {myAssessments.map(a => <td key={`avg-${a.id}`} className="px-2 py-1.5 border-r text-center">{getColStats(a.id).avg}</td>)}
                       <td className="px-4 py-2.5 text-center text-blue-900">{getFinalStats().avg}</td>
                     </tr>
                     <tr>
                       <td className="px-4 py-2.5 border-r text-right text-green-700" colSpan="1">Nilai Tertinggi:</td>
                       {myAssessments.map(a => <td key={`max-${a.id}`} className="px-2 py-1.5 border-r text-center text-green-700">{getColStats(a.id).max}</td>)}
                       <td className="px-4 py-2.5 text-center text-green-700">{getFinalStats().max}</td>
                     </tr>
                     <tr>
                       <td className="px-4 py-2.5 border-r text-right text-red-700" colSpan="1">Nilai Terendah:</td>
                       {myAssessments.map(a => <td key={`min-${a.id}`} className="px-2 py-1.5 border-r text-center text-red-700">{getColStats(a.id).min}</td>)}
                       <td className="px-4 py-2.5 text-center text-red-700">{getFinalStats().min}</td>
                     </tr>
                   </tfoot>
                )}
              </table>
            </div>
          ) : (
            <div className="text-center text-gray-400 py-16 border-2 border-dashed rounded-lg bg-gray-50">Silahkan pilih kelas untuk memulai input nilai.</div>
          )}
          {selectedClass && <p className="text-xs text-gray-400 mt-3 flex items-center"><Cloud className="w-3 h-3 mr-1"/> Nilai otomatis tersimpan ke server saat Anda mengetik/berpindah kolom.</p>}
        </div>
      </div>
    </div>
  );
}

function ModulRekapAbsen({ data, myClasses, myStudents, myPtms }) {
  const [selectedClass, setSelectedClass] = useState('');
  
  const classStudents = selectedClass ? myStudents.filter(s => s.classId === Number(selectedClass)) : [];
  const classPtms = selectedClass ? myPtms.filter(p => p.classId === Number(selectedClass)).sort((a,b)=>new Date(a.date)-new Date(b.date)) : [];

  const getAttendance = (studentId, ptmId) => {
    const a = data.attendances.find(x => x.studentId === studentId && x.ptmId === ptmId);
    if(!a) return '-';
    switch(a.status) {
      case 'Hadir': return <span className="text-green-600 font-bold">H</span>;
      case 'Sakit': return <span className="text-yellow-600 font-bold">S</span>;
      case 'Izin': return <span className="text-sky-600 font-bold">I</span>;
      case 'Alfa': return <span className="text-red-600 font-bold">A</span>;
      case 'Dispensasi': return <span className="text-orange-600 font-bold">D</span>;
      default: return '-';
    }
  };

  const getCounts = (studentId) => {
    const counts = { Hadir: 0, Sakit: 0, Izin: 0, Alfa: 0, Dispensasi: 0 };
    classPtms.forEach(p => {
      const a = data.attendances.find(x => x.studentId === studentId && x.ptmId === p.id);
      if(a && counts[a.status] !== undefined) counts[a.status]++;
    });
    return counts;
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="mb-4">
        <label className="block text-sm font-bold text-gray-700 mb-2">Pilih Kelas</label>
        <select value={selectedClass} onChange={e=>setSelectedClass(e.target.value)} className="w-full md:w-1/3 border rounded px-3 py-2 text-sm bg-gray-50 focus:ring-blue-500">
          <option value="">-- Tampilkan Rekap Kelas Anda --</option>
          {myClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {selectedClass && classPtms.length > 0 && (
        <div className="overflow-x-auto border rounded-lg">
          <table className="min-w-full text-sm border-collapse">
            <thead className="bg-slate-100 border-b">
              <tr>
                <th className="px-4 py-2 text-left border-r" rowSpan="2">Nama Siswa</th>
                <th className="px-2 py-2 text-center border-r" colSpan={classPtms.length}>Pertemuan (Tgl)</th>
                <th className="px-2 py-2 text-center bg-blue-100" colSpan="6">Total Kehadiran</th>
              </tr>
              <tr className="border-b">
                {classPtms.map(p => {
                  const sub = data.subjects.find(s=>s.id===p.subjectId);
                  return (
                    <th key={p.id} className="px-2 py-1.5 text-center border-r font-normal text-xs" title={`${p.date} - ${sub?.name}`}>
                      {p.date.split('-').reverse().slice(0,2).join('/')}
                    </th>
                  )
                })}
                <th className="px-2 py-1.5 text-center border-r font-bold text-green-700 bg-green-50">H</th>
                <th className="px-2 py-1.5 text-center border-r font-bold text-yellow-700 bg-yellow-50">S</th>
                <th className="px-2 py-1.5 text-center border-r font-bold text-sky-700 bg-sky-50">I</th>
                <th className="px-2 py-1.5 text-center border-r font-bold text-red-700 bg-red-50">A</th>
                <th className="px-2 py-1.5 text-center border-r font-bold text-orange-700 bg-orange-50">D</th>
                <th className="px-2 py-1.5 text-center font-bold text-blue-700 bg-blue-50">%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {classStudents.map(s => {
                const counts = getCounts(s.id);
                const percentage = classPtms.length === 0 ? 100 : Math.round(((counts.Hadir + counts.Dispensasi) / classPtms.length) * 100);
                return (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 border-r font-medium whitespace-nowrap">{s.name}</td>
                    {classPtms.map(p => (
                      <td key={p.id} className="px-2 py-2 text-center border-r">
                        {getAttendance(s.id, p.id)}
                      </td>
                    ))}
                    <td className="px-2 py-2 text-center border-r font-bold bg-green-50">{counts.Hadir}</td>
                    <td className="px-2 py-2 text-center border-r font-bold bg-yellow-50">{counts.Sakit}</td>
                    <td className="px-2 py-2 text-center border-r font-bold bg-sky-50">{counts.Izin}</td>
                    <td className="px-2 py-2 text-center border-r font-bold bg-red-50">{counts.Alfa}</td>
                    <td className="px-2 py-2 text-center border-r font-bold bg-orange-50">{counts.Dispensasi}</td>
                    <td className="px-2 py-2 text-center font-bold bg-blue-50 text-blue-700">{percentage}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="p-3 bg-gray-50 text-xs text-gray-500 flex flex-wrap gap-4 border-t">
            <span><b className="text-green-600">H</b>: Hadir</span><span><b className="text-yellow-600">S</b>: Sakit</span><span><b className="text-sky-600">I</b>: Izin</span><span><b className="text-red-600">A</b>: Alfa</span><span><b className="text-orange-600">D</b>: Dispensasi</span><span><b className="text-blue-600">%</b>: (H+D)/Total</span>
          </div>
        </div>
      )}
      {selectedClass && classPtms.length === 0 ? <p className="text-gray-500 text-sm">Belum ada PTM tercatat untuk kelas Anda ini.</p> : null}
    </div>
  );
}

function ModulPantau({ data, myClasses, myStudents, myPtms }) {
  const [threshold, setThreshold] = useState(75);

  const stats = useMemo(() => {
    return myStudents.map(s => {
      const clsPtms = myPtms.filter(p => p.classId === s.classId);
      const totalPtm = clsPtms.length;
      const atts = data.attendances.filter(a => a.studentId === s.id && clsPtms.map(p=>p.id).includes(a.ptmId));
      const hadir = atts.filter(a => a.status === 'Hadir' || a.status === 'Dispensasi').length;
      const perc = totalPtm === 0 ? 100 : (hadir / totalPtm) * 100;
      return { ...s, totalPtm, hadir, percentage: Math.round(perc) };
    }).filter(s => s.percentage < threshold);
  }, [myStudents, myPtms, data.attendances, threshold]);

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6">
        <h3 className="text-xl font-bold text-red-600 flex items-center"><Activity className="w-6 h-6 mr-2"/> Pantau Siswa Kritis di Kelas Anda</h3>
        <div className="flex items-center space-x-2 mt-2 md:mt-0">
          <label className="text-sm font-bold text-gray-600">Batas Kehadiran Min (%):</label>
          <input type="number" value={threshold} onChange={e=>setThreshold(Number(e.target.value))} className="border p-1.5 w-20 text-center rounded bg-red-50 focus:ring-red-500 font-bold" />
        </div>
      </div>

      <div className="overflow-x-auto border rounded-lg">
         <table className="min-w-full divide-y divide-gray-200 text-sm">
           <thead className="bg-red-100 text-red-800">
             <tr>
               <th className="px-4 py-3 text-left font-bold">Nama Siswa</th>
               <th className="px-4 py-3 text-left font-bold">Kelas</th>
               <th className="px-4 py-3 text-center font-bold">Total PTM Guru</th>
               <th className="px-4 py-3 text-center font-bold">Siswa Hadir</th>
               <th className="px-4 py-3 text-center font-bold">Persentase</th>
             </tr>
           </thead>
           <tbody className="divide-y divide-gray-200 bg-white">
             {stats.map(s => {
               const cls = data.classes.find(c=>c.id === s.classId)?.name;
               return (
                 <tr key={s.id} className="hover:bg-red-50/50">
                   <td className="px-4 py-3 font-medium">{s.name}</td>
                   <td className="px-4 py-3">{cls}</td>
                   <td className="px-4 py-3 text-center">{s.totalPtm}</td>
                   <td className="px-4 py-3 text-center">{s.hadir}</td>
                   <td className="px-4 py-3 text-center"><span className="font-bold text-red-600 px-2 py-1 bg-red-100 rounded">{s.percentage}%</span></td>
                 </tr>
               )
             })}
             {stats.length === 0 ? <tr><td colSpan="5" className="p-8 text-center text-gray-500">Aman! Tidak ada siswa dengan kehadiran di bawah {threshold}% di kelas Anda.</td></tr> : null}
           </tbody>
         </table>
      </div>
    </div>
  );
}

function ModulCetak({ data, currentUser, myClasses, mySubjects, myPtms, myStudents, currentTerm }) {
  const [printType, setPrintType] = useState('kehadiran'); // kehadiran, jurnal, nilai, pantau
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [printThreshold, setPrintThreshold] = useState(75);

  // Helpers specific to printing (filtered by Guru)
  const classStudents = selectedClass ? myStudents.filter(s => s.classId === Number(selectedClass)) : [];
  const classPtms = selectedClass ? myPtms.filter(p => p.classId === Number(selectedClass)).sort((a,b)=>new Date(a.date)-new Date(b.date)) : [];
  
  let classJournals = selectedClass ? data.journals.filter(j => j.classId === Number(selectedClass) && j.teacherId === currentUser.id && (!j.term || j.term === currentTerm)) : [];
  if (printType === 'jurnal' && selectedSubject) {
    classJournals = classJournals.filter(j => j.subjectId === Number(selectedSubject));
  }
  classJournals.sort((a,b)=>new Date(a.date)-new Date(b.date));

  const myAssessments = data.assessments?.filter(a => a.teacherId === currentUser.id && (!a.term || a.term === currentTerm)) || [];

  const handlePrint = () => { window.print(); };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow print:hidden">
        <h3 className="text-lg font-bold mb-4">Menu Cetak Laporan Khusus ({currentTerm})</h3>
        <div className={`grid grid-cols-1 ${printType === 'jurnal' ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-4 mb-6`}>
           <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Kategori Laporan</label>
              <select value={printType} onChange={(e) => setPrintType(e.target.value)} className="w-full border p-2.5 rounded bg-gray-50">
                 <option value="kehadiran">Rekap Kehadiran Siswa</option>
                 <option value="jurnal">Buku Jurnal Mengajar</option>
                 <option value="nilai">Rekap Nilai Anda (Leger)</option>
                 <option value="pantau">Laporan Kehadiran Kritis (Pantau)</option>
              </select>
           </div>
           <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Pilih Kelas</label>
              <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="w-full border p-2.5 rounded bg-gray-50">
                 <option value="">-- Kelas Anda --</option>
                 {myClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
           </div>
           {printType === 'jurnal' && (
             <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Filter Mapel (Opsional)</label>
                <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} className="w-full border p-2.5 rounded bg-gray-50">
                   <option value="">Semua Mapel Saya</option>
                   {mySubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
             </div>
           )}
           {printType === 'pantau' && (
             <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Batas Hadir Minimum (%)</label>
                <input type="number" value={printThreshold} onChange={(e) => setPrintThreshold(e.target.value)} className="w-full border p-2.5 rounded bg-gray-50" />
             </div>
           )}
           <div className="flex items-end">
              <button onClick={handlePrint} disabled={!selectedClass} className={`w-full text-white px-4 py-2.5 rounded flex justify-center items-center font-bold shadow ${selectedClass ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-300 cursor-not-allowed'}`}>
                 <Printer className="w-5 h-5 mr-2"/> Cetak Laporan
              </button>
           </div>
        </div>
      </div>
      
      {/* Print Preview Area */}
      {selectedClass ? (
        <div className="bg-white p-8 border-2 border-dashed border-gray-300 min-h-[500px] text-black">
          {/* KOP SURAT */}
          <div className="flex items-center justify-between mb-6 border-b-4 border-black pb-4 px-4">
             {data.settings.schoolLogo ? (
                <img src={data.settings.schoolLogo} alt="Logo Sekolah" className="w-24 h-24 object-contain" />
             ) : <div className="w-24 h-24"></div>}
             <div className="text-center flex-1 px-4">
                <h1 className="text-2xl font-bold uppercase">{data.settings.schoolName}</h1>
                <p className="text-sm">{data.settings.schoolAddress}</p>
             </div>
             <div className="w-24 h-24"></div> {/* Spacer balance */}
          </div>

          {/* JUDUL LAPORAN */}
          <div className="text-center mb-6">
             <h2 className="text-xl font-bold uppercase underline">
                {printType === 'kehadiran' && 'Laporan Rekapitulasi Kehadiran Siswa'}
                {printType === 'jurnal' && 'Buku Jurnal Mengajar Guru'}
                {printType === 'nilai' && 'Daftar Kumpulan Nilai Siswa (Leger)'}
                {printType === 'pantau' && 'Laporan Siswa Kritis Kehadiran'}
             </h2>
             <p className="text-sm mt-2">
                Kelas: <strong>{data.classes.find(c=>c.id===Number(selectedClass))?.name}</strong> | 
                Tahun Pelajaran: {data.settings.academicYear} | Semester: {data.settings.semester}
             </p>
          </div>
          
          {/* ISI TABEL */}
          <div className="overflow-x-auto text-sm">
             {printType === 'kehadiran' && (
                <table className="min-w-full border-collapse border border-black mb-8">
                  <thead>
                    <tr>
                      <th className="border border-black px-2 py-1" rowSpan="2">No</th>
                      <th className="border border-black px-2 py-1" rowSpan="2">Nama Siswa</th>
                      <th className="border border-black px-2 py-1" colSpan={classPtms.length || 1}>Pertemuan (Tgl)</th>
                      <th className="border border-black px-2 py-1" colSpan="6">Total Kehadiran</th>
                    </tr>
                    <tr>
                      {classPtms.length === 0 ? <th className="border border-black px-2 py-1">-</th> : null}
                      {classPtms.map(p => (
                        <th key={p.id} className="border border-black px-1 py-1 font-normal text-xs">{p.date.split('-').reverse().slice(0,2).join('/')}</th>
                      ))}
                      <th className="border border-black px-2 py-1">H</th>
                      <th className="border border-black px-2 py-1">S</th>
                      <th className="border border-black px-2 py-1">I</th>
                      <th className="border border-black px-2 py-1">A</th>
                      <th className="border border-black px-2 py-1">D</th>
                      <th className="border border-black px-2 py-1">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classStudents.map((s, idx) => {
                      const counts = { H:0, S:0, I:0, A:0, D:0 };
                      return (
                        <tr key={s.id}>
                           <td className="border border-black px-2 py-1 text-center">{idx+1}</td>
                           <td className="border border-black px-2 py-1">{s.name}</td>
                           {classPtms.length === 0 ? <td className="border border-black px-2 py-1 text-center">-</td> : null}
                           {classPtms.map(p => {
                              const a = data.attendances.find(x => x.studentId === s.id && x.ptmId === p.id);
                              let st = '-';
                              if(a) {
                                st = a.status.charAt(0);
                                if(counts[st] !== undefined) counts[st]++;
                              }
                              return <td key={p.id} className="border border-black px-1 py-1 text-center font-medium">{st}</td>
                           })}
                           <td className="border border-black px-2 py-1 text-center font-bold">{counts.H}</td>
                           <td className="border border-black px-2 py-1 text-center font-bold">{counts.S}</td>
                           <td className="border border-black px-2 py-1 text-center font-bold">{counts.I}</td>
                           <td className="border border-black px-2 py-1 text-center font-bold">{counts.A}</td>
                           <td className="border border-black px-2 py-1 text-center font-bold">{counts.D}</td>
                           <td className="border border-black px-2 py-1 text-center font-bold text-blue-700">{classPtms.length === 0 ? 100 : Math.round(((counts.H + counts.D) / classPtms.length) * 100)}%</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
             )}

             {printType === 'jurnal' && (
                <table className="min-w-full border-collapse border border-black mb-8">
                  <thead>
                     <tr>
                        <th className="border border-black px-2 py-2">Tgl / Jam</th>
                        <th className="border border-black px-2 py-2">Mapel</th>
                        <th className="border border-black px-2 py-2">Materi / Kegiatan</th>
                        <th className="border border-black px-2 py-2">Siswa Tdk Hadir</th>
                     </tr>
                  </thead>
                  <tbody>
                     {classJournals.map(j => {
                        const sub = data.subjects.find(s => s.id === j.subjectId)?.name;
                        return (
                           <tr key={j.id}>
                              <td className="border border-black px-2 py-2 whitespace-nowrap align-top">{j.date}<br/>{j.time}</td>
                              <td className="border border-black px-2 py-2 align-top">{sub}<br/>({j.type})</td>
                              <td className="border border-black px-2 py-2 align-top">
                                 <b>{j.element}</b><br/>{j.material}<br/><i>{j.activities}</i>
                              </td>
                              <td className="border border-black px-2 py-2 align-top text-xs">{j.absents || 'Nihil'}</td>
                           </tr>
                        )
                     })}
                     {classJournals.length === 0 ? <tr><td colSpan="4" className="border border-black px-2 py-4 text-center">Belum ada catatan jurnal untuk Anda.</td></tr> : null}
                  </tbody>
                </table>
             )}

             {printType === 'nilai' && (
                <table className="min-w-full border-collapse border border-black mb-8">
                  <thead>
                     <tr>
                        <th className="border border-black px-2 py-2">No</th>
                        <th className="border border-black px-2 py-2">Nama Siswa</th>
                        {myAssessments.map(a => <th key={a.id} className="border border-black px-2 py-2">{a.name} ({a.weight}%)</th>)}
                        <th className="border border-black px-2 py-2">Nilai Akhir</th>
                     </tr>
                  </thead>
                  <tbody>
                     {classStudents.map((s, idx) => {
                        let total = 0, totalWeight = 0;
                        return (
                           <tr key={s.id}>
                              <td className="border border-black px-2 py-1 text-center">{idx+1}</td>
                              <td className="border border-black px-2 py-1">{s.name}</td>
                              {myAssessments.map(a => {
                                 const g = data.grades.find(x => x.studentId === s.id && x.assessmentId === a.id);
                                 const score = g ? Number(g.score) : 0;
                                 total += score * (a.weight / 100);
                                 totalWeight += a.weight;
                                 return <td key={a.id} className="border border-black px-2 py-1 text-center">{g ? g.score : '-'}</td>
                              })}
                              <td className="border border-black px-2 py-1 text-center font-bold">
                                 {totalWeight === 0 ? '-' : (totalWeight === 100 ? total.toFixed(1) : ((total / (totalWeight/100))).toFixed(1))}
                              </td>
                           </tr>
                        )
                     })}
                  </tbody>
                </table>
             )}

             {printType === 'pantau' && (
                <table className="min-w-full border-collapse border border-black mb-8">
                  <thead>
                     <tr>
                        <th className="border border-black px-2 py-2">No</th>
                        <th className="border border-black px-2 py-2">Nama Siswa</th>
                        <th className="border border-black px-2 py-2">Total Pertemuan</th>
                        <th className="border border-black px-2 py-2">Siswa Hadir</th>
                        <th className="border border-black px-2 py-2">Persentase</th>
                     </tr>
                  </thead>
                  <tbody>
                     {classStudents.map((s) => {
                        const totalPtm = classPtms.length;
                        const atts = data.attendances.filter(a => a.studentId === s.id && classPtms.map(p=>p.id).includes(a.ptmId));
                        const hadir = atts.filter(a => a.status === 'Hadir' || a.status === 'Dispensasi').length;
                        const perc = totalPtm === 0 ? 100 : (hadir / totalPtm) * 100;
                        return { ...s, totalPtm, hadir, percentage: Math.round(perc) };
                     }).filter(s => s.percentage < printThreshold).map((s, idx) => (
                        <tr key={s.id}>
                           <td className="border border-black px-2 py-2 text-center">{idx+1}</td>
                           <td className="border border-black px-2 py-2">{s.name}</td>
                           <td className="border border-black px-2 py-2 text-center">{s.totalPtm}</td>
                           <td className="border border-black px-2 py-2 text-center">{s.hadir}</td>
                           <td className="border border-black px-2 py-2 text-center font-bold text-red-600">{s.percentage}%</td>
                        </tr>
                     ))}
                     {classStudents.filter(s => {
                        const totalPtm = classPtms.length;
                        const atts = data.attendances.filter(a => a.studentId === s.id && classPtms.map(p=>p.id).includes(a.ptmId));
                        const hadir = atts.filter(a => a.status === 'Hadir' || a.status === 'Dispensasi').length;
                        const perc = totalPtm === 0 ? 100 : (hadir / totalPtm) * 100;
                        return Math.round(perc) < printThreshold;
                     }).length === 0 ? <tr><td colSpan="5" className="border border-black px-2 py-4 text-center">Tidak ada siswa kritis di bawah {printThreshold}%.</td></tr> : null}
                  </tbody>
                </table>
             )}
          </div>

          {/* SIGNATURE AREA (Tanda Tangan) */}
          <div className="flex justify-between mt-12 px-8">
             <div className="text-center w-64">
                <p>Mengetahui,</p>
                <p>Kepala Sekolah,</p>
                <br/><br/><br/><br/>
                <p className="font-bold underline">{data.settings.principalName}</p>
                <p>NIP. {data.settings.principalNip}</p>
             </div>
             <div className="text-center w-64">
                <p>&nbsp;</p>
                <p>Guru Mata Pelajaran,</p>
                <br/><br/><br/><br/>
                <p className="font-bold underline">{currentUser.name}</p>
                <p>NIP. {currentUser.nip || '-'}</p>
             </div>
          </div>
        </div>
      ) : (
        <div className="bg-white p-8 border-2 border-dashed border-gray-300 h-64 flex items-center justify-center text-gray-400 font-medium">
          Pilih Kategori Laporan dan Kelas di atas untuk menampilkan Lembar Cetak.
        </div>
      )}
    </div>
  );
}

function ModulPengaturan({ data, updateData, currentUser, isAdmin, currentTerm }) {
  const [form, setForm] = useState(data.settings);
  const [pw, setPw] = useState({ old: '', new: '' });

  const saveSettings = (e) => {
    e.preventDefault();
    updateData('settings', form);
    alert('Pengaturan sekolah berhasil diperbarui di Cloud!');
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 1024 * 1024) {
         alert("Ukuran gambar terlalu besar! Maksimal 1MB.");
         return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setForm({ ...form, schoolLogo: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const changePassword = (e) => {
    e.preventDefault();
    if (currentUser.password !== pw.old) { alert('Password lama salah!'); return; }
    
    const updatedUsers = data.users.map(u => u.id === currentUser.id ? { ...u, password: pw.new } : u);
    updateData('users', updatedUsers);
    setPw({ old: '', new: '' });
    alert('Password berhasil diubah!');
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {isAdmin && (
         <div className="bg-white p-6 rounded-lg shadow">
           <h3 className="text-lg font-bold mb-4 border-b pb-2">Pengaturan Identitas & Periode Sekolah</h3>
           <form onSubmit={saveSettings} className="space-y-4 text-sm">
             <div>
                <label className="text-gray-600 font-bold block mb-1">Logo Sekolah (Maks 1MB)</label>
                <div className="flex items-center space-x-4">
                   {form.schoolLogo ? (
                      <img src={form.schoolLogo} alt="Logo" className="w-16 h-16 object-contain border rounded p-1 bg-gray-50" />
                   ) : (
                      <div className="w-16 h-16 border rounded bg-gray-100 flex items-center justify-center text-xs text-gray-400 text-center p-2">Belum ada logo</div>
                   )}
                   <input type="file" accept="image/*" onChange={handleLogoUpload} className="border p-2 rounded text-sm flex-1 bg-gray-50" />
                </div>
             </div>
             <div><label className="text-gray-600 font-bold block mb-1">Nama Sekolah Lengkap</label><input required value={form.schoolName} onChange={e=>setForm({...form, schoolName:e.target.value})} className="w-full border p-2 rounded focus:ring-blue-500" /></div>
             <div><label className="text-gray-600 font-bold block mb-1">Alamat Lengkap</label><textarea required value={form.schoolAddress} onChange={e=>setForm({...form, schoolAddress:e.target.value})} className="w-full border p-2 rounded h-16 focus:ring-blue-500" /></div>
             
             <div className="grid grid-cols-2 gap-4">
               <div><label className="text-gray-600 font-bold block mb-1">Nama Kepala Sekolah</label><input required value={form.principalName} onChange={e=>setForm({...form, principalName:e.target.value})} className="w-full border p-2 rounded" /></div>
               <div><label className="text-gray-600 font-bold block mb-1">NIP Kepala Sekolah</label><input required value={form.principalNip} onChange={e=>setForm({...form, principalNip:e.target.value})} className="w-full border p-2 rounded" /></div>
               
               <div><label className="text-gray-600 font-bold block mb-1">Tahun Pelajaran</label><input required value={form.academicYear} onChange={e=>setForm({...form, academicYear:e.target.value})} className="w-full border p-2 rounded bg-blue-50" /></div>
               <div>
                 <label className="text-gray-600 font-bold block mb-1">Semester Aktif</label>
                 <select value={form.semester} onChange={e=>setForm({...form, semester:e.target.value})} className="w-full border p-2 rounded bg-blue-50">
                   <option>Ganjil</option><option>Genap</option>
                 </select>
               </div>
             </div>
             <p className="text-xs text-orange-600 font-medium bg-orange-50 p-2 rounded border border-orange-200">
               ⚠️ Mengubah Tahun/Semester akan membuka lembaran Jurnal, PTM, dan Nilai yang bersih untuk semua guru. Untuk melihat data lama, Anda cukup ubah kembali pengaturan ini ke periode yang lama.
             </p>
             <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded font-bold shadow hover:bg-blue-700 w-full mt-2 flex items-center justify-center"><Save className="w-4 h-4 mr-2"/> Simpan Pengaturan Sistem</button>
           </form>
         </div>
      )}

      <div className="bg-white p-6 rounded-lg shadow h-fit">
        <h3 className="text-lg font-bold mb-4 border-b pb-2">Ubah Password Akun Anda</h3>
        <form onSubmit={changePassword} className="space-y-4 text-sm">
          <div><label className="text-gray-600 font-bold block mb-1">Password Lama</label><input type="password" required value={pw.old} onChange={e=>setPw({...pw, old:e.target.value})} className="w-full border p-2 rounded focus:ring-orange-500" /></div>
          <div><label className="text-gray-600 font-bold block mb-1">Password Baru</label><input type="password" required value={pw.new} onChange={e=>setPw({...pw, new:e.target.value})} className="w-full border p-2 rounded focus:ring-orange-500" /></div>
          <button type="submit" className="bg-orange-600 text-white px-4 py-2 rounded font-bold shadow hover:bg-orange-700 w-full">Ganti Password Sekarang</button>
        </form>
      </div>
    </div>
  );
}

function ModulTentang() {
  return (
    <div className="bg-white p-8 rounded-lg shadow max-w-3xl mx-auto text-center space-y-6">
      <div className="w-24 h-24 bg-blue-100 rounded-full mx-auto flex items-center justify-center overflow-hidden border-4 border-blue-50 shadow-sm">
        <img src="https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhwFhcX7IV8uSskVU1Jr-od3cntLeTE4ozM_9gnRqCVr9JMlCIRZz64NxQO0kLY03dn6tgnyhV3jI8LKh1oqDuQOV656RffXfseQxgrjYmzI_Q8G-5P1eY84q5URHb1Lf8XL1ocidRJu_blTATxTzKvHFUfWVQm0K69_5zdvPAGYFynYFqjqq7uflRkhiyi/s320-rw/Profile.png" alt="Profil Fadli Rahman" className="w-full h-full object-cover" />
      </div>
      <h2 className="text-3xl font-bold text-gray-800">Sistem Terpadu Guru (SiTeGu)</h2>
      <p className="text-gray-600 font-medium">Sinergi Teknologi, Dedikasi untuk Guru</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
         <div className="text-left text-sm text-gray-700 bg-gray-50 p-6 rounded-lg space-y-2 border">
           <h3 className="font-bold text-lg mb-3 text-blue-800 border-b pb-2">Profil Pengembang</h3>
           <p><strong>Nama:</strong> Fadli Rahman, S.Pd.</p>
           <p><strong>Instansi:</strong> SMK Negeri 2 Sebulu</p>
           <p><strong>Email:</strong> <a href="mailto:fadhli_rahman@ymail.com" className="text-blue-600 hover:underline">fadhli_rahman@ymail.com</a></p>
           <p><strong>Website:</strong> <a href="https://www.fadlirahman.my.id" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">www.fadlirahman.my.id</a></p>
           <p><strong>Instagram:</strong> <a href="https://www.instagram.com/fadhli.arrasyid/" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">@fadhli.arrasyid</a></p>
         </div>

         <div className="text-left text-sm text-gray-700 bg-yellow-50 p-6 rounded-lg space-y-2 border border-yellow-200 flex flex-col justify-between">
           <div>
              <h3 className="font-bold text-lg mb-3 text-yellow-800 border-b border-yellow-200 pb-2">Dukung Kami (Donasi)</h3>
              <p>Aplikasi ini disediakan secara gratis untuk membantu kemudahan administrasi Bapak/Ibu Guru. Jika aplikasi ini bermanfaat, pertimbangkan untuk mendukung pengembangan lebih lanjut.</p>
              
              <div className="mt-4 p-3 bg-yellow-100 rounded border border-yellow-300">
                <p className="font-medium text-yellow-900 mb-1">💳 Bank Kaltimtara</p>
                <p className="font-bold text-xl text-yellow-900 tracking-wider">0458522</p>
                <p className="text-xs text-yellow-800 mt-1">a.n. Fadli Rahman</p>
              </div>
           </div>
           <a href="https://saweria.co/fadlirahman87" target="_blank" rel="noreferrer" className="block text-center bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-bold py-2.5 px-4 rounded mt-4 shadow-sm transition-colors">
              ☕ Dukung via Saweria
           </a>
         </div>
      </div>

      <div className="text-left text-sm text-gray-700 border p-6 rounded-lg bg-blue-50/30">
        <h3 className="font-bold mb-2">Log Perubahan Utama</h3>
        <ul className="list-disc list-inside space-y-1 text-xs">
          <li><span className="font-bold text-blue-600">v4.3.0 - Rebranding ke SiTeGu, Dispensasi dihitung Hadir, penambahan kolom persentase absen.</span></li>
          <li>v4.2.0 - Fitur Mesin Waktu: Pilih Periode/Semester di Sidebar untuk melihat/cetak data arsip lama.</li>
          <li>v4.1.0 - Import Siswa, Mapel, Kelas & Penugasan via CSV. Tambah Print Pantau. Rekap Nilai dengan Max/Min/Rata-rata.</li>
          <li>v4.0.0 - Migrasi ke Single School & Sistem Penugasan (RBAC Isolasi Data per Guru)</li>
          <li>v2.0.0 - Full Integrasi Cloud Server Firebase</li>
        </ul>
      </div>
    </div>
  );
}