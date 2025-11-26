import SettingsPanel from '../SettingsPanel';

export default function SettingsPanelExample() {
  return (
    <SettingsPanel 
      botName="GX-MODY"
      systemPrompt="You are GX-MODY, a helpful and friendly AI assistant. Answer questions clearly and concisely. Always be polite and helpful."
      autoReply={true}
      onSave={(settings) => console.log('Settings saved:', settings)}
    />
  );
}
