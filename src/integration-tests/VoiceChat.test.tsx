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
    // Render the app
    await act(async () => {
      render(<App />);
    });

    // Wait for the button to be available
    const voiceButton = await waitFor(() => 
      screen.getByRole('button', { name: 'Start voice input' })
    );
    
    // Click the voice button
    await act(async () => {
      fireEvent.click(voiceButton);
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
    const userMessageEl = await within(messagesContainer).findByText(userMessage);
    expect(userMessageEl).toBeInTheDocument();
    expect(userMessageEl.closest('.message-container')).toHaveClass('user');

    // Verify AI response
    const aiMessageEl = await within(messagesContainer).findByText('AI response');
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
      mockRecognitionInstance.onresult?.({
        results: [[{ transcript: 'First message' }]]
      });
      mockRecognitionInstance.onend?.();
    });

    // Wait for first message and response
    await screen.findByText('First message');
    await screen.findByText(firstResponse);

    // Second message sequence
    await act(async () => {
      fireEvent.click(voiceButton);
    });

    expect(voiceButton).toBeDisabled();
    expect(voiceButton).toHaveClass('listening');

    await act(async () => {
      mockRecognitionInstance.onresult?.({
        results: [[{ transcript: 'Second message' }]]
      });
      mockRecognitionInstance.onend?.();
    });

    // Wait for second message and response
    await screen.findByText('Second message');
    await screen.findByText(secondResponse);

    // Verify both messages and responses are still visible
    expect(screen.getByText('First message')).toBeInTheDocument();
    expect(screen.getByText(firstResponse)).toBeInTheDocument();
    expect(screen.getByText('Second message')).toBeInTheDocument();
    expect(screen.getByText(secondResponse)).toBeInTheDocument();

    // Verify API calls
    expect(window.fetch).toHaveBeenCalledTimes(2);
    expect(window.fetch).toHaveBeenNthCalledWith(1, 
      'http://localhost:8080/api/chat',
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
      'http://localhost:8080/api/chat',
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
    const userMessageEl = await within(messagesContainer).findByText(userMessage);
    expect(userMessageEl).toBeInTheDocument();
    expect(userMessageEl.closest('.message-container')).toHaveClass('user');

    // Verify that the error was logged
    expect(consoleSpy).toHaveBeenCalledWith('Error:', expect.any(Error));
    consoleSpy.mockRestore();
  });
});
