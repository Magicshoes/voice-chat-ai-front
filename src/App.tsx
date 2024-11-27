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
    const newMessage = { text, isUser: true };
    setMessages(prev => [...prev, newMessage]);

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

      if (!response.ok) {
        throw new Error('API request failed');
      }

      const data = await response.json();
      
      // Add AI response
      const aiMessage = { text: data.message, isUser: false };
      setMessages(prev => [...prev, aiMessage]);
      
      // Enhanced TTS setup
      const speech = new SpeechSynthesisUtterance(data.message);
      
      // Get available voices
      const voices = window.speechSynthesis.getVoices();
      
      // Select a high-quality English voice
      const preferredVoice = voices.find(voice => 
        voice.lang.startsWith('en') && 
        (voice.name.includes('Enhanced') || 
         voice.name.includes('Premium') || 
         voice.name.includes('Neural') ||
         voice.name.includes('Daniel') ||  // MacOS enhanced voice
         voice.name.includes('Samantha'))  // MacOS enhanced voice
      ) || voices.find(voice => voice.lang.startsWith('en')); // Fallback to any English voice
      
      if (preferredVoice) {
        speech.voice = preferredVoice;
      }
      
      // Optimize speech parameters
      speech.rate = 1.0;      // Normal speed
      speech.pitch = 1.0;     // Normal pitch
      speech.volume = 1.0;    // Full volume
      
      // Add event handlers for better control
      speech.onstart = () => {
        console.log('Speech started');
      };
      
      speech.onerror = (event) => {
        console.error('Speech error:', event);
      };
      
      speech.onend = () => {
        console.log('Speech ended');
      };
      
      // Ensure voices are loaded
      if (window.speechSynthesis.getVoices().length === 0) {
        window.speechSynthesis.onvoiceschanged = () => {
          const updatedVoices = window.speechSynthesis.getVoices();
          const updatedPreferredVoice = updatedVoices.find(voice => 
            voice.lang.startsWith('en') && 
            (voice.name.includes('Enhanced') || 
             voice.name.includes('Premium') || 
             voice.name.includes('Neural') ||
             voice.name.includes('Daniel') ||
             voice.name.includes('Samantha'))
          ) || updatedVoices.find(voice => voice.lang.startsWith('en'));
          
          if (updatedPreferredVoice) {
            speech.voice = updatedPreferredVoice;
          }
          window.speechSynthesis.speak(speech);
        };
      } else {
        window.speechSynthesis.speak(speech);
      }
      
    } catch (error) {
      console.error('Error:', error);
      // Add error message to chat
      setMessages(prev => [...prev, { text: 'Sorry, there was an error processing your request.', isUser: false }]);
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
