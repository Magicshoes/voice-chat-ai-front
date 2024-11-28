import React from 'react';

interface ChatMessageProps {
  message: string;
  isUser: boolean;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, isUser }) => {
  return (
    <div className={`message-container ${isUser ? 'user' : 'ai'}`}>
      <div className="message-bubble">
        <p>{message}</p>
      </div>
    </div>
  );
};

export default ChatMessage;
