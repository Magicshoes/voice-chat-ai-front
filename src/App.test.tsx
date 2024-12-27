import  { act } from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from './App';

describe('App Component', () => {
  it('renders the app header and title', async () => {
    await act(async () => {
      render(<App />);
    });
    
    expect(screen.getByText('AI Voice Chat')).toBeInTheDocument();
  });

  it('renders the model selector with default options', async () => {
    await act(async () => {
      render(<App />);
    });
    
    const selector = screen.getByRole('combobox');
    expect(selector).toBeInTheDocument();
    
    expect(screen.getByText('GPT-3.5 Turbo')).toBeInTheDocument();
    expect(screen.getByText('GPT-4')).toBeInTheDocument();
  });

  it('renders the voice button', async () => {
    await act(async () => {
      render(<App />);
    });
    
    const voiceButton = screen.getByRole('button');
    expect(voiceButton).toBeInTheDocument();
    expect(voiceButton.querySelector('svg')).toBeInTheDocument();
  });

  it('renders the chat container', async () => {
    await act(async () => {
      render(<App />);
    });
    
    const main = screen.getByRole('main');
    expect(main).toHaveClass('chat-container');
    expect(main.querySelector('.messages-container')).toBeInTheDocument();
  });
});
