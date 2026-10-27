import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  collection, 
  addDoc, 
  updateDoc 
} from 'firebase/firestore';
import { 
  Calendar as CalendarIcon, MapPin, Monitor, CheckCircle, XCircle, 
  Clock, Plus, Trash2, LogOut, User as UserIcon, 
  Menu, X, Bell, Info, Mail, PieChart, Printer, CheckSquare, ChevronLeft, ChevronRight, UserPlus
} from 'lucide-react';

// ==========================================
// 🔒 1. กำหนดรายชื่ออีเมลเฉพาะเจาะจงตามบทบาท
// ==========================================
const HEAD_ADMIN_EMAILS = [
  "head.general@ssrw.ac.th", 
  "preepan@ssrw.ac.th"
];

const DEPUTY_ADMIN_EMAILS = [
  "deputy.director@ssrw.ac.th", 
  "preepan@ssrw.ac.th"
];

const SUPER_ADMIN_EMAILS = [
  "admin@ssrw.ac.th",
  "preepan@ssrw.ac.th"
];

const ALL_ADMIN_EMAILS = Array.from(new Set([...HEAD_ADMIN_EMAILS, ...DEPUTY_ADMIN_EMAILS, ...SUPER_ADMIN_EMAILS]));

// --- รายชื่อครูผู้รับมอบหมายงาน ---
const TEACHERS = [
  "นายพีรพัฒน์ พลเรือง (ครูแพนเตอร์)",
  "นายพงศ์พล พากุล (ครูแม็ก)",
  "นายธณกร กูฎโสม (ครูอั๋น)"
];

// --- รายชื่อฝ่ายงานและกลุ่มสาระ ---
const DEPARTMENTS = [
  "ฝ่ายบริหารงานวิชาการ",
  "ฝ่ายบริหารงานบุคคล",
  "ฝ่ายบริหารงานทั่วไป",
  "ฝ่ายบริหารงานนโยบายและแผน",
  "ฝ่ายบริหารงานการเงินและพัสดุ",
  "ฝ่ายบริหารงานกิจการนักเรียน",
  "ฝ่ายบริหารงานระบบดูแลช่วยเหลือนักเรียน",
  "กลุ่มสาระการเรียนรู้ภาษาไทย",
  "กลุ่มสาระการเรียนรู้คณิตศาสตร์",
  "กลุ่มสาระการเรียนรู้วิทยาศาสตร์และเทคโนโลยี",
  "กลุ่มสาระการเรียนรู้สังคมศึกษา ศาสนา และวัฒนธรรม",
  "กลุ่มสาระการเรียนรู้สุขศึกษาและพลศึกษา",
  "กลุ่มสาระการเรียนรู้ศิลปะ",
  "กลุ่มสาระการเรียนรู้การงานอาชีพ",
  "กลุ่มสาระการเรียนรู้ภาษาต่างประเทศ"
];

