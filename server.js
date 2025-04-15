require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const twilio = require("twilio");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const axios = require("axios");

const app = express();
const server = http.createServer(app);

// ---------- Middleware ----------
app.use(cors({
  origin: ['http://localhost:5173'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const io = new Server(server, {
  cors: {
    origin: ['http://localhost:5173'],
    methods: ['GET', 'POST'],
  },
});

const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

app.use("/uploads", express.static(uploadDir, {
  setHeaders: (res) => {
    res.set("Access-Control-Allow-Origin", "*");
  }
}));

// ---------- MongoDB Connection ----------
mongoose.connect("mongodb://127.0.0.1:27017/whatsapp_tickets")
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB Connection Error:", err));

// ---------- Mongoose Schema (Correct & Fresh) ----------
const ticketSchema = new mongoose.Schema({
  ticketId: { type: String, unique: true },
  sender: String,
  profileName: String,
  messages: [
    {
      text: String,
      media: [{ url: String, type: String }],
      timestamp: { type: Date, default: Date.now },
    },
  ],
  status: { type: String, default: "open" },
  replies: [
    {
      text: String,
      media: [{ url: String, type: String }],
      timestamp: { type: Date, default: Date.now },
    },
  ],
});

// ✅ Prevent Mongoose model caching issue
if (mongoose.models.Ticket) {
  delete mongoose.connection.models.Ticket;
}

const Ticket = mongoose.model("Ticket", ticketSchema);

// ---------- File Upload ----------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/\s+/g, "_");
    const uniqueSuffix = Date.now();
    cb(null, `${base}-${uniqueSuffix}${ext}`);
  },
});
const upload = multer({ storage });

// ---------- Twilio Setup ----------
const NGROK_DOMAIN = process.env.NGROK_DOMAIN || "https://d727-103-191-187-6.ngrok-free.app";
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioNumber = `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`;

// Verify Twilio credentials are present
if (!accountSid || !authToken || !process.env.TWILIO_PHONE_NUMBER) {
  console.warn("⚠️ WARNING: Missing Twilio credentials in environment variables!");
  console.warn("Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in your .env file");
}

console.log("🔧 Config:", {
  ngrokDomain: NGROK_DOMAIN,
  twilioNumber: twilioNumber.replace(/^\w+:/, ""), // Log without the prefix for privacy
  dbConnection: "mongodb://127.0.0.1:27017/whatsapp_tickets",
});

// Initialize Twilio client if credentials are available
let twilioClient;
try {
  twilioClient = new twilio(accountSid, authToken);
  console.log("✅ Twilio client initialized");
} catch (err) {
  console.error("❌ Failed to initialize Twilio client:", err.message);
}

// ---------- Routes ----------

app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  const fileUrl = `${NGROK_DOMAIN}/uploads/${req.file.filename}`;
  res.json({ url: fileUrl, type: req.file.mimetype });
});

app.post("/webhook", async (req, res) => {
  try {
    const sender = req.body.WaId || req.body.From?.replace("whatsapp:+", "");
    const profileName = req.body.ProfileName || "WhatsApp User";
    const text = req.body.Body || "";
    const numMedia = parseInt(req.body.NumMedia || "0");

    if (!sender) return res.status(400).send("Missing sender");

    const inboundMedia = [];
    for (let i = 0; i < numMedia; i++) {
      const mediaUrl = req.body[`MediaUrl${i}`];
      const mediaType = req.body[`MediaContentType${i}`];
      if (mediaUrl && mediaType) {
        const ext = mediaType.split("/")[1] || "dat";
        const filename = `inbound-${Date.now()}-${i}.${ext}`;
        const localPath = path.join(uploadDir, filename);

        const response = await axios({
          method: "GET",
          url: mediaUrl,
          responseType: "arraybuffer",
          auth: { username: accountSid, password: authToken },
        });

        fs.writeFileSync(localPath, response.data);
        const publicUrl = `${NGROK_DOMAIN}/uploads/${filename}`;
        inboundMedia.push({ url: publicUrl, type: mediaType });
      }
    }

    let ticket = await Ticket.findOne({ sender, status: "open" });
    if (!ticket) {
      const ticketId = `TICKET-${Date.now()}`;
      ticket = new Ticket({
        ticketId,
        sender,
        profileName,
        messages: [{ text, media: inboundMedia }],
      });
      await ticket.save();

      if (twilioClient) {
        try {
          await twilioClient.messages.create({
            from: twilioNumber,
            to: `whatsapp:+${sender}`,
            body: `✅ Your support ticket (${ticketId}) has been created.`,
          });
        } catch (twilioErr) {
          console.error("❌ Twilio error in webhook:", twilioErr.message);
        }
      }
    } else {
      if (!ticket.profileName || ticket.profileName === "WhatsApp User") {
        ticket.profileName = profileName;
      }
      ticket.messages.push({ text, media: inboundMedia });
      await ticket.save();
    }

    io.emit("message-update", ticket);
    res.status(200).send("Received");
  } catch (err) {
    console.error("❌ Error in /webhook:", err);
    res.status(500).send("Internal error");
  }
});

