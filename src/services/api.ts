import { API_CONFIG } from '../config/api';
import { supabase } from '../lib/supabase';
import { Message } from '../types/chat';

interface N8NResponse {
  text?: string;
  audioUrl?: string;
}

interface ChatHistoryMessage {
  text: string;
  isUser: boolean;
  role: 'user' | 'assistant';
  timestamp: string;
  audioUrl?: string;
}

export const sendMessageToN8N = async (message: Message): Promise<any> => {
  try {
    // Use the production webhook URL
    const webhookUrl = API_CONFIG.N8N_WEBHOOK_URL;
    
    // Format the request body
    const requestBody = {
      content: message.content,
      role: message.role,
      type: message.type,
      userId: message.userId || 'anonymous',
      timestamp: message.timestamp.toISOString()
    };
    
    console.log('Sending message to n8n webhook:', {
      url: webhookUrl,
      requestBody,
      headers: API_CONFIG.DEFAULT_HEADERS
    });
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: API_CONFIG.DEFAULT_HEADERS,
      body: JSON.stringify(requestBody),
      mode: 'cors',
      credentials: 'omit'
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    // Get the raw response text first
    const responseText = await response.text();
    console.log('Raw response from n8n:', responseText);

    if (!response.ok) {
      console.error('HTTP error response:', {
        status: response.status,
        statusText: response.statusText,
        body: responseText
      });

      // Handle 500 errors specifically
      if (response.status === 500) {
        console.error('Server error details:', responseText);
        return {
          text: "I apologize, but there's an issue with the server processing your request. The error has been logged and will be addressed. Please try again in a moment.",
          type: 'text'
        };
      }

      throw new Error(`HTTP error! status: ${response.status}, body: ${responseText}`);
    }

    // If the response is empty, return a default response
    if (!responseText.trim()) {
      console.log('Received empty response from n8n');
      return {
        text: "I apologize, but I'm having trouble processing your request right now. Please try again in a moment.",
        type: 'text'
      };
    }

    try {
      // Try to parse the response as JSON
      const data = JSON.parse(responseText);
      console.log('Parsed response data:', data);

      // Handle the n8n response format
      if (Array.isArray(data) && data.length > 0 && data[0].output) {
        return {
          text: data[0].output,
          type: 'text'
        };
      }

      // If the response doesn't match the expected format, return the raw data
      return data;
    } catch (parseError) {
      console.error('Error parsing n8n response:', parseError);
      // If parsing fails, return a formatted response with the raw text
      return {
        text: responseText,
        type: 'text'
      };
    }
  } catch (error) {
    console.error('Error sending message to n8n:', error);
    // Return a user-friendly error response
    return {
      text: "I apologize, but I'm having trouble connecting to the server right now. Please try again in a moment.",
      type: 'text'
    };
  }
};

export const sendTestMessageToN8N = async (message: Message): Promise<any> => {
  try {
    // Get the user ID from localStorage
    const userId = localStorage.getItem('userId') || 'anonymous';
    
    // Format the request body
    const requestBody = {
      message: {
        content: message.content,
        role: message.role,
        type: message.type
      },
      userId: userId,
      timestamp: new Date().toISOString()
    };
    
    console.log('Sending test message to n8n webhook:', requestBody);
    
    const response = await fetch(API_CONFIG.N8N_WEBHOOK_TEST_URL, {
      method: 'POST',
      headers: API_CONFIG.DEFAULT_HEADERS,
      body: JSON.stringify(requestBody),
      mode: 'cors',
      credentials: 'omit'
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Get the raw response text first
    const responseText = await response.text();
    console.log('Raw test response from n8n:', responseText);

    // If the response is empty, return a default response
    if (!responseText.trim()) {
      console.log('Received empty response from n8n test endpoint');
      return {
        text: "Test message received but no response generated.",
        type: 'text'
      };
    }

    try {
      // Try to parse the response as JSON
      const data = JSON.parse(responseText);
      return data;
    } catch (parseError) {
      console.error('Error parsing n8n test response:', parseError);
      // If parsing fails, return a formatted response with the raw text
      return {
        text: responseText,
        type: 'text'
      };
    }
  } catch (error) {
    console.error('Error sending test message to n8n:', error);
    // Return a user-friendly error response
    return {
      text: "I apologize, but I'm having trouble connecting to the test server right now. Please try again in a moment.",
      type: 'text'
    };
  }
};

export const generateSpeech = async (text: string): Promise<string> => {
  try {
    console.log('Generating speech for text:', text);
    const response = await fetch(`${API_CONFIG.ELEVENLABS_API_URL}/text-to-speech/${API_CONFIG.ELEVENLABS_VOICE_ID}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': API_CONFIG.ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    console.log('Generated audio URL:', audioUrl);
    return audioUrl;
  } catch (error) {
    console.error('Error generating speech:', error);
    throw error;
  }
};

export const getChatHistory = async (sessionId: string): Promise<ChatHistoryMessage[]> => {
  try {
    const { data, error } = await supabase
      .from('n8n_chat_histories')
      .select('message')
      .eq('sessionid', sessionId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Supabase error:', error);
      return []; // Return empty array on error instead of throwing
    }
    
    return data.map(item => item.message as ChatHistoryMessage);
  } catch (error) {
    console.error('Error fetching chat history:', error);
    return []; // Return empty array on error instead of throwing
  }
}; 