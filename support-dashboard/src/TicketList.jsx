import React from "react";

const TicketList = ({ tickets, onSelect, selectedId }) => {
  return (
    <div
      style={{
        width: "350px",
        background: "#202c33",
        color: "#e9edef",
        height: "100vh",
        overflowY: "auto",
        borderRight: "1px solid #2b3a42",
      }}
    >
      <div style={{ padding: "20px", fontWeight: "bold", fontSize: "18px" }}>
        📋 Tickets
      </div>

      {Array.isArray(tickets) && tickets.map((ticket) => (
        <div
          key={ticket.ticketId}
          onClick={() => onSelect(ticket)}
          style={{
            padding: "15px 20px",
            borderBottom: "1px solid #2b3a42",
            background:
              selectedId === ticket.ticketId ? "#2a3942" : "transparent",
            cursor: "pointer",
            transition: "background 0.3s",
          }}
        >
          <div style={{ fontWeight: "bold", fontSize: "15px", marginBottom: "4px" }}>
            {ticket.sender}
          </div>
          <div style={{ fontSize: "12px", color: "#8696a0" }}>
            {ticket.ticketId}
          </div>
        </div>
      ))}
    </div>
  );
};

export default TicketList;
