export default async function handler(req, res) {
  // รับเฉพาะ Method POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { message } = req.body;
  
  // ดึงค่า Token จาก Environment Variables ของ Vercel เพียงตัวเดียว
  const LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

  try {
    // เปลี่ยน endpoint จาก push เป็น broadcast
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
            text: message 
          }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`LINE API Error: ${JSON.stringify(errorData)}`);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('LINE API Error:', error);
    res.status(500).json({ error: error.message });
  }
}