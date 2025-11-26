import Header from '../Header';

export default function HeaderExample() {
  return <Header isConnected={true} onToggleConnection={() => console.log('Toggle connection')} />;
}
