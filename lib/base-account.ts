import { createBaseAccountSDK } from '@base-org/account'

const ROOT_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://blink-tip.vercel.app'

export const baseAccountSDK = createBaseAccountSDK({
  appName: 'BlinkTip',
  appLogoUrl: `${ROOT_URL}/icon.png`,
})

export const baseAccountProvider = baseAccountSDK.getProvider()
