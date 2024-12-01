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
  // Increase timeout for all tests in this suite
  jest.setTimeout(15000);

  beforeAll(() => {
    // Enable fake timers before any tests run
    jest.useFakeTimers();
  });

  afterAll(() => {
    // Cleanup after all tests
    jest.useRealTimers();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockRecognitionInstance = new MockSpeechRecognition();
    
    // Mock the SpeechRecognition constructor
    const mockSpeechRecognition = jest.fn(() => mockRecognitionInstance);
    Object.defineProperty(window, 'SpeechRecognition', {
      value: mockSpeechRecognition,
      writable: true
    });
    Object.defineProperty(window, 'webkitSpeechRecognition', {
      value: mockSpeechRecognition,
      writable: true
    });

    // Setup fetch mock
    window.fetch = jest.fn().mockImplementation(async () => ({
      ok: true,
      json: async () => ({ message: 'AI response' })
    }));
  });

  afterEach(() => {
    window.speechSynthesis.cancel();
    jest.clearAllMocks();
  });

  it('integrates voice input with chat interface', async () => {
    // Mock API response
    window.fetch = jest.fn().mockImplementation(async () => ({
      ok: true,
      json: async () => ({ message: 'AI response' })
    }));

    // Reset speech synthesis mock
    jest.clearAllMocks();
    const mockSpeak = jest.fn();
    const mockGetVoices = jest.fn().mockReturnValue([
      { name: 'Daniel', lang: 'en-US' },
      { name: 'Samantha', lang: 'en-US' },
      { name: 'Basic Voice', lang: 'en-GB' }
    ]);

    Object.defineProperty(window.speechSynthesis, 'speak', {
      value: mockSpeak,
      writable: true
    });

    Object.defineProperty(window.speechSynthesis, 'getVoices', {
      value: mockGetVoices,
      writable: true
    });

    render(<App />);

    // Get the voice button
    const voiceButton = screen.getByRole('button', { name: 'Start voice input' });
    expect(voiceButton).toBeInTheDocument();

    // Click the button
    fireEvent.click(voiceButton);

    // Simulate speech recognition result
    const mockResults = [
      {
        isFinal: true,
        0: { transcript: 'Test message', confidence: 0.9 },
        length: 1,
        [Symbol.iterator]: Array.prototype[Symbol.iterator]
      }
    ];
    
    // Add array-like methods to mock results
    Object.setPrototypeOf(mockResults[0], Array.prototype);

    await act(async () => {
      mockRecognitionInstance.onresult?.({
        resultIndex: 0,
        results: mockResults,
        type: 'result',
        bubbles: false,
        cancelable: false,
        timeStamp: Date.now()
      } as unknown as SpeechRecognitionEvent);
    });

    // Wait for the messages to be rendered
    await waitFor(() => {
      const messagesContainer = screen.getByTestId('messages-container');
      const userMessage = within(messagesContainer).getByText('Test message');
      expect(userMessage).toBeInTheDocument();
    });

    await waitFor(() => {
      const messagesContainer = screen.getByTestId('messages-container');
      const aiMessage = within(messagesContainer).getByText('AI response');
      expect(aiMessage).toBeInTheDocument();
    });

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

    // Verify speech synthesis
    expect(mockGetVoices).toHaveBeenCalled();
    expect(mockSpeak).toHaveBeenCalled();
  });

  it('handles speech recognition errors gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    await act(async () => {
      render(<App />);
    });

    const voiceButton = await waitFor(() => 
      screen.getByRole('button', { name: 'Start voice input' })
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
    // Mock different responses for each API call
    const firstResponse = "Response to first message";
    const secondResponse = "Response to second message";
    window.fetch = jest.fn()
      .mockImplementationOnce(async () => ({
        ok: true,
        json: async () => ({ message: firstResponse })
      }))
      .mockImplementationOnce(async () => ({
        ok: true,
        json: async () => ({ message: secondResponse })
      }));

    render(<App />);

    // Get the voice button
    const voiceButton = await screen.findByRole('button', { name: 'Start voice input' });
    expect(voiceButton).toBeInTheDocument();

    // First message sequence
    await act(async () => {
      fireEvent.click(voiceButton);
    });

    expect(voiceButton).toBeDisabled();
    expect(voiceButton).toHaveClass('listening');

    await act(async () => {
      const mockResults = [
        {
          isFinal: true,
          0: { transcript: 'First message', confidence: 0.9 },
          length: 1,
          [Symbol.iterator]: Array.prototype[Symbol.iterator]
        }
      ];
      
      // Add array-like methods to mock results
      Object.setPrototypeOf(mockResults[0], Array.prototype);

      mockRecognitionInstance.onresult?.({
        resultIndex: 0,
        results: mockResults,
        type: 'result',
        bubbles: false,
        cancelable: false,
        timeStamp: Date.now()
      } as unknown as SpeechRecognitionEvent);
    });

    // Wait for first message and response
    await waitFor(() => {
      const messagesContainer = screen.getByTestId('messages-container');
      const userMessage = within(messagesContainer).getByText('First message');
      expect(userMessage).toBeInTheDocument();
    });

    await waitFor(() => {
      const messagesContainer = screen.getByTestId('messages-container');
      const aiMessage = within(messagesContainer).getByText(firstResponse);
      expect(aiMessage).toBeInTheDocument();
    });

    // Second message sequence
    await act(async () => {
      fireEvent.click(voiceButton);
    });

    expect(voiceButton).toBeDisabled();
    expect(voiceButton).toHaveClass('listening');

    await act(async () => {
      const mockResults = [
        {
          isFinal: true,
          0: { transcript: 'Second message', confidence: 0.9 },
          length: 1,
          [Symbol.iterator]: Array.prototype[Symbol.iterator]
        }
      ];
      
      // Add array-like methods to mock results
      Object.setPrototypeOf(mockResults[0], Array.prototype);

      mockRecognitionInstance.onresult?.({
        resultIndex: 0,
        results: mockResults,
        type: 'result',
        bubbles: false,
        cancelable: false,
        timeStamp: Date.now()
      } as unknown as SpeechRecognitionEvent);
    });

    // Wait for second message and response
    await waitFor(() => {
      const messagesContainer = screen.getByTestId('messages-container');
      const userMessage = within(messagesContainer).getByText('Second message');
      expect(userMessage).toBeInTheDocument();
    });

    await waitFor(() => {
      const messagesContainer = screen.getByTestId('messages-container');
      const aiMessage = within(messagesContainer).getByText(secondResponse);
      expect(aiMessage).toBeInTheDocument();
    });

    // Verify both messages and responses are still visible
    expect(screen.getByText('First message')).toBeInTheDocument();
    expect(screen.getByText(firstResponse)).toBeInTheDocument();
    expect(screen.getByText('Second message')).toBeInTheDocument();
    expect(screen.getByText(secondResponse)).toBeInTheDocument();

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
          model: 'gpt-3.5-turbo',
        }),
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
          model: 'gpt-3.5-turbo',
        }),
      })
    );
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
      screen.getByRole('button', { name: 'Start voice input' })
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
    const mockSpeak = jest.fn();
    const mockGetVoices = jest.fn().mockReturnValue([
      { name: 'Daniel', lang: 'en-US' },
      { name: 'Samantha', lang: 'en-US' }
    ]);

    Object.defineProperty(window.speechSynthesis, 'speak', {
      value: mockSpeak,
      writable: true
    });

    Object.defineProperty(window.speechSynthesis, 'getVoices', {
      value: mockGetVoices,
      writable: true
    });

    render(<App />);

    const voiceButton = screen.getByRole('button', { name: 'Start voice input' });
    expect(voiceButton).toBeInTheDocument();

    // First message sequence
    fireEvent.click(voiceButton);

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
    });

    // Wait for first message and response using waitFor and within
    await waitFor(() => {
      const messagesContainer = screen.getByTestId('messages-container');
      const userMessage = within(messagesContainer).getByText((content) => content.includes('First message'));
      const aiResponse = within(messagesContainer).getByText((content) => content.includes(firstResponse));
      expect(userMessage).toBeInTheDocument();
      expect(aiResponse).toBeInTheDocument();
    });

    // Second message sequence
    fireEvent.click(voiceButton);

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
    });

    // Wait for second message and response
    await waitFor(() => {
      const messagesContainer = screen.getByTestId('messages-container');
      const userMessage = within(messagesContainer).getByText((content) => content.includes('Second message'));
      const aiResponse = within(messagesContainer).getByText((content) => content.includes(secondResponse));
      expect(userMessage).toBeInTheDocument();
      expect(aiResponse).toBeInTheDocument();
    });

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

    // Verify speech synthesis
    expect(mockSpeak).toHaveBeenCalledTimes(2);
  });
});
