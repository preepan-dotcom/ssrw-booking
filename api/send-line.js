export default async function handler(req, res) {
  // รับเฉพาะ Method POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { message } = req.body;
  
  // ดึงค่า Token จาก Environment Variables ของ Vercel (ดึงรหัส wvSqvZmylylz... มาใช้อัตโนมัติ)
  const LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

  if (!LINE_TOKEN) {
    return res.status(500).json({ error: 'LINE_CHANNEL_ACCESS_TOKEN is missing in Vercel environment' });
  }

  try {
    // เปลี่ยนไปยิง Messaging API (Broadcast) ของ LINE Official Account
    const response = await fetch('https://api.line.me/v2/bot/message/broadcast', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LINE_TOKEN}`
      },
      body: JSON.stringify({
        messages: [
          { 
            type: 'text', 
            text: message || 'มีการอัปเดตสถานะในระบบ SSRW Booking' 
          }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('LINE Messaging API Error:', errorData);
      throw new Error(`LINE API Error: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('LINE API Exception:', error);
    return res.status(500).json({ error: error.message });
  }
}