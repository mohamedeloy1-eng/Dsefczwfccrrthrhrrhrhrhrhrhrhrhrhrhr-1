import ConversationList from '../ConversationList';

const mockConversations = [
  {
    id: '1',
    phoneNumber: '+201234567890',
    name: 'Ahmed Mohamed',
    lastMessage: 'How can I help you today?',
    timestamp: '2m ago',
    unreadCount: 3,
  },
  {
    id: '2',
    phoneNumber: '+201987654321',
    name: 'Sara Ali',
    lastMessage: 'Thank you for your help!',
    timestamp: '15m ago',
    unreadCount: 0,
  },
  {
    id: '3',
    phoneNumber: '+201122334455',
    name: 'Omar Hassan',
    lastMessage: 'What is the weather today?',
    timestamp: '1h ago',
    unreadCount: 1,
  },
];

export default function ConversationListExample() {
  return (
    <ConversationList 
      conversations={mockConversations} 
      selectedId="1" 
      onSelect={(id) => console.log('Selected:', id)} 
    />
  );
}
