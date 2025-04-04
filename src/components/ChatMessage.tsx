import React from 'react';
import { Message } from '../types/chat';
import YouTubePlayer from './YouTubePlayer';

interface ChatMessageProps {
  message: Message;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-[80%] ${isUser ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800'} rounded-lg p-4`}>
        <div className="text-sm mb-2">
          {message.content}
        </div>
        {message.type === 'video' && message.videoId && (
          <div className="mt-2">
            <YouTubePlayer videoId={message.videoId} />
            {message.videoTitle && (
              <div className="text-sm mt-2 italic">
                {message.videoTitle}
              </div>
            )}
          </div>
        )}
        <div className="text-xs mt-2 opacity-70">
          {message.timestamp.toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage; 