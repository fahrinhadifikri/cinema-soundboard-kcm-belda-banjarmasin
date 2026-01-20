// api/trigger.js
import Pusher from "pusher";

const pusher = new Pusher({
  appId: "2104227",
  key: "0396bd8cd1f0bbf91a96",
  secret: "3fe5d4b7483c54fbd5f8",
  cluster: "ap1",
  useTLS: true,
});

export default async function handler(req, res) {
  // Tambahkan Header CORS agar Tampermonkey bisa akses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    const { studio, type } = req.body;
    await pusher.trigger("cinema-channel", "trigger-audio", { studio, type });
    return res.status(200).json({ status: "Sent" });
  }

  return res.status(405).json({ message: "Method not allowed" });
}