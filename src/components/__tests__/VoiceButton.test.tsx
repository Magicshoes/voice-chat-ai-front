import React, { act } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import VoiceButton from '../VoiceButton';

// Mock the Web Speech API
class MockSpeechRecognition {
  continuous: boolean = false;
  interimResults: boolean = false;
  maxAlternatives: number = 3;
  lang: string = '';
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

  it('renders with proper accessibility attributes', async () => {
    await act(async () => {
      render(<VoiceButton onSpeechResult={mockOnSpeechResult} />);
    });

    const button = screen.getByRole('button', { name: 'Start voice input' });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('voice-button');
    expect(button).toHaveAttribute('aria-label', 'Start voice input');
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button).not.toBeDisabled();
  });

  it('starts listening when clicked', async () => {
    await act(async () => {
      render(<VoiceButton onSpeechResult={mockOnSpeechResult} />);
    });

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
    await act(async () => {
      render(<VoiceButton onSpeechResult={mockOnSpeechResult} />);
    });

    const button = screen.getByRole('button', { name: 'Start voice input' });
    
    await act(async () => {
      fireEvent.click(button);
    });

    const testText = 'Test speech input';
    
    await act(async () => {
      const mockResults = [
        {
          isFinal: true,
          0: { transcript: testText, confidence: 0.9 },
          1: { transcript: 'Test speech input 2', confidence: 0.7 },
          2: { transcript: 'Test speech input 3', confidence: 0.5 },
          length: 3
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

    expect(mockOnSpeechResult).toHaveBeenCalledWith(testText);
    expect(button).not.toHaveClass('listening');
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button).not.toBeDisabled();
  });

  it('handles low confidence results', async () => {
    await act(async () => {
      render(<VoiceButton onSpeechResult={mockOnSpeechResult} />);
    });

    const button = screen.getByRole('button', { name: 'Start voice input' });
    
    await act(async () => {
      fireEvent.click(button);
    });

    await act(async () => {
      const mockResults = [
        {
          isFinal: true,
          0: { transcript: 'Low confidence 1', confidence: 0.4 },
          1: { transcript: 'Low confidence 2', confidence: 0.3 },
          2: { transcript: 'Low confidence 3', confidence: 0.2 },
          length: 3
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

    expect(mockOnSpeechResult).toHaveBeenCalledWith('Low confidence 1 OR Low confidence 2 OR Low confidence 3');
    expect(button).not.toHaveClass('listening');
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button).not.toBeDisabled();
  });

  it('handles speech recognition error', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    await act(async () => {
      render(<VoiceButton onSpeechResult={mockOnSpeechResult} />);
    });

    const button = screen.getByRole('button', { name: 'Start voice input' });
    
    await act(async () => {
      fireEvent.click(button);
    });

    await act(async () => {
      mockRecognitionInstance.onerror?.({ error: 'test error' });
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

    await act(async () => {
      render(<VoiceButton onSpeechResult={mockOnSpeechResult} />);
    });

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
