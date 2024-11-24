import React, { useState } from 'react';
import { FaMicrophone } from 'react-icons/fa';

interface VoiceButtonProps {
  onSpeechResult: (text: string) => void;
}

const VoiceButton: React.FC<VoiceButtonProps> = ({ onSpeechResult }) => {
  const [isListening, setIsListening] = useState(false);

  const startListening = () => {
    setIsListening(true);
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error('Speech recognition is not supported in this browser. Please use Chrome, Edge, Safari (14.1+), or Opera.');
      setIsListening(false);
      return;
    }
    const recognition = new SpeechRecognition();
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
