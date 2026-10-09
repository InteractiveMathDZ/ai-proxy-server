import { GoogleGenAI } from "@google/genai"; // أو الطريقة التي تستخدمها حالياً لاستدعاء النموذج

export default async function handler(req, res) {
  // التأكد من أن الطلب من نوع POST (حسب مزود خدمة البريد أو Webhook)
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // استقبال محتوى البريد الوارد من الـ Webhook أو الطلب القادم
    const { sender, subject, body } = req.body;

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const prompt = `أنت مساعد ذكي تقرأ البريد الوارد وتكتب رداً احترافياً ومناسباً باللغة العربية.
    - المرسل: ${sender}
    - الموضوع: ${subject}
    - محتوى الرسالة: ${body}
    
    اكتب رداً موجزاً واحترافياً:`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash', // أو gemini-3.5-flash حسب المتاح في مشروعكم
      contents: prompt,
    });

    const replyText = response.text;

    return res.status(200).json({ 
      success: true, 
      reply: replyText 
    });

  } catch (error) {
    console.error('Error processing email:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
