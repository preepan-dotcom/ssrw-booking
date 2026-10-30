import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported } from "firebase/analytics";
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
  Menu, X, Info, Mail, PieChart as PieChartIcon, Printer, CheckSquare, ChevronLeft, ChevronRight, Search,
  BarChart as BarChartIcon, Sun, Moon
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

// 1. นำเข้า liff
import liff from '@line/liff';

// 2. ใส่ LIFF ID ที่ได้มาจาก LINE Developers Console
const LIFF_ID = "2012277307-tTe2Pen5"; 

// --- กำหนดระดับสิทธิ์ให้แต่ละอีเมล (Role-based Access) ---
const USER_ROLES = {
  "kamchai@ssrw.ac.th": "executive",
  "apirat@ssrw.ac.th": "head",
  "admin@ssrw.ac.th": "admin",
  "prssrw@ssrw.ac.th": "admin"
};

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

isSupported().then(supported => {
  if (supported) getAnalytics(app);
});

// --- Base Collections ---
const itemsCol = collection(db, 'items');
const bookingsCol = collection(db, 'bookings');
const getProfileDoc = (uid) => doc(db, 'profiles', uid);
const getItemDoc = (id) => doc(db, 'items', id);
const getBookingDoc = (id) => doc(db, 'bookings', id);

// ==========================================
// 🚀 ฟังก์ชันส่งแจ้งเตือน LINE
// ==========================================
const sendLineMessage = async (msg) => {
  try {
    const response = await fetch('/api/send-line', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error("Line API Error (Response):", errorData);
    } else {
      console.log("ส่งแจ้งเตือน LINE สำเร็จ!");
    }
  } catch (error) {
    console.error("Line API Fetch Error:", error);
  }
};

// --- Reusable UI Components ---
const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message, type]);

  const bgColor = type === 'error' ? 'bg-red-500' : type === 'success' ? 'bg-green-500' : 'bg-blue-500';
  const Icon = type === 'success' ? CheckCircle : type === 'error' ? XCircle : Info;

  return (
    <div className={`fixed bottom-4 right-4 ${bgColor} text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 z-50 animate-bounce print:hidden max-w-md`}>
      <Icon size={20} className="shrink-0" />
      <span className="font-medium text-sm">{message}</span>
    </div>
  );
};

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-40 p-4 print:hidden">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] transition-colors">
        <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 p-1 rounded-full transition-colors">
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
    pending_head: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
    pending_deputy: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
    approved: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
    rejected: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
  };
  
  const labels = {
    pending_head: 'รอหัวหน้าฝ่ายรับทราบ',
    pending_deputy: 'รอรองผู้อำนวยการอนุมัติ',
    approved: 'อนุมัติเรียบร้อย',
    rejected: 'ไม่อนุมัติ',
  };

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${styles[status] || styles.pending_head}`}>
      {labels[status] || 'รอตรวจสอบ'}
    </span>
  );
};

const NavBtn = ({ active, onClick, Icon, label }) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all print:hidden
      ${active ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'}`}
  >
    <Icon size={18} /> {label}
  </button>
);

