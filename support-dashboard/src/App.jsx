import React, { useEffect, useState } from "react";
import TicketList from "./TicketList";
import ChatWindow from "./ChatWindow";
import socket from "./socket";
import axios from "axios";

const App = () => {
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);

  const fetchTickets = async () => {
    try {
      const res = await axios.get("https://d727-103-191-187-6.ngrok-free.app/messages", {
        headers: {
          "ngrok-skip-browser-warning": "true",
        },
      });
      if (Array.isArray(res.data)) {
        setTickets(res.data);
      } else {
        console.error("Unexpected response format:", res.data);
        setTickets([]);
      }
    } catch (err) {
      console.error("Failed to fetch tickets:", err);
      setTickets([]);
    }
  };

  useEffect(() => {
    fetchTickets();
    const handleUpdate = (updatedTicket) => {
      setTickets((prev) =>
        prev.map((t) =>
          t.ticketId === updatedTicket.ticketId ? updatedTicket : t
        )
      );
      setSelectedTicket((prev) =>
        prev?.ticketId === updatedTicket.ticketId ? updatedTicket : prev
      );
    };
    socket.on("message-update", handleUpdate);
    return () => socket.off("message-update", handleUpdate);
  }, []);

  return (
    <div style={{ display: "flex", height: "100vh", width: "100vw", margin: 0, padding: 0, overflow: "hidden" }}>
      <TicketList
        tickets={tickets}
        onSelect={setSelectedTicket}
        selectedId={selectedTicket?.ticketId}
      />
      <ChatWindow ticket={selectedTicket} />
    </div>
  );
};

export default App;
