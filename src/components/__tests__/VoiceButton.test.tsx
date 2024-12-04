import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import VoiceButton from '../VoiceButton';

// Mock the Web Speech API
interface SpeechRecognitionEvent {
  resultIndex: number;
  results: {
    length: number;
    item(index: number): {
      isFinal: boolean;
      length: number;
      item(index: number): {
        transcript: string;
        confidence: number;
      };
    };
  };
  type: string;
  bubbles: boolean;
  cancelable: boolean;
  timeStamp: number;
}

class MockSpeechRecognition {
  continuous: boolean = false;
  interimResults: boolean = false;
  maxAlternatives: number = 3;
  lang: string = '';
  onresult: ((event: SpeechRecognitionEvent) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
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

  it('renders with proper accessibility attributes', () => {
    render(<VoiceButton onSpeechResult={mockOnSpeechResult} />);

    const button = screen.getByRole('button', { name: 'Start voice input' });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('voice-button');
    expect(button).toHaveAttribute('aria-label', 'Start voice input');
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button).not.toBeDisabled();
  });

  it('starts listening when clicked', async () => {
    render(<VoiceButton onSpeechResult={mockOnSpeechResult} />);

    const button = screen.getByRole('button', { name: 'Start voice input' });
    
    await act(async () => {
      fireEvent.click(button);
    });

    expect(mockRecognitionInstance.start).toHaveBeenCalled();
    expect(button).toHaveClass('voice-button', 'listening');
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(button).toBeDisabled();

    // Verify recognition configuration
    expect(mockRecognitionInstance.continuous).toBe(false);
    expect(mockRecognitionInstance.interimResults).toBe(true);
    expect(mockRecognitionInstance.maxAlternatives).toBe(3);
    expect(mockRecognitionInstance.lang).toBe('en-US');
  });

  it('handles successful speech recognition', async () => {
    render(<VoiceButton onSpeechResult={mockOnSpeechResult} />);

    const button = screen.getByRole('button', { name: 'Start voice input' });
    
    await act(async () => {
      fireEvent.click(button);
    });

    const testText = 'Test speech input';
    
    await act(async () => {
      // Simulate recognition result
      mockRecognitionInstance.onresult?.({
        resultIndex: 0,
        results: {
          length: 1,
          item: (index: number) => ({
            isFinal: true,
            length: 1,
            item: (index: number) => ({
              transcript: testText,
              confidence: 0.9
            })
          })
        },
        type: 'result',
        bubbles: false,
        cancelable: false,
        timeStamp: Date.now()
      });

      // Simulate recognition end
      mockRecognitionInstance.onend?.();
    });

    expect(mockOnSpeechResult).toHaveBeenCalledWith(testText);
    expect(button).not.toHaveClass('listening');
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button).not.toBeDisabled();
  });

  it('handles low confidence results', async () => {
    render(<VoiceButton onSpeechResult={mockOnSpeechResult} />);

    const button = screen.getByRole('button', { name: 'Start voice input' });
    
    await act(async () => {
      fireEvent.click(button);
    });

    await act(async () => {
      // Simulate recognition result
      mockRecognitionInstance.onresult?.({
        resultIndex: 0,
        results: {
          length: 1,
          item: (index: number) => ({
            isFinal: true,
            length: 3,
            item: (index: number) => ({
              transcript: `Low confidence ${index + 1}`,
              confidence: 0.4 - (index * 0.1)
            })
          })
        },
        type: 'result',
        bubbles: false,
        cancelable: false,
        timeStamp: Date.now()
      });

      // Simulate recognition end
      mockRecognitionInstance.onend?.();
    });

    expect(mockOnSpeechResult).toHaveBeenCalledWith('Low confidence 1 OR Low confidence 2 OR Low confidence 3');
    expect(button).not.toHaveClass('listening');
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button).not.toBeDisabled();
  });

  it('handles speech recognition error', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    render(<VoiceButton onSpeechResult={mockOnSpeechResult} />);

    const button = screen.getByRole('button', { name: 'Start voice input' });
    
    await act(async () => {
      fireEvent.click(button);
    });

    await act(async () => {
      // Simulate error and end events
      mockRecognitionInstance.onerror?.({ error: 'test error' });
      mockRecognitionInstance.onend?.();
    });

    expect(consoleSpy).toHaveBeenCalledWith('Speech recognition error:', 'test error');
    expect(button).not.toHaveClass('listening');
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button).not.toBeDisabled();

    consoleSpy.mockRestore();
  });

  it('handles browser not supporting speech recognition', async () => {
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

    render(<VoiceButton onSpeechResult={mockOnSpeechResult} />);

    const button = screen.getByRole('button', { name: 'Start voice input' });
    
    await act(async () => {
      fireEvent.click(button);
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      'Speech recognition is not supported in this browser. Please use Chrome, Edge, Safari (14.1+), or Opera.'
    );
    expect(button).not.toHaveClass('listening');
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button).not.toBeDisabled();

    consoleSpy.mockRestore();
  });
});
