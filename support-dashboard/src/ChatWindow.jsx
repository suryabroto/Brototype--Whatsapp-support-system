import React, { useState, useEffect, useRef } from "react";
import axios from "axios";

const ChatWindow = ({ ticket }) => {
  const [message, setMessage] = useState("");
  const [attachedMedia, setAttachedMedia] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef(null);
  const chatEndRef = useRef();

  const NGROK_DOMAIN = "https://d727-103-191-187-6.ngrok-free.app";

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [ticket]);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Only allow images/videos
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      alert("Only image and video files are supported.");
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("file", file);

      const res = await axios.post(`${NGROK_DOMAIN}/upload`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          "ngrok-skip-browser-warning": "true",
        },
      });

      setAttachedMedia({
        url: res.data.url,
        type: res.data.type,
        name: file.name,
      });
    } catch (err) {
      console.error("Upload error:", err);
      alert("Failed to upload file.");
    } finally {
      setUploading(false);
    }
  };

  const removeAttachedMedia = () => setAttachedMedia(null);

  const sendReply = async () => {
    if (!ticket) return alert("Please select a ticket.");
    if (!message.trim() && !attachedMedia) return alert("Please enter a message or attach media.");

    try {
      setSending(true);
      
      // Prepare the payload
      const payload = {
        ticketId: ticket.ticketId,
        message: message.trim(),
        media: attachedMedia ? {
          url: attachedMedia.url,
          type: attachedMedia.type,
        } : null,
      };
      
      // Log what's being sent to help with debugging
      console.log("📤 Sending payload:", payload);

      const resp = await axios.post(`${NGROK_DOMAIN}/send-message`, payload, {
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        timeout: 10000 // 10 second timeout
      });

      console.log("✅ sendReply response:", resp.data);
      setMessage("");
      removeAttachedMedia();
    } catch (err) {
      console.error("❌ Error sending message:", err);
      
      if (err.response) {
        console.error("Server response error:", err.response.data);
        alert(`Failed to send message: ${err.response.data?.error || err.response.statusText}`);
      } else if (err.request) {
        console.error("No response received:", err.request);
        alert("No response from server. Check your connection and try again.");
      } else {
        console.error("Request setup error:", err.message);
        alert(`Error preparing request: ${err.message}`);
      }
    } finally {
      setSending(false);
    }
  };

  const combined = [
    ...(ticket?.messages || []).map((m) => ({ ...m, from: "user" })),
    ...(ticket?.replies || []).map((r) => ({ ...r, from: "agent" })),
  ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  const renderMedia = (media) => {
    if (!media || !Array.isArray(media)) return null;
    return media.map((item, i) => {
      if (!item?.url || !item?.type) return null;

      if (item.type.startsWith("image/")) {
        return <img key={i} src={item.url} alt="media" style={{ maxWidth: "100%", marginTop: 8, borderRadius: "8px" }} />;
      } else if (item.type.startsWith("video/")) {
        return <video key={i} src={item.url} controls style={{ maxWidth: "100%", marginTop: 8, borderRadius: "8px" }} />;
      } else {
        return (
          <a key={i} href={item.url} target="_blank" rel="noopener noreferrer" style={{ color: "#00a884", display: "block", marginTop: 8 }}>
            📎 Open Attachment
          </a>
        );
      }
    });
  };

  if (!ticket) {
    return (
      <div style={{ flex: 1, background: "#111b21", display: "flex", alignItems: "center", justifyContent: "center", color: "#8696a0" }}>
        <h3>Select a ticket to view the conversation</h3>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", backgroundColor: "#111b21", height: "100vh" }}>
      <div style={{ background: "#202c33", color: "#e9edef", padding: "15px 20px", fontWeight: "bold", borderLeft: "1px solid #2b3a42" }}>
        <div>Chat with: {ticket.profileName || "User"}</div>
        <div>Number: {ticket.sender}</div>
      </div>

      <div style={{
        flex: 1,
        padding: "20px",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        backgroundImage: "url('https://i.pinimg.com/736x/2e/35/2a/2e352a34f29bd02eadca4b5d39136fd9.jpg')",
        backgroundRepeat: "repeat",
        backgroundSize: "contain",
      }}>
        {combined.map((msg, i) => (
          <div key={i} style={{ display: "flex", justifyContent: msg.from === "agent" ? "flex-end" : "flex-start", marginBottom: "10px" }}>
            <div style={{
              background: msg.from === "agent" ? "#005c4b" : "#202c33",
              color: "#e9edef",
              padding: "10px 15px",
              borderRadius: "10px",
              maxWidth: "60%",
              fontSize: "14px",
              lineHeight: "1.4",
              wordBreak: "break-word",
            }}>
              {msg.text}
              {renderMedia(msg.media || [])}
              <div style={{ fontSize: "11px", marginTop: "5px", textAlign: "right", color: "#aebac1" }}>
                {new Date(msg.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      <div style={{ padding: "15px 20px", background: "#202c33", display: "flex", alignItems: "center" }}>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              sendReply();
            }
          }}
          placeholder="Type a message..."
          style={{ flex: 1, background: "#2a3942", border: "none", borderRadius: "25px", padding: "10px 15px", color: "#e9edef", outline: "none" }}
        />
        <input type="file" ref={fileInputRef} style={{ display: "none" }} onChange={handleFileChange} />
        <button
          onClick={() => fileInputRef.current.click()}
          style={{ marginLeft: "10px", background: "#007bff", border: "none", borderRadius: "25px", padding: "10px 15px", color: "white", fontWeight: "bold", cursor: "pointer" }}
          disabled={uploading || sending}
        >
          {uploading ? "Uploading..." : "Attach"}
        </button>
        <button
          onClick={sendReply}
          style={{ marginLeft: "10px", background: "#00a884", border: "none", borderRadius: "25px", padding: "10px 20px", color: "white", fontWeight: "bold", cursor: "pointer" }}
          disabled={sending}
        >
          {sending ? "Sending..." : "Send"}
        </button>
      </div>

      {attachedMedia && (
        <div style={{ padding: "10px 20px", background: "#202c33", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span>Attached: {attachedMedia.name}</span>
          <button onClick={removeAttachedMedia} style={{ background: "transparent", border: "none", color: "#ff4d4f", cursor: "pointer" }}>
            Remove
          </button>
        </div>
      )}
    </div>
  );
};

export default ChatWindow;