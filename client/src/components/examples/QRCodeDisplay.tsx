import QRCodeDisplay from '../QRCodeDisplay';

export default function QRCodeDisplayExample() {
  return (
    <QRCodeDisplay 
      qrCode={null} 
      isConnected={false} 
      onRefresh={() => console.log('Refresh QR clicked')} 
    />
  );
}
