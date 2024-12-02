/// <reference lib="dom" />

import React, { act } from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from '../App';

// Extend global to include fetch mock
declare global {
  interface Window {
    fetch: jest.Mock;
  }
}

// Mock Web Speech APIs before any imports
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

class MockVoice {
  name: string;
  lang: string;

  constructor(name: string, lang: string) {
    this.name = name;
    this.lang = lang;
  }
}

class MockSpeechSynthesis {
  private voices: MockVoice[];
  private onvoiceschangedCallback: (() => void) | null;

  constructor() {
    this.voices = [
      new MockVoice('Daniel', 'en-US'),
      new MockVoice('Samantha', 'en-US'),
      new MockVoice('Basic Voice', 'en-GB')
    ];
    this.onvoiceschangedCallback = null;
  }

  speak = jest.fn();
  cancel = jest.fn();
  pause = jest.fn();
  resume = jest.fn();
  
  getVoices = jest.fn().mockImplementation(() => this.voices);

  set onvoiceschanged(callback: (() => void) | null) {
    this.onvoiceschangedCallback = callback;
    if (callback) {
      callback();
    }
  }
}

Object.defineProperty(window, 'SpeechSynthesisUtterance', {
  value: MockSpeechSynthesisUtterance,
  writable: true
});

const mockSpeechSynthesis = new MockSpeechSynthesis();
Object.defineProperty(window, 'speechSynthesis', {
  value: mockSpeechSynthesis,
  writable: true
});

// Mock the Web Speech Recognition API
class MockSpeechRecognition {
  continuous: boolean = false;
  interimResults: boolean = false;
  onresult: ((event: SpeechRecognitionEvent) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  start = jest.fn();
  stop = jest.fn();
}

let mockRecognitionInstance: MockSpeechRecognition;

describe('Voice Chat Integration', () => {
  let mockRecognitionInstance: any;

  // Increase timeout for all tests in this suite
  jest.setTimeout(30000);

  beforeEach(() => {
    // Mock SpeechRecognition
    mockRecognitionInstance = {
      start: jest.fn(),
      stop: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      onresult: null,
      onerror: null,
      onend: null
    };

    const mockSpeechRecognition = jest.fn(() => mockRecognitionInstance);

    Object.defineProperty(window, 'SpeechRecognition', {
      value: mockSpeechRecognition,
      writable: true
    });

    Object.defineProperty(window, 'webkitSpeechRecognition', {
      value: mockSpeechRecognition,
      writable: true
    });

    // Mock speech synthesis
    const mockUtterance = jest.fn();
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      value: mockUtterance,
      writable: true
    });

    const mockSpeechSynthesis = {
      speak: jest.fn(),
      getVoices: jest.fn().mockReturnValue([
        { name: 'Daniel', lang: 'en-US' },
        { name: 'Samantha', lang: 'en-US' }
      ]),
      onvoiceschanged: null
    };

    Object.defineProperty(window, 'speechSynthesis', {
      value: mockSpeechSynthesis,
      writable: true
    });
  });

  it('integrates voice input with chat interface', async () => {
    // Mock API response with minimal delay
    window.fetch = jest.fn().mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return {
        ok: true,
        json: async () => ({ message: 'Test response' })
      };
    });

    // Render the app and wait for initial setup
    const { container } = render(<App />);

    // Wait for the app to be fully rendered
    await waitFor(() => {
      expect(container.querySelector('.App')).toBeInTheDocument();
    }, { timeout: 5000 });

    // Get the voice button using role and aria-label
    const voiceButton = await waitFor(() => 
      screen.getByRole('button', { name: /start voice input/i })
    , { timeout: 5000 });
    
    expect(voiceButton).toBeInTheDocument();

    // Click the button to start voice recognition
    await act(async () => {
      fireEvent.click(voiceButton);
      // Wait for click handler to complete
      await new Promise(resolve => setTimeout(resolve, 500));
    });

    // Simulate speech recognition result
    await act(async () => {
      mockRecognitionInstance.onresult!({
        results: [[{ transcript: 'Test message', confidence: 0.9 }]],
        resultIndex: 0
      } as unknown as SpeechRecognitionEvent);
      mockRecognitionInstance.onend!();
    });

    // Wait for user message to appear first
    await waitFor(() => {
      const messagesContainer = screen.getByTestId('messages-container');
      const userMessages = messagesContainer.querySelectorAll('.message-container.user');
      expect(userMessages.length).toBe(1);
      expect(userMessages[0].textContent).toContain('Test message');
    }, { timeout: 5000 });

    // Then wait for AI response
    await waitFor(() => {
      const messagesContainer = screen.getByTestId('messages-container');
      const aiMessages = messagesContainer.querySelectorAll('.message-container.ai');
      expect(aiMessages.length).toBe(1);
      expect(aiMessages[0].textContent).toContain('Test response');
    }, { timeout: 5000 });

    // Final verification of both messages
    const messagesContainer = screen.getByTestId('messages-container');
    const messageElements = messagesContainer.querySelectorAll('.message-container');
    expect(messageElements.length).toBe(2);

