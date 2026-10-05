export default async function handler(req, res) {
  // السماح بالاستدعاء من أي موقع ملكك (أو اجعلها '*' للسماح للجميع)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, systemPrompt } = req.body;
    const apiKey = process.env.GEMINI_API_KEY; // المفتاح المخفي بأمان في Vercel

    if (!apiKey) {
      return res.status(500).json({ error: 'API key not configured on server' });
    }

    // بناء الطلب الموجه لـ Gemini API مع دعم لتغيير شخصية البوت حسب المشروع المرسل
    const defaultPrompt = "أنت مساعد ذكي وموثوق. أجب بدقة بناءً على الطلب.";
    const currentPrompt = systemPrompt || defaultPrompt;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: `${currentPrompt}\n\nسؤال المستخدم: ${message}` }
            ]
          }
        ]
      })
    });

    const data = await response.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'عذراً، لم أتمكن من معالجة الطلب.';
    
    return res.status(200).json({ reply });

  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}
