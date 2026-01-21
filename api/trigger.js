// api/trigger.js
import Pusher from "pusher";

export default async function handler(req, res) {
    // Header CORS agar tidak diblokir browser Barco
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method === 'POST') {
        try {
            const pusher = new Pusher({
                appId: "2104227",
                key: "0396bd8cd1f0bbf91a96",
                secret: "3fe5d4b7483c54fbd5f8",
                cluster: "ap1",
                useTLS: true,
            });

            const { studio, type } = req.body;
            
            // Validasi data
            if (!studio || !type) {
                return res.status(400).json({ error: "Data studio/type kosong" });
            }

            await pusher.trigger("cinema-channel", "trigger-audio", { studio, type });
            return res.status(200).json({ status: "Sent" });
        } catch (error) {
            console.error("Pusher Error:", error);
            return res.status(500).json({ error: error.message });
        }
    }

    return res.status(405).json({ message: "Method not allowed" });
}