import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, deleteDoc, onSnapshot, collection, addDoc, updateDoc } from 'firebase/firestore';
import { 
  Calendar, MapPin, Monitor, CheckCircle, XCircle, 
  Clock, Plus, Trash2, LogOut, User as UserIcon, 
  Menu, X, Bell, Info, Mail, PieChart, Printer, Image as ImageIcon
} from 'lucide-react';

// --- Firebase Initialization ---
const firebaseConfig = {
  apiKey: "AIzaSyxxxx...",
  authDomain: "ssrw-booking-xxx.firebaseapp.com",
  projectId: "ssrw-booking-xxx",
  storageBucket: "ssrw-booking-xxx.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef..."
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'ssrw-booking-app';

// --- Base Paths for Firestore ---
const getPublicCollection = (colName) => collection(db, 'artifacts', appId, 'public', 'data', colName);
const getPublicDoc = (colName, docId) => doc(db, 'artifacts', appId, 'public', 'data', colName, docId);

// --- Reusable UI Components ---
const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = type === 'error' ? 'bg-red-500' : type === 'success' ? 'bg-green-500' : 'bg-blue-500';
  const Icon = type === 'success' ? CheckCircle : type === 'error' ? XCircle : Info;

  return (
    <div className={`fixed bottom-4 right-4 ${bgColor} text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 z-50 animate-bounce`}>
      <Icon size={20} />
      <span className="font-medium">{message}</span>
    </div>
  );
};

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-bold text-gray-800">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 hover:bg-gray-200 p-1 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};

