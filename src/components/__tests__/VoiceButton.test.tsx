import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { act } from 'react';
import '@testing-library/jest-dom';
import VoiceButton from '../VoiceButton';

// Mock the Web Speech API
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

describe('VoiceButton Component', () => {
  const mockOnSpeechResult = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockOnSpeechResult.mockClear();
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

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the microphone button', async () => {
    await act(async () => {
      render(<VoiceButton onSpeechResult={mockOnSpeechResult} />);
    });

    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('voice-button');
    expect(button.querySelector('svg')).toBeInTheDocument();
  });

  it('starts listening when clicked', async () => {
    await act(async () => {
      render(<VoiceButton onSpeechResult={mockOnSpeechResult} />);
    });

    const button = screen.getByRole('button');

    await act(async () => {
      fireEvent.click(button);
      await Promise.resolve();
    });

    expect(mockRecognitionInstance.start).toHaveBeenCalled();
    expect(button).toHaveClass('voice-button listening');
    expect(button).toBeDisabled();
  });

  it('handles successful speech recognition', async () => {
    await act(async () => {
      render(<VoiceButton onSpeechResult={mockOnSpeechResult} />);
    });

    const button = screen.getByRole('button');

    await act(async () => {
      fireEvent.click(button);
      await Promise.resolve();
    });

    const testText = 'Test speech input';
    
    await act(async () => {
      if (mockRecognitionInstance.onresult) {
        mockRecognitionInstance.onresult({
          results: [[{ transcript: testText }]]
        });
      }
      if (mockRecognitionInstance.onend) {
        mockRecognitionInstance.onend();
      }
      await Promise.resolve();
    });

    expect(mockOnSpeechResult).toHaveBeenCalledWith(testText);
    expect(button).not.toHaveClass('listening');
    expect(button).not.toBeDisabled();
  });

  it('handles speech recognition errors', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    await act(async () => {
      render(<VoiceButton onSpeechResult={mockOnSpeechResult} />);
    });
    const button = screen.getByRole('button');

    await act(async () => {
      fireEvent.click(button);
      await Promise.resolve();
    });

    const mockError = { error: 'no-speech' };

    await act(async () => {
      if (mockRecognitionInstance.onerror) {
        mockRecognitionInstance.onerror(mockError);
      }
      await Promise.resolve();
    });

    expect(consoleSpy).toHaveBeenCalledWith('Speech recognition error:', 'no-speech');
    expect(button).not.toHaveClass('listening');
    expect(button).not.toBeDisabled();

    consoleSpy.mockRestore();
  });

  it('handles recognition end event', async () => {
    await act(async () => {
      render(<VoiceButton onSpeechResult={mockOnSpeechResult} />);
    });
    const button = screen.getByRole('button');

    await act(async () => {
      fireEvent.click(button);
      await Promise.resolve();
    });

    await act(async () => {
      if (mockRecognitionInstance.onend) {
        mockRecognitionInstance.onend();
      }
      await Promise.resolve();
    });

    expect(button).not.toHaveClass('listening');
    expect(button).not.toBeDisabled();
  });

  it('handles unsupported browsers', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    
    // Remove SpeechRecognition support
    Object.defineProperty(window, 'SpeechRecognition', {
      value: undefined,
      writable: true
    });
    Object.defineProperty(window, 'webkitSpeechRecognition', {
      value: undefined,
      writable: true
    });

    await act(async () => {
      render(<VoiceButton onSpeechResult={mockOnSpeechResult} />);
    });
    const button = screen.getByRole('button');

    await act(async () => {
      fireEvent.click(button);
      await Promise.resolve();
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      'Speech recognition is not supported in this browser. Please use Chrome, Edge, Safari (14.1+), or Opera.'
    );
    expect(button).not.toHaveClass('listening');
    expect(button).not.toBeDisabled();

    consoleSpy.mockRestore();
  });
});
