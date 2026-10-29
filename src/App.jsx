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
  BarChart as BarChartIcon
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

// --- กำหนดระดับสิทธิ์ให้แต่ละอีเมล (Role-based Access) ---
const USER_ROLES = {
  "kamchai@ssrw.ac.th": "executive", // ผู้บริหาร (รอง ผอ.) - กดอนุมัติได้อย่างเดียว
  "apirat@ssrw.ac.th": "head",       // หัวหน้าฝ่าย - กดรับทราบได้อย่างเดียว
  "admin@ssrw.ac.th": "admin",       // ผู้ดูแลระบบ - ทำได้ทุกอย่าง
  "preepan@ssrw.ac.th": "admin"      // ผู้ดูแลระบบ - ทำได้ทุกอย่าง
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

// Safe Analytics Initialization
isSupported().then(supported => {
  if (supported) {
    getAnalytics(app);
  }
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
      ${active ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
  >
    <Icon size={18} /> {label}
  </button>
);

const MobileNavBtn = ({ active, onClick, Icon, label }) => (
  <button 
    onClick={onClick}
    className={`flex w-full items-center gap-3 px-4 py-3 rounded-lg text-left font-medium transition-all print:hidden
      ${active ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
  >
    <Icon size={18} /> {label}
  </button>
);

const DEPARTMENTS = [
  "บริหารงานวิชาการ",
  "บริหารงานงบประมาณ",
  "บริหารงานบุคคล",
  "บริหารงานทั่วไป",
  "บริหารงานระบบดูแลช่วยเหลือนักเรียน",
  "บริหารงานกิจการนักเรียน",
  "บริหารงานนโยบายและแผน",
  "กลุ่มสาระฯ ภาษาไทย",
  "กลุ่มสาระฯ คณิตศาสตร์",
  "กลุ่มสาระฯ วิทยาศาสตร์และเทคโนโลยี",
  "กลุ่มสาระฯ สังคมศึกษาฯ",
  "กลุ่มสาระฯ สุขศึกษาและพลศึกษา",
  "กลุ่มสาระฯ ศิลปะ",
  "กลุ่มสาระฯ การงานอาชีพ",
  "กลุ่มสาระฯ ภาษาต่างประเทศ",
  "กิจกรรมพัฒนาผู้เรียน",
  "อื่นๆ"
];

const ASSIGNABLE_TEACHERS = [
  "นายพีรพัฒน์ พลเรือง (ครูแพนเตอร์)",
  "นายพงศ์พล พากุล (ครูแม็ก)",
  "นายธณกร กูฎโสม (ครูอั๋น)"
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
      
      try {
        await sendLineMessage(notifyMsg);
      } catch (lineErr) {
        console.error("สร้างการขออนุญาตสำเร็จ แต่ส่ง LINE แจ้งเตือนไม่สำเร็จ:", lineErr);
      }

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
          <h2 className="text-2xl font-bold text-gray-800">ขออนุญาตใช้อาคารสถานที่และอุปกรณ์</h2>
          <p className="text-gray-500 mt-1">โรงเรียนศรีสองรักษ์วิทยา</p>
        </div>
      </div>

      {activeItems.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl shadow-sm text-center text-gray-500 border border-gray-100">
          ไม่พบรายการที่เปิดให้ขออนุญาตในขณะนี้
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
                  className="w-full bg-gray-50 hover:bg-blue-600 hover:text-white text-gray-700 font-semibold py-2.5 rounded-xl transition-all border border-gray-200 hover:border-blue-600 group-hover:shadow-sm"
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
        <div className="mb-6 bg-blue-50 p-4 rounded-xl border border-blue-100">
          <h4 className="font-semibold text-blue-800 flex items-center gap-2 mb-2"><Clock size={18} /> ตารางการใช้งาน</h4>
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
            <p className="text-sm text-gray-500 text-center py-2 bg-white rounded-lg border border-dashed border-blue-200">ยังไม่มีการขออนุญาตในวันนี้</p>
          )}
        </div>

        <form onSubmit={handleBook} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-800">วันที่ต้องการใช้</label>
            <input type="date" name="date" required min={new Date().toISOString().split('T')[0]} value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full px-3 py-2 border border-gray-400 rounded-md focus:outline-none focus:border-blue-500" />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-800">เวลาเริ่ม</label>
              <input type="time" name="startTime" required className="w-full px-3 py-2 border border-gray-400 rounded-md focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-800">เวลาสิ้นสุด</label>
              <input type="time" name="endTime" required className="w-full px-3 py-2 border border-gray-400 rounded-md focus:outline-none focus:border-blue-500" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-gray-800">ฝ่ายงาน/กลุ่มสาระที่ขอใช้งาน</label>
            <select name="department" required defaultValue="" className="w-full px-3 py-2 border border-gray-400 rounded-md bg-white focus:outline-none focus:border-blue-500">
              <option value="" disabled>-- กรุณาเลือกฝ่ายงาน/กลุ่มสาระ --</option>
              {DEPARTMENTS.map(dep => (
                <option key={dep} value={dep}>{dep}</option>
              ))}
            </select>
          </div>

          {selectedItem?.type === 'room' && (
            <div className="border-t border-gray-300 pt-4 mt-4 space-y-4">
              <h4 className="font-semibold text-gray-800 text-sm">รายละเอียดการจัดห้องและอุปกรณ์เสริม</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-800">จำนวนโต๊ะ</label>
                  <input type="number" name="tables" min="0" defaultValue="0" className="w-full px-3 py-2 border border-gray-400 rounded-md focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-800">จำนวนเก้าอี้</label>
                  <input type="number" name="chairs" min="0" defaultValue="0" className="w-full px-3 py-2 border border-gray-400 rounded-md focus:outline-none focus:border-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 items-center">
                <div className="flex items-center gap-2">
                  <input type="checkbox" name="soundSystem" id="soundSystem" className="w-4 h-4 text-blue-600 rounded border-gray-400 focus:ring-blue-500" />
                  <label htmlFor="soundSystem" className="text-sm font-medium text-gray-800">ต้องการเครื่องเสียง</label>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-800">จำนวนไมค์</label>
                  <input type="number" name="microphones" min="0" defaultValue="0" className="w-full px-3 py-2 border border-gray-400 rounded-md focus:outline-none focus:border-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-800">อุปกรณ์อื่นๆ (โปรดระบุ)</label>
                <input type="text" name="otherEquipment" placeholder="เช่น โปรเจคเตอร์, กระดาน" className="w-full px-3 py-2 border border-gray-400 rounded-md focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-800">แนบผังการจัดห้อง (รูปภาพ)</label>
                <input type="file" accept="image/*" onChange={handleImageUpload} className="w-full px-3 py-2 border border-gray-400 rounded-md focus:outline-none focus:border-blue-500 text-sm file:mr-4 file:py-1.5 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                {layoutImage && (
                  <div className="relative inline-block mt-3">
                    <img src={layoutImage} alt="Room Layout" className="h-32 object-contain rounded-md border border-gray-400" />
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

          <div className="border-t border-gray-300 pt-4 mt-4">
            <label className="block text-sm font-medium mb-1 text-gray-800">วัตถุประสงค์การใช้งาน</label>
            <textarea name="purpose" required rows="2" className="w-full px-3 py-2 border border-gray-400 rounded-md focus:outline-none focus:border-blue-500 resize-none" placeholder="ระบุเหตุผลที่ต้องการใช้งาน..."></textarea>
          </div>
          
          <div className="pt-4 flex gap-3">
            <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors font-medium">ยกเลิก</button>
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
          <h2 className="text-2xl font-bold text-gray-800">ปฏิทินการใช้งานสถานที่และอุปกรณ์</h2>
          <p className="text-gray-500 mt-1">คลิกที่วันที่เพื่อดูรายการจองรายละเอียดทั้งหมด</p>
        </div>

        <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl border border-gray-200 shadow-sm">
          <button onClick={prevMonth} className="p-1 hover:bg-gray-100 rounded-lg text-gray-600"><ChevronLeft size={20} /></button>
          <span className="font-bold text-gray-800 text-lg">{thaiMonths[month]} {year + 543}</span>
          <button onClick={nextMonth} className="p-1 hover:bg-gray-100 rounded-lg text-gray-600"><ChevronRight size={20} /></button>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 overflow-x-auto">
        <div className="grid grid-cols-7 gap-2 min-w-[600px] text-center font-bold text-gray-600 mb-4 border-b pb-3">
          <div className="text-red-500">อา.</div>
          <div>จ.</div>
          <div>อ.</div>
          <div>พ.</div>
          <div>พฤ.</div>
          <div>ศ.</div>
          <div className="text-blue-500">ส.</div>
        </div>

        <div className="grid grid-cols-7 gap-2 min-w-[600px]">
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} className="h-24 bg-gray-50/50 rounded-xl"></div>
          ))}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayBookings = bookings.filter(b => b.date === dateStr && b.status !== 'rejected');

            return (
              <div 
                key={day} 
                onClick={() => handleDayClick(day)}
                className="h-24 p-1.5 border border-gray-100 hover:border-blue-500 rounded-xl bg-white hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
              >
                <span className="font-semibold text-sm text-gray-700">{day}</span>
                <div className="space-y-1 overflow-y-auto max-h-14">
                  {dayBookings.slice(0, 2).map(b => (
                    <div 
                      key={b.id} 
                      className={`text-[10px] px-1.5 py-0.5 rounded truncate font-medium ${
                        b.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {b.startTime} {b.itemName}
                    </div>
                  ))}
                  {dayBookings.length > 2 && (
                    <span className="text-[10px] text-gray-400 block text-center">+{dayBookings.length - 2} รายการ</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedDayStr && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Clock className="text-blue-600" size={20} /> รายการการใช้งานประจำวันที่ {selectedDayStr}
          </h3>

          {selectedDayBookings.length === 0 ? (
            <p className="text-gray-500 text-sm py-4 text-center">ไม่มีการใช้งานในวันนี้</p>
          ) : (
            <div className="space-y-3">
              {selectedDayBookings.map(b => {
                const teachersList = b.assignedTeachers || (b.assignedTeacher ? [b.assignedTeacher] : []);
                return (
                <div key={b.id} className="p-4 rounded-xl border border-gray-100 bg-gray-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-800">{b.itemName}</span>
                      <Badge status={b.status} />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      <strong>ผู้ขออนุญาต:</strong> {b.displayName || b.userEmail} 
                      {b.department && <span className="text-blue-700 font-medium"> ({b.department})</span>} 
                      | <strong>เวลา:</strong> {b.startTime} - {b.endTime} น.
                    </p>
                    <p className="text-xs text-gray-600 mt-1"><strong>วัตถุประสงค์:</strong> {b.purpose}</p>
                    {teachersList.length > 0 && (
                      <p className="text-xs text-indigo-700 mt-1.5 font-semibold bg-indigo-50 inline-block px-2 py-1 rounded border border-indigo-100">
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
  
  // เพิ่ม State สำหรับ Filter
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
      if (assignedTeachersArray && assignedTeachersArray.length > 0) {
        updateData.assignedTeachers = assignedTeachersArray;
      }
      
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

  // กรองข้อมูลตาม Filter
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
        <h2 className="text-2xl font-bold text-gray-800">จัดการอนุมัติคำขออนุญาต</h2>
        <p className="text-gray-500 mt-1">ขั้นตอนการรับทราบ มอบหมายผู้ดูแล และอนุมัติการขอใช้อาคารสถานที่และอุปกรณ์</p>
      </div>

      {/* ส่วนตัวกรองค้นหา */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="ค้นหาชื่อผู้ขอ หรือ สถานที่..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
          />
        </div>
        <div className="flex gap-4 w-full md:w-auto">
          <input 
            type="date" 
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="flex-1 md:w-40 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 text-sm bg-white"
          />
          <select 
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="flex-1 md:w-48 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 text-sm bg-white"
          >
            <option value="all">สถานะทั้งหมด</option>
            <option value="pending_head">รอหัวหน้าฝ่ายรับทราบ</option>
            <option value="pending_deputy">รอรอง ผอ. อนุมัติ</option>
            <option value="approved">อนุมัติเรียบร้อย</option>
            <option value="rejected">ไม่อนุมัติ</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
         <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-gray-600 text-sm">
                  <th className="p-4 font-semibold w-1/4">ผู้ขอ/รายการ</th>
                  <th className="p-4 font-semibold w-1/6">วันและเวลา</th>
                  <th className="p-4 font-semibold w-1/4">รายละเอียด & ผู้ดูแล</th>
                  <th className="p-4 font-semibold text-center w-1/6">สถานะปัจจุบัน</th>
                  <th className="p-4 font-semibold text-center w-1/4 min-w-[280px]">การจัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredBookings.length === 0 && (
                  <tr><td colSpan="5" className="p-8 text-center text-gray-500">ไม่พบข้อมูลที่ค้นหา</td></tr>
                )}
                {filteredBookings.map(b => {
                  const teachersList = b.assignedTeachers || (b.assignedTeacher ? [b.assignedTeacher] : []);
                  return (
                  <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 align-top">
                      <p className="font-bold text-blue-700 mb-1">{b.itemName}</p>
                      <p className="text-xs font-medium text-gray-800">{b.displayName || b.userEmail}</p>
                      {b.department && (
                        <span className="inline-block mt-1 text-[11px] font-medium text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                          {b.department}
                        </span>
                      )}
                    </td>
                    <td className="p-4 align-top">
                      <p className="text-sm font-medium text-gray-800">{b.date}</p>
                      <p className="text-xs text-gray-500 mt-1">{b.startTime} - {b.endTime}</p>
                    </td>
                    <td className="p-4 align-top">
                      <p className="text-sm text-gray-700 mb-2" title={b.purpose}>{b.purpose}</p>
                      {teachersList.length > 0 && (
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-gray-500 font-semibold">ครูผู้ดูแล:</span>
                          <div className="flex flex-wrap gap-1">
                            {teachersList.map(t => (
                              <span key={t} className="text-[11px] text-indigo-700 font-semibold bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded">
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
                        <div className="flex flex-col items-center gap-2 bg-amber-50/50 p-3 rounded-xl border border-amber-200 shadow-sm">
                          <span className="text-xs font-bold text-amber-800 w-full text-left border-b border-amber-200 pb-1 flex items-center gap-1">
                            👑 สำหรับหัวหน้าฝ่าย
                          </span>
                          <div className="flex flex-col items-start gap-1.5 w-full text-left bg-white p-2.5 border border-amber-100 rounded-lg">
                            <span className="text-[11px] font-semibold text-gray-600 mb-1">เลือกครูผู้ดูแล (เลือกได้มากกว่า 1 คน):</span>
                            {ASSIGNABLE_TEACHERS.map(teacher => (
                              <label key={teacher} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer hover:bg-gray-50 w-full p-1 rounded transition-colors">
                                <input 
                                  type="checkbox" 
                                  className="rounded border-gray-300 text-amber-500 focus:ring-amber-500 w-3.5 h-3.5"
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
                              <button onClick={() => handleUpdateStatus(b.id, 'rejected')} className="bg-red-100 text-red-700 hover:bg-red-600 hover:text-white px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors">
                                ปฏิเสธ
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                      {b.status === 'pending_head' && !canAcknowledge && (
                        <span className="text-[11px] font-semibold text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-200 inline-block">
                          ⏳ รอหัวหน้าฝ่ายดำเนินการ
                        </span>
                      )}
                      {b.status === 'pending_deputy' && canApprove && (
                        <div className="flex flex-col items-center gap-2 bg-blue-50/50 p-3 rounded-xl border border-blue-200 shadow-sm">
                          <span className="text-xs font-bold text-blue-800 w-full text-left border-b border-blue-200 pb-1 flex items-center gap-1">
                            👑 สำหรับรองผู้อำนวยการ
                          </span>
                          <p className="text-[10px] text-gray-500 w-full text-left mt-1 mb-1">หัวหน้าฝ่ายรับทราบและมอบหมายผู้ดูแลเรียบร้อยแล้ว</p>
                          <div className="flex justify-center gap-2 w-full">
                            <button onClick={() => handleUpdateStatus(b.id, 'approved')} className="flex-1 bg-blue-600 text-white hover:bg-blue-700 px-3 py-2 rounded-lg text-xs font-semibold transition-colors shadow-sm flex items-center justify-center gap-1">
                              <CheckCircle size={14} /> รอง ผอ. อนุมัติ
                            </button>
                            {canReject && (
                              <button onClick={() => handleUpdateStatus(b.id, 'rejected')} className="bg-red-100 text-red-700 hover:bg-red-600 hover:text-white px-3 py-2 rounded-lg text-xs font-semibold transition-colors">
                                ไม่อนุมัติ
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                      {b.status === 'pending_deputy' && !canApprove && (
                        <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200 inline-block">
                          ⏳ รอรองผู้อำนวยการดำเนินการ
                        </span>
                      )}
                      {(b.status === 'approved' || b.status === 'rejected') && (
                        <div className="flex flex-col items-center gap-2">
                          <span className="text-[11px] font-semibold text-gray-400 bg-gray-50 px-3 py-1 rounded-full border border-gray-200">
                            การพิจารณาเสร็จสิ้น
                          </span>
                          <div className="flex justify-center items-center gap-2 mt-1">
                            {b.status === 'approved' && canApprove && (
                              <button onClick={() => handleUpdateStatus(b.id, 'rejected')} className="text-amber-600 bg-amber-50 hover:bg-amber-100 px-2 py-1.5 rounded-md transition-colors flex items-center gap-1 text-xs border border-amber-200" title="ยกเลิกการอนุมัติ (เปลี่ยนเป็นไม่อนุมัติ)">
                                <XCircle size={14} /> ยกเลิก
                              </button>
                            )}
                            {canReject && (
                              <button onClick={() => handleDeleteBooking(b.id)} className="text-red-600 bg-red-50 hover:bg-red-100 px-2 py-1.5 rounded-md transition-colors flex items-center gap-1 text-xs border border-red-200" title="ลบรายการนี้ถาวร">
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
        <h2 className="text-2xl font-bold text-gray-800">ประวัติการขออนุญาตของฉัน</h2>
        <p className="text-gray-500 mt-1">ติดตามสถานะคำขอเสนอผ่านหัวหน้าฝ่ายและรองผู้อำนวยการ</p>
      </div>
      {bookings.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl shadow-sm text-center text-gray-500 border border-gray-100">
          คุณยังไม่มีประวัติการขออนุญาต
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
                  <th className="p-4 font-semibold">สถานะคำขอ</th>
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
      if (file.size > 512000) {
        showToast('ไฟล์ภาพมีขนาดใหญ่เกินไป (กรุณาใช้ไฟล์ขนาดไม่เกิน 500KB)', 'error');
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
        await updateDoc(getItemDoc(editingItem.id), itemData);
        showToast('อัปเดตข้อมูลสำเร็จ');
      } else {
        await addDoc(itemsCol, itemData);
        showToast('เพิ่มรายการใหม่สำเร็จ');
      }
      setIsModalOpen(false);
      setEditingItem(null);
    } catch (error) {
      showToast('เกิดข้อผิดพลาดในการบันทึก', 'error');
    }
  };

  const handleDelete = async (id) => {
    try {
       await deleteDoc(getItemDoc(id));
       showToast('ลบรายการสำเร็จ');
    } catch(err) {
       showToast('ไม่สามารถลบรายการได้', 'error');
    }
  };

  return (
    <div className="space-y-6 print:hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">จัดการสถานที่และอุปกรณ์</h2>
          <p className="text-gray-500 mt-1">เพิ่ม ลบ หรือแก้ไขข้อมูลรายการที่เปิดให้ขออนุญาต</p>
        </div>
        <button onClick={() => { setEditingItem(null); setItemImage(null); setIsModalOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-medium transition-colors shadow-sm">
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
                  <span className="text-sm text-gray-600">รองรับ {item.capacity} </span>
                  <div className="flex gap-2">
                    <button onClick={() => { setEditingItem(item); setItemImage(item.image || null); setIsModalOpen(true); }} className="text-blue-600 hover:bg-blue-50 p-2 rounded-lg transition-colors text-sm font-medium">แก้ไข</button>
                    <button onClick={() => handleDelete(item.id)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"><Trash2 size={18} /></button>
                  </div>
               </div>
            </div>
          </div>
        ))}
      </div>

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
          </div>
          <div className="flex items-center gap-2 mt-2">
            <input type="checkbox" id="isActive" name="isActive" defaultChecked={editingItem ? editingItem.isActive : true} className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
            <label htmlFor="isActive" className="text-sm font-medium text-gray-700">เปิดให้ขออนุญาต (Active)</label>
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

// --- 6. Admin: Reports ---
const AdminReports = ({ bookings, items }) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [chartType, setChartType] = useState('pie');

  // ตัวเลือกในการพิมพ์
  const [printOptions, setPrintOptions] = useState({
    summary: true,
    itemStats: true,
    deptStats: true,
    chart: true,
    list: true
  });

  const handlePrintOptionChange = (option) => {
    setPrintOptions(prev => ({ ...prev, [option]: !prev[option] }));
  };

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

  const chartData = [
    { name: 'อนุมัติแล้ว', value: approved, color: '#10B981' },
    { name: 'ไม่อนุมัติ', value: rejected, color: '#EF4444' },
    { name: 'อยู่ระหว่างพิจารณา', value: pending, color: '#F59E0B' },
  ].filter(item => item.value > 0);

  // คำนวณสถิติสถานที่/อุปกรณ์ที่ถูกใช้งานบ่อย
  const itemCounts = filteredBookings.reduce((acc, b) => {
    acc[b.itemName] = (acc[b.itemName] || 0) + 1;
    return acc;
  }, {});
  const sortedItems = Object.entries(itemCounts).sort((a, b) => b[1] - a[1]);

  // คำนวณสถิติฝ่ายที่ขอใช้งานบ่อย
  const deptCounts = filteredBookings.reduce((acc, b) => {
    const dept = b.department || 'ไม่ระบุ';
    acc[dept] = (acc[dept] || 0) + 1;
    return acc;
  }, {});
  const sortedDepts = Object.entries(deptCounts).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">สรุปการใช้งานระบบ</h2>
          <p className="text-gray-500 mt-1">ดูรายงานการขอใช้สถานที่และสั่งพิมพ์เอกสารรายงาน</p>
        </div>
        <button 
          onClick={() => window.print()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
        >
          <Printer size={16} /> พิมพ์รายงานสถิติ
        </button>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-end print:hidden">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">ตั้งแต่วันที่</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">ถึงวันที่</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">ฝ่ายงาน/กลุ่มสาระ</label>
          <select value={filterDepartment} onChange={(e) => setFilterDepartment(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white min-w-[150px]">
            <option value="all">ทุกฝ่ายงาน</option>
            {DEPARTMENTS.map(dep => <option key={dep} value={dep}>{dep}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">สถานะ</label>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white min-w-[150px]">
            <option value="all">ทุกสถานะ</option>
            <option value="approved">อนุมัติเรียบร้อย</option>
            <option value="rejected">ไม่อนุมัติ</option>
            <option value="pending_head">รอหัวหน้าฝ่ายรับทราบ</option>
            <option value="pending_deputy">รอรอง ผอ. อนุมัติ</option>
          </select>
        </div>
      </div>

      {/* เลือกข้อมูลที่จะพิมพ์ (หน้าจอเท่านั้น) */}
      <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 print:hidden">
        <h3 className="text-sm font-bold text-blue-800 mb-3 flex items-center gap-2">
          <Printer size={16} /> เลือกเนื้อหาที่จะแสดงในเอกสารพิมพ์
        </h3>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2 cursor-pointer font-medium text-gray-700">
            <input type="checkbox" checked={printOptions.summary} onChange={() => handlePrintOptionChange('summary')} className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4" /> สรุปภาพรวม
          </label>
          <label className="flex items-center gap-2 cursor-pointer font-medium text-gray-700">
            <input type="checkbox" checked={printOptions.chart} onChange={() => handlePrintOptionChange('chart')} className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4" /> กราฟสัดส่วนสถานะ
          </label>
          <label className="flex items-center gap-2 cursor-pointer font-medium text-gray-700">
            <input type="checkbox" checked={printOptions.itemStats} onChange={() => handlePrintOptionChange('itemStats')} className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4" /> สถิติสถานที่/อุปกรณ์
          </label>
          <label className="flex items-center gap-2 cursor-pointer font-medium text-gray-700">
            <input type="checkbox" checked={printOptions.deptStats} onChange={() => handlePrintOptionChange('deptStats')} className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4" /> สถิติฝ่ายที่ใช้งาน
          </label>
          <label className="flex items-center gap-2 cursor-pointer font-medium text-gray-700">
            <input type="checkbox" checked={printOptions.list} onChange={() => handlePrintOptionChange('list')} className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4" /> ตารางรายละเอียด
          </label>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:hidden">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-sm font-medium text-gray-500">ตามเงื่อนไขที่เลือก (รายการ)</p>
          <p className="text-3xl font-bold text-gray-800 mt-2">{total}</p>
        </div>
        <div className="bg-green-50 p-5 rounded-2xl border border-green-100 shadow-sm">
          <p className="text-sm font-medium text-green-700">อนุมัติแล้ว (รายการ)</p>
          <p className="text-3xl font-bold text-green-800 mt-2">{approved}</p>
        </div>
        <div className="bg-red-50 p-5 rounded-2xl border border-red-100 shadow-sm">
          <p className="text-sm font-medium text-red-700">ไม่อนุมัติ (รายการ)</p>
          <p className="text-3xl font-bold text-red-800 mt-2">{rejected}</p>
        </div>
        <div className="bg-amber-50 p-5 rounded-2xl border border-amber-100 shadow-sm">
          <p className="text-sm font-medium text-amber-700">อยู่ระหว่างพิจารณา (รายการ)</p>
          <p className="text-3xl font-bold text-amber-800 mt-2">{pending}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:hidden">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
               <PieChartIcon size={20} className="text-blue-600" />
               สัดส่วนสถานะการขออนุญาต
            </h3>
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button 
                onClick={() => setChartType('pie')}
                className={`p-1.5 rounded-md text-sm flex items-center gap-1 transition-colors ${chartType === 'pie' ? 'bg-white shadow-sm text-blue-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <PieChartIcon size={16} /> วงกลม
              </button>
              <button 
                onClick={() => setChartType('bar')}
                className={`p-1.5 rounded-md text-sm flex items-center gap-1 transition-colors ${chartType === 'bar' ? 'bg-white shadow-sm text-blue-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <BarChartIcon size={16} /> แท่ง
              </button>
            </div>
          </div>
          
          <div className="flex-1 flex justify-center items-center min-h-[300px]">
            {total === 0 ? (
               <p className="text-gray-400 text-sm">ไม่มีข้อมูลสำหรับแสดงแผนภูมิ</p>
            ) : chartType === 'pie' ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value) => [`${value} รายการ`, 'จำนวน']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="name" tick={{fontSize: 12, fill: '#4B5563'}} tickLine={false} axisLine={{stroke: '#D1D5DB'}} />
                  <YAxis allowDecimals={false} tick={{fontSize: 12, fill: '#4B5563'}} tickLine={false} axisLine={{stroke: '#D1D5DB'}} />
                  <RechartsTooltip cursor={{fill: '#F3F4F6'}} formatter={(value) => [`${value} รายการ`, 'จำนวน']} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                     {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col">
           <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                 <CheckSquare size={20} className="text-blue-600" />
                 รายการที่นำมาสรุปผล
              </h3>
              <span className="text-sm font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">{total} รายการ</span>
           </div>
           
           <div className="flex-1 overflow-y-auto max-h-[300px] pr-2 space-y-3">
              {filteredBookings.length === 0 ? (
                 <p className="text-gray-400 text-sm text-center mt-10">ไม่พบรายการตามเงื่อนไขที่เลือก</p>
              ) : (
                 filteredBookings.map(b => (
                    <div key={b.id} className="p-3 border border-gray-100 rounded-xl bg-gray-50/50 flex flex-col gap-1.5 hover:bg-gray-50 transition-colors">
                       <div className="flex justify-between items-start">
                          <span className="font-semibold text-gray-800 text-sm">{b.itemName}</span>
                          <Badge status={b.status} />
                       </div>
                       <div className="flex justify-between items-end">
                          <div className="text-xs text-gray-500">
                             <p>📅 {b.date} | ⏰ {b.startTime} - {b.endTime}</p>
                             <p className="mt-0.5">👤 {b.displayName} <span className="text-blue-600">({b.department || '-'})</span></p>
                          </div>
                       </div>
                    </div>
                 ))
              )}
           </div>
        </div>
      </div>

      {/* ========================================== */}
      {/* 📄 รูปแบบหน้ากระดาษสำหรับสั่งพิมพ์ (Print Layout) */}
      {/* ========================================== */}
      <div className="hidden print:block print:bg-white print:p-8 print:w-full print:text-black">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-2">รายงานสถิติการขออนุญาตใช้อาคารสถานที่และอุปกรณ์</h1>
          <h2 className="text-xl font-bold mb-2">โรงเรียนศรีสองรักษ์วิทยา</h2>
          <p className="mt-2 text-md">
            ประจำช่วงวันที่: {startDate ? new Date(startDate).toLocaleDateString('th-TH') : 'ทั้งหมด'} ถึง {endDate ? new Date(endDate).toLocaleDateString('th-TH') : 'ทั้งหมด'}
          </p>
          <p className="text-sm text-gray-700 mt-1">
            กรองข้อมูล: ฝ่าย ({filterDepartment === 'all' ? 'ทั้งหมด' : filterDepartment}) | สถานะ ({filterStatus === 'all' ? 'ทั้งหมด' : getStatusLabel(filterStatus)})
          </p>
        </div>

        {/* ส่วนสรุปภาพรวม */}
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

        {/* ส่วนแผนภูมิแท่งสำหรับการพิมพ์ */}
        {printOptions.chart && total > 0 && (
          <div className="mb-8 flex justify-center items-center break-inside-avoid">
            <div className="w-full max-w-xl text-center border p-4">
              <h3 className="font-bold text-lg mb-4">สัดส่วนสถานะการขออนุญาต (แผนภูมิ)</h3>
              <BarChart width={500} height={250} data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }} className="mx-auto">
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" tick={{fontSize: 14, fill: '#000'}} tickLine={false} axisLine={{stroke: '#000'}} />
                <YAxis allowDecimals={false} tick={{fontSize: 14, fill: '#000'}} tickLine={false} axisLine={{stroke: '#000'}} />
                <Bar dataKey="value" fill="#4B5563" radius={[4, 4, 0, 0]}>
                   {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </div>
          </div>
        )}

        {/* ส่วนตารางจัดอันดับ (2 คอลัมน์) */}
        <div className="grid grid-cols-2 gap-8 mb-8 break-inside-avoid">
          {printOptions.itemStats && (
            <div>
              <h3 className="font-bold text-lg mb-3">สถิติสถานที่/อุปกรณ์ที่ใช้บ่อยที่สุด</h3>
              <table className="w-full border-collapse border border-black text-sm">
                <thead>
                  <tr className="bg-gray-200">
                    <th className="border border-black px-2 py-2 text-center w-12">ลำดับ</th>
                    <th className="border border-black px-2 py-2 text-left">สถานที่/อุปกรณ์</th>
                    <th className="border border-black px-2 py-2 text-center w-24">จำนวนครั้ง</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedItems.length > 0 ? sortedItems.map(([name, count], index) => (
                    <tr key={name}>
                      <td className="border border-black px-2 py-1 text-center">{index + 1}</td>
                      <td className="border border-black px-2 py-1">{name}</td>
                      <td className="border border-black px-2 py-1 text-center font-bold">{count}</td>
                    </tr>
                  )) : <tr><td colSpan="3" className="border border-black px-2 py-2 text-center">ไม่มีข้อมูล</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {printOptions.deptStats && (
            <div>
              <h3 className="font-bold text-lg mb-3">สถิติฝ่ายงานที่ขอใช้งานมากที่สุด</h3>
              <table className="w-full border-collapse border border-black text-sm">
                <thead>
                  <tr className="bg-gray-200">
                    <th className="border border-black px-2 py-2 text-center w-12">ลำดับ</th>
                    <th className="border border-black px-2 py-2 text-left">ฝ่ายงาน/กลุ่มสาระ</th>
                    <th className="border border-black px-2 py-2 text-center w-24">จำนวนครั้ง</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedDepts.length > 0 ? sortedDepts.map(([name, count], index) => (
                    <tr key={name}>
                      <td className="border border-black px-2 py-1 text-center">{index + 1}</td>
                      <td className="border border-black px-2 py-1">{name}</td>
                      <td className="border border-black px-2 py-1 text-center font-bold">{count}</td>
                    </tr>
                  )) : <tr><td colSpan="3" className="border border-black px-2 py-2 text-center">ไม่มีข้อมูล</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ส่วนตารางรายละเอียดแบบเดิม */}
        {printOptions.list && (
          <div className="break-inside-avoid">
            <h3 className="font-bold text-lg mb-3">รายละเอียดการขออนุญาต</h3>
            <table className="w-full border-collapse border border-black text-sm mb-12">
              <thead>
                <tr className="bg-gray-200">
                  <th className="border border-black px-2 py-2 text-center w-12">ลำดับ</th>
                  <th className="border border-black px-2 py-2 text-center w-24">วันที่ใช้งาน</th>
                  <th className="border border-black px-2 py-2 text-left w-48">สถานที่/อุปกรณ์</th>
                  <th className="border border-black px-2 py-2 text-left w-32">ผู้ขออนุญาต/ฝ่าย</th>
                  <th className="border border-black px-2 py-2 text-left">วัตถุประสงค์</th>
                  <th className="border border-black px-2 py-2 text-center w-24">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {filteredBookings.length > 0 ? (
                  filteredBookings.map((b, index) => (
                    <tr key={b.id}>
                      <td className="border border-black px-2 py-1 text-center">{index + 1}</td>
                      <td className="border border-black px-2 py-1 text-center">{new Date(b.date).toLocaleDateString('th-TH')}</td>
                      <td className="border border-black px-2 py-1">{b.itemName}</td>
                      <td className="border border-black px-2 py-1">{b.displayName}<br/><span className="text-xs text-gray-600">({b.department || '-'})</span></td>
                      <td className="border border-black px-2 py-1">{b.purpose}</td>
                      <td className="border border-black px-2 py-1 text-center">{getStatusLabel(b.status)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="border border-black px-2 py-4 text-center">ไม่มีข้อมูลตามเงื่อนไขที่เลือก</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        
        {/* ลายเซ็นผู้ตรวจสอบ */}
        <div className="grid grid-cols-3 gap-8 mt-16 text-center text-sm break-inside-avoid">
          <div>
            <p className="mb-12">ลงชื่อ .....................................................</p>
            <p>(.....................................................)</p>
            <p className="mt-1">ผู้จัดทำรายงานสถิติ</p>
          </div>
          <div>
            <p className="mb-12">ลงชื่อ .....................................................</p>
            <p>(.....................................................)</p>
            <p className="mt-1">หัวหน้าฝ่ายบริหารงานทั่วไป</p>
          </div>
          <div>
            <p className="mb-12">ลงชื่อ .....................................................</p>
            <p>(.....................................................)</p>
            <p className="mt-1">รองผู้อำนวยการโรงเรียน / ผู้อำนวยการ</p>
          </div>
        </div>
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
  const [isLoggingIn, setIsLoggingIn] = useState(false); // 💡 ป้องกันการกดล็อกอินซ้ำ
  const [toast, setToast] = useState(null);
  const [activeTab, setActiveTab] = useState('browse');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

        const role = USER_ROLES[currentUser.email] || 'user';
        
        const profileData = {
          email: currentUser.email,
          displayName: currentUser.displayName || currentUser.email.split('@')[0],
          photoURL: currentUser.photoURL,
          role: role,
          lastLogin: Date.now()
        };

        try {
          await setDoc(getProfileDoc(currentUser.uid), profileData, { merge: true });
        } catch (e) {
          console.error("Profile sync error:", e);
        }

        setUser(currentUser);
        setProfile(profileData);

        setActiveTab(prev => {
           if (role !== 'user' && (prev === 'browse' || prev === 'my-bookings')) {
             return 'admin-bookings';
           }
           return prev;
        });
      } else {
        setUser(null);
        setProfile(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!user) return;

    const itemsUnsub = onSnapshot(
      itemsCol,
      (snapshot) => {
        const itemsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setItems(itemsData);
      },
      (err) => console.error("Items fetch error:", err)
    );

    const bookingsUnsub = onSnapshot(
      bookingsCol,
      (snapshot) => {
        const bookingsData = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setBookings(bookingsData);
      },
      (err) => console.error("Bookings fetch error:", err)
    );

    return () => {
      itemsUnsub();
      bookingsUnsub();
    };
  }, [user]);

  // 🚀 ป้องกันการกดเข้าสู่ระบบซ้ำ (Disable Dynamic Button)
  const handleGoogleLogin = async () => {
    if (isLoggingIn) return; // หากกำลังทำงานอยู่ จะป้องกันไม่ให้กดย้ำได้

    setIsLoggingIn(true);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ 
      hd: 'ssrw.ac.th',
      prompt: 'select_account'
    });

    try {
      await signInWithPopup(auth, provider);
      showToast('เข้าสู่ระบบสำเร็จ');
    } catch (error) {
      console.warn("Popup sign-in error:", error);
      
      if (
        error.code === 'auth/popup-blocked' || 
        error.code === 'auth/cancelled-popup-request' ||
        error.code === 'auth/popup-closed-by-user' ||
        error.code === 'auth/internal-error'
      ) {
        showToast('กรุณาเปิดลิงก์บนเบราว์เซอร์หลัก (Chrome/Safari) แทนการเปิดในแอป LINE หรือคัดลอกลิงก์ไปเปิดโดยตรง', 'error');
      } else {
        showToast('เกิดข้อผิดพลาดในการเข้าสู่ระบบ', 'error');
      }
    } finally {
      setIsLoggingIn(false); // ปลดล็อกสถานะปุ่มเข้าสู่ระบบเสร็จสิ้น
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
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center border border-gray-100">
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <UserIcon className="text-blue-600" size={40} />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">เข้าสู่ระบบ</h1>
          <p className="text-gray-500 mb-6 text-sm">ระบบขออนุญาตใช้อาคารสถานที่และอุปกรณ์<br/>โรงเรียนศรีสองรักษ์วิทยา</p>
          
          <button 
            onClick={handleGoogleLogin}
            disabled={isLoggingIn}
            className={`w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-3 ${
              isLoggingIn ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {isLoggingIn ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>กำลังเข้าสู่ระบบ...</span>
              </>
            ) : (
              <>
                <Mail size={20} />
                <span>เข้าสู่ระบบด้วย Google Account</span>
              </>
            )}
          </button>
          
          <p className="text-xs text-gray-400 mt-6 text-center">
            *อนุญาตเฉพาะอีเมลบุคลากร <strong>@ssrw.ac.th</strong> เท่านั้น
          </p>
        </div>
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    );
  }

  const hasAdminAccess = profile.role !== 'user';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <header className="bg-white shadow-sm sticky top-0 z-30 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-lg">
                <CalendarIcon className="text-white h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 hidden sm:block">SSRW Booking</h1>
                <p className="text-xs text-gray-500 hidden sm:block">โรงเรียนศรีสองรักษ์วิทยา</p>
              </div>
            </div>

            <nav className="hidden md:flex space-x-1">
              {!hasAdminAccess && (
                <>
                  <NavBtn active={activeTab === 'browse'} onClick={() => setActiveTab('browse')} Icon={Monitor} label="รายการที่ขออนุญาตได้" />
                  <NavBtn active={activeTab === 'calendar'} onClick={() => setActiveTab('calendar')} Icon={CalendarIcon} label="ปฏิทินการใช้งาน" />
                  <NavBtn active={activeTab === 'my-bookings'} onClick={() => setActiveTab('my-bookings')} Icon={Clock} label="ประวัติการขออนุญาตของฉัน" />
                </>
              )}
              {hasAdminAccess && (
                <>
                  <NavBtn active={activeTab === 'admin-bookings'} onClick={() => setActiveTab('admin-bookings')} Icon={CheckSquare} label="จัดการอนุมัติคำขอ" />
                  <NavBtn active={activeTab === 'calendar'} onClick={() => setActiveTab('calendar')} Icon={CalendarIcon} label="ปฏิทินการใช้งาน" />
                  <NavBtn active={activeTab === 'admin-items'} onClick={() => setActiveTab('admin-items')} Icon={MapPin} label="จัดการสถานที่/อุปกรณ์" />
                  <NavBtn active={activeTab === 'admin-reports'} onClick={() => setActiveTab('admin-reports')} Icon={PieChartIcon} label="สรุปการใช้งาน" />
                </>
              )}
            </nav>

            <div className="flex items-center gap-4">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-sm font-semibold text-gray-800">{profile.email}</span>
                <span className="text-xs text-blue-600 font-medium">
                  {profile.role === 'admin' ? 'ผู้ดูแลระบบ' : 
                   profile.role === 'executive' ? 'รองผู้อำนวยการ' : 
                   profile.role === 'head' ? 'หัวหน้าฝ่าย' : 'ผู้ใช้งาน'}
                </span>
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

        {isMobileMenuOpen && (
          <div className="md:hidden bg-white border-t p-2 space-y-1 shadow-lg absolute w-full print:hidden">
             {!hasAdminAccess && (
                <>
                  <MobileNavBtn active={activeTab === 'browse'} onClick={() => {setActiveTab('browse'); setIsMobileMenuOpen(false);}} Icon={Monitor} label="รายการที่ขออนุญาตได้" />
                  <MobileNavBtn active={activeTab === 'calendar'} onClick={() => {setActiveTab('calendar'); setIsMobileMenuOpen(false);}} Icon={CalendarIcon} label="ปฏิทินการใช้งาน" />
                  <MobileNavBtn active={activeTab === 'my-bookings'} onClick={() => {setActiveTab('my-bookings'); setIsMobileMenuOpen(false);}} Icon={Clock} label="ประวัติการขออนุญาตของฉัน" />
                </>
              )}
              {hasAdminAccess && (
                <>
                  <MobileNavBtn active={activeTab === 'admin-bookings'} onClick={() => {setActiveTab('admin-bookings'); setIsMobileMenuOpen(false);}} Icon={CheckSquare} label="จัดการอนุมัติคำขอ" />
                  <MobileNavBtn active={activeTab === 'calendar'} onClick={() => {setActiveTab('calendar'); setIsMobileMenuOpen(false);}} Icon={CalendarIcon} label="ปฏิทินการใช้งาน" />
                  <MobileNavBtn active={activeTab === 'admin-items'} onClick={() => {setActiveTab('admin-items'); setIsMobileMenuOpen(false);}} Icon={MapPin} label="จัดการสถานที่/อุปกรณ์" />
                  <MobileNavBtn active={activeTab === 'admin-reports'} onClick={() => {setActiveTab('admin-reports'); setIsMobileMenuOpen(false);}} Icon={PieChartIcon} label="สรุปการใช้งาน" />
                </>
              )}
          </div>
        )}
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 print:p-0 print:m-0 print:max-w-none">
        {!hasAdminAccess && activeTab === 'browse' && <UserBrowseItems bookings={bookings} items={items} showToast={showToast} user={profile} userId={user.uid} />}
        {!hasAdminAccess && activeTab === 'my-bookings' && <UserBookings bookings={bookings.filter(b => b.userId === user.uid)} />}
        {activeTab === 'calendar' && <CalendarView bookings={bookings} items={items} />}
        
        {hasAdminAccess && activeTab === 'admin-items' && <AdminManageItems items={items} showToast={showToast} />}
        {hasAdminAccess && activeTab === 'admin-bookings' && <AdminManageBookings bookings={bookings} showToast={showToast} userRole={profile.role} />}
        {hasAdminAccess && activeTab === 'admin-reports' && <AdminReports bookings={bookings} items={items} />}
      </main>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}