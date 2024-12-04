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

  // Get fresh voices and log their properties
  const freshVoices = window.speechSynthesis.getVoices();
  console.log('Voice details:');
  freshVoices.forEach((voice, index) => {
    console.log(`Voice ${index}:`, {
      name: voice.name,
      lang: voice.lang,
      default: voice.default,
      localService: voice.localService,
      voiceURI: voice.voiceURI
    });
  });

  // Create utterance
  const speech = new SpeechSynthesisUtterance(speakText);
  
  // Try to find a suitable voice
  let selectedVoice = null;
  
  // First try to find Microsoft English voices
  selectedVoice = freshVoices.find(voice => 
    voice.name.includes('Microsoft') && voice.lang.startsWith('en')
  );
  
  // If no Microsoft voice, try Google English voices
  if (!selectedVoice) {
    selectedVoice = freshVoices.find(voice => 
      voice.name.includes('Google') && voice.lang.startsWith('en')
    );
  }
  
  // If still no voice, try any English voice
  if (!selectedVoice) {
    selectedVoice = freshVoices.find(voice => 
      voice.lang.startsWith('en')
    );
  }
  
  // If still no voice, use the first available voice
  if (!selectedVoice && freshVoices.length > 0) {
    selectedVoice = freshVoices[0];
  }

  if (selectedVoice) {
    console.log('Selected voice:', {
      name: selectedVoice.name,
      lang: selectedVoice.lang,
      default: selectedVoice.default,
      localService: selectedVoice.localService,
      voiceURI: selectedVoice.voiceURI
    });
    speech.voice = selectedVoice;
  } else {
    console.warn('No voice available, using browser default');
  }

  // Set speech properties
  speech.text = speakText;  // Ensure text is set
  speech.rate = 1.0;
  speech.pitch = 1.0;
  speech.volume = 1.0;
  speech.lang = selectedVoice?.lang || 'en-US';  // Ensure language is set

  return new Promise((resolve, reject) => {
    speech.onend = () => {
      console.log('Speech ended');
      resolve(true);
    };

    speech.onerror = (event) => {
      console.error('Speech error:', event);
      reject(event);
    };

    speech.onstart = () => {
      console.log('Speech started');
    };

    try {
      console.log('Starting speech with text:', speakText);
      window.speechSynthesis.speak(speech);

      // Keep speech synthesis active
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
      reject(error);
    }
  });
};

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedModel, setSelectedModel] = useState('gpt-3.5-turbo');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    const initVoices = async () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        console.log('Initializing speech synthesis...');
        
        // Try to get voices immediately
        let availableVoices = window.speechSynthesis.getVoices();
        
        // If no voices available, wait for them to load
        if (!availableVoices.length) {
          try {
            availableVoices = await new Promise((resolve) => {
              const voicesChanged = () => {
                const voices = window.speechSynthesis.getVoices();
                if (voices.length > 0) {
                  window.speechSynthesis.removeEventListener('voiceschanged', voicesChanged);
                  resolve(voices);
                }
              };
              window.speechSynthesis.addEventListener('voiceschanged', voicesChanged);
              // Double-check voices in case they loaded while we were setting up
              const voices = window.speechSynthesis.getVoices();
              if (voices.length > 0) {
                window.speechSynthesis.removeEventListener('voiceschanged', voicesChanged);
                resolve(voices);
              }
            });
          } catch (error) {
            console.error('Error waiting for voices:', error);
          }
        }

        // Log available voices
        console.log('Available voices:');
        availableVoices.forEach((voice, index) => {
          console.log(`Voice ${index}:`, {
            name: voice.name,
            lang: voice.lang,
            default: voice.default,
            localService: voice.localService,
            voiceURI: voice.voiceURI
          });
        });

        setVoices(availableVoices);
      } else {
        console.error('Speech synthesis not available');
      }
    };

    initVoices();
  }, []);

  const handleSpeechResult = async (text: string) => {
    try {
      // Add user message
      const userMessage = { text, isUser: true };
      setMessages(prev => [...prev, userMessage]);

      // Send to API
      const apiUrl = 'http://localhost:11434/api/chat';
      console.log('Sending request to:', apiUrl);
      console.log('Request payload:', {
        message: text,
        context: messages.map(m => ({ text: m.text, isUser: m.isUser })).reverse()
      });

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: text,
          context: messages.map(m => ({ text: m.text, isUser: m.isUser })).reverse()
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Response not OK:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('API Response:', data);

      if (!data.message) {
        throw new Error('API response missing message field');
      }

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
    } catch (err: unknown) {
      console.error('Error in speech handling:', err);
      let errorMessage = 'An unexpected error occurred';
      
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === 'string') {
        errorMessage = err;
      } else if (err && typeof err === 'object' && 'message' in err) {
        errorMessage = String(err.message);
      }

      setMessages(prev => [...prev, { 
        text: `Error: ${errorMessage}. Please ensure the API server is running at ${window.location.protocol}//${window.location.hostname}:11434`, 
        isUser: false 
      }]);
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
