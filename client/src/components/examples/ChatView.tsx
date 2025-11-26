import ChatView from '../ChatView';

const mockMessages = [
  {
    id: '1',
    content: 'Hello! How can I help you?',
    isBot: false,
    timestamp: '10:30 AM',
  },
  {
    id: '2',
    content: 'Hello! I am GX-MODY, your AI assistant. I can help you with any questions you have. What would you like to know?',
    isBot: true,
    timestamp: '10:30 AM',
  },
  {
    id: '3',
    content: 'What is the capital of Egypt?',
    isBot: false,
    timestamp: '10:31 AM',
  },
  {
    id: '4',
    content: 'The capital of Egypt is Cairo. It is the largest city in Egypt and the Arab world, and one of the largest cities in Africa. Cairo is located on the banks of the Nile River.',
    isBot: true,
    timestamp: '10:31 AM',
  },
];

export default function ChatViewExample() {
  return <ChatView messages={mockMessages} userName="Ahmed Mohamed" />;
}
