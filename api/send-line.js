export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  // นำ Token จากข้อ 1 มาใส่ในเครื่องหมายคำพูดด้านล่าง
  const token = "wvSqvZmylylzvt+/tdnDuOQYKRSvhG+Rja5QHqAy1Cki5xPEnqxaxkbvVEYsHrDse1hCLUCSa387YSLGKCMjU0PyokJUzQkt2gIj861ceQdELWgfAmFCXEcKQX5U7w4JCeVvrY3ljojKu4phnOee8QdB04t89/1O/w1cDnyilFU="
  const message = req.body.message;

  try {
    const response = await fetch('https://notify-api.line.me/api/notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Bearer ${token}`
      },
      // LINE Notify บังคับให้ส่งข้อมูลรูปแบบ URLSearchParams
      body: new URLSearchParams({ message: message })
    });
    
    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
}