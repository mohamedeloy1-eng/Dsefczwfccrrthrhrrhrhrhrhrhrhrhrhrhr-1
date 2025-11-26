import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Smartphone, CheckCircle2 } from "lucide-react";
import { useState } from "react";

interface QRCodeDisplayProps {
  qrCode: string | null;
  isConnected: boolean;
  onRefresh: () => void;
}

export default function QRCodeDisplay({ qrCode, isConnected, onRefresh }: QRCodeDisplayProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    onRefresh();
    setTimeout(() => setIsRefreshing(false), 1500);
  };

  if (isConnected) {
    return (
      <Card data-testid="card-qr-connected">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            WhatsApp Connection
          </CardTitle>
          <CardDescription>Your bot is connected and ready</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-8">
          <div className="p-4 rounded-full bg-primary/10 mb-4">
            <CheckCircle2 className="h-16 w-16 text-primary" />
          </div>
          <p className="text-lg font-medium text-center">Successfully Connected</p>
          <p className="text-sm text-muted-foreground text-center mt-1">
            GX-MODY is now active and responding to messages
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-qr-display">
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Scan QR Code
            </CardTitle>
            <CardDescription>Connect your WhatsApp to activate GX-MODY</CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={isRefreshing}
            data-testid="button-refresh-qr"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center py-4">
        {qrCode ? (
          <div className="p-4 bg-white rounded-lg" data-testid="qr-code-image">
            <img 
              src={qrCode} 
              alt="WhatsApp QR Code" 
              className="w-48 h-48 object-contain"
            />
          </div>
        ) : (
          <div className="w-48 h-48 bg-muted rounded-lg flex items-center justify-center" data-testid="qr-code-placeholder">
            <p className="text-sm text-muted-foreground text-center px-4">
              Generating QR Code...
            </p>
          </div>
        )}
        <div className="mt-4 text-center">
          <p className="text-sm text-muted-foreground">
            1. Open WhatsApp on your phone
          </p>
          <p className="text-sm text-muted-foreground">
            2. Tap Menu or Settings and select Linked Devices
          </p>
          <p className="text-sm text-muted-foreground">
            3. Point your phone at this screen to scan the code
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