app.post("/send-message", async (req, res) => {
  try {
    console.log("📩 Received /send-message request:", req.body);
    const { ticketId, message, media } = req.body;
    
    if (!ticketId) {
      return res.status(400).json({ error: "ticketId is required" });
    }
    
    const ticket = await Ticket.findOne({ ticketId });
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    const sendPayload = {
      from: twilioNumber,
      to: `whatsapp:+${ticket.sender}`,
    };

    // Validate message or media exists
    if (!message?.trim() && (!media || !media.url)) {
      return res.status(400).json({ error: "Message or media is required" });
    }

    if (media?.url && media?.type) {
      // Validate media URL
      if (!media.url.startsWith("https://")) {
        return res.status(400).json({ error: "Media URL must be HTTPS." });
      }
      
      // Validate media format
      if (!/\.(jpg|jpeg|png|gif|mp4|pdf)$/i.test(media.url)) {
        return res.status(400).json({ error: "Invalid media format." });
      }

      sendPayload.mediaUrl = [media.url];
      sendPayload.body = message || "";
    } else if (message?.trim()) {
      sendPayload.body = message.trim();
    }

    // Log what we're sending to Twilio
    console.log("📤 Sending to Twilio:", { 
      to: sendPayload.to,
      hasMedia: !!sendPayload.mediaUrl,
      messageLength: sendPayload.body?.length || 0
    });

    // Only try to send via Twilio if we have the client
    let twilioResp;
    if (twilioClient) {
      try {
        twilioResp = await twilioClient.messages.create(sendPayload);
        console.log("✅ Twilio SID:", twilioResp.sid);
      } catch (twilioErr) {
        console.error("❌ Twilio error:", twilioErr.message);
        // Don't return here - we still want to save the message to our database
      }
    } else {
      console.warn("⚠️ Twilio client not available, skipping actual message send");
    }

    // Always save the reply to our database
    ticket.replies.push({
      text: message || "",
      media: media ? [{ url: media.url, type: media.type }] : [],
    });
    await ticket.save();

    // Notify connected clients
    io.emit("message-update", ticket);
    
    res.status(200).json({ 
      success: true,
      twilioSid: twilioResp?.sid,
      ticketId: ticket.ticketId
    });
  } catch (err) {
    console.error("❌ Error in /send-message:", err);
    res.status(500).json({
      error: "Failed to send message",
      details: err.message,
    });
  }
});

app.get("/messages", async (req, res) => {
  try {
    const { status } = req.query;
    const filter = status ? { status } : {};
    const tickets = await Ticket.find(filter).sort({ "messages.timestamp": -1 });
    res.json(tickets);
  } catch (err) {
    console.error("❌ Error in /messages:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    server: "WhatsApp Tickets API",
    timestamp: new Date().toISOString(),
    domain: NGROK_DOMAIN
  });
});

server.listen(process.env.PORT || 3000, () => {
  console.log("🚀 Server running on port", process.env.PORT || 3000);
});