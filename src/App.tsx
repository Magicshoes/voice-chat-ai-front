import React, { useState, useEffect } from 'react';
import './App.css';
import VoiceButton from './components/VoiceButton';
import ChatMessage from './components/ChatMessage';

interface Message {
  text: string;
  isUser: boolean;
}

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedModel, setSelectedModel] = useState('gpt-3.5-turbo');

  const handleSpeechResult = async (text: string) => {
    // Add user message
    setMessages(prev => [...prev, { text, isUser: true }]);

    try {
      const response = await fetch('http://localhost:8080/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: text,
          model: selectedModel,
        }),
      });

      const data = await response.json();
      
      // Add AI response
      setMessages(prev => [...prev, { text: data.message, isUser: false }]);
      
      // Play the response using TTS
      const speech = new SpeechSynthesisUtterance(data.message);
      window.speechSynthesis.speak(speech);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handlePlayMessage = (message: string) => {
    const speech = new SpeechSynthesisUtterance(message);
    window.speechSynthesis.speak(speech);
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>AI Voice Chat</h1>
        <select 
          value={selectedModel} 
          onChange={(e) => setSelectedModel(e.target.value)}
          className="model-selector"
        >
          <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
          <option value="gpt-4">GPT-4</option>
        </select>
      </header>
      
      <main className="chat-container">
        <div className="messages-container" data-testid="messages-container">
          {messages.slice().reverse().map((message, index) => (
            <ChatMessage
              key={index}
              message={message.text}
              isUser={message.isUser}
              onPlay={!message.isUser ? () => handlePlayMessage(message.text) : undefined}
            />
          ))}
        </div>
        
        <div className="input-container">
          <VoiceButton onSpeechResult={handleSpeechResult} />
        </div>
      </main>
    </div>
  );
}

export default App;
