import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const BACKEND_SERVER_URL = import.meta.env.VITE_SERVER_URL;

interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
}

function generateUUID() {
  if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  } else {
    // Simple fallback UUID (not cryptographically perfect)
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

export function useChat(initialThreadId?: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentCountry, setCurrentCountry] = useState<string | null>("El Salvador");

  const [isLoading, setIsLoading] = useState(false);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(
    initialThreadId || null
  );

  const { toast } = useToast();

  const getCountryName = async (content: string) => {
    const countries = ["El Salvador", "Costa Rica", "Nicaragua", "Honduras"];
    const lowerContent = content.toLowerCase();

    for (const country of countries) {
      if (lowerContent.includes(country.toLowerCase())) {
        return country;
      }
    }

    return null;
  };

  const fetchThreadMessages = async (threadId: string) => {
    try {
      setIsLoading(true);
      setCurrentThreadId(threadId);

      const response = await fetch(
        `${BACKEND_SERVER_URL}/api/get-thread-history`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            threadId: threadId,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.json(); // or use response.json() if it's JSON
        throw new Error(`Server error: ${errorText}`);
      }
      const data = await response.json();
      setMessages(data.messages.reverse());
    } catch (error) {
      console.error("Error fetching messages:", error);
      toast({
        title: "Error",
        description: "Failed to fetch messages. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async (content: string) => {
    try {
      setIsLoading(true);

      // Detect country from the content
      const detectedCountry = await getCountryName(content);

      if (detectedCountry && detectedCountry !== currentCountry) {
        setCurrentCountry(detectedCountry);
      }

      // Add user message to UI
      const userMessage: Message = {
        id: generateUUID(),
        content,
        role: "user",
      };
      setMessages((prev) => [...prev, userMessage]);

      const { data: sessionData, error } = await supabase.auth.getSession();

      if (error) {
        console.error("Error fetching session:", error);
        return;
      }

      const userID = sessionData?.session?.user?.id;
      const res = await fetch(`${BACKEND_SERVER_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userID: userID,
          threadID: currentThreadId,
          query: content,
          country: detectedCountry || currentCountry, // <-- send currentCountry to backend
        }),
      });

      if (!res.ok) {
        const errorText = await res.json(); // or use response.json() if it's JSON
        throw new Error(`Server error: ${errorText}`);
      }

      const { response, threadID } = await res.json();

      // Update thread ID if this is a new conversation
      if (!currentThreadId) {
        setCurrentThreadId(threadID);
      }

      // Add assistant message to UI
      setMessages((prev) => [
        ...prev,
        {
          id: generateUUID(),
          content: response,
          role: "assistant",
        },
      ]);
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return {
    messages,
    setMessages, // Add this line to return setMessages
    isLoading,
    sendMessage,
    fetchThreadMessages,
    currentThreadId,
    resetThreadId: () => setCurrentThreadId(null),
  };
}
