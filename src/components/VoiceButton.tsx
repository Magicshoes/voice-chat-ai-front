import React, { useState } from 'react';
import { FaMicrophone } from 'react-icons/fa';

interface VoiceButtonProps {
  onSpeechResult: (text: string) => void;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
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

    // Enhanced configuration for better accuracy
    recognition.continuous = false;        // Single utterance mode for better accuracy
    recognition.interimResults = true;     // Get interim results for real-time feedback
    recognition.lang = 'en-US';           // Set to US English for better recognition

    let finalTranscript = '';
    let interimTranscript = '';
    let confidenceThreshold = 0.8;        // Minimum confidence level to accept

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let bestResult = {
        transcript: '',
        confidence: 0
      };

      // Process all results to find the best one
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results.item(i);
        if (!result) continue;
        
        if (result.isFinal) {
          // For final results, get the first (most confident) result
          const alternative = result.item(0);
          if (alternative) {
            const altTranscript = alternative.transcript || '';
            const altConfidence = alternative.confidence || 0;
            
            if (altConfidence > bestResult.confidence) {
              bestResult = {
                transcript: altTranscript,
                confidence: altConfidence
              };
            }
          }
          
          if (bestResult.confidence >= confidenceThreshold) {
            finalTranscript = bestResult.transcript;
          } else {
            // If confidence is low, get all alternatives
            const alternatives = [];
            for (let j = 0; j < result.length; j++) {
              const alt = result.item(j);
              if (alt && alt.transcript) {
                alternatives.push(alt.transcript);
              }
            }
            finalTranscript = alternatives.join(' OR ');
          }

          // Clean up the transcript
          if (finalTranscript) {
            finalTranscript = finalTranscript
              .trim()
              .replace(/^\w/, c => c.toUpperCase())    // Capitalize first letter
              .replace(/\s+/g, ' ')                    // Remove extra spaces
              .replace(/[.,/#!$%^&\*;:{}=\-_`~()]/g, ''); // Remove punctuation
          }

          if (finalTranscript) {
            onSpeechResult(finalTranscript);
            setIsListening(false);
          }
        }
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    try {
      recognition.start();
    } catch (error) {
      console.error('Speech recognition error:', error);
      setIsListening(false);
    }
  };

  return (
    <button
      className={`voice-button ${isListening ? 'listening' : ''}`}
      onClick={startListening}
      disabled={isListening}
      aria-label="Start voice input"
      aria-pressed={isListening}
      title="Start voice input"
      type="button"
    >
      <FaMicrophone aria-hidden="true" />
      <span className="sr-only">Start voice input</span>
    </button>
  );
};

export default VoiceButton;
