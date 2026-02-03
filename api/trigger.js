// File: api/trigger.js
import Pusher from 'pusher';

// 1. KONFIGURASI PUSHER (Sesuai data yang kamu kirim)
const pusher = new Pusher({
  appId: "2106350",
  key: "fe598cf7eb50135b39dd",
  secret: "a049fc6c1197cfc00216",
  cluster: "ap1",
  useTLS: true
});

export default async function handler(req, res) {
  // 2. SETUP CORS (Agar Localhost Barco bisa kirim data kesini)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*'); // Boleh diakses dari semua IP
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle preflight request (Browser checking)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Hanya terima method POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { studio, type, time } = req.body;

  try {
    console.log(`[TRIGGER] Studio: ${studio} | Type: ${type} | Time: ${time}`);

    // 3. KIRIM SINYAL KE PUSHER
    // Channel: 'cinema-channel'
    // Event: 'trigger-audio'
    await pusher.trigger("cinema-channel", "trigger-audio", {
      studio: studio,
      type: type,
      time: time
    });

    return res.status(200).json({ status: 'Sent', studio, time });
  } catch (error) {
    console.error("Pusher Error:", error);
    return res.status(500).json({ error: 'Failed to trigger pusher' });
  }
}