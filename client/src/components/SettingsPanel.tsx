import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Settings, Save, Key, MessageSquareText, Image, Trash2, Upload } from "lucide-react";
import { useState, useRef, useEffect } from "react";

interface SettingsPanelProps {
  botName: string;
  systemPrompt: string;
  autoReply: boolean;
  onSave: (settings: { botName: string; systemPrompt: string; autoReply: boolean }) => void;
}

export default function SettingsPanel({ botName: initialName, systemPrompt: initialPrompt, autoReply: initialAutoReply, onSave }: SettingsPanelProps) {
  const [botName, setBotName] = useState(initialName);
  const [systemPrompt, setSystemPrompt] = useState(initialPrompt);
  const [autoReply, setAutoReply] = useState(initialAutoReply);
  const [isSaving, setIsSaving] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedBg = localStorage.getItem('app-background');
    if (savedBg) {
      setBackgroundImage(savedBg);
      applyBackground(savedBg);
    }
  }, []);

  const applyBackground = (imageUrl: string | null) => {
    const root = document.documentElement;
    if (imageUrl) {
      root.style.setProperty('--app-background-image', `url(${imageUrl})`);
      document.body.classList.add('has-background-image');
    } else {
      root.style.removeProperty('--app-background-image');
      document.body.classList.remove('has-background-image');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('حجم الصورة كبير جداً. الحد الأقصى 5 ميجابايت');
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const imageUrl = event.target?.result as string;
        setBackgroundImage(imageUrl);
        localStorage.setItem('app-background', imageUrl);
        applyBackground(imageUrl);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveBackground = () => {
    setBackgroundImage(null);
    localStorage.removeItem('app-background');
    applyBackground(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = () => {
    setIsSaving(true);
    onSave({ botName, systemPrompt, autoReply });
    setTimeout(() => setIsSaving(false), 1000);
  };

  return (
    <>
      <Card data-testid="card-settings">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Bot Settings
          </CardTitle>
          <CardDescription>Configure your GX-MODY bot behavior</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="botName" className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              Bot Name
            </Label>
            <Input
              id="botName"
              value={botName}
              onChange={(e) => setBotName(e.target.value)}
              placeholder="GX-MODY"
              data-testid="input-bot-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="systemPrompt" className="flex items-center gap-2">
              <MessageSquareText className="h-4 w-4" />
              System Prompt
            </Label>
            <Textarea
              id="systemPrompt"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="You are a helpful AI assistant..."
              className="min-h-[120px] resize-none"
              data-testid="input-system-prompt"
            />
            <p className="text-xs text-muted-foreground">
              This prompt defines how your bot will behave and respond to users
            </p>
          </div>

          <div className="flex items-center justify-between rounded-md border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="autoReply">الرد التلقائي</Label>
              <p className="text-xs text-muted-foreground">
                الرد تلقائياً على جميع الرسائل الواردة
              </p>
            </div>
            <Switch
              id="autoReply"
              checked={autoReply}
              onCheckedChange={setAutoReply}
              data-testid="switch-auto-reply"
            />
          </div>

          <Button 
            onClick={handleSave} 
            className="w-full" 
            disabled={isSaving}
            data-testid="button-save-settings"
          >
            <Save className="h-4 w-4 ml-2" />
            {isSaving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
          </Button>
        </CardContent>
      </Card>

      <Card data-testid="card-background-settings" className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Image className="h-5 w-5" />
          خلفية الموقع
        </CardTitle>
        <CardDescription>اختر صورة خلفية للموقع</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept="image/*"
          className="hidden"
          data-testid="input-background-file"
        />

        {backgroundImage ? (
          <div className="space-y-4">
            <div className="relative rounded-lg overflow-hidden border">
              <img 
                src={backgroundImage} 
                alt="خلفية الموقع" 
                className="w-full h-32 object-cover"
                data-testid="img-background-preview"
              />
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                <p className="text-white text-sm">معاينة الخلفية</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1"
                data-testid="button-change-background"
              >
                <Upload className="h-4 w-4 ml-2" />
                تغيير الصورة
              </Button>
              <Button
                variant="destructive"
                onClick={handleRemoveBackground}
                data-testid="button-remove-background"
              >
                <Trash2 className="h-4 w-4 ml-2" />
                إزالة
              </Button>
            </div>
          </div>
        ) : (
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
            data-testid="dropzone-background"
          >
            <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-medium">اضغط لاختيار صورة</p>
            <p className="text-xs text-muted-foreground mt-1">
              PNG, JPG, WEBP (حد أقصى 5 ميجابايت)
            </p>
          </div>
        )}
      </CardContent>
    </Card>
    </>
  );
}