// --- Firebase Initialization ---
const firebaseConfig = {
  apiKey: "AIzaSyCxziIRuocf210AaNQASHAxaGWtcagQj0w",
  authDomain: "ssrw-booking.firebaseapp.com",
  databaseURL: "https://ssrw-booking-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "ssrw-booking",
  storageBucket: "ssrw-booking.firebasestorage.app",
  messagingSenderId: "207851800955",
  appId: "1:207851800955:web:9db070bfefb0cd81f5d5de",
  measurementId: "G-0SVZM8J1E9"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const itemsCol = collection(db, 'items');
const bookingsCol = collection(db, 'bookings');
const getProfileDoc = (uid) => doc(db, 'profiles', uid);
const getItemDoc = (id) => doc(db, 'items', id);
const getBookingDoc = (id) => doc(db, 'bookings', id);

// ==========================================
// 🚀 ฟังก์ชันส่งแจ้งเตือน LINE (Broadcast)
// ==========================================
const notifyLine = async (message) => {
  try {
    await fetch('/api/send-line', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
  } catch (error) {
    console.error('Failed to send LINE notification:', error);
  }
};

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
    pending_head: 'bg-amber-100 text-amber-800 border-amber-200',
    pending_deputy: 'bg-blue-100 text-blue-800 border-blue-200',
    approved: 'bg-green-100 text-green-800 border-green-200',
    rejected: 'bg-red-100 text-red-800 border-red-200',
  };
  
  const labels = {
    pending_head: 'รอหัวหน้าฝ่ายรับทราบ',
    pending_deputy: 'รอรองผู้อำนวยการอนุมัติ',
    approved: 'อนุมัติเรียบร้อย',
    rejected: 'ไม่อนุมัติ/ยกเลิก',
  };

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${styles[status] || styles.pending_head}`}>
      {labels[status] || 'รอตรวจสอบ'}
    </span>
  );
};

// --- Main Application Component ---
export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [items, setItems] = useState([]);
  const [bookings, setBookings] = useState([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [activeTab, setActiveTab] = useState('browse');

  const showToast = (message, type = 'success') => setToast({ message, type });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        if (!currentUser.email.endsWith('@ssrw.ac.th')) {
          showToast('กรุณาใช้อีเมลโรงเรียน (@ssrw.ac.th) เท่านั้น', 'error');
          await signOut(auth);
          setUser(null);
          setProfile(null);
          setIsLoading(false);
          return;
        }

        const isAdmin = ALL_ADMIN_EMAILS.includes(currentUser.email);
        const isHead = HEAD_ADMIN_EMAILS.includes(currentUser.email);
        const isDeputy = DEPUTY_ADMIN_EMAILS.includes(currentUser.email);

        const profileData = {
          email: currentUser.email,
          displayName: currentUser.displayName || currentUser.email.split('@')[0],
          photoURL: currentUser.photoURL,
          role: isAdmin ? 'admin' : 'user',
          isHead,
          isDeputy,
          lastLogin: Date.now()
        };

        try {
          await setDoc(getProfileDoc(currentUser.uid), profileData, { merge: true });
        } catch (e) {
          console.error("Profile sync error:", e);
        }

        setUser(currentUser);
        setProfile(profileData);

        if (isAdmin && (activeTab === 'browse' || activeTab === 'my-bookings')) {
          setActiveTab('admin-bookings');
        }
      } else {
        setUser(null);
        setProfile(null);
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const itemsUnsub = onSnapshot(itemsCol, (snapshot) => {
      setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const bookingsUnsub = onSnapshot(bookingsCol, (snapshot) => {
      setBookings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
    });
    return () => { itemsUnsub(); bookingsUnsub(); };
  }, [user]);

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ hd: 'ssrw.ac.th' });
    try {
      await signInWithPopup(auth, provider);
      showToast('เข้าสู่ระบบสำเร็จ');
    } catch (error) {
      if (error.code !== 'auth/popup-closed-by-user') showToast('เกิดข้อผิดพลาดในการเข้าสู่ระบบ', 'error');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setActiveTab('browse');
      showToast('ออกจากระบบเรียบร้อยแล้ว');
    } catch (error) {
      showToast('เกิดข้อผิดพลาดในการออกจากระบบ', 'error');
    }
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;
  }

  if (!user || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center border border-gray-100">
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <UserIcon size={40} className="text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">เข้าสู่ระบบ</h1>
          <p className="text-gray-500 mb-6 text-sm">ระบบจองอาคารสถานที่และอุปกรณ์<br/>โรงเรียนศรีสองรักษ์วิทยา</p>
          <button onClick={handleGoogleLogin} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-3">
            <Mail size={20} /> เข้าสู่ระบบด้วย Google Account
          </button>
          <p className="text-xs text-gray-400 mt-6 text-center">*อนุญาตเฉพาะอีเมลบุคลากร <strong>@ssrw.ac.th</strong> เท่านั้น</p>
        </div>
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    );
  }

  const isAdmin = profile.role === 'admin';
  const roleName = profile.isDeputy ? 'รองผู้อำนวยการ' : profile.isHead ? 'หัวหน้าฝ่ายบริหารทั่วไป' : isAdmin ? 'ผู้ดูแลระบบ' : 'ผู้ใช้งาน';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <header className="bg-white shadow-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-lg"><CalendarIcon className="text-white h-6 w-6" /></div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 hidden sm:block">SSRW Booking</h1>
                <p className="text-xs text-gray-500 hidden sm:block">โรงเรียนศรีสองรักษ์วิทยา</p>
              </div>
            </div>

            <nav className="hidden md:flex space-x-1">
              {!isAdmin && (
                <>
                  <NavBtn active={activeTab === 'browse'} onClick={() => setActiveTab('browse')} Icon={Monitor} label="รายการจองได้" />
                  <NavBtn active={activeTab === 'calendar'} onClick={() => setActiveTab('calendar')} Icon={CalendarIcon} label="ปฏิทินการใช้งาน" />
                  <NavBtn active={activeTab === 'my-bookings'} onClick={() => setActiveTab('my-bookings')} Icon={Clock} label="ประวัติการจอง" />
                </>
              )}
              {isAdmin && (
                <>
                  <NavBtn active={activeTab === 'admin-bookings'} onClick={() => setActiveTab('admin-bookings')} Icon={Bell} label="จัดการคำขอจอง" />
                  <NavBtn active={activeTab === 'calendar'} onClick={() => setActiveTab('calendar')} Icon={CalendarIcon} label="ปฏิทินการใช้งาน" />
                  <NavBtn active={activeTab === 'admin-items'} onClick={() => setActiveTab('admin-items')} Icon={MapPin} label="จัดการสถานที่" />
                  <NavBtn active={activeTab === 'admin-reports'} onClick={() => setActiveTab('admin-reports')} Icon={PieChart} label="สรุปการใช้งาน" />
                </>
              )}
            </nav>

            <div className="flex items-center gap-4">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-sm font-semibold text-gray-800">{profile.email}</span>
                <span className="text-xs text-blue-600 font-medium">{roleName}</span>
              </div>
              <button onClick={handleLogout} className="text-gray-500 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition-colors" title="ออกจากระบบ"><LogOut size={20} /></button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 print:p-0 print:m-0 print:max-w-none">
        {!isAdmin && activeTab === 'browse' && <UserBrowseItems items={items} bookings={bookings} user={profile} userId={user.uid} showToast={showToast} />}
        {!isAdmin && activeTab === 'my-bookings' && <UserBookings bookings={bookings.filter(b => b.userId === user.uid)} />}
        {activeTab === 'calendar' && <CalendarView bookings={bookings} items={items} />}
        
        {isAdmin && activeTab === 'admin-items' && <AdminManageItems items={items} showToast={showToast} />}
        {isAdmin && activeTab === 'admin-bookings' && <AdminManageBookings bookings={bookings} userProfile={profile} showToast={showToast} />}
        {isAdmin && activeTab === 'admin-reports' && <AdminReports bookings={bookings} items={items} />}
      </main>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

const NavBtn = ({ active, onClick, Icon, label }) => (
  <button onClick={onClick} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${active ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}><Icon size={18} /> {label}</button>
);

// --- User Browse Items (ผู้ใช้งานทั่วไปขอจอง) ---
const UserBrowseItems = ({ items, bookings, user, userId, showToast }) => {
  const [selectedItem, setSelectedItem] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeItems = items.filter(item => item.isActive);
  const parseTime = (timeStr) => { const [h, m] = timeStr.split(':').map(Number); return h * 60 + m; };

  const handleBook = async (e) => {
    e.preventDefault();
    const form = e.target;
    const startTime = form.startTime.value;
    const endTime = form.endTime.value;
    const date = form.date.value;
    const department = form.department.value;

    if (parseTime(startTime) >= parseTime(endTime)) { showToast('เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น', 'error'); return; }

    const hasOverlap = bookings.some(b => b.itemId === selectedItem.id && b.date === date && b.status !== 'rejected' && parseTime(startTime) < parseTime(b.endTime) && parseTime(endTime) > parseTime(b.startTime));
    if (hasOverlap) { showToast('เวลาที่เลือกมีการใช้งานแล้ว', 'error'); return; }

    setIsSubmitting(true);
    try {
      await addDoc(bookingsCol, {
        itemId: selectedItem.id, itemName: selectedItem.name,
        userId: userId, userEmail: user.email, displayName: user.displayName || user.email.split('@')[0],
        department: department, // เก็บข้อมูลฝ่ายงาน
        date, startTime, endTime, purpose: form.purpose.value,
        status: 'pending_head',
        createdAt: Date.now()
      });
      showToast('ส่งคำขอสำเร็จ (รอหัวหน้าฝ่ายรับทราบ)');
      
      await notifyLine(
        `🔔 มีคำขอจองใหม่!\nรายการ: ${selectedItem.name}\nวันที่: ${date}\nเวลา: ${startTime} - ${endTime} น.\nฝ่าย/กลุ่มสาระ: ${department}\nผู้ขอ: ${user.displayName || user.email}`
      );

      setIsModalOpen(false);
    } catch (error) {
      showToast('เกิดข้อผิดพลาดในการจอง', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">จองอาคารสถานที่และอุปกรณ์</h2>
          <p className="text-gray-500 mt-1">โรงเรียนศรีสองรักษ์วิทยา</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {activeItems.map(item => (
          <div key={item.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow group flex flex-col">
            {item.image ? (
              <div className="h-40 w-full overflow-hidden bg-gray-100 border-b">
                <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              </div>
            ) : <div className={`h-2 ${item.type === 'room' ? 'bg-blue-500' : 'bg-purple-500'}`}></div>}
            <div className="p-6 flex-1 flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-xl ${item.type === 'room' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                  {item.type === 'room' ? <MapPin size={24} /> : <Monitor size={24} />}
                </div>
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-1">{item.name}</h3>
              <p className="text-gray-500 text-sm mb-4 line-clamp-2 min-h-[40px]">{item.description}</p>
              <div className="flex items-center text-sm text-gray-600 mb-6 mt-auto"><UserIcon size={16} className="mr-2" /> รองรับ {item.capacity} คน/ชิ้น</div>
              <button onClick={() => { setSelectedItem(item); setIsModalOpen(true); }} className="w-full bg-gray-50 hover:bg-blue-600 hover:text-white text-gray-700 font-semibold py-2.5 rounded-xl transition-all border">ทำการจอง</button>
            </div>
          </div>
        ))}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => !isSubmitting && setIsModalOpen(false)} title={`จอง: ${selectedItem?.name}`}>
        <form onSubmit={handleBook} className="space-y-4">
          <div><label className="block text-sm font-medium mb-1">วันที่</label><input type="date" name="date" required className="w-full px-4 py-2 border rounded-xl" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium mb-1">เวลาเริ่ม</label><input type="time" name="startTime" required className="w-full px-4 py-2 border rounded-xl" /></div>
            <div><label className="block text-sm font-medium mb-1">เวลาสิ้นสุด</label><input type="time" name="endTime" required className="w-full px-4 py-2 border rounded-xl" /></div>
          </div>
          
          {/* ส่วนที่เพิ่มใหม่: Dropdown ฝ่ายงาน/กลุ่มสาระ */}
          <div>
            <label className="block text-sm font-medium mb-1">ฝ่ายงาน/กลุ่มสาระที่ขอใช้งาน</label>
            <select name="department" required className="w-full px-4 py-2 border rounded-xl bg-white outline-none focus:ring-2 focus:ring-blue-500">
              <option value="" disabled defaultValue>-- เลือกฝ่ายงาน/กลุ่มสาระ --</option>
              {DEPARTMENTS.map(dep => (
                <option key={dep} value={dep}>{dep}</option>
              ))}
            </select>
          </div>

          <div><label className="block text-sm font-medium mb-1">รายละเอียด/วัตถุประสงค์</label><textarea name="purpose" required rows="2" className="w-full px-4 py-2 border rounded-xl"></textarea></div>
          <button type="submit" disabled={isSubmitting} className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium">{isSubmitting ? 'กำลังส่งข้อมูล...' : 'ส่งคำขอจอง'}</button>
        </form>
      </Modal>
    </div>
  );
};

// --- Admin: Manage Bookings ---
const AdminManageBookings = ({ bookings, userProfile, showToast }) => {
  const [actionModal, setActionModal] = useState({ isOpen: false, type: '', bookingId: null, bookingName: '' });
  const [assignedTeacher, setAssignedTeacher] = useState('');

  const openActionModal = (b, type) => {
    setActionModal({ isOpen: true, type, bookingId: b.id, bookingName: b.itemName });
    setAssignedTeacher('');
  };

  const confirmAction = async () => {
    const { type, bookingId } = actionModal;
    let updateData = { actionBy: userProfile.email };
    let statusText = '';

    if (type === 'acknowledge') {
      updateData.status = 'pending_deputy';
      updateData.acknowledgedAt = Date.now();
      updateData.assignedTeacher = assignedTeacher;
      statusText = '✅ หัวหน้าฝ่ายรับทราบแล้ว';
    } else if (type === 'approve') {
      updateData.status = 'approved';
      updateData.approvedAt = Date.now();
      statusText = '🎉 รอง ผอ. อนุมัติเรียบร้อย';
    } else if (type === 'reject' || type === 'revoke') {
      updateData.status = 'rejected';
      updateData.rejectedAt = Date.now();
      statusText = type === 'revoke' ? '❌ ยกเลิกการอนุมัติแล้ว' : '❌ คำขอถูกปฏิเสธ';
    }

    try {
      await updateDoc(getBookingDoc(bookingId), updateData);
      showToast('ดำเนินการเรียบร้อยแล้ว');
      
      await notifyLine(
        `📢 อัปเดตสถานะการจอง\nรายการ: ${actionModal.bookingName}\nสถานะ: ${statusText}\nผู้ดำเนินการ: ${userProfile.displayName || userProfile.email.split('@')[0]}`
      );

      setActionModal({ isOpen: false, type: '', bookingId: null, bookingName: '' });
    } catch (e) {
      showToast('เกิดข้อผิดพลาดในการดำเนินการ', 'error');
    }
  };

  return (
    <div className="space-y-6 print:hidden">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">จัดการอนุมัติคำขอจอง</h2>
        <p className="text-gray-500 mt-1">ขั้นตอนการรับทราบและอนุมัติการขอใช้อาคารสถานที่และอุปกรณ์</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-gray-600 text-sm">
              <th className="p-4 font-semibold">รายการ/ผู้ขอ</th>
              <th className="p-4 font-semibold">วันและเวลา</th>
              <th className="p-4 font-semibold">รายละเอียด/ผู้มอบหมาย</th>
              <th className="p-4 font-semibold text-center">สถานะ</th>
              <th className="p-4 font-semibold text-center">การดำเนินการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {bookings.length === 0 && (<tr><td colSpan="5" className="p-8 text-center text-gray-500">ไม่มีคำขอจอง</td></tr>)}
            {bookings.map(b => (
              <tr key={b.id} className="hover:bg-gray-50">
                <td className="p-4">
                  <p className="font-bold text-blue-700">{b.itemName}</p>
                  <p className="text-xs text-gray-800 mt-1">{b.displayName}</p>
                  {/* แสดงชื่อฝ่ายงาน/กลุ่มสาระ */}
                  {b.department && <p className="text-[11px] text-gray-500 bg-gray-100 inline-block px-1.5 py-0.5 rounded mt-1">{b.department}</p>}
                </td>
                <td className="p-4 text-sm text-gray-800">{b.date}<br/><span className="text-xs text-gray-500">{b.startTime} - {b.endTime}</span></td>
                <td className="p-4 text-sm">
                  <p className="text-gray-700 line-clamp-1">{b.purpose}</p>
                  {b.assignedTeacher && <p className="text-xs text-blue-600 mt-1 font-medium"><UserPlus size={12} className="inline mr-1"/>{b.assignedTeacher}</p>}
                </td>
                <td className="p-4 text-center"><Badge status={b.status} /></td>
                <td className="p-4 text-center">
                  
                  {b.status === 'pending_head' && userProfile.isHead && (
                    <div className="flex justify-center gap-2">
                      <button onClick={() => openActionModal(b, 'acknowledge')} className="bg-amber-500 text-white hover:bg-amber-600 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 shadow-sm"><CheckSquare size={14} /> รับทราบ</button>
                      <button onClick={() => openActionModal(b, 'reject')} className="bg-red-100 text-red-700 hover:bg-red-200 px-2 py-1.5 rounded-lg text-xs font-semibold">ปฏิเสธ</button>
                    </div>
                  )}

                  {b.status === 'pending_deputy' && userProfile.isDeputy && (
                    <div className="flex justify-center gap-2">
                      <button onClick={() => openActionModal(b, 'approve')} className="bg-green-600 text-white hover:bg-green-700 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 shadow-sm"><CheckCircle size={14} /> อนุมัติ</button>
                      <button onClick={() => openActionModal(b, 'reject')} className="bg-red-100 text-red-700 hover:bg-red-200 px-2 py-1.5 rounded-lg text-xs font-semibold">ปฏิเสธ</button>
                    </div>
                  )}

                  {b.status === 'approved' && (userProfile.role === 'admin' || userProfile.isHead || userProfile.isDeputy) && (
                    <div className="flex justify-center flex-col items-center gap-1">
                      <span className="text-xs text-gray-400">ดำเนินการแล้ว</span>
                      <button onClick={() => openActionModal(b, 'revoke')} className="text-[10px] text-red-500 hover:text-red-700 underline mt-1">ยกเลิกอนุมัติ</button>
                    </div>
                  )}

                  {b.status === 'rejected' && <span className="text-xs text-gray-400">ดำเนินการแล้ว</span>}
                  {b.status === 'pending_head' && !userProfile.isHead && <span className="text-xs text-gray-400">รอหัวหน้าฝ่าย</span>}
                  {b.status === 'pending_deputy' && !userProfile.isDeputy && <span className="text-xs text-gray-400">รอรอง ผอ.</span>}

                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Confirmation Modal */}
      <Modal isOpen={actionModal.isOpen} onClose={() => setActionModal({ isOpen: false, type: '', bookingId: null })} title="ยืนยันการดำเนินการ">
        <div className="space-y-4">
          <p className="text-gray-700 text-sm">
            คุณต้องการ <strong>{actionModal.type === 'acknowledge' ? 'รับทราบ' : actionModal.type === 'approve' ? 'อนุมัติ' : actionModal.type === 'revoke' ? 'ยกเลิกการอนุมัติ' : 'ปฏิเสธ'}</strong> คำขอจอง <strong>{actionModal.bookingName}</strong> ใช่หรือไม่?
          </p>
          
          {actionModal.type === 'acknowledge' && (
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mt-2">
              <label className="block text-sm font-semibold text-blue-800 mb-2 flex items-center gap-2"><UserPlus size={16}/> เลือกครูผู้รับมอบหมายงาน</label>
              <select 
                value={assignedTeacher} 
                onChange={(e) => setAssignedTeacher(e.target.value)} 
                className="w-full px-4 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500 bg-white outline-none"
              >
                <option value="" disabled>-- กรุณาเลือกครู --</option>
                {TEACHERS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          )}

          <div className="pt-4 flex gap-3">
            <button onClick={() => setActionModal({ isOpen: false, type: '', bookingId: null })} className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-medium transition-colors">ปิด/ยกเลิก</button>
            <button 
              onClick={confirmAction} 
              disabled={actionModal.type === 'acknowledge' && !assignedTeacher}
              className={`flex-1 px-4 py-2 text-white rounded-xl font-medium transition-colors disabled:opacity-50 ${actionModal.type === 'revoke' || actionModal.type === 'reject' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              ยืนยันการดำเนินการ
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

// --- Calendar View ---
const CalendarView = ({ bookings }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDayBookings, setSelectedDayBookings] = useState([]);
  const [selectedDayStr, setSelectedDayStr] = useState('');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const thaiMonths = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

  const handleDayClick = (day) => {
    const formattedDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayBookings = bookings.filter(b => b.date === formattedDate && b.status !== 'rejected');
    setSelectedDayBookings(dayBookings);
    setSelectedDayStr(`${day} ${thaiMonths[month]} ${year + 543}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800">ปฏิทินการใช้งาน</h2>
        <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl border shadow-sm">
          <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="p-1 text-gray-600"><ChevronLeft size={20} /></button>
          <span className="font-bold text-gray-800">{thaiMonths[month]} {year + 543}</span>
          <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="p-1 text-gray-600"><ChevronRight size={20} /></button>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 overflow-x-auto">
        <div className="grid grid-cols-7 gap-2 min-w-[600px] text-center font-bold text-gray-600 mb-4 border-b pb-3">
          <div className="text-red-500">อา.</div><div>จ.</div><div>อ.</div><div>พ.</div><div>พฤ.</div><div>ศ.</div><div className="text-blue-500">ส.</div>
        </div>
        <div className="grid grid-cols-7 gap-2 min-w-[600px]">
          {Array.from({ length: firstDayOfWeek }).map((_, i) => <div key={`empty-${i}`} className="h-24 bg-gray-50/50 rounded-xl"></div>)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayBookings = bookings.filter(b => b.date === dateStr && b.status !== 'rejected');
            return (
              <div key={day} onClick={() => handleDayClick(day)} className="h-24 p-1.5 border border-gray-100 hover:border-blue-500 rounded-xl bg-white hover:shadow-md cursor-pointer flex flex-col">
                <span className="font-semibold text-sm">{day}</span>
                <div className="space-y-1 overflow-y-auto max-h-14 mt-1">
                  {dayBookings.slice(0, 2).map(b => (
                    <div key={b.id} className={`text-[10px] px-1.5 py-0.5 rounded truncate font-medium ${b.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                      {b.startTime} {b.itemName}
                    </div>
                  ))}
                  {dayBookings.length > 2 && <span className="text-[10px] text-gray-400 block text-center">+{dayBookings.length - 2}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedDayStr && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><Clock size={20} className="text-blue-600" /> วันที่ {selectedDayStr}</h3>
          {selectedDayBookings.length === 0 ? <p className="text-gray-500 text-sm">ไม่มีการใช้งาน</p> : (
            <div className="space-y-3">
              {selectedDayBookings.map(b => (
                <div key={b.id} className="p-4 rounded-xl border bg-gray-50">
                  <div className="flex items-center gap-2 mb-1"><span className="font-bold text-gray-800">{b.itemName}</span><Badge status={b.status} /></div>
                  <p className="text-xs text-gray-600"><strong>เวลา:</strong> {b.startTime} - {b.endTime} | <strong>ผู้ขอ:</strong> {b.displayName} {b.department && `(${b.department})`}</p>
                  {b.assignedTeacher && <p className="text-xs text-blue-600 mt-1 font-medium"><UserPlus size={14} className="inline mr-1"/> ผู้ดูแล: {b.assignedTeacher}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// --- User Bookings ---
const UserBookings = ({ bookings }) => (
  <div className="bg-white rounded-2xl shadow-sm border p-6">
    <h2 className="text-2xl font-bold mb-4">ประวัติการจอง</h2>
    <div className="space-y-3">
      {bookings.length === 0 && <p className="text-gray-500 text-center py-4">ไม่มีประวัติ</p>}
      {bookings.map(b => (
        <div key={b.id} className="p-4 border rounded-xl flex justify-between items-center">
          <div>
            <p className="font-bold">{b.itemName} <span className="text-sm font-normal text-gray-500">({b.date})</span></p>
            {b.department && <p className="text-xs text-gray-500">{b.department}</p>}
            {b.assignedTeacher && <p className="text-xs text-blue-600 mt-1">ผู้รับมอบหมายงาน: {b.assignedTeacher}</p>}
          </div>
          <Badge status={b.status} />
        </div>
      ))}
    </div>
  </div>
);
const AdminManageItems = () => <div className="p-8 text-center text-gray-500">สำหรับจัดการเพิ่ม/ลบ สถานที่ (โค้ดมาตรฐานถูกละไว้เพื่อความกระชับ)</div>;

// --- Admin: Reports ---
const AdminReports = ({ bookings }) => {
  const total = bookings.length;
  const approved = bookings.filter(b => b.status === 'approved').length;
  const rejected = bookings.filter(b => b.status === 'rejected').length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end print:hidden">
        <h2 className="text-2xl font-bold text-gray-800">สรุปรายงานการใช้งาน</h2>
        <button onClick={() => window.print()} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm flex items-center gap-2"><Printer size={16} /> พิมพ์รายงาน</button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-5 rounded-2xl border shadow-sm"><p className="text-sm text-gray-500">คำขอทั้งหมด</p><p className="text-3xl font-bold">{total}</p></div>
        <div className="bg-green-50 p-5 rounded-2xl border-green-100 border shadow-sm"><p className="text-sm text-green-700">อนุมัติแล้ว</p><p className="text-3xl font-bold text-green-800">{approved}</p></div>
        <div className="bg-red-50 p-5 rounded-2xl border-red-100 border shadow-sm"><p className="text-sm text-red-700">ไม่อนุมัติ/ยกเลิก</p><p className="text-3xl font-bold text-red-800">{rejected}</p></div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100 text-gray-700">
              <th className="p-4">วัน/เวลา</th>
              <th className="p-4">สถานที่</th>
              <th className="p-4">ผู้ขอ / ฝ่ายงาน</th>
              <th className="p-4">ผู้รับมอบหมายงาน</th>
              <th className="p-4 text-center">สถานะ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {bookings.map(b => (
              <tr key={b.id}>
                <td className="p-4">{b.date} <br/> {b.startTime}-{b.endTime}</td>
                <td className="p-4 font-medium">{b.itemName}</td>
                <td className="p-4">
                  {b.displayName}
                  {b.department && <span className="block text-xs text-gray-500 mt-0.5">{b.department}</span>}
                </td>
                <td className="p-4 text-blue-700 font-medium">{b.assignedTeacher || '-'}</td>
                <td className="p-4 text-center"><Badge status={b.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};