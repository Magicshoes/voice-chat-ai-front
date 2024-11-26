import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { act } from 'react';
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
  constructor(public text: string) {}
}

class MockSpeechSynthesis {
  speak = jest.fn();
  cancel = jest.fn();
  pause = jest.fn();
  resume = jest.fn();
  getVoices = jest.fn().mockReturnValue([]);
}

Object.defineProperty(window, 'SpeechSynthesisUtterance', {
  value: MockSpeechSynthesisUtterance,
  writable: true
});

Object.defineProperty(window, 'speechSynthesis', {
  value: new MockSpeechSynthesis(),
  writable: true
});

// Mock fetch API
window.fetch = jest.fn();
const mockResponse = "This is a mock response from the AI assistant";
(window.fetch as jest.Mock).mockImplementation(async (url, options) => {
  console.log('Fetch called with:', { url, options });
  const response = {
    ok: true,
    json: async () => {
      const data = { message: mockResponse, error: null };
      console.log('Fetch response:', data);
      return data;
    }
  };
  return response;
});

// Mock the Web Speech Recognition API
class MockSpeechRecognition {
  continuous: boolean = false;
  interimResults: boolean = false;
  onresult: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
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
  });

  afterEach(async () => {
    // Cancel any ongoing speech synthesis
    window.speechSynthesis.cancel();
    
    // Clear all mocks and timers
    jest.clearAllMocks();
    jest.clearAllTimers();
    
    // Run all pending microtasks
    await Promise.resolve();
    
    // Cleanup any pending effects
    await act(async () => {
      jest.runOnlyPendingTimers();
      await Promise.resolve();
    });
  });

  it('integrates voice input with chat interface', async () => {
    const mockResponse = 'Hello! How can I help you today?';
    
    // Setup fetch mock
    window.fetch = jest.fn().mockImplementation(async () => ({
      ok: true,
      json: async () => ({ message: mockResponse })
    }));

    // Render the app
    await act(async () => {
      render(<App />);
      await Promise.resolve();
    });

    const voiceButton = screen.getByRole('button', { name: 'Start voice input' });
    
    // Click the voice button
    await act(async () => {
      fireEvent.click(voiceButton);
      await Promise.resolve();
    });

    const userMessage = 'Hello AI assistant';
    const mockResult = {
      results: [[{ transcript: userMessage }]],
    };

    // Simulate speech recognition result
    await act(async () => {
      if (mockRecognitionInstance.onresult) {
        mockRecognitionInstance.onresult(mockResult);
      }
      if (mockRecognitionInstance.onend) {
        mockRecognitionInstance.onend();
      }
      await Promise.resolve();
    });

    // Let any promises resolve
    await act(async () => {
      jest.advanceTimersByTime(0);
      await Promise.resolve();
    });

    // Verify the messages
    const messagesContainer = screen.getByTestId('messages-container');
    
    // Verify user message
    const userMessageEl = within(messagesContainer).getByText(userMessage);
    expect(userMessageEl).toBeInTheDocument();
    expect(userMessageEl.closest('.message-container')).toHaveClass('user');

    // Verify AI response
    const aiMessageEl = within(messagesContainer).getByText(mockResponse);
    expect(aiMessageEl).toBeInTheDocument();
    expect(aiMessageEl.closest('.message-container')).toHaveClass('ai');

    // Verify API calls
    expect(window.fetch).toHaveBeenCalledTimes(1);
    expect(window.fetch).toHaveBeenCalledWith(
      'http://localhost:8080/api/chat',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          model: 'gpt-3.5-turbo',
        }),
      })
    );

    // Verify speech synthesis
    expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(1);
    expect(window.speechSynthesis.speak).toHaveBeenCalledWith(
      expect.any(MockSpeechSynthesisUtterance)
    );
  });

  it('handles speech recognition errors gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    await act(async () => {
      render(<App />);
    });

    const voiceButton = screen.getByRole('button', { name: 'Start voice input' });
    
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
    (window.fetch as jest.Mock)
      .mockImplementationOnce(async (url, options) => {
        console.log('Fetch called with:', { url, options });
        const response = {
          ok: true,
          json: async () => {
            const data = { message: firstResponse, error: null };
            console.log('Fetch response:', data);
            return data;
          }
        };
        return response;
      })
      .mockImplementationOnce(async (url, options) => {
        console.log('Fetch called with:', { url, options });
        const response = {
          ok: true,
          json: async () => {
            const data = { message: secondResponse, error: null };
            console.log('Fetch response:', data);
            return data;
          }
        };
        return response;
      });

    await act(async () => {
      render(<App />);
    });

    const voiceButton = screen.getByRole('button', { name: 'Start voice input' });
    
    // First message
    await act(async () => {
      fireEvent.click(voiceButton);
    });
    
    await act(async () => {
      if (mockRecognitionInstance.onresult) {
        mockRecognitionInstance.onresult({ 
          results: [[{ transcript: 'First message' }]] 
        });
      }
      if (mockRecognitionInstance.onend) {
        mockRecognitionInstance.onend();
      }
    });
    
    // Advance timers and wait for any pending promises
    jest.advanceTimersByTime(100);
    await Promise.resolve();

    // Wait for both first message and its response
    await act(async () => {
      await waitFor(() => {
        const messagesContainer = screen.getByTestId('messages-container');
        const messages = within(messagesContainer).getAllByText(/(First message|Response to first message)/);
        expect(messages).toHaveLength(2);
        expect(messages[0]).toHaveTextContent('Response to first message');
        expect(messages[1]).toHaveTextContent('First message');
        expect(messages[0].closest('.message-container')).toHaveClass('ai');
        expect(messages[1].closest('.message-container')).toHaveClass('user');
      }, { timeout: 3000, interval: 100 });
    });

    // Second message
    await act(async () => {
      fireEvent.click(voiceButton);
    });
    
    await act(async () => {
      if (mockRecognitionInstance.onresult) {
        mockRecognitionInstance.onresult({ 
          results: [[{ transcript: 'Second message' }]] 
        });
      }
      if (mockRecognitionInstance.onend) {
        mockRecognitionInstance.onend();
      }
    });
    
    // Advance timers and wait for any pending promises
    jest.advanceTimersByTime(100);
    await Promise.resolve();

    // Wait for all four messages to appear
    await act(async () => {
      await waitFor(() => {
        const messagesContainer = screen.getByTestId('messages-container');
        const messages = within(messagesContainer).getAllByText(/(First message|Response to first message|Second message|Response to second message)/);
        expect(messages).toHaveLength(4);
        expect(messages[0]).toHaveTextContent('Response to second message');
        expect(messages[1]).toHaveTextContent('Second message');
        expect(messages[2]).toHaveTextContent('Response to first message');
        expect(messages[3]).toHaveTextContent('First message');
        expect(messages[0].closest('.message-container')).toHaveClass('ai');
        expect(messages[1].closest('.message-container')).toHaveClass('user');
        expect(messages[2].closest('.message-container')).toHaveClass('ai');
        expect(messages[3].closest('.message-container')).toHaveClass('user');
      }, { timeout: 3000, interval: 100 });
    });

    expect(window.fetch).toHaveBeenCalledTimes(2);
    expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(2);
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

    const voiceButton = screen.getByRole('button', { name: 'Start voice input' });
    
    // Click the voice button
    await act(async () => {
      fireEvent.click(voiceButton);
      await Promise.resolve();
    });

    const userMessage = 'Test message';
    const mockResult = {
      results: [[{ transcript: userMessage }]],
    };
    
    // Simulate speech recognition result
    await act(async () => {
      if (mockRecognitionInstance.onresult) {
        mockRecognitionInstance.onresult(mockResult);
      }
      if (mockRecognitionInstance.onend) {
        mockRecognitionInstance.onend();
      }
      await Promise.resolve();
    });

    // Let any promises resolve
    await act(async () => {
      jest.advanceTimersByTime(0);
      await Promise.resolve();
    });

    // Verify the user message appears
    const messagesContainer = screen.getByTestId('messages-container');
    const userMessageEl = within(messagesContainer).getByText(userMessage);
    expect(userMessageEl).toBeInTheDocument();
    expect(userMessageEl.closest('.message-container')).toHaveClass('user');

    // Verify that the error was logged
    expect(consoleSpy).toHaveBeenCalledWith('Error:', expect.any(Error));
    consoleSpy.mockRestore();
  });
});
