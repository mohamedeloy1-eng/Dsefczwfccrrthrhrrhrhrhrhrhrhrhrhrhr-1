import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, Smartphone, CheckCircle2, Wrench, Phone, QrCode, Loader2, Copy, Check } from "lucide-react";
import { useState, useEffect } from "react";

interface QRCodeDisplayProps {
  qrCode: string | null;
  isConnected: boolean;
  onRefresh: () => void;
  onRepair: () => void;
  onRequestPairingCode: (phoneNumber: string) => Promise<{ success: boolean; code?: string; error?: string }>;
  pairingCode?: string | null;
  isRepairing?: boolean;
  isRefreshing?: boolean;
}

export default function QRCodeDisplay({ 
  qrCode, 
  isConnected, 
  onRefresh, 
  onRepair,
  onRequestPairingCode,
  pairingCode: externalPairingCode,
  isRepairing = false,
  isRefreshing = false
}: QRCodeDisplayProps) {
  const [localRefreshing, setLocalRefreshing] = useState(false);
  const [localRepairing, setLocalRepairing] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isRequestingCode, setIsRequestingCode] = useState(false);
  const [localPairingCode, setLocalPairingCode] = useState<string | null>(null);
  const [pairingError, setPairingError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isRefreshing && localRefreshing) {
      setLocalRefreshing(false);
    }
  }, [isRefreshing, localRefreshing]);

  useEffect(() => {
    if (!isRepairing && localRepairing) {
      setLocalRepairing(false);
    }
  }, [isRepairing, localRepairing]);

  const handleRefresh = async () => {
    setLocalRefreshing(true);
    try {
      await Promise.resolve(onRefresh());
    } finally {
      setTimeout(() => setLocalRefreshing(false), 2000);
    }
  };

  const handleRepair = async () => {
    setLocalRepairing(true);
    try {
      await Promise.resolve(onRepair());
    } finally {
      setTimeout(() => setLocalRepairing(false), 3000);
    }
  };

  const handleRequestPairingCode = async () => {
    if (!phoneNumber.trim()) {
      setPairingError("Please enter your phone number");
      return;
    }

    setIsRequestingCode(true);
    setPairingError(null);
    setLocalPairingCode(null);

    try {
      const result = await onRequestPairingCode(phoneNumber.trim());
      if (result.success && result.code) {
        setLocalPairingCode(result.code);
      } else {
        setPairingError(result.error || "Failed to get pairing code");
      }
    } catch (error: any) {
      setPairingError(error?.message || "Failed to request pairing code");
    } finally {
      setIsRequestingCode(false);
    }
  };

  const handleCopyCode = () => {
    const code = localPairingCode || externalPairingCode;
    if (code) {
      navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const showRefreshing = isRefreshing || localRefreshing;
  const showRepairing = isRepairing || localRepairing;
  const displayPairingCode = localPairingCode || externalPairingCode;

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
              Connect WhatsApp
            </CardTitle>
            <CardDescription>Link your WhatsApp to activate GX-MODY</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRepair}
              disabled={showRepairing}
              data-testid="button-repair"
            >
              <Wrench className={`h-4 w-4 mr-2 ${showRepairing ? 'animate-pulse' : ''}`} />
              Repair
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh}
              disabled={showRefreshing}
              data-testid="button-refresh-qr"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${showRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="qr" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="qr" className="gap-2" data-testid="tab-qr-code">
              <QrCode className="h-4 w-4" />
              QR Code
            </TabsTrigger>
            <TabsTrigger value="phone" className="gap-2" data-testid="tab-phone-link">
              <Phone className="h-4 w-4" />
              Phone Number
            </TabsTrigger>
          </TabsList>

          <TabsContent value="qr" className="mt-0">
            <div className="flex flex-col items-center justify-center py-4">
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
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground px-4">
                      Generating QR Code...
                    </p>
                  </div>
                </div>
              )}
              <div className="mt-4 text-center space-y-1">
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
            </div>
          </TabsContent>

          <TabsContent value="phone" className="mt-0">
            <div className="flex flex-col items-center justify-center py-4 space-y-4">
              <div className="w-full max-w-xs space-y-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Phone Number</label>
                  <Input
                    type="tel"
                    placeholder="201234567890"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="text-center text-lg"
                    dir="ltr"
                    data-testid="input-phone-number"
                    disabled={isRequestingCode}
                  />
                  <p className="text-xs text-muted-foreground text-center">
                    Enter your number with country code (e.g., 201234567890)
                  </p>
                </div>

                <Button
                  onClick={handleRequestPairingCode}
                  disabled={isRequestingCode || !phoneNumber.trim()}
                  className="w-full"
                  data-testid="button-request-code"
                >
                  {isRequestingCode ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Requesting Code...
                    </>
                  ) : (
                    <>
                      <Phone className="h-4 w-4 mr-2" />
                      Get Linking Code
                    </>
                  )}
                </Button>

                {pairingError && (
                  <p className="text-sm text-destructive text-center" data-testid="text-pairing-error">
                    {pairingError}
                  </p>
                )}

                {displayPairingCode && (
                  <div className="mt-4 p-4 bg-primary/10 rounded-lg text-center space-y-2">
                    <p className="text-sm font-medium">Your Linking Code:</p>
                    <div className="flex items-center justify-center gap-2">
                      <p className="text-3xl font-bold tracking-widest font-mono" data-testid="text-pairing-code" dir="ltr">
                        {displayPairingCode}
                      </p>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleCopyCode}
                        data-testid="button-copy-code"
                      >
                        {copied ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Enter this code in WhatsApp to link your device
                    </p>
                  </div>
                )}
              </div>

              <div className="text-center space-y-1 pt-2">
                <p className="text-sm text-muted-foreground">
                  1. Open WhatsApp on your phone
                </p>
                <p className="text-sm text-muted-foreground">
                  2. Go to Settings → Linked Devices
                </p>
                <p className="text-sm text-muted-foreground">
                  3. Tap "Link a Device" then "Link with phone number instead"
                </p>
                <p className="text-sm text-muted-foreground">
                  4. Enter the linking code shown above
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
