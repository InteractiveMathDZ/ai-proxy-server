import { google } from 'googleapis';

// إعداد عميل Google API باستخدام متغيرات البيئة التي حفظناها
const oauth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  'http://localhost:3000'
);

oauth2Client.setCredentials({
  refresh_token: process.env.GMAIL_REFRESH_TOKEN,
});

const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const pubSubMessage = req.body.message;
      
      if (!pubSubMessage || !pubSubMessage.data) {
        return res.status(400).json({ error: 'Invalid Pub/Sub message format' });
      }

      // 1. فك تشفير بيانات الإشعار القادمة من Base64
      const decodedData = JSON.parse(
        Buffer.from(pubSubMessage.data, 'base64').toString('utf8')
      );
      
      const emailAddress = decodedData.emailAddress;
      const historyId = decodedData.historyId;
      
      console.log(`استلام إشعار للبريد: ${emailAddress} بـ historyId: ${historyId}`);

      // 2. البحث عن الرسائل الجديدة غير المقروءة في صندوق الوارد (أو التي لم يُرد عليها)
      // نبحث عن الرسائل التي تحمل علامة UNREAD في الـ INBOX
      const listResponse = await gmail.users.messages.list({
        userId: 'me',
        q: 'is:unread in:inbox',
        maxResults: 5 // لمعالجة الدفعات الجديدة أولاً بأول
      });

      const messages = listResponse.data.messages || [];

      if (messages.length === 0) {
        console.log('لا توجد رسائل جديدة غير مقروءة للمعالجة.');
        return res.status(200).json({ status: 'success', processed: 0 });
      }

      // 3. الحلقة (Loop) لكل رسالة جديدة وغير مردود عليها
      for (const msgSummary of messages) {
        const messageId = msgSummary.id;

        // جلب تفاصيل الرسالة الفعلية (الموضوع، المرسل، والمحتوى)
        const msgDetail = await gmail.users.messages.get({
          userId: 'me',
          id: messageId,
          format: 'full',
        });

        const headers = msgDetail.data.payload.headers;
        const subjectHeader = headers.find(h => h.name.toLowerCase() === 'subject');
        const fromHeader = headers.find(h => h.name.toLowerCase() === 'from');
        
        const subject = subjectHeader ? subjectHeader.value : 'بدون موضوع';
        const sender = fromHeader ? fromHeader.value : '';

        // استخراج النص الأساسي للرسالة
        let emailBody = '';
        const payload = msgDetail.data.payload;
        if (payload.body && payload.body.data) {
          emailBody = Buffer.from(payload.body.data, 'base64').toString('utf8');
        } else if (payload.parts) {
          // البحث في أجزاء الرسالة النصية البسيطة
          const part = payload.parts.find(p => p.mimeType === 'text/plain');
          if (part && part.body && part.body.data) {
            emailBody = Buffer.from(part.body.data, 'base64').toString('utf8');
          }
        }

        console.log(`معالجة رسالة من: ${sender} | الموضوع: ${subject}`);

        // 4. استدعاء نموذج Gemini لتحضير الرد الذكي
        // (يمكنك استخدام واجهة Google GenAI SDK أو طلب HTTP مباشر لـ gemini-2.5-flash أو gemini-3.5-flash حسب المتاح في مشروعك)
        const geminiReply = await generateGeminiResponse(subject, emailBody);

        // 5. إرسال الرد عبر Gmail API (Reply)
        // استخراج البريد الإلكتروني الفعلي للمرسل من صيغة "Name <email@domain.com>"
        const senderEmailMatch = sender.match(/<(.+)>/);
        const recipientEmail = senderEmailMatch ? senderEmailMatch[1] : sender;

        await gmail.users.messages.send({
          userId: 'me',
          requestBody: {
            raw: createEmailRaw({
              to: recipientEmail,
              subject: `Re: ${subject}`,
              body: geminiReply,
              threadId: msgDetail.data.threadId
            })
          }
        });

        console.تم(`تم إرسال الرد بنجاح إلى: ${recipientEmail}`);

        // 6. تغيير حالة البريد إلى "تم الرد عليه" (إزالة علامة UNREAD وأرشفته أو تغيير ليفل)
        await gmail.users.messages.batchModify({
          userId: 'me',
          requestBody: {
            ids: [messageId],
            removeLabelIds: ['UNREAD', 'INBOX'] // إزالة علامة غير مقروء والأرشفة لنقلها من الوارد
          }
        });
      }

      // الرد بـ 200 OK لـ Google Pub/Sub لتأكيد الاستلام والمعالجة
      return res.status(200).json({ status: 'success', processed: messages.length });

    } catch (error) {
      console.error("خطأ في معالجة الـ Webhook وتوليد الرد:", error);
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'GET') {
    return res.status(200).json({ message: 'Webhook endpoint is active.' });
  }

  res.setHeader('Allow', ['POST', 'GET']);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}

// دالة مساعدة لتوليد الرد باستخدام نموذج Gemini (استبدل مفتاح الـ API أو الطريقة بما يناسب مشروعك)
async function generateGeminiResponse(subject, body) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return `مرحباً، شكراً لتواصلك. لقد تلقينا رسالتك بخصوص: "${subject}" وسيتم الرد عليك قريباً.`;
  }

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `أنت مساعد ذكي ومحترف للرد على رسائل البريد الإلكتروني. اكتب رداً احترافياً وموجزاً باللغة التي كتبت بها الرسالة التالية:\n\nالموضوع: ${subject}\nالمحتوى: ${body}`
          }]
        }]
      })
    });

    const data = await response.json();
    if (data.candidates && data.candidates[0].content.parts[0].text) {
      return data.candidates[0].content.parts[0].text;
    }
  } catch (e) {
    console.error("خطأ في الاتصال بـ Gemini:", e);
  }

  return `مرحباً، شكراً لرسالتك حول "${subject}". تم استلام طلبك وجاري مراجعته.`;
}

// دالة مساعدة لتنسيق رسالة البريد وتجنب تشوه الحروف العربية في العنوان والمحتوى
function createEmailRaw({ to, subject, body, threadId }) {
  // ترميز الموضوع بصيغة MIME للغة العربية (UTF-8)
  const encodedSubject = `=?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`;

  const emailLines = [
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    '',
    body
  ];
  
  const email = emailLines.join('\r\n');
  return Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

