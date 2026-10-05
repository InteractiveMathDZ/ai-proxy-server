export default async function handler(req, res) {
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
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'API key not configured on server' });
    }

    const defaultPrompt = "أنت مساعد ذكي وموثوق. أجب بدقة بناءً على الطلب.";
    const currentPrompt = systemPrompt || defaultPrompt;

    // بناء الطلب بالطريقة القياسية الحديثة مع دعم system_instruction
    const apiRequestBody = {
      system_instruction: {
        parts: [{ text: currentPrompt }]
      },
      contents: [
        {
          parts: [{ text: message }]
        }
      ]
    };

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(apiRequestBody)
    });

    const data = await response.json();

    // فحص ما إذا كان هناك خطأ راجع من واجهة برمجة التطبيقات نفسه
    if (data.error) {
      console.error("API Error:", data.error);
      return res.status(500).json({ error: data.error.message || 'Gemini API Error' });
    }

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!reply) {
      // طباعة الـ data في الـ console لمعرفة سبب عدم وجود نص (مثل الحجب الأمني)
      console.log("Full Response without text:", JSON.stringify(data));
      return res.status(500).json({ error: 'تم حجب الرد بواسطة فلاتر الأمان أو أن الاستجابة فارغة.' });
    }
    
    return res.status(200).json({ reply });

  } catch (error) {
    console.error("Server Catch Error:", error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
