/// <reference lib="dom" />

import React, { act } from 'react';
import { render, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from '../App';

// Define SpeechRecognitionEvent type that extends Event
type SpeechRecognitionEvent = Event & {
  resultIndex: number;
  results: SpeechRecognitionResultList;
  type: string;
  bubbles: boolean;
  cancelable: boolean;
  timeStamp: number;
}

// Extend global to include fetch mock
declare global {
  interface Window {
    fetch: jest.Mock;
  }
}

// Mock Web Speech APIs before any imports
const mockVoices = [
  { name: 'Daniel', lang: 'en-US' },
  { name: 'Samantha', lang: 'en-US' },
  { name: 'Basic Voice', lang: 'en-GB' }
];

class MockSpeechSynthesisUtterance {
  text: string;
  voice: any;
  rate: number;
  pitch: number;
  volume: number;
  onstart: (() => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;

  constructor(text: string) {
    this.text = text;
    this.voice = null;
    this.rate = 1.0;
    this.pitch = 1.0;
    this.volume = 1.0;
    this.onstart = null;
    this.onerror = null;
    this.onend = null;
  }
}

class MockSpeechSynthesis {
  private voices: any[];
  private onvoiceschangedCallback: (() => void) | null;

  constructor() {
    this.voices = mockVoices;
    this.onvoiceschangedCallback = null;
  }

  speak = jest.fn();
  cancel = jest.fn();
  pause = jest.fn();
  resume = jest.fn();
  getVoices = jest.fn().mockReturnValue(mockVoices);

  set onvoiceschanged(callback: (() => void) | null) {
    this.onvoiceschangedCallback = callback;
    // Immediately trigger the callback to simulate voices being loaded
    if (callback) {
      callback();
    }
  }

  get onvoiceschanged() {
    return this.onvoiceschangedCallback;
  }
}

Object.defineProperty(window, 'SpeechSynthesisUtterance', {
  value: MockSpeechSynthesisUtterance,
  writable: true
});

Object.defineProperty(window, 'speechSynthesis', {
  value: {
    getVoices: jest.fn().mockReturnValue(mockVoices),
    speak: jest.fn(),
    cancel: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
    onvoiceschanged: null
  },
  writable: true
});

// Mock classes for Web Speech API
class SpeechRecognitionAlternative {
  constructor(public transcript: string, public confidence: number) {}
}

class SpeechRecognitionResult {
  private _items: SpeechRecognitionAlternative[]
  readonly length: number;
  isFinal: boolean;

  constructor(items: SpeechRecognitionAlternative | SpeechRecognitionAlternative[], isFinal: boolean) {
    this._items = Array.isArray(items) ? items : [items];
    this.isFinal = isFinal;
    this.length = this._items.length;
  }

  item(index: number): SpeechRecognitionAlternative {
    return this._items[index];
  }

  [Symbol.iterator]() {
    return this._items[Symbol.iterator]();
  }

  [index: number]: SpeechRecognitionAlternative;
}

class SpeechRecognitionResultList {
  private _results: SpeechRecognitionResult[]
  readonly length: number;

  constructor(results: SpeechRecognitionResult[]) {
    this._results = results;
    this.length = results.length;
  }

  item(index: number): SpeechRecognitionResult {
    return this._results[index];
  }

  [Symbol.iterator]() {
    return this._results[Symbol.iterator]();
  }

  [index: number]: SpeechRecognitionResult;
}

class MockSpeechRecognition {
  continuous: boolean = false;
  interimResults: boolean = true;
  lang: string = 'en-US';
  onresult: ((event: SpeechRecognitionEvent) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  started: boolean = false;

  start = jest.fn(async () => {
    if (this.started) {
      throw new Error('Recognition already started');
    }
    this.started = true;

    // Simulate starting recognition and getting results
    await new Promise(resolve => setTimeout(resolve, 100));
    if (!this.started) return; // Don't send results if stopped

    if (this.onresult) {
      // First send interim result
      const interimResult: SpeechRecognitionEvent = {
        resultIndex: 0,
        results: new SpeechRecognitionResultList([
          new SpeechRecognitionResult(
            new SpeechRecognitionAlternative('Test', 0.7),
            false
          )
        ]),
        type: 'result'
      } as SpeechRecognitionEvent;

      this.onresult(interimResult);

      // Then send final result with higher confidence
      const finalResult: SpeechRecognitionEvent = {
        resultIndex: 0,
        results: new SpeechRecognitionResultList([
          new SpeechRecognitionResult(
            new SpeechRecognitionAlternative('Test message', 0.95),
            true
          )
        ]),
        type: 'result'
      } as SpeechRecognitionEvent;

      this.onresult(finalResult);
    }
    
    // Then end recognition
    if (this.onend) {
      this.started = false;
      this.onend();
    }
  });

  stop = jest.fn(() => {
    this.started = false;
    if (this.onend) {
      this.onend();
    }
  });
}

let mockRecognitionInstance: MockSpeechRecognition;

// Mock react-icons/fa
jest.mock('react-icons/fa', () => ({
  FaMicrophone: () => <div data-testid="microphone-icon">Microphone Icon</div>
}));

describe('Voice Chat Integration', () => {
  let mockRecognitionInstance: any;

  // Increase timeout for all tests in this suite
  jest.setTimeout(10000);

  // Mock console.error to prevent error messages in test output
  const originalConsoleError = console.error;
  beforeAll(() => {
    console.error = jest.fn();
  });

  afterAll(() => {
    console.error = originalConsoleError;
  });

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock fetch responses
    global.fetch = jest.fn().mockImplementation(async () => ({
      ok: true,
      json: async () => ({ message: 'AI response' })
    }));

    mockRecognitionInstance = new MockSpeechRecognition();
    
    // Mock the SpeechRecognition constructor
    Object.defineProperty(window, 'SpeechRecognition', {
      value: jest.fn(() => mockRecognitionInstance),
      writable: true
    });


    Object.defineProperty(window, 'webkitSpeechRecognition', {
      value: jest.fn(() => mockRecognitionInstance),
      writable: true
    });

    // Mock speech synthesis
    Object.defineProperty(window, 'speechSynthesis', {
      value: {
        getVoices: () => mockVoices,
        speak: jest.fn(),
        cancel: jest.fn(),
        pause: jest.fn(),
        resume: jest.fn(),
        onvoiceschanged: null
      },
      writable: true
    });

    // Render App component
    await act(async () => {
      render(<App />);
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('handles voice input and displays response', async () => {
    // Find the button using both role and title
    const voiceButton = screen.getByRole('button', { name: /start voice input/i });
    expect(voiceButton).toBeInTheDocument();
    
    await act(async () => {
      fireEvent.click(voiceButton);
    });

    // Wait for recognition to complete and response to be displayed
    await waitFor(() => {
      expect(screen.getByText('Test message')).toBeInTheDocument();
      expect(screen.getByText('AI response')).toBeInTheDocument();
    });
  });

  it('maintains chat history after voice input', async () => {
    const voiceButton = screen.getByRole('button', { name: /start voice input/i });
    expect(voiceButton).toBeInTheDocument();
    
    // First voice input
    await act(async () => {
      fireEvent.click(voiceButton);
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    await waitFor(() => {
      expect(screen.getByText('Test message')).toBeInTheDocument();
      expect(screen.getByText('AI response')).toBeInTheDocument();
    });

    // Second voice input
    await act(async () => {
      fireEvent.click(voiceButton);
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    await waitFor(() => {
      const messages = screen.getAllByText('Test message');
      const responses = screen.getAllByText('AI response');
      expect(messages).toHaveLength(2);
      expect(responses).toHaveLength(2);
    });
  });

  it('handles recognition errors gracefully', async () => {
    const voiceButton = screen.getByRole('button', { name: /start voice input/i });
    expect(voiceButton).toBeInTheDocument();
    
    // Mock error event
    mockRecognitionInstance.onerror = jest.fn();
    mockRecognitionInstance.onend = jest.fn();
    
    await act(async () => {
      fireEvent.click(voiceButton);
      mockRecognitionInstance.onerror?.({ error: 'no-speech' });
      mockRecognitionInstance.onend?.();
    });

    // Verify error was logged
    expect(console.error).toHaveBeenCalledWith('Speech recognition error:', 'no-speech');
    expect(screen.queryByText(/no speech detected/i)).not.toBeInTheDocument();
  });

  it('handles low confidence results by showing the transcript', async () => {
    const voiceButton = screen.getByRole('button', { name: /start voice input/i });
    expect(voiceButton).toBeInTheDocument();
    
    await act(async () => {
      fireEvent.click(voiceButton);
      
      if (mockRecognitionInstance.onresult) {
        const lowConfidenceResult: SpeechRecognitionEvent = {
          resultIndex: 0,
          results: new SpeechRecognitionResultList([
            new SpeechRecognitionResult([
              new SpeechRecognitionAlternative('First alternative', 0.5),
              new SpeechRecognitionAlternative('Second alternative', 0.4)
            ], true)
          ]),
          type: 'result'
        } as SpeechRecognitionEvent;
        
        mockRecognitionInstance.onresult(lowConfidenceResult);
      }
      
      mockRecognitionInstance.onend?.();
    });

    // Wait for the low confidence alternatives to be displayed
    await waitFor(() => {
      expect(screen.getByText('First alternative OR Second alternative')).toBeInTheDocument();
    });
  });
});
