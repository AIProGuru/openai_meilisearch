
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Plus } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { ChatThread } from "@/hooks/use-chat-threads";

interface ChatItem {
  id: string;
  title: string;
  createdAt: string;
}

interface GroupedChats {
  today: ChatThread[];
  lastWeek: ChatThread[];
  lastMonth: ChatThread[];
  older: ChatThread[];
}

interface ChatSidebarProps {
  chats: ChatThread[];
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  activeChatId?: string;
  groupedChats: GroupedChats;
}

export const ChatSidebar = ({ onSelectChat, onNewChat, activeChatId, groupedChats }: ChatSidebarProps) => {
  const isMobile = useIsMobile();
  
  const renderChatGroup = (chats: ChatThread[], title: string) => {
    if (chats.length === 0) return null;
    
    return (
      <div className="space-y-2">
        <h3 className="px-3 text-xs font-medium text-gray-400">{title}</h3>
        {chats.map((chat) => (
          <Button
            key={chat.id}
            variant="ghost"
            className={`w-full justify-start ${
              chat.id === activeChatId ? 'bg-gray-700' : 'hover:bg-gray-800'
            }`}
            onClick={() => onSelectChat(chat.threadID)}
          >
            <MessageSquare className="mr-2 h-4 w-4 shrink-0" />
            <span className="truncate">{chat.title}</span>
          </Button>
        ))}
      </div>
    );
  };

  return (
    <div className={`${isMobile ? 'w-full' : 'w-[260px]'} h-full bg-gray-900 text-white flex flex-col`}>
      <div className="p-3">
        <Button 
          onClick={onNewChat}
          className="w-full bg-gray-700 hover:bg-gray-600"
        >
          <Plus className="mr-2 h-4 w-4" />
          New chat
        </Button>
      </div>
      
      <ScrollArea className="flex-1 px-3">
        <div className="space-y-4 pb-4">
          {renderChatGroup(groupedChats.today, "Today")}
          {renderChatGroup(groupedChats.lastWeek, "Previous 7 Days")}
          {renderChatGroup(groupedChats.lastMonth, "Previous 30 Days")}
          {renderChatGroup(groupedChats.older, "Older")}
        </div>
      </ScrollArea>
    </div>
  );
};
