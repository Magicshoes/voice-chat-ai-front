import React, { useState, useEffect } from 'react';
import './App.css';
import VoiceButton from './components/VoiceButton';
import ChatMessage from './components/ChatMessage';

interface Message {
  text: string;
  isUser: boolean;
}

const speakText = async (speakText: string, voices: SpeechSynthesisVoice[]) => {
  if (!window.speechSynthesis) {
    console.error('Speech synthesis not available');
    return;
  }

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  // Wait for voices to load if they haven't already
  if (voices.length === 0) {
    try {
      voices = await new Promise((resolve) => {
        const voicesChanged = () => {
          const availableVoices = window.speechSynthesis.getVoices();
          if (availableVoices.length > 0) {
            window.speechSynthesis.removeEventListener('voiceschanged', voicesChanged);
            resolve(availableVoices);
          }
        };
        window.speechSynthesis.addEventListener('voiceschanged', voicesChanged);
        // Also try getting voices immediately
        const availableVoices = window.speechSynthesis.getVoices();
        if (availableVoices.length > 0) {
          window.speechSynthesis.removeEventListener('voiceschanged', voicesChanged);
          resolve(availableVoices);
        }
      });
    } catch (error) {
      console.error('Error loading voices:', error);
    }
  }

  console.log('Available voices:', voices);

  // Create utterance
  const speech = new SpeechSynthesisUtterance(speakText);
  
  // Find an English voice
  const englishVoice = voices.find(voice => 
    voice.lang.startsWith('en') && 
    (voice.name.includes('Microsoft') || voice.name.includes('Google') || voice.name.includes('English'))
  ) || voices.find(voice => voice.lang.startsWith('en'));

  if (englishVoice) {
    console.log('Using voice:', englishVoice.name);
    speech.voice = englishVoice;
  } else {
    console.warn('No English voice found, using default');
  }

  // Set speech properties
  speech.rate = 1.0;
  speech.pitch = 1.0;
  speech.volume = 1.0;

  // Add event handlers
  speech.onstart = () => console.log('Speech started');
  speech.onend = () => console.log('Speech ended');
  speech.onerror = (event) => console.error('Speech error:', event);

  // Speak
  try {
    console.log('Starting speech...');
    window.speechSynthesis.speak(speech);

    // Chrome sometimes fails to speak if the utterance is too long
    // This keeps the speech synthesis active
    const utteranceTimer = setInterval(() => {
      if (!window.speechSynthesis.speaking) {
        clearInterval(utteranceTimer);
        return;
      }
      window.speechSynthesis.pause();
      window.speechSynthesis.resume();
    }, 14000);
  } catch (error) {
    console.error('Error speaking:', error);
  }
};

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedModel, setSelectedModel] = useState('gpt-3.5-turbo');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    // Check if speech synthesis is available
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      console.log('Speech synthesis is available');
      
      // Initial voice loading
      const loadVoices = () => {
        try {
          const availableVoices = window.speechSynthesis.getVoices() || [];
          console.log('Loaded voices:', availableVoices);
          if (availableVoices && availableVoices.length > 0) {
            setVoices(availableVoices);
          } else {
            console.warn('No voices available yet');
          }
        } catch (error) {
          console.error('Error loading voices:', error);
          setVoices([]);
        }
      };

      // Load voices immediately if available
      loadVoices();

      // Set up voice changed event listener
      if ('onvoiceschanged' in window.speechSynthesis) {
        console.log('Setting up onvoiceschanged listener');
        window.speechSynthesis.onvoiceschanged = () => {
          console.log('Voices changed event triggered');
          loadVoices();
        };
      } else {
        console.warn('onvoiceschanged not supported in this browser');
      }

      // iOS Safari: reload voices on visibility change
      const handleVisibilityChange = () => {
        if (!document.hidden) {
          console.log('Document became visible, reloading voices');
          loadVoices();
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        if ('onvoiceschanged' in window.speechSynthesis) {
          window.speechSynthesis.onvoiceschanged = null;
        }
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, []);

  const handleSpeechResult = async (text: string) => {
    try {
      // Add user message
      const userMessage = { text, isUser: true };
      setMessages(prev => [...prev, userMessage]);

      // Send to API
      const response = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: text,
          context: messages.map(m => ({ text: m.text, isUser: m.isUser })).reverse() // Reverse the context to match display order
        }),
      });

      if (!response.ok) {
        throw new Error('API request failed');
      }

      const data = await response.json();

      // Add AI response and trigger speech
      const aiMessage = { text: data.message, isUser: false };
      setMessages(prev => {
        const updatedMessages = [...prev, aiMessage];
        // Ensure speech synthesis is called after state update
        setTimeout(async () => {
          try {
            await speakText(aiMessage.text, voices);
          } catch (error) {
            console.error('Failed to speak response:', error);
          }
        }, 100);
        return updatedMessages;
      });
    } catch (error) {
      console.error('Error in speech handling:', error);
      setMessages(prev => [...prev, { text: 'Sorry, there was an error processing your request.', isUser: false }]);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>AI Voice Chat</h1>
        <select 
          className="model-selector" 
          value={selectedModel} 
          onChange={(e) => setSelectedModel(e.target.value)}
        >
          <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
          <option value="gpt-4">GPT-4</option>
        </select>
      </header>
      <main className="chat-container">
        <div className="messages-container" data-testid="messages-container">
          {messages.map((msg, index) => (
            <ChatMessage
              key={index}
              message={msg.text}
              isUser={msg.isUser}
            />
          ))}
        </div>
        <div className="input-container">
          <div className="voice-input-container">
            <VoiceButton onSpeechResult={handleSpeechResult} />
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
