import { useState } from "react";
import axios from "axios";
import "./App.css";

function App() {
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState([]);
  const [document, setDocument] = useState(null);
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!message && !document && !image) return;

    setLoading(true);

    const formData = new FormData();

    formData.append("message", message);

    if (document) {
      formData.append("document", document);
    }

    if (image) {
      formData.append("image", image);
    }

    try {
      const res = await axios.post(
        "http://localhost:3000/chat",
        formData
      );

      setChat((prev) => [
        ...prev,
        { role: "user", text: message },
        { role: "bot", text: res.data.response },
      ]);

      setMessage("");
      setDocument(null);
      setImage(null);

    } catch (error) {
      console.log(error);
    }

    setLoading(false);
  };

  const newChat = async () => {
await axios.post("http://localhost:3000/reset");
    setChat([]);
    setDocument(null);
    setImage(null);
  };

  return (
    <div className="container">
      <h1>Gemini Chatbot</h1>

      <div className="chat-box">
        {chat.map((msg, index) => (
          <div
            key={index}
            className={msg.role === "user" ? "user" : "bot"}
          >
            <b>{msg.role}:</b> {msg.text}
          </div>
        ))}

        {loading && <p>Loading...</p>}
      </div>

      <textarea
        placeholder="Type message..."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />

      <input
        type="file"
        accept=".pdf,.txt"
        onChange={(e) => setDocument(e.target.files[0])}
      />

      <input
        type="file"
        accept="image/png,image/jpeg"
        onChange={(e) => setImage(e.target.files[0])}
      />

      <div className="buttons">
        <button onClick={sendMessage}>
          Send
        </button>

        <button onClick={newChat}>
          New Chat
        </button>
      </div>
    </div>
  );
}

export default App;