const MobileNavBtn = ({ active, onClick, Icon, label }) => (
  <button 
    onClick={onClick}
    className={`flex w-full items-center gap-3 px-4 py-3 rounded-lg text-left font-medium transition-all print:hidden
      ${active ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
  >
    <Icon size={18} /> {label}
  </button>
);

const DEPARTMENTS = [
  "บริหารงานวิชาการ", "บริหารงานงบประมาณ", "บริหารงานบุคคล", "บริหารงานทั่วไป",
  "บริหารงานระบบดูแลช่วยเหลือนักเรียน", "บริหารงานกิจการนักเรียน", "บริหารงานนโยบายและแผน",
  "กลุ่มสาระฯ ภาษาไทย", "กลุ่มสาระฯ คณิตศาสตร์", "กลุ่มสาระฯ วิทยาศาสตร์และเทคโนโลยี",
  "กลุ่มสาระฯ สังคมศึกษาฯ", "กลุ่มสาระฯ สุขศึกษาและพลศึกษา", "กลุ่มสาระฯ ศิลปะ",
  "กลุ่มสาระฯ การงานอาชีพ", "กลุ่มสาระฯ ภาษาต่างประเทศ", "กิจกรรมพัฒนาผู้เรียน", "อื่นๆ"
];

const ASSIGNABLE_TEACHERS = [
  "นายพีรพัฒน์ พลเรือง (ครูแพนเตอร์)",
  "นายพงศ์พล พากุล (ครูแม็ก)",
  "นายธณกร กูฎโสม (ครูอั๋น)"
];

const CHART_COLORS = [
  '#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', 
  '#EC4899', '#06B6D4', '#84CC16', '#6366F1', '#14B8A6'
];

// --- 1. User: Browse & Book Items ---
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
      if (file.size > 512000) {
        showToast('ไฟล์ภาพมีขนาดใหญ่เกินไป (กรุณาใช้ไฟล์ขนาดไม่เกิน 500KB)', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => setLayoutImage(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const parseTime = (timeStr) => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return (h * 60) + m;
  };

  const handleBook = async (e) => {
    e.preventDefault();
    const form = e.target;
    const startTime = form.startTime.value;
    const endTime = form.endTime.value;
    const date = form.date.value;
    const department = form.department.value;

    if (parseTime(startTime) >= parseTime(endTime)) {
      showToast('เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น', 'error');
      return;
    }

    const hasOverlap = bookings.some(b => {
      if (b.itemId !== selectedItem.id || b.date !== date || b.status === 'rejected') return false;
      const bStart = parseTime(b.startTime);
      const bEnd = parseTime(b.endTime);
      const nStart = parseTime(startTime);
      const nEnd = parseTime(endTime);
      return nStart < bEnd && nEnd > bStart;
    });

    if (hasOverlap) {
      showToast('ไม่สามารถขออนุญาตได้: เวลาที่เลือกมีการใช้งานแล้ว', 'error');
      return;
    }

    setIsSubmitting(true);
    
    const bookingData = {
      itemId: selectedItem.id,
      itemName: selectedItem.name,
      userId: userId,
      userEmail: user.email,
      displayName: user.displayName || user.email.split('@')[0],
      department: department,
      date: date,
      startTime: startTime,
      endTime: endTime,
      purpose: form.purpose.value,
      status: 'pending_head',
      createdAt: Date.now()
    };

    if (selectedItem.type === 'room') {
      bookingData.tables = form.tables?.value ? Number(form.tables.value) : 0;
      bookingData.chairs = form.chairs?.value ? Number(form.chairs.value) : 0;
      bookingData.soundSystem = form.soundSystem?.checked || false;
      bookingData.microphones = form.microphones?.value ? Number(form.microphones.value) : 0;
      bookingData.otherEquipment = form.otherEquipment?.value || '';
      bookingData.layoutImage = layoutImage;
    }

    try {
      await addDoc(bookingsCol, bookingData);
      const itemNameSafe = selectedItem?.name || 'ไม่ระบุสถานที่';
      const userNameSafe = user?.displayName || user?.email || 'ไม่ระบุผู้ขออนุญาต';
      const deptSafe = department || 'ไม่ระบุฝ่าย';
      const dateSafe = date || 'ไม่ระบุวันที่';
      const timeSafe = `${startTime || '-'} - ${endTime || '-'} น.`;
      const notifyMsg = `🔔 มีคำขออนุญาตใหม่เข้าสู่ระบบ!\n\n📌 สถานที่: ${itemNameSafe}\n👤 ผู้ขออนุญาต: ${userNameSafe}\n🏷️ ฝ่าย: ${deptSafe}\n📅 วันที่: ${dateSafe}\n⏰ เวลา: ${timeSafe}\n\nกรุณาเข้าสู่ระบบเพื่อตรวจสอบครับ`;
      
      try { await sendLineMessage(notifyMsg); } catch (lineErr) {}

      showToast('ส่งคำขออนุญาตสำเร็จ (เสนอต่อหัวหน้าฝ่าย)');
      setIsModalOpen(false);
      setLayoutImage(null);
      setSelectedDate('');
    } catch (error) {
      showToast('เกิดข้อผิดพลาดในการขออนุญาต', 'error');
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
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">ขออนุญาตใช้อาคารสถานที่และอุปกรณ์</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">โรงเรียนศรีสองรักษ์วิทยา</p>
        </div>
      </div>

      {activeItems.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 p-12 rounded-2xl shadow-sm text-center text-gray-500 dark:text-gray-400 border border-gray-100 dark:border-gray-700">
          ไม่พบรายการที่เปิดให้ขออนุญาตในขณะนี้
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeItems.map(item => (
            <div key={item.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow group flex flex-col">
              {item.image ? (
                <div className="h-40 w-full overflow-hidden bg-gray-100 dark:bg-gray-700 border-b dark:border-gray-600">
                  <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                </div>
              ) : (
                <div className={`h-2 ${item.type === 'room' ? 'bg-blue-500' : 'bg-purple-500'}`}></div>
              )}
              <div className="p-6 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <div className={`p-3 rounded-xl ${item.type === 'room' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-purple-50 text-purple-600 dark:bg-purple-900/40 dark:text-purple-300'}`}>
                    {item.type === 'room' ? <MapPin size={24} /> : <Monitor size={24} />}
                  </div>
                  <span className="text-xs font-semibold px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                    {item.type === 'room' ? 'สถานที่' : 'อุปกรณ์'}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-1">{item.name}</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-4 line-clamp-2 min-h-[40px]">{item.description || 'ไม่มีคำอธิบายเพิ่มเติม'}</p>
                <div className="flex items-center text-sm text-gray-600 dark:text-gray-400 mb-6 font-medium mt-auto">
                  <UserIcon className="mr-2" size={16} /> 
                  รองรับ {item.capacity || '-'}
                </div>
                <button 
                  onClick={() => { 
                    setSelectedItem(item); 
                    setIsModalOpen(true); 
                    setLayoutImage(null);
                    setSelectedDate(new Date().toISOString().split('T')[0]);
                  }}
                  className="w-full bg-gray-50 dark:bg-gray-700 hover:bg-blue-600 dark:hover:bg-blue-600 hover:text-white text-gray-700 dark:text-white font-semibold py-2.5 rounded-xl transition-all border border-gray-200 dark:border-gray-600 hover:border-blue-600 group-hover:shadow-sm"
                >
                  ทำการขออนุญาต
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Booking Modal */}
      <Modal isOpen={isModalOpen} onClose={() => !isSubmitting && setIsModalOpen(false)} title={`ขออนุญาต: ${selectedItem?.name}`}>
        <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
          <h4 className="font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-2 mb-2"><Clock size={18} /> ตารางการใช้งาน</h4>
          <input 
            type="date" 
            value={selectedDate} 
            onChange={(e) => setSelectedDate(e.target.value)} 
            className="w-full px-3 py-1.5 border border-blue-200 dark:border-blue-800 rounded-lg text-sm mb-3 focus:ring-blue-500 bg-white dark:bg-gray-700 dark:text-white"
          />
          {itemBookings.length > 0 ? (
            <ul className="space-y-2 max-h-32 overflow-y-auto pr-2">
              {itemBookings.map(b => (
                <li key={b.id} className="text-sm flex justify-between items-center bg-white dark:bg-gray-800 px-3 py-2 rounded-lg border border-blue-100 dark:border-gray-700 shadow-sm">
                  <span className="font-medium text-gray-700 dark:text-gray-200">{b.startTime} - {b.endTime}</span>
                  <Badge status={b.status} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2 bg-white dark:bg-gray-800 rounded-lg border border-dashed border-blue-200 dark:border-gray-700">ยังไม่มีการขออนุญาตในวันนี้</p>
          )}
        </div>

        <form onSubmit={handleBook} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-800 dark:text-gray-200">วันที่ต้องการใช้</label>
            <input type="date" name="date" required min={new Date().toISOString().split('T')[0]} value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full px-3 py-2 border border-gray-400 dark:border-gray-600 rounded-md focus:outline-none focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white" />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-800 dark:text-gray-200">เวลาเริ่ม</label>
              <input type="time" name="startTime" required className="w-full px-3 py-2 border border-gray-400 dark:border-gray-600 rounded-md focus:outline-none focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-800 dark:text-gray-200">เวลาสิ้นสุด</label>
              <input type="time" name="endTime" required className="w-full px-3 py-2 border border-gray-400 dark:border-gray-600 rounded-md focus:outline-none focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-gray-800 dark:text-gray-200">ฝ่ายงาน/กลุ่มสาระที่ขอใช้งาน</label>
            <select name="department" required defaultValue="" className="w-full px-3 py-2 border border-gray-400 dark:border-gray-600 rounded-md focus:outline-none focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white">
              <option value="" disabled>-- กรุณาเลือกฝ่ายงาน/กลุ่มสาระ --</option>
              {DEPARTMENTS.map(dep => (
                <option key={dep} value={dep}>{dep}</option>
              ))}
            </select>
          </div>

          {selectedItem?.type === 'room' && (
            <div className="border-t border-gray-300 dark:border-gray-600 pt-4 mt-4 space-y-4">
              <h4 className="font-semibold text-gray-800 dark:text-gray-200 text-sm">รายละเอียดการจัดห้องและอุปกรณ์เสริม</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-800 dark:text-gray-200">จำนวนโต๊ะ</label>
                  <input type="number" name="tables" min="0" defaultValue="0" className="w-full px-3 py-2 border border-gray-400 dark:border-gray-600 rounded-md focus:outline-none focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-800 dark:text-gray-200">จำนวนเก้าอี้</label>
                  <input type="number" name="chairs" min="0" defaultValue="0" className="w-full px-3 py-2 border border-gray-400 dark:border-gray-600 rounded-md focus:outline-none focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 items-center">
                <div className="flex items-center gap-2">
                  <input type="checkbox" name="soundSystem" id="soundSystem" className="w-4 h-4 text-blue-600 rounded border-gray-400 dark:border-gray-600 focus:ring-blue-500 bg-white dark:bg-gray-700" />
                  <label htmlFor="soundSystem" className="text-sm font-medium text-gray-800 dark:text-gray-200">ต้องการเครื่องเสียง</label>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-800 dark:text-gray-200">จำนวนไมค์</label>
                  <input type="number" name="microphones" min="0" defaultValue="0" className="w-full px-3 py-2 border border-gray-400 dark:border-gray-600 rounded-md focus:outline-none focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-800 dark:text-gray-200">อุปกรณ์อื่นๆ (โปรดระบุ)</label>
                <input type="text" name="otherEquipment" placeholder="เช่น โปรเจคเตอร์, กระดาน" className="w-full px-3 py-2 border border-gray-400 dark:border-gray-600 rounded-md focus:outline-none focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-800 dark:text-gray-200">แนบผังการจัดห้อง (รูปภาพ)</label>
                <input type="file" accept="image/*" onChange={handleImageUpload} className="w-full px-3 py-2 border border-gray-400 dark:border-gray-600 rounded-md focus:outline-none focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white text-sm file:mr-4 file:py-1.5 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 dark:file:bg-blue-900/50 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100" />
                {layoutImage && (
                  <div className="relative inline-block mt-3">
                    <img src={layoutImage} alt="Room Layout" className="h-32 object-contain rounded-md border border-gray-400 dark:border-gray-600" />
                    <button type="button" onClick={() => setLayoutImage(null)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 shadow-sm transition-colors" title="ลบรูปภาพ"><X size={16} /></button>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="border-t border-gray-300 dark:border-gray-600 pt-4 mt-4">
            <label className="block text-sm font-medium mb-1 text-gray-800 dark:text-gray-200">วัตถุประสงค์การใช้งาน</label>
            <textarea name="purpose" required rows="2" className="w-full px-3 py-2 border border-gray-400 dark:border-gray-600 rounded-md focus:outline-none focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white resize-none" placeholder="ระบุเหตุผลที่ต้องการใช้งาน..."></textarea>
          </div>
          
          <div className="pt-4 flex gap-3">
            <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium">ยกเลิก</button>
            <button type="submit" disabled={isSubmitting} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 flex justify-center items-center">
              {isSubmitting ? 'กำลังส่งข้อมูล...' : 'ส่งคำขออนุญาต'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

// --- 2. Calendar View ---
const CalendarView = ({ bookings, items }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDayBookings, setSelectedDayBookings] = useState([]);
  const [selectedDayStr, setSelectedDayStr] = useState('');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const thaiMonths = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
  ];

  const handleDayClick = (day) => {
    const formattedDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayBookings = bookings.filter(b => b.date === formattedDate && b.status !== 'rejected');
    setSelectedDayBookings(dayBookings);
    setSelectedDayStr(`${day} ${thaiMonths[month]} ${year + 543}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">ปฏิทินการใช้งานสถานที่และอุปกรณ์</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">คลิกที่วันที่เพื่อดูรายการจองรายละเอียดทั้งหมด</p>
        </div>

        <div className="flex items-center gap-3 bg-white dark:bg-gray-800 px-4 py-2 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <button onClick={prevMonth} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300"><ChevronLeft size={20} /></button>
          <span className="font-bold text-gray-800 dark:text-white text-lg">{thaiMonths[month]} {year + 543}</span>
          <button onClick={nextMonth} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300"><ChevronRight size={20} /></button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 overflow-x-auto">
        <div className="grid grid-cols-7 gap-2 min-w-[600px] text-center font-bold text-gray-600 dark:text-gray-400 mb-4 border-b dark:border-gray-700 pb-3">
          <div className="text-red-500 dark:text-red-400">อา.</div>
          <div>จ.</div>
          <div>อ.</div>
          <div>พ.</div>
          <div>พฤ.</div>
          <div>ศ.</div>
          <div className="text-blue-500 dark:text-blue-400">ส.</div>
        </div>

        <div className="grid grid-cols-7 gap-2 min-w-[600px]">
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} className="h-24 bg-gray-50/50 dark:bg-gray-800/50 rounded-xl"></div>
          ))}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayBookings = bookings.filter(b => b.date === dateStr && b.status !== 'rejected');

            return (
              <div 
                key={day} 
                onClick={() => handleDayClick(day)}
                className="h-24 p-1.5 border border-gray-100 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 rounded-xl bg-white dark:bg-gray-800 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
              >
                <span className="font-semibold text-sm text-gray-700 dark:text-gray-300">{day}</span>
                <div className="space-y-1 overflow-y-auto max-h-14">
                  {dayBookings.slice(0, 2).map(b => (
                    <div 
                      key={b.id} 
                      className={`text-[10px] px-1.5 py-0.5 rounded truncate font-medium ${
                        b.status === 'approved' ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                      }`}
                    >
                      {b.startTime} {b.itemName}
                    </div>
                  ))}
                  {dayBookings.length > 2 && (
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 block text-center">+{dayBookings.length - 2} รายการ</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedDayStr && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
            <Clock className="text-blue-600 dark:text-blue-400" size={20} /> รายการการใช้งานประจำวันที่ {selectedDayStr}
          </h3>

          {selectedDayBookings.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm py-4 text-center">ไม่มีการใช้งานในวันนี้</p>
          ) : (
            <div className="space-y-3">
              {selectedDayBookings.map(b => {
                const teachersList = b.assignedTeachers || (b.assignedTeacher ? [b.assignedTeacher] : []);
                return (
                <div key={b.id} className="p-4 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-800 dark:text-gray-100">{b.itemName}</span>
                      <Badge status={b.status} />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      <strong>ผู้ขออนุญาต:</strong> {b.displayName || b.userEmail} 
                      {b.department && <span className="text-blue-700 dark:text-blue-400 font-medium"> ({b.department})</span>} 
                      | <strong>เวลา:</strong> {b.startTime} - {b.endTime} น.
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-300 mt-1"><strong>วัตถุประสงค์:</strong> {b.purpose}</p>
                    {teachersList.length > 0 && (
                      <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-1.5 font-semibold bg-indigo-50 dark:bg-indigo-900/30 inline-block px-2 py-1 rounded border border-indigo-100 dark:border-indigo-800">
                        👨‍🏫 ผู้ดูแล: {teachersList.join(', ')}
                      </p>
                    )}
                  </div>
                </div>
              )})}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// --- 3. Admin: Manage Bookings ---
const AdminManageBookings = ({ bookings, showToast, userRole }) => {
  const [assignSelections, setAssignSelections] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const canAcknowledge = userRole === 'admin' || userRole === 'head';
  const canApprove = userRole === 'admin' || userRole === 'executive';
  const canReject = userRole === 'admin' || userRole === 'head' || userRole === 'executive';

  const handleAssignToggle = (bookingId, teacher) => {
    setAssignSelections(prev => {
      const currentSelected = prev[bookingId] || [];
      if (currentSelected.includes(teacher)) {
        return { ...prev, [bookingId]: currentSelected.filter(t => t !== teacher) };
      } else {
        return { ...prev, [bookingId]: [...currentSelected, teacher] };
      }
    });
  };

  const handleUpdateStatus = async (bookingId, newStatus, assignedTeachersArray = []) => {
    try {
      const updateData = { status: newStatus };
      if (assignedTeachersArray && assignedTeachersArray.length > 0) updateData.assignedTeachers = assignedTeachersArray;
      
      await updateDoc(getBookingDoc(bookingId), updateData);
      
      const currentBooking = bookings.find(b => b.id === bookingId);
      const teachersList = updateData.assignedTeachers || currentBooking?.assignedTeachers || (currentBooking?.assignedTeacher ? [currentBooking.assignedTeacher] : []);
      
      let statusText = "";
      if (newStatus === 'pending_deputy') {
        statusText = "✅ หัวหน้าฝ่ายรับทราบแล้ว (รอรอง ผอ. อนุมัติ)";
        if (teachersList.length > 0) statusText += `\n👨‍🏫 ผู้ดูแล: ${teachersList.join(', ')}`;
      } else if (newStatus === 'approved') {
        statusText = "🎉 รอง ผอ. อนุมัติเรียบร้อยแล้ว";
        if (teachersList.length > 0) statusText += `\n👨‍🏫 แจ้งเตือนผู้ดูแล: ${teachersList.join(', ')}\n(โปรดเตรียมความพร้อมสถานที่และอุปกรณ์ครับ)`;
      } else if (newStatus === 'rejected') {
        statusText = "❌ ไม่อนุมัติ/ยกเลิกคำขอ";
      }

      if (currentBooking && statusText) {
        const notifyMsg = `📝 มีการอัปเดตสถานะการขออนุญาต\n\n📌 สถานที่: ${currentBooking.itemName}\n📅 วันที่: ${currentBooking.date}\n⏰ เวลา: ${currentBooking.startTime} - ${currentBooking.endTime} น.\n👤 ผู้ขออนุญาต: ${currentBooking.displayName || currentBooking.userEmail}\n📋 สถานะใหม่: ${statusText}`;
        await sendLineMessage(notifyMsg);
      }
      showToast('อัปเดตสถานะเรียบร้อยแล้ว');
    } catch (error) {
      showToast('เกิดข้อผิดพลาดในการอัปเดตสถานะ', 'error');
    }
  };

  const handleDeleteBooking = async (bookingId) => {
    if (window.confirm('คุณแน่ใจหรือไม่ว่าต้องการลบรายการขออนุญาตนี้? (ข้อมูลจะถูกลบถาวร)')) {
      try {
        await deleteDoc(getBookingDoc(bookingId));
        showToast('ลบรายการขออนุญาตเรียบร้อยแล้ว');
      } catch (error) {
        showToast('เกิดข้อผิดพลาดในการลบรายการ', 'error');
      }
    }
  };

  const filteredBookings = bookings.filter(b => {
    const matchSearch = (b.itemName || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                        (b.displayName || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchDate = filterDate === '' || b.date === filterDate;
    const matchStatus = filterStatus === 'all' || b.status === filterStatus;
    return matchSearch && matchDate && matchStatus;
  });

  return (
    <div className="space-y-6 print:hidden">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">จัดการอนุมัติคำขออนุญาต</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">ขั้นตอนการรับทราบ มอบหมายผู้ดูแล และอนุมัติการขอใช้อาคารสถานที่และอุปกรณ์</p>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-2.5 text-gray-400 dark:text-gray-500" size={18} />
          <input 
            type="text" 
            placeholder="ค้นหาชื่อผู้ขอ หรือ สถานที่..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 text-sm bg-white dark:bg-gray-700 dark:text-white"
          />
        </div>
        <div className="flex gap-4 w-full md:w-auto">
          <input 
            type="date" 
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="flex-1 md:w-40 px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 text-sm bg-white dark:bg-gray-700 dark:text-white"
          />
          <select 
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="flex-1 md:w-48 px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 text-sm bg-white dark:bg-gray-700 dark:text-white"
          >
            <option value="all">สถานะทั้งหมด</option>
            <option value="pending_head">รอหัวหน้าฝ่ายรับทราบ</option>
            <option value="pending_deputy">รอรอง ผอ. อนุมัติ</option>
            <option value="approved">อนุมัติเรียบร้อย</option>
            <option value="rejected">ไม่อนุมัติ</option>
          </select>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
         <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-100 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm">
                  <th className="p-4 font-semibold w-1/4">ผู้ขอ/รายการ</th>
                  <th className="p-4 font-semibold w-1/6">วันและเวลา</th>
                  <th className="p-4 font-semibold w-1/4">รายละเอียด & ผู้ดูแล</th>
                  <th className="p-4 font-semibold text-center w-1/6">สถานะปัจจุบัน</th>
                  <th className="p-4 font-semibold text-center w-1/4 min-w-[280px]">การจัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredBookings.length === 0 && (
                  <tr><td colSpan="5" className="p-8 text-center text-gray-500 dark:text-gray-400">ไม่พบข้อมูลที่ค้นหา</td></tr>
                )}
                {filteredBookings.map(b => {
                  const teachersList = b.assignedTeachers || (b.assignedTeacher ? [b.assignedTeacher] : []);
                  return (
                  <tr key={b.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="p-4 align-top">
                      <p className="font-bold text-blue-700 dark:text-blue-400 mb-1">{b.itemName}</p>
                      <p className="text-xs font-medium text-gray-800 dark:text-gray-200">{b.displayName || b.userEmail}</p>
                      {b.department && (
                        <span className="inline-block mt-1 text-[11px] font-medium text-blue-800 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded border border-blue-100 dark:border-blue-800">
                          {b.department}
                        </span>
                      )}
                    </td>
                    <td className="p-4 align-top">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{b.date}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{b.startTime} - {b.endTime}</p>
                    </td>
                    <td className="p-4 align-top">
                      <p className="text-sm text-gray-700 dark:text-gray-300 mb-2" title={b.purpose}>{b.purpose}</p>
                      {teachersList.length > 0 && (
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold">ครูผู้ดูแล:</span>
                          <div className="flex flex-wrap gap-1">
                            {teachersList.map(t => (
                              <span key={t} className="text-[11px] text-indigo-700 dark:text-indigo-300 font-semibold bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 px-2 py-0.5 rounded">
                                👨‍🏫 {t}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-center align-top">
                      <Badge status={b.status} />
                    </td>
                    <td className="p-4 text-center align-top">
                      {b.status === 'pending_head' && canAcknowledge && (
                        <div className="flex flex-col items-center gap-2 bg-amber-50/50 dark:bg-amber-900/20 p-3 rounded-xl border border-amber-200 dark:border-amber-800/50 shadow-sm">
                          <span className="text-xs font-bold text-amber-800 dark:text-amber-400 w-full text-left border-b border-amber-200 dark:border-amber-800/50 pb-1 flex items-center gap-1">
                            👑 สำหรับหัวหน้าฝ่าย
                          </span>
                          <div className="flex flex-col items-start gap-1.5 w-full text-left bg-white dark:bg-gray-800 p-2.5 border border-amber-100 dark:border-amber-900/50 rounded-lg">
                            <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">เลือกครูผู้ดูแล:</span>
                            {ASSIGNABLE_TEACHERS.map(teacher => (
                              <label key={teacher} className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 w-full p-1 rounded transition-colors">
                                <input 
                                  type="checkbox" 
                                  className="rounded border-gray-300 dark:border-gray-600 text-amber-500 focus:ring-amber-500 bg-white dark:bg-gray-700 w-3.5 h-3.5"
                                  checked={(assignSelections[b.id] || []).includes(teacher)}
                                  onChange={() => handleAssignToggle(b.id, teacher)}
                                />
                                {teacher}
                              </label>
                            ))}
                          </div>
                          <div className="flex justify-center gap-2 w-full mt-1">
                            <button onClick={() => handleUpdateStatus(b.id, 'pending_deputy', assignSelections[b.id])} className="flex-1 bg-amber-500 text-white hover:bg-amber-600 px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors shadow-sm flex items-center justify-center gap-1">
                              <CheckSquare size={14} /> หัวหน้ารับทราบ
                            </button>
                            {canReject && (
                              <button onClick={() => handleUpdateStatus(b.id, 'rejected')} className="bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 hover:bg-red-600 dark:hover:bg-red-600 hover:text-white dark:hover:text-white px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors">
                                ปฏิเสธ
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                      {b.status === 'pending_head' && !canAcknowledge && (
                        <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-3 py-1 rounded-full border border-amber-200 dark:border-amber-800 inline-block">
                          ⏳ รอหัวหน้าฝ่ายดำเนินการ
                        </span>
                      )}
                      {b.status === 'pending_deputy' && canApprove && (
                        <div className="flex flex-col items-center gap-2 bg-blue-50/50 dark:bg-blue-900/20 p-3 rounded-xl border border-blue-200 dark:border-blue-800/50 shadow-sm">
                          <span className="text-xs font-bold text-blue-800 dark:text-blue-400 w-full text-left border-b border-blue-200 dark:border-blue-800/50 pb-1 flex items-center gap-1">
                            👑 สำหรับรองผู้อำนวยการ
                          </span>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400 w-full text-left mt-1 mb-1">หัวหน้าฝ่ายรับทราบและมอบหมายผู้ดูแลเรียบร้อยแล้ว</p>
                          <div className="flex justify-center gap-2 w-full">
                            <button onClick={() => handleUpdateStatus(b.id, 'approved')} className="flex-1 bg-blue-600 text-white hover:bg-blue-700 px-3 py-2 rounded-lg text-xs font-semibold transition-colors shadow-sm flex items-center justify-center gap-1">
                              <CheckCircle size={14} /> รอง ผอ. อนุมัติ
                            </button>
                            {canReject && (
                              <button onClick={() => handleUpdateStatus(b.id, 'rejected')} className="bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 hover:bg-red-600 dark:hover:bg-red-600 hover:text-white px-3 py-2 rounded-lg text-xs font-semibold transition-colors">
                                ไม่อนุมัติ
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                      {b.status === 'pending_deputy' && !canApprove && (
                        <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full border border-blue-200 dark:border-blue-800 inline-block">
                          ⏳ รอรองผู้อำนวยการดำเนินการ
                        </span>
                      )}
                      {(b.status === 'approved' || b.status === 'rejected') && (
                        <div className="flex flex-col items-center gap-2">
                          <span className="text-[11px] font-semibold text-gray-400 bg-gray-50 dark:bg-gray-700 px-3 py-1 rounded-full border border-gray-200 dark:border-gray-600">
                            การพิจารณาเสร็จสิ้น
                          </span>
                          <div className="flex justify-center items-center gap-2 mt-1">
                            {b.status === 'approved' && canApprove && (
                              <button onClick={() => handleUpdateStatus(b.id, 'rejected')} className="text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/50 px-2 py-1.5 rounded-md transition-colors flex items-center gap-1 text-xs border border-amber-200 dark:border-amber-800" title="ยกเลิกการอนุมัติ">
                                <XCircle size={14} /> ยกเลิก
                              </button>
                            )}
                            {canReject && (
                              <button onClick={() => handleDeleteBooking(b.id)} className="text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 px-2 py-1.5 rounded-md transition-colors flex items-center gap-1 text-xs border border-red-200 dark:border-red-800" title="ลบถาวร">
                                <Trash2 size={14} /> ลบ
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
      </div>
    </div>
  );
};

// --- 4. User: View Own Bookings ---
const UserBookings = ({ bookings }) => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">ประวัติการขออนุญาตของฉัน</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">ติดตามสถานะคำขอเสนอผ่านหัวหน้าฝ่ายและรองผู้อำนวยการ</p>
      </div>
      {bookings.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 p-12 rounded-2xl shadow-sm text-center text-gray-500 dark:text-gray-400 border border-gray-100 dark:border-gray-700">
          คุณยังไม่มีประวัติการขออนุญาต
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-100 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm">
                  <th className="p-4 font-semibold">รายการ</th>
                  <th className="p-4 font-semibold">วันและเวลา</th>
                  <th className="p-4 font-semibold">วัตถุประสงค์</th>
                  <th className="p-4 font-semibold">สถานะคำขอ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {bookings.map(b => (
                  <tr key={b.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="p-4">
                      <p className="font-semibold text-gray-800 dark:text-gray-200">{b.itemName}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">ส่งเมื่อ: {new Date(b.createdAt).toLocaleDateString('th-TH')}</p>
                    </td>
                    <td className="p-4">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{b.date}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{b.startTime} - {b.endTime}</p>
                    </td>
                    <td className="p-4">
                      <p className="text-sm text-gray-700 dark:text-gray-300 max-w-[200px] truncate" title={b.purpose}>{b.purpose}</p>
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

// --- 5. Admin: Manage Items ---
const AdminManageItems = ({ items, showToast }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [itemImage, setItemImage] = useState(null);

  const handleItemImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 512000) { showToast('ขนาดไฟล์เกิน', 'error'); return; }
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
        await updateDoc(getItemDoc(editingItem.id), itemData);
        showToast('อัปเดตสำเร็จ');
      } else {
        await addDoc(itemsCol, itemData);
        showToast('เพิ่มสำเร็จ');
      }
      setIsModalOpen(false); setEditingItem(null);
    } catch (error) { showToast('ข้อผิดพลาด', 'error'); }
  };

  const handleDelete = async (id) => {
    try { await deleteDoc(getItemDoc(id)); showToast('ลบสำเร็จ'); } catch(err) {}
  };

  return (
    <div className="space-y-6 print:hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">จัดการสถานที่และอุปกรณ์</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">เพิ่ม ลบ หรือแก้ไขข้อมูลรายการ</p>
        </div>
        <button onClick={() => { setEditingItem(null); setItemImage(null); setIsModalOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-medium shadow-sm">
          <Plus size={20} /> เพิ่มรายการ
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map(item => (
          <div key={item.id} className={`bg-white dark:bg-gray-800 rounded-2xl shadow-sm border overflow-hidden relative flex flex-col ${!item.isActive ? 'border-dashed border-gray-300 dark:border-gray-600 opacity-70' : 'border-gray-100 dark:border-gray-700'}`}>
            {!item.isActive && <div className="absolute top-4 right-4 text-xs font-bold bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded z-10">ปิดใช้งาน</div>}
            {item.image && (
              <div className="h-32 w-full bg-gray-100 dark:bg-gray-700 border-b dark:border-gray-600 overflow-hidden">
                <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
              </div>
            )}
            <div className="p-6 flex-1 flex flex-col">
               <div className="flex items-center gap-3 mb-3">
                 <div className={`p-2 rounded-lg ${item.type === 'room' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-purple-50 text-purple-600 dark:bg-purple-900/40 dark:text-purple-300'}`}>
                    {item.type === 'room' ? <MapPin size={20} /> : <Monitor size={20} />}
                 </div>
                 <h3 className="font-bold text-lg text-gray-800 dark:text-white line-clamp-1">{item.name}</h3>
               </div>
               <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2 h-10">{item.description}</p>
               <div className="flex justify-between items-center pt-4 border-t border-gray-100 dark:border-gray-700 mt-auto">
                  <span className="text-sm text-gray-600 dark:text-gray-400">รองรับ {item.capacity} </span>
                  <div className="flex gap-2">
                    <button onClick={() => { setEditingItem(item); setItemImage(item.image || null); setIsModalOpen(true); }} className="text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 p-2 rounded-lg transition-colors text-sm font-medium">แก้ไข</button>
                    <button onClick={() => handleDelete(item.id)} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 p-2 rounded-lg transition-colors"><Trash2 size={18} /></button>
                  </div>
               </div>
            </div>
          </div>
        ))}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? 'แก้ไขรายการ' : 'เพิ่มรายการ'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ชื่อสถานที่/อุปกรณ์</label>
            <input type="text" name="name" defaultValue={editingItem?.name} required className="w-full px-4 py-2 border dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 dark:text-white" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ประเภท</label>
              <select name="type" defaultValue={editingItem?.type || 'room'} className="w-full px-4 py-2 border dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 dark:text-white">
                <option value="room">อาคาร/ห้องประชุม</option>
                <option value="equipment">อุปกรณ์</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ความจุ</label>
              <input type="number" name="capacity" defaultValue={editingItem?.capacity} required className="w-full px-4 py-2 border dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 dark:text-white" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">รายละเอียด</label>
            <textarea name="description" defaultValue={editingItem?.description} rows="3" className="w-full px-4 py-2 border dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none bg-white dark:bg-gray-700 dark:text-white"></textarea>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">รูปภาพ</label>
            <input type="file" accept="image/*" onChange={handleItemImageUpload} className="w-full px-4 py-2 border dark:border-gray-600 rounded-xl outline-none bg-white dark:bg-gray-700 dark:text-white text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 dark:file:bg-blue-900/40 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100" />
          </div>
          <div className="flex items-center gap-2 mt-2">
            <input type="checkbox" id="isActive" name="isActive" defaultChecked={editingItem ? editingItem.isActive : true} className="w-4 h-4 text-blue-600 rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500 bg-white dark:bg-gray-700" />
            <label htmlFor="isActive" className="text-sm font-medium text-gray-700 dark:text-gray-300">เปิดให้ขออนุญาต</label>
          </div>
          <div className="pt-4 flex gap-3">
            <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium">ยกเลิก</button>
            <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium">บันทึกข้อมูล</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

// --- 6. Admin: Reports (ปรับปรุงระบบแผนภูมิและจัดกลุ่มข้อมูล) ---
const AdminReports = ({ bookings, items }) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  
  // 💡 State สำหรับควบคุมรูปแบบกราฟและกลุ่มข้อมูล
  const [chartType, setChartType] = useState('pie'); // 'pie' | 'bar'
  const [groupBy, setGroupBy] = useState('status');  // 'status' | 'item' | 'department'

  const [printOptions, setPrintOptions] = useState({ summary: true, itemStats: true, deptStats: true, chart: true, list: true });
  const handlePrintOptionChange = (option) => setPrintOptions(prev => ({ ...prev, [option]: !prev[option] }));

  // กรองรายการคำขอตามเงื่อนไข วันที่, ฝ่ายงาน, และสถานะ
  const filteredBookings = bookings.filter(b => {
    if (!b.date) return false;
    if (startDate && b.date < startDate) return false;
    if (endDate && b.date > endDate) return false;
    if (filterDepartment !== 'all' && b.department !== filterDepartment) return false;
    if (filterStatus !== 'all' && b.status !== filterStatus) return false;
    return true;
  });

  const total = filteredBookings.length;
  const approved = filteredBookings.filter(b => b.status === 'approved').length;
  const rejected = filteredBookings.filter(b => b.status === 'rejected').length;
  const pending = filteredBookings.filter(b => b.status.startsWith('pending')).length;

  const getStatusLabel = (status) => {
    if (status === 'approved') return 'อนุมัติ';
    if (status === 'rejected') return 'ไม่อนุมัติ';
    return 'รอพิจารณา';
  };

  // 1. คำนวณความถี่การขอใช้ตามสถานที่/อุปกรณ์
  const itemCounts = filteredBookings.reduce((acc, b) => { 
    const key = b.itemName || 'ไม่ระบุสถานที่';
    acc[key] = (acc[key] || 0) + 1; 
    return acc; 
  }, {});
  const sortedItems = Object.entries(itemCounts).sort((a, b) => b[1] - a[1]);

  // 2. คำนวณความถี่การขอใช้ตามฝ่ายงาน
  const deptCounts = filteredBookings.reduce((acc, b) => {
    const dept = b.department || 'ไม่ระบุฝ่าย';
    acc[dept] = (acc[dept] || 0) + 1; 
    return acc;
  }, {});
  const sortedDepts = Object.entries(deptCounts).sort((a, b) => b[1] - a[1]);

  // 3. ฟังก์ชันเตรียมข้อมูลสำหรับสร้างกราฟ dynamic ตามค่า groupBy
  const getChartData = () => {
    if (groupBy === 'status') {
      return [
        { name: 'อนุมัติแล้ว', value: approved, color: '#10B981' },
        { name: 'ไม่อนุมัติ', value: rejected, color: '#EF4444' },
        { name: 'อยู่ระหว่างพิจารณา', value: pending, color: '#F59E0B' },
      ].filter(item => item.value > 0);
    } else if (groupBy === 'item') {
      return sortedItems.map(([name, value], index) => ({
        name: name,
        value: value,
        color: CHART_COLORS[index % CHART_COLORS.length]
      }));
    } else if (groupBy === 'department') {
      return sortedDepts.map(([name, value], index) => ({
        name: name,
        value: value,
        color: CHART_COLORS[index % CHART_COLORS.length]
      }));
    }
    return [];
  };

  const currentChartData = getChartData();

  // ฟังก์ชันแสดงชื่อหัวข้อกราฟ dynamic
  const getChartTitle = () => {
    switch (groupBy) {
      case 'status': return 'สัดส่วนตามสถานะการขออนุมัติ';
      case 'item': return 'สัดส่วนตามสถานที่/อุปกรณ์ที่ใช้บ่อย';
      case 'department': return 'สัดส่วนตามฝ่ายงานที่ใช้งานบ่อย';
      default: return 'สัดส่วนข้อมูล';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">สรุปการใช้งานระบบ</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">ดูรายงานการขอใช้สถานที่และสั่งพิมพ์เอกสารรายงาน</p>
        </div>
        <button onClick={() => window.print()} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-2">
          <Printer size={16} /> พิมพ์รายงานสถิติ
        </button>
      </div>

      {/* แถบกรองข้อมูล */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-wrap gap-4 items-end print:hidden">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">ตั้งแต่วันที่</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-white" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">ถึงวันที่</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-white" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">ฝ่ายงาน</label>
          <select value={filterDepartment} onChange={(e) => setFilterDepartment(e.target.value)} className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-white min-w-[150px]">
            <option value="all">ทุกฝ่ายงาน</option>
            {DEPARTMENTS.map(dep => <option key={dep} value={dep}>{dep}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">สถานะ</label>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-white min-w-[150px]">
            <option value="all">ทุกสถานะ</option>
            <option value="approved">อนุมัติเรียบร้อย</option>
            <option value="rejected">ไม่อนุมัติ</option>
            <option value="pending_head">รอหัวหน้าฝ่ายรับทราบ</option>
            <option value="pending_deputy">รอรอง ผอ. อนุมัติ</option>
          </select>
        </div>
      </div>

      {/* เลือกตัวเลือกสิ่งที่จะพิมพ์ */}
      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800 print:hidden">
        <h3 className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-3 flex items-center gap-2">
          <Printer size={16} /> เลือกเนื้อหาที่จะพิมพ์
        </h3>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2 cursor-pointer font-medium text-gray-700 dark:text-gray-300"><input type="checkbox" checked={printOptions.summary} onChange={() => handlePrintOptionChange('summary')} className="rounded text-blue-600 focus:ring-blue-500 bg-white dark:bg-gray-700 w-4 h-4" /> สรุปภาพรวม</label>
          <label className="flex items-center gap-2 cursor-pointer font-medium text-gray-700 dark:text-gray-300"><input type="checkbox" checked={printOptions.chart} onChange={() => handlePrintOptionChange('chart')} className="rounded text-blue-600 focus:ring-blue-500 bg-white dark:bg-gray-700 w-4 h-4" /> กราฟ</label>
          <label className="flex items-center gap-2 cursor-pointer font-medium text-gray-700 dark:text-gray-300"><input type="checkbox" checked={printOptions.itemStats} onChange={() => handlePrintOptionChange('itemStats')} className="rounded text-blue-600 focus:ring-blue-500 bg-white dark:bg-gray-700 w-4 h-4" /> สถิติสถานที่</label>
          <label className="flex items-center gap-2 cursor-pointer font-medium text-gray-700 dark:text-gray-300"><input type="checkbox" checked={printOptions.deptStats} onChange={() => handlePrintOptionChange('deptStats')} className="rounded text-blue-600 focus:ring-blue-500 bg-white dark:bg-gray-700 w-4 h-4" /> สถิติฝ่าย</label>
          <label className="flex items-center gap-2 cursor-pointer font-medium text-gray-700 dark:text-gray-300"><input type="checkbox" checked={printOptions.list} onChange={() => handlePrintOptionChange('list')} className="rounded text-blue-600 focus:ring-blue-500 bg-white dark:bg-gray-700 w-4 h-4" /> ตารางรายละเอียด</label>
        </div>
      </div>

      {/* การ์ดแสดงข้อมูลสถิติตัวเลข 4 ช่อง */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:hidden">
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">ตามเงื่อนไข (รายการ)</p>
          <p className="text-3xl font-bold text-gray-800 dark:text-white mt-2">{total}</p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 p-5 rounded-2xl border border-green-100 dark:border-green-800/50 shadow-sm">
          <p className="text-sm font-medium text-green-700 dark:text-green-400">อนุมัติแล้ว</p>
          <p className="text-3xl font-bold text-green-800 dark:text-green-300 mt-2">{approved}</p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 p-5 rounded-2xl border border-red-100 dark:border-red-800/50 shadow-sm">
          <p className="text-sm font-medium text-red-700 dark:text-red-400">ไม่อนุมัติ</p>
          <p className="text-3xl font-bold text-red-800 dark:text-red-300 mt-2">{rejected}</p>
        </div>
        <div className="bg-amber-50 dark:bg-amber-900/20 p-5 rounded-2xl border border-amber-100 dark:border-amber-800/50 shadow-sm">
          <p className="text-sm font-medium text-amber-700 dark:text-amber-400">อยู่ระหว่างพิจารณา</p>
          <p className="text-3xl font-bold text-amber-800 dark:text-amber-300 mt-2">{pending}</p>
        </div>
      </div>

      {/* การ์ดแผนภูมิรายงานสถิติ และ รายการนำเสนอ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:hidden">
        
        {/* การ์ดสัดส่วน / กราฟ (อัปเดตให้มี Dropdown เปลี่ยนกลุ่มข้อมูลได้) */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
            
            {/* หัวข้อ dynamic & Dropdown เลือกเรื่องของกราฟ */}
            <div className="flex flex-col gap-1.5">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <PieChartIcon size={20} className="text-blue-600" /> 
                {getChartTitle()}
              </h3>
              
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value)}
                className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              >
                <option value="status">จัดกลุ่มตาม: สถานะการขออนุมัติ</option>
                <option value="item">จัดกลุ่มตาม: การใช้สถานที่/อุปกรณ์</option>
                <option value="department">จัดกลุ่มตาม: ฝ่ายงาน/กลุ่มสาระ</option>
              </select>
            </div>

            {/* ปุ่มสลับชนิดกราฟ วงกลม/แท่ง */}
            <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1 self-end sm:self-auto">
              <button onClick={() => setChartType('pie')} className={`p-1.5 rounded-md text-sm flex items-center gap-1 ${chartType === 'pie' ? 'bg-white dark:bg-gray-600 shadow-sm text-blue-600 dark:text-blue-300 font-medium' : 'text-gray-500 dark:text-gray-400'}`}><PieChartIcon size={16} /> วงกลม</button>
              <button onClick={() => setChartType('bar')} className={`p-1.5 rounded-md text-sm flex items-center gap-1 ${chartType === 'bar' ? 'bg-white dark:bg-gray-600 shadow-sm text-blue-600 dark:text-blue-300 font-medium' : 'text-gray-500 dark:text-gray-400'}`}><BarChartIcon size={16} /> แท่ง</button>
            </div>
          </div>

          <div className="flex-1 flex justify-center items-center min-h-[300px]">
            {total === 0 || currentChartData.length === 0 ? (
              <p className="text-gray-400">ไม่มีข้อมูลตามเงื่อนไขที่เลือก</p>
            ) : chartType === 'pie' ? (
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie 
                    data={currentChartData} 
                    cx="50%" 
                    cy="50%" 
                    labelLine={false} 
                    outerRadius={100} 
                    dataKey="value" 
                    label={({ name, percent }) => `${name.length > 12 ? name.substring(0, 10) + '...' : name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {currentChartData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <RechartsTooltip formatter={(value) => [`${value} รายการ`, 'จำนวน']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={currentChartData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis 
                    dataKey="name" 
                    tick={{fontSize: 11, fill: '#4B5563'}} 
                    interval={0}
                    tickFormatter={(value) => value.length > 10 ? `${value.substring(0, 8)}...` : value}
                  />
                  <YAxis allowDecimals={false} tick={{fontSize: 12, fill: '#4B5563'}} />
                  <RechartsTooltip formatter={(value) => [`${value} รายการ`, 'จำนวน']} />
                  <Bar dataKey="value" name="จำนวนรายการ" radius={[4, 4, 0, 0]}>
                    {currentChartData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* การ์ดรายการที่นำมาสรุปผล */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col">
           <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2"><CheckSquare size={20} className="text-blue-600" /> รายการที่นำมาสรุปผล</h3>
              <span className="text-sm font-medium text-gray-500 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full">{total} รายการ</span>
           </div>
           <div className="flex-1 overflow-y-auto max-h-[320px] pr-2 space-y-3">
              {filteredBookings.length === 0 ? <p className="text-gray-400 text-sm text-center mt-10">ไม่พบรายการ</p> : filteredBookings.map(b => (
                    <div key={b.id} className="p-3 border border-gray-100 dark:border-gray-700 rounded-xl bg-gray-50/50 dark:bg-gray-700/30 flex flex-col gap-1.5">
                       <div className="flex justify-between items-start">
                          <span className="font-semibold text-gray-800 dark:text-gray-200 text-sm">{b.itemName}</span>
                          <Badge status={b.status} />
                       </div>
                       <div className="flex justify-between items-end">
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                             <p>📅 {b.date} | ⏰ {b.startTime} - {b.endTime}</p>
                             <p className="mt-0.5">👤 {b.displayName} <span className="text-blue-600 dark:text-blue-400">({b.department || '-'})</span></p>
                          </div>
                       </div>
                    </div>
                 ))}
           </div>
        </div>
      </div>

{/* หน้าพิมพ์เอกสารรายงานสถิติ */}
      <div className="hidden print:block print:bg-white print:p-8 print:w-full print:text-black">
        <div className="text-center mb-8">
          {/* 🌟 แสดงตราโรงเรียนกึ่งกลางด้านบน */}
          <img 
            src="https://github.com/preepan-dotcom/ssrw-booking/blob/main/src/assets/ssrw-logo.png?alt=media&raw=true" 
            alt="ตราโรงเรียนศรีสองรักษ์วิทยา" 
            className="h-24 mx-auto mb-3 object-contain"
          />
          <h1 className="text-2xl font-bold mb-1">โรงเรียนศรีสองรักษ์วิทยา</h1>
          <h2 className="text-xl font-bold mb-2">รายงานสถิติการขออนุญาตใช้อาคารสถานที่และอุปกรณ์</h2>
          <p className="mt-2 text-md">ประจำช่วงวันที่: {startDate ? new Date(startDate).toLocaleDateString('th-TH') : 'ทั้งหมด'} ถึง {endDate ? new Date(endDate).toLocaleDateString('th-TH') : 'ทั้งหมด'}</p>
          <p className="text-sm text-gray-700 mt-1">กรองข้อมูล: ฝ่าย ({filterDepartment === 'all' ? 'ทั้งหมด' : filterDepartment}) | สถานะ ({filterStatus === 'all' ? 'ทั้งหมด' : getStatusLabel(filterStatus)})</p>
        </div>

        {printOptions.summary && (
          <div className="mb-8 p-4 border-2 border-black rounded-lg">
            <h3 className="font-bold text-lg mb-3 underline">สรุปจำนวนการใช้งานภาพรวม</h3>
            <div className="grid grid-cols-4 gap-4 text-center">
              <div><p className="font-semibold">ยอดขอใช้ทั้งหมด</p><p className="text-2xl font-bold mt-1">{total}</p><p className="text-sm">รายการ</p></div>
              <div><p className="font-semibold">อนุมัติแล้ว</p><p className="text-2xl font-bold mt-1">{approved}</p><p className="text-sm">รายการ</p></div>
              <div><p className="font-semibold">ไม่อนุมัติ</p><p className="text-2xl font-bold mt-1">{rejected}</p><p className="text-sm">รายการ</p></div>
              <div><p className="font-semibold">รอพิจารณา</p><p className="text-2xl font-bold mt-1">{pending}</p><p className="text-sm">รายการ</p></div>
            </div>
          </div>
        )}

        {printOptions.chart && total > 0 && (
          <div className="mb-8 flex justify-center items-center break-inside-avoid">
            <div className="w-full max-w-xl text-center border p-4">
              <h3 className="font-bold text-lg mb-4">{getChartTitle()}</h3>
              <BarChart width={500} height={250} data={currentChartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }} className="mx-auto">
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#000" />
                <XAxis dataKey="name" tick={{fontSize: 12, fill: '#000'}} tickLine={false} axisLine={{stroke: '#000'}} />
                <YAxis allowDecimals={false} tick={{fontSize: 12, fill: '#000'}} tickLine={false} axisLine={{stroke: '#000'}} />
                <Bar dataKey="value" fill="#4B5563">{currentChartData.map((e, i) => <Cell key={i} fill={e.color} />)}</Bar>
              </BarChart>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-8 mb-8 break-inside-avoid">
          {printOptions.itemStats && (
            <div>
              <h3 className="font-bold text-lg mb-3">สถานที่/อุปกรณ์ที่ใช้บ่อย</h3>
              <table className="w-full border-collapse border border-black text-sm">
                <thead><tr className="bg-gray-200"><th className="border border-black px-2 py-2">ลำดับ</th><th className="border border-black px-2 py-2 text-left">สถานที่/อุปกรณ์</th><th className="border border-black px-2 py-2">ครั้ง</th></tr></thead>
                <tbody>{sortedItems.map(([n, c], i) => <tr key={n}><td className="border border-black px-2 py-1 text-center">{i + 1}</td><td className="border border-black px-2 py-1">{n}</td><td className="border border-black px-2 py-1 text-center">{c}</td></tr>)}</tbody>
              </table>
            </div>
          )}
          {printOptions.deptStats && (
            <div>
              <h3 className="font-bold text-lg mb-3">ฝ่ายงานที่ใช้งานบ่อย</h3>
              <table className="w-full border-collapse border border-black text-sm">
                <thead><tr className="bg-gray-200"><th className="border border-black px-2 py-2">ลำดับ</th><th className="border border-black px-2 py-2 text-left">ฝ่ายงาน</th><th className="border border-black px-2 py-2">ครั้ง</th></tr></thead>
                <tbody>{sortedDepts.map(([n, c], i) => <tr key={n}><td className="border border-black px-2 py-1 text-center">{i + 1}</td><td className="border border-black px-2 py-1">{n}</td><td className="border border-black px-2 py-1 text-center">{c}</td></tr>)}</tbody>
              </table>
            </div>
          )}
        </div>

        {printOptions.list && (
          <div className="break-inside-avoid">
            <h3 className="font-bold text-lg mb-3">รายละเอียดการขออนุญาต</h3>
            <table className="w-full border-collapse border border-black text-sm mb-4">
              <thead><tr className="bg-gray-200"><th className="border border-black px-2 py-2">ลำดับ</th><th className="border border-black px-2 py-2">วันที่</th><th className="border border-black px-2 py-2 text-left">สถานที่</th><th className="border border-black px-2 py-2 text-left">ผู้ขอ/ฝ่าย</th><th className="border border-black px-2 py-2 text-left">วัตถุประสงค์</th><th className="border border-black px-2 py-2">สถานะ</th></tr></thead>
              <tbody>{filteredBookings.map((b, i) => <tr key={b.id}><td className="border border-black px-2 py-1 text-center">{i + 1}</td><td className="border border-black px-2 py-1 text-center">{new Date(b.date).toLocaleDateString('th-TH')}</td><td className="border border-black px-2 py-1">{b.itemName}</td><td className="border border-black px-2 py-1">{b.displayName}<br/><span className="text-xs">({b.department})</span></td><td className="border border-black px-2 py-1">{b.purpose}</td><td className="border border-black px-2 py-1 text-center">{getStatusLabel(b.status)}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// --- Main Application Component ---
export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [items, setItems] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [toast, setToast] = useState(null);
  const [activeTab, setActiveTab] = useState('browse');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // 💡 State สำหรับ Dark Mode (จดจำการตั้งค่าไว้ใน LocalStorage)
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme) return savedTheme === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // 💡 Effect เมื่อสลับโหมดให้เปลี่ยน class ในระดับ HTML Document
  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const showToast = (message, type = 'success') => setToast({ message, type });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        if (!currentUser.email.endsWith('@ssrw.ac.th')) {
          showToast('กรุณาใช้อีเมลโรงเรียน (@ssrw.ac.th) เท่านั้น', 'error');
          await signOut(auth); setUser(null); setProfile(null); setIsLoading(false);
          return;
        }
        const role = USER_ROLES[currentUser.email] || 'user';
        const profileData = { email: currentUser.email, displayName: currentUser.displayName || currentUser.email.split('@')[0], photoURL: currentUser.photoURL, role: role, lastLogin: Date.now() };
        try { await setDoc(getProfileDoc(currentUser.uid), profileData, { merge: true }); } catch (e) {}
        setUser(currentUser); setProfile(profileData);
        setActiveTab(prev => (role !== 'user' && (prev === 'browse' || prev === 'my-bookings')) ? 'admin-bookings' : prev);
      } else { setUser(null); setProfile(null); }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const itemsUnsub = onSnapshot(itemsCol, (snap) => setItems(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const bookingsUnsub = onSnapshot(bookingsCol, (snap) => setBookings(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))));
    return () => { itemsUnsub(); bookingsUnsub(); };
  }, [user]);

  // 3. เพิ่มโค้ดส่วนนี้ภายใน useEffect หลักที่ตรวจสอบสถานะผู้ใช้ เพื่อดึงข้อมูล LINE Profile มาเชื่อม
  useEffect(() => {
    const initLiffAndUpdateProfile = async () => {
      try {
        await liff.init({ liffId: 2012277307-tTe2Pen5 });
        
        // 🚀 ตรวจสอบว่าเปิดใน LINE Browser หรือไม่
        if (liff.isInClient()) {
          liff.openWindow({
            url: "https://ssrw-booking.vercel.app", // ใส่โดเมนจริงของคุณ
            external: true
          });
          liff.closeWindow();
          return;
        }

        // ถ้าเปิดผ่าน LINE และผู้ใช้ล็อกอินอยู่
        if (liff.isLoggedIn() && user) {
          const lineProfile = await liff.getProfile();
          
          // บันทึก lineUserId ลงใน Profile บน Firestore
          await setDoc(getProfileDoc(user.uid), {
            lineUserId: lineProfile.userId,
            lineDisplayName: lineProfile.displayName
          }, { merge: true });
          
          console.log("บันทึก LINE User ID เรียบร้อย:", lineProfile.userId);
        }
      } catch (err) {
        console.error("LIFF Init Error:", err);
      }
    };

    if (user) {
      initLiffAndUpdateProfile();
    }
  }, [user]);

  const handleGoogleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ hd: 'ssrw.ac.th', prompt: 'select_account' });
    try {
      await signInWithPopup(auth, provider);
      showToast('เข้าสู่ระบบสำเร็จ');
    } catch (error) {
      if (['auth/popup-blocked', 'auth/cancelled-popup-request'].includes(error.code)) {
        showToast('กรุณาเปิดบนเบราว์เซอร์หลักแทนแอป LINE', 'error');
      } else { showToast('เกิดข้อผิดพลาดในการเข้าสู่ระบบ', 'error'); }
    } finally { setIsLoggingIn(false); }
  };

  const handleLogout = async () => {
    try { await signOut(auth); setActiveTab('browse'); showToast('ออกจากระบบ'); } catch (e) {}
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;

  if (!user || !profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4 transition-colors">
        {/* Toggle Theme before login */}
        <div className="absolute top-4 right-4">
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-3 text-gray-500 dark:text-gray-400 bg-white/50 dark:bg-gray-800/50 backdrop-blur rounded-full hover:bg-white dark:hover:bg-gray-700 transition-all shadow-sm">
             {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
        <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-xl max-w-md w-full text-center border border-gray-100 dark:border-gray-700 transition-colors">
          <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center mx-auto mb-6">
            <UserIcon className="text-blue-600 dark:text-blue-400" size={40} />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">เข้าสู่ระบบ</h1>
          <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">ระบบขออนุญาตใช้อาคารสถานที่และอุปกรณ์<br/>โรงเรียนศรีสองรักษ์วิทยา</p>
          <button onClick={handleGoogleLogin} disabled={isLoggingIn} className={`w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 rounded-xl transition-all shadow-md flex items-center justify-center gap-3 ${isLoggingIn ? 'opacity-50 cursor-not-allowed' : ''}`}>
            {isLoggingIn ? <><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div><span>กำลังเข้าสู่ระบบ...</span></> : <><Mail size={20} /><span>เข้าสู่ระบบด้วย Google Account</span></>}
          </button>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-6">*อนุญาตเฉพาะอีเมล <strong>@ssrw.ac.th</strong> เท่านั้น</p>
        </div>
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    );
  }

  const hasAdminAccess = profile.role !== 'user';

  return (
    // 💡 Main wrapper with Dark Mode Background
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col font-sans transition-colors duration-200">
      <header className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-30 print:hidden transition-colors border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-lg"><CalendarIcon className="text-white h-6 w-6" /></div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white hidden sm:block">SSRW Booking</h1>
                <p className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">โรงเรียนศรีสองรักษ์วิทยา</p>
              </div>
            </div>

            <nav className="hidden md:flex space-x-1">
              {!hasAdminAccess && (
                <>
                  <NavBtn active={activeTab === 'browse'} onClick={() => setActiveTab('browse')} Icon={Monitor} label="รายการที่ขออนุญาต" />
                  <NavBtn active={activeTab === 'calendar'} onClick={() => setActiveTab('calendar')} Icon={CalendarIcon} label="ปฏิทิน" />
                  <NavBtn active={activeTab === 'my-bookings'} onClick={() => setActiveTab('my-bookings')} Icon={Clock} label="ประวัติของฉัน" />
                </>
              )}
              {hasAdminAccess && (
                <>
                  <NavBtn active={activeTab === 'admin-bookings'} onClick={() => setActiveTab('admin-bookings')} Icon={CheckSquare} label="จัดการอนุมัติคำขอ" />
                  <NavBtn active={activeTab === 'calendar'} onClick={() => setActiveTab('calendar')} Icon={CalendarIcon} label="ปฏิทิน" />
                  <NavBtn active={activeTab === 'admin-items'} onClick={() => setActiveTab('admin-items')} Icon={MapPin} label="จัดการสถานที่" />
                  <NavBtn active={activeTab === 'admin-reports'} onClick={() => setActiveTab('admin-reports')} Icon={PieChartIcon} label="สรุปการใช้งาน" />
                </>
              )}
            </nav>

            <div className="flex items-center gap-4">
              {/* 💡 ปุ่มสลับ Dark / Light Mode */}
              <button 
                onClick={() => setIsDarkMode(!isDarkMode)} 
                className="p-2 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title={isDarkMode ? "เปลี่ยนเป็นโหมดสว่าง" : "เปลี่ยนเป็นโหมดมืด"}
              >
                {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{profile.email}</span>
                <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                  {profile.role === 'admin' ? 'ผู้ดูแลระบบ' : profile.role === 'executive' ? 'รองผู้อำนวยการ' : profile.role === 'head' ? 'หัวหน้าฝ่าย' : 'ผู้ใช้งาน'}
                </span>
              </div>
              <button onClick={handleLogout} className="text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors" title="ออกจากระบบ">
                <LogOut size={20} />
              </button>
              <button className="md:hidden p-2 text-gray-600 dark:text-gray-300" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {isMobileMenuOpen && (
          <div className="md:hidden bg-white dark:bg-gray-800 border-t dark:border-gray-700 p-2 space-y-1 shadow-lg absolute w-full print:hidden">
             {!hasAdminAccess && (
                <>
                  <MobileNavBtn active={activeTab === 'browse'} onClick={() => {setActiveTab('browse'); setIsMobileMenuOpen(false);}} Icon={Monitor} label="รายการที่ขออนุญาต" />
                  <MobileNavBtn active={activeTab === 'calendar'} onClick={() => {setActiveTab('calendar'); setIsMobileMenuOpen(false);}} Icon={CalendarIcon} label="ปฏิทิน" />
                  <MobileNavBtn active={activeTab === 'my-bookings'} onClick={() => {setActiveTab('my-bookings'); setIsMobileMenuOpen(false);}} Icon={Clock} label="ประวัติของฉัน" />
                </>
              )}
              {hasAdminAccess && (
                <>
                  <MobileNavBtn active={activeTab === 'admin-bookings'} onClick={() => {setActiveTab('admin-bookings'); setIsMobileMenuOpen(false);}} Icon={CheckSquare} label="จัดการอนุมัติคำขอ" />
                  <MobileNavBtn active={activeTab === 'calendar'} onClick={() => {setActiveTab('calendar'); setIsMobileMenuOpen(false);}} Icon={CalendarIcon} label="ปฏิทิน" />
                  <MobileNavBtn active={activeTab === 'admin-items'} onClick={() => {setActiveTab('admin-items'); setIsMobileMenuOpen(false);}} Icon={MapPin} label="จัดการสถานที่" />
                  <MobileNavBtn active={activeTab === 'admin-reports'} onClick={() => {setActiveTab('admin-reports'); setIsMobileMenuOpen(false);}} Icon={PieChartIcon} label="สรุปการใช้งาน" />
                </>
              )}
          </div>
        )}
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 transition-all">
        {/* Render active tab */}
        {!hasAdminAccess && activeTab === 'browse' && <UserBrowseItems items={items} bookings={bookings} user={user} userId={user.uid} showToast={showToast} />}
        {!hasAdminAccess && activeTab === 'my-bookings' && <UserBookings bookings={bookings.filter(b => b.userId === user.uid)} />}
        
        {activeTab === 'calendar' && <CalendarView bookings={bookings} items={items} />}
        
        {hasAdminAccess && activeTab === 'admin-bookings' && <AdminManageBookings bookings={bookings} showToast={showToast} userRole={profile.role} />}
        {hasAdminAccess && activeTab === 'admin-items' && <AdminManageItems items={items} showToast={showToast} />}
        {hasAdminAccess && activeTab === 'admin-reports' && <AdminReports bookings={bookings} items={items} />}
      </main>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}