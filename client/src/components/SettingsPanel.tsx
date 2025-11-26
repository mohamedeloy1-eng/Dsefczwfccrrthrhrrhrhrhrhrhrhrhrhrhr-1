import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Settings, Save, Key, MessageSquareText } from "lucide-react";
import { useState } from "react";

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

  const handleSave = () => {
    setIsSaving(true);
    onSave({ botName, systemPrompt, autoReply });
    setTimeout(() => setIsSaving(false), 1000);
  };

  return (
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
            <Label htmlFor="autoReply">Auto Reply</Label>
            <p className="text-xs text-muted-foreground">
              Automatically respond to all incoming messages
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
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? 'Saving...' : 'Save Settings'}
        </Button>
      </CardContent>
    </Card>
  );
}
