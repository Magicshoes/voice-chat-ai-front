import React, { useState, useEffect } from 'react';
import './App.css';
import VoiceButton from './components/VoiceButton';
import ChatMessage from './components/ChatMessage';

interface Message {
  text: string;
  isUser: boolean;
}

const speakText = (speakText: string, voices: SpeechSynthesisVoice[]) => {
  // Enhanced TTS setup
  const speech = new SpeechSynthesisUtterance(speakText);

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

  // Speak the response
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.speak(speech);
  }
};

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedModel, setSelectedModel] = useState('gpt-3.5-turbo');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    // Check if speech synthesis is available
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      // Load voices when component mounts
      const loadVoices = () => {
        const availableVoices = window.speechSynthesis.getVoices();
        setVoices(availableVoices);
      };

      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;

      return () => {
        if (window.speechSynthesis) {
          window.speechSynthesis.onvoiceschanged = null;
        }
      };
    }
  }, []);

  const handleSpeechResult = async (text: string) => {
    // Add user message
    const newMessage = { text, isUser: true };
    setMessages(prev => [...prev, newMessage]);

    try {
      const response = await fetch('http://localhost:11434/api/chat', {
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

    } catch (error) {
      console.error('Error:', error);
      // Add error message to chat
      setMessages(prev => [...prev, { text: 'Sorry, there was an error processing your request.', isUser: false }]);
    }
    
    const latestMessage = messages[messages.length - 1];
    if (latestMessage && !latestMessage.isUser) {
      // Speak the AI response
      speakText(latestMessage.text, voices);
    
    };
  }

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
