import React from 'react';

interface ChatMessageProps {
  message: string;
  isUser: boolean;
  onPlay?: () => void;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, isUser, onPlay }) => {
  return (
    <div className={`message-container ${isUser ? 'user' : 'ai'}`}>
      <div className="message-bubble">
        <p>{message}</p>
        {!isUser && onPlay && (
          <button className="play-button" onClick={onPlay}>
            🔊 Play
          </button>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;