const Badge = ({ status }) => {
  const styles = {
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    approved: 'bg-green-100 text-green-800 border-green-200',
    rejected: 'bg-red-100 text-red-800 border-red-200',
  };
  
  const labels = {
    pending: 'รออนุมัติ',
    approved: 'อนุมัติแล้ว',
    rejected: 'ไม่อนุมัติ',
  };

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${styles[status]}`}>
      {labels[status]}
    </span>
  );
};

// --- Main Application Component ---
export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [items, setItems] = useState([]);
  const [bookings, setBookings] = useState([]);
  
  // App States
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [activeTab, setActiveTab] = useState('browse'); // browse, my-bookings, admin-items, admin-bookings, admin-reports
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const showToast = (message, type = 'success') => setToast({ message, type });

  // 1. Firebase Auth Setup (Mandatory Pattern)
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth init error:", error);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 2. Fetch Data (Requires user)
  useEffect(() => {
    if (!user) return;

    // Fetch User Profile
    const profileUnsub = onSnapshot(
      getPublicDoc('profiles', user.uid),
      (docSnap) => {
        if (docSnap.exists()) {
          const profileData = docSnap.data();
          setProfile(profileData);
          if (profileData.role === 'admin' && (activeTab === 'browse' || activeTab === 'my-bookings')) {
            setActiveTab('admin-bookings');
          }
        } else {
          setProfile(null);
        }
        setIsLoading(false);
      },
      (err) => console.error("Profile fetch error:", err)
    );

    // Fetch Items
    const itemsUnsub = onSnapshot(
      getPublicCollection('items'),
      (snapshot) => {
        const itemsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setItems(itemsData);
      },
      (err) => console.error("Items fetch error:", err)
    );

    // Fetch Bookings
    const bookingsUnsub = onSnapshot(
      getPublicCollection('bookings'),
      (snapshot) => {
        // Sort in memory (Rule 2: No complex queries)
        const bookingsData = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .sort((a, b) => b.createdAt - a.createdAt);
        setBookings(bookingsData);
      },
      (err) => console.error("Bookings fetch error:", err)
    );

    return () => {
      profileUnsub();
      itemsUnsub();
      bookingsUnsub();
    };
  }, [user]);

  // --- Actions ---
  const handleSimulatedGoogleLogin = async (email) => {
    if (!email.endsWith('@ssrw.ac.th')) {
      showToast('กรุณาใช้อีเมล @ssrw.ac.th เท่านั้น', 'error');
      return;
    }
    
    // Create or update profile
    const role = email === 'admin@ssrw.ac.th' ? 'admin' : 'user';
    try {
      await setDoc(getPublicDoc('profiles', user.uid), {
        email,
        role,
        createdAt: Date.now()
      });
      showToast(`เข้าสู่ระบบสำเร็จ (สิทธิ์: ${role === 'admin' ? 'ผู้ดูแลระบบ' : 'ผู้ใช้งาน'})`);
    } catch (error) {
      showToast('เกิดข้อผิดพลาดในการเข้าสู่ระบบ', 'error');
    }
  };

  const handleLogout = () => {
    // Since we use anonymous auth under the hood, we just clear the profile doc locally to simulate logout
    // Or in a real app, sign out. For this demo, we'll just wipe the UI state and let user "re-login"
    setProfile(null);
    setActiveTab('browse');
    showToast('ออกจากระบบแล้ว', 'success');
  };

  const simulateEmailNotification = (userEmail, itemName, status) => {
    // Simulate real-world delay for sending email
    setTimeout(() => {
      const statusText = status === 'approved' ? 'อนุมัติ' : 'ไม่อนุมัติ';
      showToast(`จำลองส่งอีเมลแจ้งเตือนไปยัง ${userEmail} ว่าการจอง "${itemName}" ถูก${statusText}แล้ว`, 'info');
    }, 1000);
  };

  // --- Views ---
  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;
  }

  // Login View
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center border border-gray-100">
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <UserIcon size={40} className="text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">เข้าสู่ระบบ</h1>
          <p className="text-gray-500 mb-6 text-sm">ระบบจองอาคารสถานที่และอุปกรณ์<br/>โรงเรียนศรีสองรักษ์วิทยา</p>
          
          <form onSubmit={(e) => {
            e.preventDefault();
            handleSimulatedGoogleLogin(e.target.email.value);
          }} className="space-y-4">
            <div>
              <input 
                type="email" 
                name="email"
                placeholder="ชื่อ.นาม@ssrw.ac.th" 
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-left"
                required
              />
            </div>
            <button 
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
            >
              <Mail size={20} />
              เข้าสู่ระบบด้วย Google (จำลอง)
            </button>
            <p className="text-xs text-gray-400 mt-4 text-left">
              *หมายเหตุ: เพื่อทดสอบสิทธิ์ผู้ดูแลระบบ ให้ใช้อีเมล <strong>admin@ssrw.ac.th</strong>
            </p>
          </form>
        </div>
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    );
  }

  const isAdmin = profile.role === 'admin';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* Navbar */}
      <header className="bg-white shadow-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-lg">
                <Calendar className="text-white h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 hidden sm:block">SSRW Booking</h1>
                <p className="text-xs text-gray-500 hidden sm:block">โรงเรียนศรีสองรักษ์วิทยา</p>
              </div>
            </div>

            {/* Desktop Nav */}
            <nav className="hidden md:flex space-x-1">
              {!isAdmin && (
                <>
                  <NavBtn active={activeTab === 'browse'} onClick={() => setActiveTab('browse')} Icon={Monitor} label="รายการจองได้" />
                  <NavBtn active={activeTab === 'my-bookings'} onClick={() => setActiveTab('my-bookings')} Icon={Clock} label="ประวัติการจองของฉัน" />
                </>
              )}
              {isAdmin && (
                <>
                  <NavBtn active={activeTab === 'admin-bookings'} onClick={() => setActiveTab('admin-bookings')} Icon={Bell} label="จัดการคำขอจอง" />
                  <NavBtn active={activeTab === 'admin-items'} onClick={() => setActiveTab('admin-items')} Icon={MapPin} label="จัดการสถานที่/อุปกรณ์" />
                  <NavBtn active={activeTab === 'admin-reports'} onClick={() => setActiveTab('admin-reports')} Icon={PieChart} label="สรุปการใช้งาน" />
                </>
              )}
            </nav>

            <div className="flex items-center gap-4">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-sm font-semibold text-gray-800">{profile.email}</span>
                <span className="text-xs text-blue-600 font-medium">{isAdmin ? 'ผู้ดูแลระบบ' : 'ผู้ใช้งาน'}</span>
              </div>
              <button onClick={handleLogout} className="text-gray-500 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition-colors" title="ออกจากระบบ">
                <LogOut size={20} />
              </button>
              <button className="md:hidden p-2 text-gray-600" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Nav */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-white border-t p-2 space-y-1 shadow-lg absolute w-full print:hidden">
             {!isAdmin && (
                <>
                  <MobileNavBtn active={activeTab === 'browse'} onClick={() => {setActiveTab('browse'); setIsMobileMenuOpen(false);}} Icon={Monitor} label="รายการจองได้" />
                  <MobileNavBtn active={activeTab === 'my-bookings'} onClick={() => {setActiveTab('my-bookings'); setIsMobileMenuOpen(false);}} Icon={Clock} label="ประวัติการจองของฉัน" />
                </>
              )}
              {isAdmin && (
                <>
                  <MobileNavBtn active={activeTab === 'admin-bookings'} onClick={() => {setActiveTab('admin-bookings'); setIsMobileMenuOpen(false);}} Icon={Bell} label="จัดการคำขอจอง" />
                  <MobileNavBtn active={activeTab === 'admin-items'} onClick={() => {setActiveTab('admin-items'); setIsMobileMenuOpen(false);}} Icon={MapPin} label="จัดการสถานที่/อุปกรณ์" />
                  <MobileNavBtn active={activeTab === 'admin-reports'} onClick={() => {setActiveTab('admin-reports'); setIsMobileMenuOpen(false);}} Icon={PieChart} label="สรุปการใช้งาน" />
                </>
              )}
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 print:p-0 print:m-0 print:max-w-none">
        {!isAdmin && activeTab === 'browse' && <UserBrowseItems items={items} bookings={bookings} user={profile} userId={user.uid} showToast={showToast} />}
        {!isAdmin && activeTab === 'my-bookings' && <UserBookings bookings={bookings.filter(b => b.userId === user.uid)} items={items} />}
        
        {isAdmin && activeTab === 'admin-items' && <AdminManageItems items={items} showToast={showToast} />}
        {isAdmin && activeTab === 'admin-bookings' && <AdminManageBookings bookings={bookings} items={items} showToast={showToast} simulateEmail={simulateEmailNotification} />}
        {isAdmin && activeTab === 'admin-reports' && <AdminReports bookings={bookings} items={items} />}
      </main>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

// --- Navigation Helpers ---
const NavBtn = ({ active, onClick, Icon, label }) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all
      ${active ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
  >
    <Icon size={18} /> {label}
  </button>
);

const MobileNavBtn = ({ active, onClick, Icon, label }) => (
  <button 
    onClick={onClick}
    className={`flex w-full items-center gap-3 px-4 py-3 rounded-lg text-left font-medium transition-all
      ${active ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
  >
    <Icon size={18} /> {label}
  </button>
);


// --- Feature Components ---

// 1. User: Browse & Book Items
const UserBrowseItems = ({ items, bookings, user, userId, showToast }) => {
  const [selectedItem, setSelectedItem] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [layoutImage, setLayoutImage] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');

  const activeItems = items.filter(item => item.isActive);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 1048576) { // กำหนดขนาด 1MB เพื่อไม่ให้ Base64 ยาวเกินไป
        showToast('ไฟล์ภาพมีขนาดใหญ่เกินไป (ไม่เกิน 1MB)', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => setLayoutImage(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const parseTime = (timeStr) => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  };

  const handleBook = async (e) => {
    e.preventDefault();
    const form = e.target;
    const startTime = form.startTime.value;
    const endTime = form.endTime.value;
    const date = form.date.value;

    if (parseTime(startTime) >= parseTime(endTime)) {
      showToast('เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น', 'error');
      return;
    }

    // ตรวจสอบการจองซ้ำซ้อน (Double-Booking Check)
    const hasOverlap = bookings.some(b => {
      if (b.itemId !== selectedItem.id || b.date !== date || b.status === 'rejected') return false;
      const bStart = parseTime(b.startTime);
      const bEnd = parseTime(b.endTime);
      const nStart = parseTime(startTime);
      const nEnd = parseTime(endTime);
      return nStart < bEnd && nEnd > bStart;
    });

    if (hasOverlap) {
      showToast('ไม่สามารถจองได้: เวลาที่เลือกมีการใช้งานแล้ว', 'error');
      return;
    }

    setIsSubmitting(true);
    
    const bookingData = {
      itemId: selectedItem.id,
      itemName: selectedItem.name,
      userId: userId,
      userEmail: user.email,
      date: date,
      startTime: startTime,
      endTime: endTime,
      purpose: form.purpose.value,
      status: 'pending',
      createdAt: Date.now()
    };

    if (selectedItem.type === 'room') {
      bookingData.tables = form.tables?.value || 0;
      bookingData.chairs = form.chairs?.value || 0;
      bookingData.soundSystem = form.soundSystem?.checked || false;
      bookingData.microphones = form.microphones?.value || 0;
      bookingData.otherEquipment = form.otherEquipment?.value || '';
      bookingData.layoutImage = layoutImage;
    }

    try {
      await addDoc(getPublicCollection('bookings'), bookingData);
      showToast('ส่งคำขอจองสำเร็จ กรุณารอการอนุมัติ');
      setIsModalOpen(false);
      setLayoutImage(null);
      setSelectedDate('');
    } catch (error) {
      showToast('เกิดข้อผิดพลาดในการจอง', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const itemBookings = selectedItem 
    ? bookings.filter(b => b.itemId === selectedItem.id && b.status !== 'rejected' && (!selectedDate || b.date === selectedDate)).sort((a, b) => parseTime(a.startTime) - parseTime(b.startTime))
    : [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">จองอาคารสถานที่และอุปกรณ์</h2>
          <p className="text-gray-500 mt-1">เลือกรายการที่ต้องการใช้งาน</p>
        </div>
      </div>

      {activeItems.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl shadow-sm text-center text-gray-500 border border-gray-100">
          ไม่พบรายการที่เปิดให้จองในขณะนี้
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeItems.map(item => (
            <div key={item.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow group flex flex-col">
              {item.image ? (
                <div className="h-40 w-full overflow-hidden bg-gray-100 border-b">
                  <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                </div>
              ) : (
                <div className={`h-2 ${item.type === 'room' ? 'bg-blue-500' : 'bg-purple-500'}`}></div>
              )}
              <div className="p-6 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <div className={`p-3 rounded-xl ${item.type === 'room' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                    {item.type === 'room' ? <MapPin size={24} /> : <Monitor size={24} />}
                  </div>
                  <span className="text-xs font-semibold px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                    {item.type === 'room' ? 'สถานที่' : 'อุปกรณ์'}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-1">{item.name}</h3>
                <p className="text-gray-500 text-sm mb-4 line-clamp-2 min-h-[40px]">{item.description || 'ไม่มีคำอธิบายเพิ่มเติม'}</p>
                <div className="flex items-center text-sm text-gray-600 mb-6 font-medium mt-auto">
                  <UserIcon size={16} className="mr-2" /> 
                  รองรับ {item.capacity || '-'} คน/ชิ้น
                </div>
                <button 
                  onClick={() => { 
                    setSelectedItem(item); 
                    setIsModalOpen(true); 
                    setLayoutImage(null);
                    setSelectedDate(new Date().toISOString().split('T')[0]);
                  }}
                  className="w-full bg-gray-50 hover:bg-blue-600 hover:text-white text-gray-700 font-semibold py-2.5 rounded-xl transition-all border border-gray-200 hover:border-blue-600 group-hover:shadow-sm"
                >
                  ทำการจอง
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Booking Modal */}
      <Modal isOpen={isModalOpen} onClose={() => !isSubmitting && setIsModalOpen(false)} title={`จอง: ${selectedItem?.name}`}>
        <div className="mb-6 bg-blue-50 p-4 rounded-xl border border-blue-100">
          <h4 className="font-semibold text-blue-800 flex items-center gap-2 mb-2"><Clock size={18}/> ตารางการใช้งาน</h4>
          <input 
            type="date" 
            value={selectedDate} 
            onChange={(e) => setSelectedDate(e.target.value)} 
            className="w-full px-3 py-1.5 border border-blue-200 rounded-lg text-sm mb-3 focus:ring-blue-500 bg-white"
          />
          {itemBookings.length > 0 ? (
            <ul className="space-y-2 max-h-32 overflow-y-auto pr-2">
              {itemBookings.map(b => (
                <li key={b.id} className="text-sm flex justify-between items-center bg-white px-3 py-2 rounded-lg border border-blue-100 shadow-sm">
                  <span className="font-medium text-gray-700">{b.startTime} - {b.endTime}</span>
                  <Badge status={b.status} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500 text-center py-2 bg-white rounded-lg border border-dashed border-blue-200">ยังไม่มีการจองในวันนี้</p>
          )}
        </div>

        <form onSubmit={handleBook} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">วันที่ต้องการใช้</label>
            <input type="date" name="date" required min={new Date().toISOString().split('T')[0]} defaultValue={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">เวลาเริ่ม</label>
              <input type="time" name="startTime" required className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">เวลาสิ้นสุด</label>
              <input type="time" name="endTime" required className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
          </div>

          {selectedItem?.type === 'room' && (
            <div className="border-t border-gray-200 pt-4 mt-4 space-y-4">
              <h4 className="font-semibold text-gray-800 text-sm">รายละเอียดการจัดห้องและอุปกรณ์เสริม</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">จำนวนโต๊ะ</label>
                  <input type="number" name="tables" min="0" defaultValue="0" className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">จำนวนเก้าอี้</label>
                  <input type="number" name="chairs" min="0" defaultValue="0" className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 items-center">
                <div className="flex items-center gap-2">
                  <input type="checkbox" name="soundSystem" id="soundSystem" className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
                  <label htmlFor="soundSystem" className="text-sm font-medium text-gray-700">ต้องการเครื่องเสียง</label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">จำนวนไมค์</label>
                  <input type="number" name="microphones" min="0" defaultValue="0" className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">อุปกรณ์อื่นๆ (โปรดระบุ)</label>
                <input type="text" name="otherEquipment" placeholder="เช่น โปรเจคเตอร์, กระดาน" className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">แนบผังการจัดห้อง (รูปภาพ)</label>
                <input type="file" accept="image/*" onChange={handleImageUpload} className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                {layoutImage && (
                  <div className="relative inline-block mt-3">
                    <img src={layoutImage} alt="Room Layout" className="h-32 object-contain rounded-lg border border-gray-200" />
                    <button 
                      type="button" 
                      onClick={() => setLayoutImage(null)} 
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 shadow-sm transition-colors"
                      title="ลบรูปภาพ"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="border-t border-gray-200 pt-4 mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">วัตถุประสงค์การใช้งาน</label>
            <textarea name="purpose" required rows="2" className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none" placeholder="ระบุเหตุผลที่ต้องการใช้งาน..."></textarea>
          </div>
          <div className="pt-4 flex gap-3">
            <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium">ยกเลิก</button>
            <button type="submit" disabled={isSubmitting} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 flex justify-center items-center">
              {isSubmitting ? 'กำลังส่งข้อมูล...' : 'ส่งคำขอจอง'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

// 2. User: View Own Bookings
const UserBookings = ({ bookings }) => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">ประวัติการจองของฉัน</h2>
        <p className="text-gray-500 mt-1">ติดตามสถานะคำขอจองของคุณได้ที่นี่</p>
      </div>

      {bookings.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl shadow-sm text-center text-gray-500 border border-gray-100">
          คุณยังไม่มีประวัติการจอง
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-gray-600 text-sm">
                  <th className="p-4 font-semibold">รายการ</th>
                  <th className="p-4 font-semibold">วันและเวลา</th>
                  <th className="p-4 font-semibold">วัตถุประสงค์</th>
                  <th className="p-4 font-semibold">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {bookings.map(b => (
                  <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4">
                      <p className="font-semibold text-gray-800">{b.itemName}</p>
                      <p className="text-xs text-gray-500 mt-1">ส่งเมื่อ: {new Date(b.createdAt).toLocaleDateString('th-TH')}</p>
                    </td>
                    <td className="p-4">
                      <p className="text-sm font-medium text-gray-700">{b.date}</p>
                      <p className="text-xs text-gray-500 mt-1">{b.startTime} - {b.endTime}</p>
                    </td>
                    <td className="p-4">
                      <p className="text-sm text-gray-700 max-w-[200px] truncate" title={b.purpose}>{b.purpose}</p>
                      {(b.tables || b.chairs || b.layoutImage) && (
                        <div className="mt-2 text-xs text-gray-500 bg-gray-50 p-2 rounded border border-gray-100">
                          {b.tables > 0 && <span>โต๊ะ: {b.tables} </span>}
                          {b.chairs > 0 && <span>เก้าอี้: {b.chairs} </span>}
                          {b.soundSystem && <span>เครื่องเสียง </span>}
                          {b.microphones > 0 && <span>ไมค์: {b.microphones} </span>}
                          {b.otherEquipment && <span>อื่นๆ: {b.otherEquipment} </span>}
                          {b.layoutImage && (
                            <div className="mt-1">
                              <span className="cursor-pointer text-blue-500 underline" onClick={() => window.open(b.layoutImage)}>ดูผังห้อง</span>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      <Badge status={b.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// 3. Admin: Manage Items (Rooms/Equipment)
const AdminManageItems = ({ items, showToast }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [itemImage, setItemImage] = useState(null);

  const handleItemImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 1048576) {
        showToast('ไฟล์ภาพมีขนาดใหญ่เกินไป (ไม่เกิน 1MB)', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => setItemImage(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    const itemData = {
      name: form.name.value,
      type: form.type.value,
      capacity: form.capacity.value,
      description: form.description.value,
      isActive: form.isActive.checked,
      image: itemImage
    };

    try {
      if (editingItem) {
        await updateDoc(getPublicDoc('items', editingItem.id), itemData);
        showToast('อัปเดตข้อมูลสำเร็จ');
      } else {
        await addDoc(getPublicCollection('items'), itemData);
        showToast('เพิ่มรายการใหม่สำเร็จ');
      }
      setIsModalOpen(false);
      setEditingItem(null);
    } catch (error) {
      showToast('เกิดข้อผิดพลาดในการบันทึก', 'error');
    }
  };

  const handleDelete = async (id) => {
    // Note: Normally we'd use a custom confirmation modal, but for safety in this environment we simulate it simply
    // or provide a soft delete (isActive = false). We will do a hard delete for demonstration.
    try {
       await deleteDoc(getPublicDoc('items', id));
       showToast('ลบรายการสำเร็จ');
    } catch(err) {
       showToast('ไม่สามารถลบรายการได้', 'error');
    }
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setItemImage(item.image || null);
    setIsModalOpen(true);
  };

  const openAdd = () => {
    setEditingItem(null);
    setItemImage(null);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6 print:hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">จัดการสถานที่และอุปกรณ์</h2>
          <p className="text-gray-500 mt-1">เพิ่ม ลบ หรือแก้ไขข้อมูลรายการที่เปิดให้จอง</p>
        </div>
        <button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-medium transition-colors shadow-sm">
          <Plus size={20} /> เพิ่มรายการ
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map(item => (
          <div key={item.id} className={`bg-white rounded-2xl shadow-sm border overflow-hidden relative flex flex-col ${!item.isActive ? 'border-dashed border-gray-300 opacity-70' : 'border-gray-100'}`}>
            {!item.isActive && <div className="absolute top-4 right-4 text-xs font-bold bg-gray-200 text-gray-600 px-2 py-1 rounded z-10">ปิดใช้งาน</div>}
            
            {item.image && (
              <div className="h-32 w-full bg-gray-100 border-b overflow-hidden">
                <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
              </div>
            )}
            
            <div className="p-6 flex-1 flex flex-col">
               <div className="flex items-center gap-3 mb-3">
                 <div className={`p-2 rounded-lg ${item.type === 'room' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                    {item.type === 'room' ? <MapPin size={20} /> : <Monitor size={20} />}
                 </div>
                 <h3 className="font-bold text-lg text-gray-800 line-clamp-1">{item.name}</h3>
               </div>
               <p className="text-sm text-gray-500 mb-4 line-clamp-2 h-10">{item.description}</p>
               <div className="flex justify-between items-center pt-4 border-t border-gray-100 mt-auto">
                  <span className="text-sm text-gray-600">รองรับ {item.capacity} คน/ชิ้น</span>
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(item)} className="text-blue-600 hover:bg-blue-50 p-2 rounded-lg transition-colors text-sm font-medium">แก้ไข</button>
                    <button onClick={() => handleDelete(item.id)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"><Trash2 size={18}/></button>
                  </div>
               </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add/Edit Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? 'แก้ไขรายการ' : 'เพิ่มรายการใหม่'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อสถานที่/อุปกรณ์</label>
            <input type="text" name="name" defaultValue={editingItem?.name} required className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ประเภท</label>
              <select name="type" defaultValue={editingItem?.type || 'room'} className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                <option value="room">อาคาร/ห้องประชุม</option>
                <option value="equipment">อุปกรณ์</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ความจุ/จำนวน</label>
              <input type="number" name="capacity" defaultValue={editingItem?.capacity} required className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">รายละเอียดเพิ่มเติม</label>
            <textarea name="description" defaultValue={editingItem?.description} rows="3" className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none"></textarea>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">รูปภาพสถานที่/อุปกรณ์</label>
            <input type="file" accept="image/*" onChange={handleItemImageUpload} className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
            {itemImage && (
              <div className="relative inline-block mt-3">
                <img src={itemImage} alt="Preview" className="h-24 object-contain rounded-lg border border-gray-200" />
                <button 
                  type="button" 
                  onClick={() => setItemImage(null)} 
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 shadow-sm"
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <input type="checkbox" id="isActive" name="isActive" defaultChecked={editingItem ? editingItem.isActive : true} className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
            <label htmlFor="isActive" className="text-sm font-medium text-gray-700">เปิดให้จอง (Active)</label>
          </div>
          <div className="pt-4 flex gap-3">
            <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium">ยกเลิก</button>
            <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium">บันทึกข้อมูล</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

// 4. Admin: Manage Bookings
const AdminManageBookings = ({ bookings, showToast, simulateEmail }) => {
  
  const handleUpdateStatus = async (bookingId, newStatus, userEmail, itemName) => {
    try {
      await updateDoc(getPublicDoc('bookings', bookingId), { status: newStatus });
      showToast('อัปเดตสถานะเรียบร้อยแล้ว');
      // จำลองการส่งอีเมลแจ้งเตือนกลับไปยังผู้ใช้งาน
      simulateEmail(userEmail, itemName, newStatus);
    } catch (error) {
      showToast('เกิดข้อผิดพลาดในการอัปเดตสถานะ', 'error');
    }
  };

  return (
    <div className="space-y-6 print:hidden">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">จัดการคำขอจอง</h2>
        <p className="text-gray-500 mt-1">พิจารณาอนุมัติหรือปฏิเสธคำขอจองจากผู้ใช้งาน</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
         <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-gray-600 text-sm">
                  <th className="p-4 font-semibold">ผู้ขอ/รายการ</th>
                  <th className="p-4 font-semibold">วันและเวลา</th>
                  <th className="p-4 font-semibold">วัตถุประสงค์</th>
                  <th className="p-4 font-semibold text-center">การจัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {bookings.length === 0 && (
                  <tr><td colSpan="4" className="p-8 text-center text-gray-500">ไม่มีคำขอจองในระบบ</td></tr>
                )}
                {bookings.map(b => (
                  <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4">
                      <p className="font-bold text-blue-700 mb-1">{b.itemName}</p>
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                         <UserIcon size={14} /> {b.userEmail}
                      </div>
                    </td>
                    <td className="p-4">
                      <p className="text-sm font-medium text-gray-800">{b.date}</p>
                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-1"><Clock size={12}/> {b.startTime} - {b.endTime}</p>
                    </td>
                    <td className="p-4 max-w-[250px]">
                      <p className="text-sm text-gray-700 line-clamp-2" title={b.purpose}>{b.purpose}</p>
                      {(b.tables || b.chairs || b.layoutImage) && (
                        <div className="mt-2 text-xs text-gray-600 bg-blue-50 p-2 rounded-lg border border-blue-100">
                          <strong>ความต้องการ:</strong><br/>
                          {b.tables > 0 && <span> โต๊ะ {b.tables} ตัว,</span>}
                          {b.chairs > 0 && <span> เก้าอี้ {b.chairs} ตัว,</span>}
                          {b.soundSystem && <span> เครื่องเสียง,</span>}
                          {b.microphones > 0 && <span> ไมค์ {b.microphones} ตัว</span>}
                          {b.otherEquipment && <div><strong>อื่นๆ:</strong> {b.otherEquipment}</div>}
                          {b.layoutImage && (
                            <div className="mt-2">
                              <span className="font-semibold block mb-1">ผังการจัดห้อง:</span>
                              <img src={b.layoutImage} alt="Layout" className="h-16 w-auto border rounded cursor-pointer hover:opacity-80" onClick={() => window.open(b.layoutImage)} />
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      {b.status === 'pending' ? (
                        <div className="flex justify-center gap-2">
                          <button 
                            onClick={() => handleUpdateStatus(b.id, 'approved', b.userEmail, b.itemName)}
                            className="bg-green-100 text-green-700 hover:bg-green-600 hover:text-white px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors border border-green-200"
                          >
                            อนุมัติ
                          </button>
                          <button 
                            onClick={() => handleUpdateStatus(b.id, 'rejected', b.userEmail, b.itemName)}
                            className="bg-red-100 text-red-700 hover:bg-red-600 hover:text-white px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors border border-red-200"
                          >
                            ปฏิเสธ
                          </button>
                        </div>
                      ) : (
                        <Badge status={b.status} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
      </div>
    </div>
  );
};

// 5. Admin: Reports (New Component)
const AdminReports = ({ bookings, items }) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // 1. Filter Bookings by Date Range
  const filteredBookings = bookings.filter(b => {
    if (!b.date) return false;
    if (startDate && b.date < startDate) return false;
    if (endDate && b.date > endDate) return false;
    return true;
  });

  // 2. Calculate Stats
  const total = filteredBookings.length;
  const approved = filteredBookings.filter(b => b.status === 'approved').length;
  const rejected = filteredBookings.filter(b => b.status === 'rejected').length;
  const pending = filteredBookings.filter(b => b.status === 'pending').length;

  const approvedPct = total > 0 ? (approved / total) * 100 : 0;
  const rejectedPct = total > 0 ? (rejected / total) * 100 : 0;
  const pendingPct = total > 0 ? (pending / total) * 100 : 0;
  
  // Custom Pie Chart Style using conic-gradient
  const pieStyle = {
    background: total > 0 
      ? `conic-gradient(
          #22c55e 0% ${approvedPct}%, 
          #ef4444 ${approvedPct}% ${approvedPct + rejectedPct}%, 
          #eab308 ${approvedPct + rejectedPct}% 100%
        )`
      : '#e5e7eb'
  };

  // 3. Calculate Item Usage Frequency
  const itemUsage = {};
  filteredBookings.forEach(b => {
    if (b.status === 'approved') {
      itemUsage[b.itemId] = (itemUsage[b.itemId] || 0) + 1;
    }
  });

  // Sort and prep top items for Bar Chart
  const topItems = Object.entries(itemUsage)
    .map(([itemId, count]) => {
      const item = items.find(i => i.id === itemId);
      return { name: item ? item.name : 'ไม่ทราบชื่อ', count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 5); // Top 5

  const maxUsage = topItems.length > 0 ? topItems[0].count : 1;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header for Print Only */}
      <div className="hidden print:block text-center mb-8 border-b-2 border-black pb-4">
        <h1 className="text-3xl font-bold text-black mb-2">สรุปการใช้อาคารสถานที่และอุปกรณ์</h1>
        <h2 className="text-xl text-black">โรงเรียนศรีสองรักษ์วิทยา</h2>
        <p className="text-md mt-2 text-gray-800">
          ช่วงเวลา: {startDate || 'เริ่มต้น'} ถึง {endDate || 'ปัจจุบัน'}
        </p>
      </div>

      {/* Screen Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">สรุปการใช้งานระบบ</h2>
          <p className="text-gray-500 mt-1">ดูรายงานการขอใช้สถานที่และสั่งพิมพ์เป็นเอกสาร</p>
        </div>
        
        <div className="flex flex-wrap items-end gap-3 bg-white p-3 rounded-xl border border-gray-200 shadow-sm w-full md:w-auto">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">ตั้งแต่วันที่</label>
            <input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-1.5 border rounded-lg text-sm outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">ถึงวันที่</label>
            <input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-1.5 border rounded-lg text-sm outline-none focus:border-blue-500"
            />
          </div>
          <button 
            onClick={() => {setStartDate(''); setEndDate('');}}
            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
          >
            ล้างค่า
          </button>
          <button 
            onClick={handlePrint}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ml-auto md:ml-2"
          >
            <Printer size={16} /> พิมพ์รายงาน
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:grid-cols-4 print:gap-4 print:mt-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm print:border-gray-400 print:shadow-none">
          <p className="text-sm font-medium text-gray-500">คำขอทั้งหมด</p>
          <p className="text-3xl font-bold text-gray-800 mt-2">{total}</p>
        </div>
        <div className="bg-green-50 p-5 rounded-2xl border border-green-100 shadow-sm print:bg-white print:border-gray-400 print:shadow-none">
          <p className="text-sm font-medium text-green-700">อนุมัติแล้ว</p>
          <p className="text-3xl font-bold text-green-800 mt-2">{approved}</p>
        </div>
        <div className="bg-red-50 p-5 rounded-2xl border border-red-100 shadow-sm print:bg-white print:border-gray-400 print:shadow-none">
          <p className="text-sm font-medium text-red-700">ไม่อนุมัติ</p>
          <p className="text-3xl font-bold text-red-800 mt-2">{rejected}</p>
        </div>
        <div className="bg-yellow-50 p-5 rounded-2xl border border-yellow-100 shadow-sm print:bg-white print:border-gray-400 print:shadow-none">
          <p className="text-sm font-medium text-yellow-700">รอตรวจสอบ</p>
          <p className="text-3xl font-bold text-yellow-800 mt-2">{pending}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:grid-cols-2 print:gap-6 print:mt-8">
        {/* Pie Chart */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm print:border-gray-400 print:shadow-none flex flex-col items-center">
          <h3 className="font-bold text-gray-800 mb-6 text-lg w-full text-left">สัดส่วนสถานะคำขอ</h3>
          
          <div className="relative w-48 h-48 rounded-full border-4 border-white shadow-inner mb-6 print:shadow-none print:border-gray-200" style={pieStyle}>
            {total === 0 && <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">ไม่มีข้อมูล</div>}
          </div>

          <div className="flex gap-4 text-sm w-full justify-center">
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-green-500 print:bg-black print:border print:border-black"></span> อนุมัติ ({approvedPct.toFixed(1)}%)</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500 print:bg-gray-400 print:border print:border-gray-500"></span> ปฏิเสธ ({rejectedPct.toFixed(1)}%)</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-yellow-500 print:bg-white print:border print:border-black print:text-black"></span> รอ ({pendingPct.toFixed(1)}%)</div>
          </div>
        </div>

        {/* Bar Chart */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm print:border-gray-400 print:shadow-none">
          <h3 className="font-bold text-gray-800 mb-6 text-lg">รายการที่ถูกใช้งานมากที่สุด 5 อันดับแรก</h3>
          
          <div className="space-y-4">
            {topItems.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">ไม่มีข้อมูลการอนุมัติในช่วงเวลานี้</p>
            ) : (
              topItems.map((item, index) => (
                <div key={index} className="flex flex-col gap-1">
                  <div className="flex justify-between text-sm font-medium">
                    <span className="text-gray-700 truncate pr-4">{item.name}</span>
                    <span className="text-gray-900">{item.count} ครั้ง</span>
                  </div>
                  <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden print:border print:border-gray-300 print:bg-transparent">
                    <div 
                      className="bg-blue-500 h-full rounded-full print:bg-gray-600" 
                      style={{ width: `${(item.count / maxUsage) * 100}%` }}
                    ></div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      
      {/* Footer for print only */}
      <div className="hidden print:block mt-16 pt-8 border-t border-gray-300">
        <div className="flex justify-between text-sm text-black">
          <div className="text-center w-48">
            <p>ลงชื่อ...................................................</p>
            <p className="mt-2">(ผู้จัดทำรายงาน)</p>
          </div>
          <div className="text-center w-48">
            <p>ลงชื่อ...................................................</p>
            <p className="mt-2">(ผู้อำนวยการโรงเรียน)</p>
          </div>
        </div>
      </div>
    </div>
  );
};