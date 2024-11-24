import React, { useState } from 'react';
import { FaMicrophone } from 'react-icons/fa';

interface VoiceButtonProps {
  onSpeechResult: (text: string) => void;
}

const VoiceButton: React.FC<VoiceButtonProps> = ({ onSpeechResult }) => {
  const [isListening, setIsListening] = useState(false);

  const startListening = () => {
    setIsListening(true);
    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript;
      onSpeechResult(text);
      setIsListening(false);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  return (
    <button
      className={`voice-button ${isListening ? 'listening' : ''}`}
      onClick={startListening}
      disabled={isListening}
    >
      <FaMicrophone />
    </button>
  );
};

export default VoiceButton;
