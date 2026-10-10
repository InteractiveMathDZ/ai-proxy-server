export default async function handler(req, res) {
  // التأكد من أن الطلب من نوع POST (الذي يرسله Google Pub/Sub)
  if (req.method === 'POST') {
    try {
      const message = req.body;
      
      // سنقوم بتطوير المنطق هنا لاحقاً لمعالجة إشعار Gmail وتفعيل Gemini
      console.log("تم استلام إشعار Pub/Sub بنجاح:", JSON.stringify(message, null, 2));

      // يجب الرد بـ 200 OK حتى لا يعيد Pub/Sub إرسال الرسالة
      return res.status(200).json({ status: 'success' });
    } catch (error) {
      console.error("خطأ في معالجة الـ Webhook:", error);
      return res.status(500).json({ error: error.message });
    }
  }

  // الرد على طلبات GET للتأكد من أن الرابط يعمل
  if (req.method === 'GET') {
    return res.status(200).json({ message: 'Webhook endpoint is active.' });
  }

  // رفض أي طريقة أخرى (PUT, DELETE, etc.)
  res.setHeader('Allow', ['POST', 'GET']);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}
