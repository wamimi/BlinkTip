const ROOT_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://blink-tip.vercel.app';

export const minikitConfig = {
  accountAssociation: {
    header: "", // Will be added after generating credentials on base.dev
    payload: "",
    signature: ""
  },
  miniapp: {
    version: "1",
    name: "BlinkTip",
    subtitle: "Universal Micro-Tips",
    description: "Accept tips from humans via Solana Actions and AI agents via x402 protocol. Multi-chain support for Solana, Base, and Celo.",
    screenshotUrls: [
      `${ROOT_URL}/screenshots/1.png`,
      `${ROOT_URL}/screenshots/2.png`,
      `${ROOT_URL}/screenshots/3.png`
    ],
    iconUrl: `${ROOT_URL}/icon.png`,
    splashImageUrl: `${ROOT_URL}/splash.png`,
    splashBackgroundColor: "#8B5CF6", // 
    homeUrl: ROOT_URL,
    webhookUrl: `${ROOT_URL}/api/webhook`, // For notifications and XMTP agent later
    primaryCategory: "social",
    tags: ["crypto", "tips", "ai", "agents", "web3"],
    heroImageUrl: `${ROOT_URL}/hero.png`,
    tagline: "Get tipped instantly and anywhere!",
    ogTitle: "BlinkTip - Universal Micro-Tip Links",
    ogDescription: "Accept tips from humans and AI agents across multiple chains",
    ogImageUrl: `${ROOT_URL}/hero.png`,
    noindex: false // Set to true during testing/development
  }
} as const;