    // Verify API call
    expect(window.fetch).toHaveBeenCalledWith(
      'http://localhost:11434/api/chat',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: 'Test message',
          model: 'gpt-3.5-turbo'
        })
      })
    );

    // Verify speech synthesis was called
    expect(window.speechSynthesis.speak).toHaveBeenCalled();
  });

  it('handles speech recognition errors gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    await act(async () => {
      render(<App />);
    });

    const voiceButton = await waitFor(() => 
      screen.getByRole('button', { name: /start voice input/i })
    );
    
    await act(async () => {
      fireEvent.click(voiceButton);
    });

    await act(async () => {
      if (mockRecognitionInstance.onerror) {
        mockRecognitionInstance.onerror({ error: 'no-speech' });
      }
      if (mockRecognitionInstance.onend) {
        mockRecognitionInstance.onend();
      }
    });
    
    // Advance timers and wait for any pending promises
    jest.advanceTimersByTime(100);
    await Promise.resolve();

    expect(consoleSpy).toHaveBeenCalledWith('Speech recognition error:', 'no-speech');
    expect(voiceButton).not.toHaveClass('listening');
    expect(voiceButton).not.toBeDisabled();
    
    consoleSpy.mockRestore();
  });

  it('maintains chat history after voice input', async () => {
    // Mock API response
    window.fetch = jest.fn().mockImplementation(async () => ({
      ok: true,
      json: async () => ({ message: 'Test response' })
    }));

    // Render the app
    render(<App />);

    // Get the voice button using role and aria-label
    const voiceButton = screen.getByRole('button', { name: /start voice input/i });
    expect(voiceButton).toBeInTheDocument();

    // First message sequence
    await act(async () => {
      fireEvent.click(voiceButton);
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    await act(async () => {
      mockRecognitionInstance.onresult!({
        results: [[{ transcript: 'First test message', confidence: 0.9 }]],
        resultIndex: 0
      } as unknown as SpeechRecognitionEvent);
      mockRecognitionInstance.onend!();
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // Wait for first message pair to appear
    await waitFor(() => {
      const messagesContainer = screen.getByTestId('messages-container');
      const messageElements = messagesContainer.querySelectorAll('.message-container');
      expect(messageElements.length).toBe(2);
      
      // Verify first user message and response
      const userMessage = Array.from(messageElements).find(el => 
        el.classList.contains('user') && el.textContent?.includes('First test message')
      );
      expect(userMessage).toBeTruthy();
      
      const aiResponse = Array.from(messageElements).find(el => 
        el.classList.contains('ai') && el.textContent?.includes('Test response')
      );
      expect(aiResponse).toBeTruthy();
    }, { timeout: 2000 });

    // Second message sequence
    await act(async () => {
      fireEvent.click(voiceButton);
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    await act(async () => {
      mockRecognitionInstance.onresult!({
        results: [[{ transcript: 'Second test message', confidence: 0.9 }]],
        resultIndex: 0
      } as unknown as SpeechRecognitionEvent);
      mockRecognitionInstance.onend!();
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // Verify both message pairs are present
    await waitFor(() => {
      const messagesContainer = screen.getByTestId('messages-container');
      const messageElements = messagesContainer.querySelectorAll('.message-container');
      expect(messageElements.length).toBe(4);

      // Verify both user messages are present
      const firstUserMessage = Array.from(messageElements).find(el => 
        el.classList.contains('user') && el.textContent?.includes('First test message')
      );
      expect(firstUserMessage).toBeTruthy();

      const secondUserMessage = Array.from(messageElements).find(el => 
        el.classList.contains('user') && el.textContent?.includes('Second test message')
      );
      expect(secondUserMessage).toBeTruthy();

      // Verify both AI responses are present
      const aiResponses = Array.from(messageElements).filter(el => 
        el.classList.contains('ai') && el.textContent?.includes('Test response')
      );
      expect(aiResponses.length).toBe(2);
    }, { timeout: 2000 });

    // Verify API was called twice
    expect(window.fetch).toHaveBeenCalledTimes(2);
  });

  it('handles API errors gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    // Mock a failed API response
    window.fetch = jest.fn().mockImplementation(async () => {
      throw new Error('Network error');
    });

    // Render the app
    await act(async () => {
      render(<App />);
      await Promise.resolve();
    });

    const voiceButton = await waitFor(() => 
      screen.getByRole('button', { name: /start voice input/i })
    );
    
    // Click the voice button
    await act(async () => {
      fireEvent.click(voiceButton);
      await Promise.resolve();
    });

    const userMessage = 'Test message';
    const mockResults = [
      {
        isFinal: true,
        0: { transcript: userMessage, confidence: 0.9 },
        length: 1,
        [Symbol.iterator]: Array.prototype[Symbol.iterator]
      }
    ];
    
    // Add array-like methods to mock results
    Object.setPrototypeOf(mockResults[0], Array.prototype);

    // Simulate speech recognition result
    await act(async () => {
      mockRecognitionInstance.onresult?.({
        resultIndex: 0,
        results: mockResults,
        type: 'result',
        bubbles: false,
        cancelable: false,
        timeStamp: Date.now()
      } as unknown as SpeechRecognitionEvent);
      await Promise.resolve();
    });

    // Let any promises resolve
    await act(async () => {
      jest.advanceTimersByTime(0);
      await Promise.resolve();
    });

    // Verify the user message appears
    const messagesContainer = screen.getByTestId('messages-container');
    
    // Verify user message
    const userMessageEl = await within(messagesContainer).findByText(userMessage);
    expect(userMessageEl).toBeInTheDocument();
    expect(userMessageEl.closest('.message-container')).toHaveClass('user');

    // Verify that the error was logged
    expect(consoleSpy).toHaveBeenCalledWith('Error:', expect.any(Error));
    consoleSpy.mockRestore();
  });

  it('handles multiple messages in sequence', async () => {
    const firstResponse = 'First AI response';
    const secondResponse = 'Second AI response';
    
    // Mock API responses for multiple calls
    window.fetch = jest.fn()
      .mockImplementationOnce(async () => ({
        ok: true,
        json: async () => ({ message: firstResponse })
      }))
      .mockImplementationOnce(async () => ({
        ok: true,
        json: async () => ({ message: secondResponse })
      }));

    // Reset speech synthesis mock
    jest.clearAllMocks();
    const mockSpeak = window.speechSynthesis.speak;

    // Render the app
    render(<App />);

    // Get the voice button using role and aria-label
    const voiceButton = screen.getByRole('button', { name: /start voice input/i });
    expect(voiceButton).toBeInTheDocument();

    // First message sequence
    await act(async () => {
      fireEvent.click(voiceButton);
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    const firstMockResults = [
      {
        isFinal: true,
        0: { transcript: 'First message', confidence: 0.9 },
        length: 1,
        [Symbol.iterator]: Array.prototype[Symbol.iterator]
      }
    ];
    Object.setPrototypeOf(firstMockResults[0], Array.prototype);

    await act(async () => {
      mockRecognitionInstance.onresult?.({
        resultIndex: 0,
        results: firstMockResults,
        type: 'result',
        bubbles: false,
        cancelable: false,
        timeStamp: Date.now()
      } as unknown as SpeechRecognitionEvent);
      mockRecognitionInstance.onend!();
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // Wait for first message and response
    await waitFor(() => {
      const messagesContainer = screen.getByTestId('messages-container');
      const messageElements = messagesContainer.querySelectorAll('.message-container');
      
      // Verify we have both messages
      expect(messageElements.length).toBe(2);
      
      // Find user message
      const userMessageEl = Array.from(messageElements).find(el => 
        el.classList.contains('user') && el.textContent?.includes('First message')
      );
      expect(userMessageEl).toBeTruthy();
      
      // Find AI response
      const aiMessageEl = Array.from(messageElements).find(el => 
        el.classList.contains('ai') && el.textContent?.includes(firstResponse)
      );
      expect(aiMessageEl).toBeTruthy();
    }, { timeout: 2000 });

    // Second message sequence
    await act(async () => {
      fireEvent.click(voiceButton);
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    const secondMockResults = [
      {
        isFinal: true,
        0: { transcript: 'Second message', confidence: 0.9 },
        length: 1,
        [Symbol.iterator]: Array.prototype[Symbol.iterator]
      }
    ];
    Object.setPrototypeOf(secondMockResults[0], Array.prototype);

    await act(async () => {
      mockRecognitionInstance.onresult?.({
        resultIndex: 0,
        results: secondMockResults,
        type: 'result',
        bubbles: false,
        cancelable: false,
        timeStamp: Date.now()
      } as unknown as SpeechRecognitionEvent);
      mockRecognitionInstance.onend!();
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // Wait for second message and response
    await waitFor(() => {
      const messagesContainer = screen.getByTestId('messages-container');
      const messageElements = messagesContainer.querySelectorAll('.message-container');
      
      // Verify we have all four messages
      expect(messageElements.length).toBe(4);
      
      // Find user message
      const userMessageEl = Array.from(messageElements).find(el => 
        el.classList.contains('user') && el.textContent?.includes('Second message')
      );
      expect(userMessageEl).toBeTruthy();
      
      // Find AI response
      const aiMessageEl = Array.from(messageElements).find(el => 
        el.classList.contains('ai') && el.textContent?.includes(secondResponse)
      );
      expect(aiMessageEl).toBeTruthy();
    }, { timeout: 2000 });

    // Verify API calls
    expect(window.fetch).toHaveBeenCalledTimes(2);
    expect(window.fetch).toHaveBeenNthCalledWith(1,
      'http://localhost:11434/api/chat',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: 'First message',
          model: 'gpt-3.5-turbo'
        })
      })
    );
    expect(window.fetch).toHaveBeenNthCalledWith(2,
      'http://localhost:11434/api/chat',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: 'Second message',
          model: 'gpt-3.5-turbo'
        })
      })
    );

    // Verify speech synthesis was called twice
    expect(mockSpeak).toHaveBeenCalledTimes(2);
  });
});
