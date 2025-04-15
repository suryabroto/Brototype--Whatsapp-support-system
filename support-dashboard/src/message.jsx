import React, { useState } from "react";
import axios from "axios";

const Message = ({ msg, onReplySent }) => {
  const [reply, setReply] = useState("");

  const sendReply = () => {
    if (!reply.trim()) return alert("Please enter a reply!");
    axios.post(
      "https://d727-103-191-187-6.ngrok-free.app/send-message",
      {
        ticketId: msg.ticketId,
        message: reply,
      },
      {
        headers: {
          "ngrok-skip-browser-warning": "true",
        },
      }
    )
    .then(() => {
      alert("✅ Reply sent!");
      setReply("");
      if (onReplySent) onReplySent();
    })
    .catch(error => console.error("❌ Error sending reply:", error));
  };

  return (
    <div style={{
      backgroundColor: "#2b2b2b",
      borderRadius: "8px",
      padding: "20px",
      marginBottom: "20px",
      boxShadow: "0 0 10px rgba(0,0,0,0.3)"
    }}>
      <p style={{ marginBottom: "10px" }}>
        <span role="img" aria-label="user">👤</span> <strong>From:</strong> {msg.sender}
      </p>

      <p style={{ margin: "10px 0", fontWeight: "bold" }}>📨 Messages:</p>

      <div style={{ maxHeight: "200px", overflowY: "auto", marginBottom: "15px" }}>
        {msg.messages.length > 0 ? (
          msg.messages.map((m, i) => (
            <div key={i} style={{
              backgroundColor: "#3a3a3a",
              padding: "10px",
              marginBottom: "8px",
              borderRadius: "5px"
            }}>
              <p style={{ margin: 0 }}>{m.text}</p>
              <small style={{ color: "#ccc" }}>{new Date(m.timestamp).toLocaleString()}</small>
            </div>
          ))
        ) : (
          <p>No messages yet.</p>
        )}
      </div>

      <div style={{ display: "flex", gap: "10px" }}>
        <input
          type="text"
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Type your reply..."
          style={{
            flex: 1,
            padding: "10px",
            borderRadius: "4px",
            border: "1px solid #555",
            backgroundColor: "#1e1e1e",
            color: "#fff"
          }}
        />
        <button onClick={sendReply} style={{
          padding: "10px 15px",
          border: "none",
          borderRadius: "4px",
          backgroundColor: "#4caf50",
          color: "#fff",
          cursor: "pointer"
        }}>
          Send
        </button>
      </div>
    </div>
  );
};

export default Message;
