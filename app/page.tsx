import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black selection:bg-purple-500 selection:text-white relative">
      
      {/* Ambient Background Glows */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-purple-600/10 rounded-full blur-[120px] animate-pulse-glow" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px] animate-pulse-glow [animation-delay:2s]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        {/* Navbar */}
        <nav className="flex items-center justify-between py-8 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-purple-600 to-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-purple-500/20">
              B
            </div>
            <span className="text-2xl font-bold tracking-tight">BlinkTip</span>
          </div>
          <div className="flex items-center gap-4 md:gap-8">
            <Link href="/login" className="hidden md:block text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors">
              Sign In
            </Link>
            <Link
              href="/register-new"
              className="px-6 py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-full font-bold text-sm hover:scale-105 transition-transform duration-200 shadow-xl"
            >
              Get Started
            </Link>
          </div>
        </nav>

        {/* Hero Section */}
        <header className="py-20 md:py-32 text-center relative">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 text-purple-700 dark:text-purple-300 text-sm font-medium mb-8 animate-slide-up">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
            </span>
            Now live: Tips from AI Agents via x402
          </div>
          
          <h1 className="text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-8 animate-slide-up [animation-delay:100ms] leading-[1.1]">
            Tips from <span className="text-gradient">Humans</span><br />
            AND <span className="text-gradient">AI Agents.</span>
          </h1>
          
          <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-12 leading-relaxed animate-slide-up [animation-delay:200ms]">
            The universal tipping layer for the agent economy. One link for Solana, Base, and Celo payments.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up [animation-delay:300ms]">
            <Link
              href="/register-new"
              className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-full font-bold text-lg hover:shadow-2xl hover:shadow-purple-500/30 hover:scale-105 transition-all duration-300"
            >
              Create Your Tip Page
            </Link>
            <Link
              href="#how-it-works"
              className="w-full sm:w-auto px-8 py-4 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 text-gray-900 dark:text-white rounded-full font-bold text-lg hover:bg-gray-50 dark:hover:bg-zinc-800 transition-all duration-300"
            >
              See How It Works
            </Link>
          </div>
        </header>

        {/* Floating Glass Visual */}
        <div className="relative mx-auto max-w-4xl mb-32 animate-float pointer-events-none">
          <div className="glass-card rounded-3xl p-2 transform rotate-1">
            <div className="bg-gradient-to-b from-gray-50 to-white dark:from-zinc-900 dark:to-black rounded-2xl overflow-hidden border border-gray-100 dark:border-zinc-800">
              {/* Fake Browser Header */}
              <div className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between bg-gray-50/50 dark:bg-zinc-900/50">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
                  <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50" />
                </div>
                <div className="px-4 py-1 rounded-md bg-gray-200/50 dark:bg-zinc-800 text-xs font-mono text-gray-500 flex items-center gap-2">
                  <span>🔒</span> blinktip.com/tip/nelly
                </div>
                <div className="w-4" />
              </div>
              
              {/* Fake Content */}
              <div className="p-12 md:p-16 text-center">
                 <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full mx-auto mb-6 shadow-xl ring-4 ring-white dark:ring-black" />
                 <h3 className="text-3xl font-bold mb-2">Nelly CyberPro</h3>
                 <p className="text-gray-500 mb-10">Building the future of AI payments.</p>
                 
                 <div className="flex flex-wrap justify-center gap-4">
                    <div className="flex items-center gap-3 px-6 py-4 rounded-2xl border border-purple-500/20 bg-purple-500/5 text-purple-700 dark:text-purple-300 font-bold shadow-sm">
                      <span className="text-xl">⚡</span> 
                      <div>
                        <div className="text-xs opacity-70 uppercase tracking-wide">Received</div>
                        5.00 USDC (Solana)
                      </div>
                    </div>
                    <div className="flex items-center gap-3 px-6 py-4 rounded-2xl border border-blue-500/20 bg-blue-500/5 text-blue-700 dark:text-blue-300 font-bold shadow-sm">
                      <span className="text-xl">🤖</span> 
                      <div>
                        <div className="text-xs opacity-70 uppercase tracking-wide">AI Agent Tip</div>
                        2.50 USDC (Base)
                      </div>
                    </div>
                 </div>
              </div>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <section id="how-it-works" className="mb-32">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Why Creators Choose BlinkTip</h2>
            <p className="text-gray-500 max-w-2xl mx-auto">The infrastructure layer for the next generation of content monetization.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { title: "One Link, Any Chain", icon: "🌐", desc: "Forget Linktree. One URL accepts Solana, Base, Celo, and more. We route the crypto automatically to your preferred wallet." },
              { title: "AI Native (x402)", icon: "🤖", desc: "First platform built for the Agent Economy. AI agents can autonomously discover your 402 endpoint and pay you for content." },
              { title: "Twitter Blinks", icon: "⚡", desc: "Paste your link on X and it turns into a native payment button. Followers tip instantly without leaving the timeline." },
            ].map((feature, i) => (
              <div key={i} className="glass-card p-10 rounded-3xl hover:-translate-y-2 transition-transform duration-300 group">
                <div className="text-5xl mb-6 bg-gray-50 dark:bg-zinc-800 w-20 h-20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold mb-4">{feature.title}</h3>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="pb-32 text-center">
          <div className="relative overflow-hidden bg-gradient-to-br from-purple-900 to-blue-900 rounded-[3rem] p-12 md:p-24 text-white shadow-2xl">
            <div className="relative z-10">
              <h2 className="text-4xl md:text-6xl font-bold mb-6">Start Earning in Web3 & AI</h2>
              <p className="text-xl text-purple-100 mb-10 max-w-2xl mx-auto opacity-90">
                Join thousands of creators receiving tips from humans and autonomous agents today.
              </p>
              <Link
                href="/register-new"
                className="inline-block px-12 py-5 bg-white text-purple-900 rounded-full font-bold text-xl hover:scale-105 transition-transform shadow-xl"
              >
                Claim Your Username
              </Link>
            </div>
            {/* Abstract Shapes */}
            <div className="absolute top-0 left-0 w-full h-full opacity-40 pointer-events-none mix-blend-overlay">
              <div className="absolute top-[-50%] left-[-20%] w-[600px] h-[600px] bg-purple-500 rounded-full blur-[120px]" />
              <div className="absolute bottom-[-50%] right-[-20%] w-[600px] h-[600px] bg-blue-500 rounded-full blur-[120px]" />
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}