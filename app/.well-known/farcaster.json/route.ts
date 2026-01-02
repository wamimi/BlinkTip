const ROOT_URL = (process.env.NEXT_PUBLIC_BASE_URL || 'https://blink-tip.vercel.app').replace(/\/$/, '');

export async function GET() {
  return Response.json({
    accountAssociation: {
      header: "", // Will be added after generating credentials on base.dev
      payload: "",
      signature: ""
    },
    frame: {
      version: "1",
      name: "BlinkTip",
      iconUrl: `${ROOT_URL}/icon.png`,
      splashImageUrl: `${ROOT_URL}/splash.png`,
      splashBackgroundColor: "#8B5CF6",
      homeUrl: ROOT_URL,
      webhookUrl: `${ROOT_URL}/api/webhook`
    }
  });
}
