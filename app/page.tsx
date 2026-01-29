'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { motion, useInView, useMotionValue, useScroll, useSpring, useTransform } from 'framer-motion'

const heroWords = ['Tips', 'from', 'Humans', 'AND', 'AI', 'Agents.']

function useMouseSpotlight() {
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  const smoothX = useSpring(mouseX, { stiffness: 100, damping: 30 })
  const smoothY = useSpring(mouseY, { stiffness: 100, damping: 30 })

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      mouseX.set(e.clientX)
      mouseY.set(e.clientY)
    }
    window.addEventListener('mousemove', handleMove)
    return () => window.removeEventListener('mousemove', handleMove)
  }, [mouseX, mouseY])

  return { x: smoothX, y: smoothY }
}

function Tilt3DCard({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const rotateX = useMotionValue(0)
  const rotateY = useMotionValue(0)
  const springRotateX = useSpring(rotateX, { stiffness: 300, damping: 30 })
  const springRotateY = useSpring(rotateY, { stiffness: 300, damping: 30 })

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const mouseX = e.clientX - centerX
    const mouseY = e.clientY - centerY
    rotateX.set(mouseY / -10)
    rotateY.set(mouseX / 10)
  }

  const handleMouseLeave = () => {
    rotateX.set(0)
    rotateY.set(0)
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX: springRotateX,
        rotateY: springRotateY,
        transformStyle: 'preserve-3d',
        perspective: 1000,
      }}
      className={className}
    >
      <div style={{ transform: 'translateZ(20px)' }}>
        {children}
      </div>
    </motion.div>
  )
}

function RippleButton({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) {
  const [ripples, setRipples] = useState<{ x: number; y: number; id: number }[]>([])

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const id = Date.now()
    setRipples((prev) => [...prev, { x, y, id }])
    setTimeout(() => setRipples((prev) => prev.filter((r) => r.id !== id)), 600)
  }

  return (
    <Link
      href={href}
      onClick={handleClick}
      className={`relative overflow-hidden ${className}`}
    >
      {ripples.map((ripple) => (
        <motion.span
          key={ripple.id}
          initial={{ scale: 0, opacity: 0.5 }}
          animate={{ scale: 4, opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="absolute w-20 h-20 bg-white/30 rounded-full pointer-events-none"
          style={{ left: ripple.x - 40, top: ripple.y - 40 }}
        />
      ))}
      {children}
    </Link>
  )
}

function MagneticButton({ children, href }: { children: React.ReactNode; href: string }) {
  const ref = useRef<HTMLAnchorElement>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const springX = useSpring(x, { stiffness: 150, damping: 15 })
  const springY = useSpring(y, { stiffness: 150, damping: 15 })

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    x.set((e.clientX - centerX) * 0.15)
    y.set((e.clientY - centerY) * 0.15)
  }

  const handleMouseLeave = () => {
    x.set(0)
    y.set(0)
  }

  return (
    <motion.a
      ref={ref}
      href={href}
      style={{ x: springX, y: springY }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.98 }}
      className="inline-block w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-full font-bold text-lg shadow-2xl shadow-purple-500/30 transition-shadow hover:shadow-purple-500/50"
    >
      {children}
    </motion.a>
  )
}

const rotatingWords = ['Solana', 'Base', 'Celo', 'AI Agents']

function RotatingText() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % rotatingWords.length)
    }, 2500)
    return () => clearInterval(interval)
  }, [])

  return (
    <span className="inline-block relative h-[1.2em] w-[140px] md:w-[180px] align-bottom overflow-hidden">
      {rotatingWords.map((word, i) => (
        <motion.span
          key={word}
          initial={{ y: 30, opacity: 0 }}
          animate={{
            y: i === index ? 0 : -30,
            opacity: i === index ? 1 : 0,
          }}
          transition={{ duration: 0.4, ease: 'easeInOut' }}
          className="absolute left-0 text-gradient font-bold"
        >
          {word}
        </motion.span>
      ))}
    </span>
  )
}

function AnimatedCounter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0)
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true })

  useEffect(() => {
    if (!isInView) return
    let start = 0
    const duration = 2000
    const step = target / (duration / 16)
    const timer = setInterval(() => {
      start += step
      if (start >= target) {
        setCount(target)
        clearInterval(timer)
      } else {
        setCount(Math.floor(start))
      }
    }, 16)
    return () => clearInterval(timer)
  }, [isInView, target])

  return (
    <span ref={ref}>
      {count.toLocaleString()}{suffix}
    </span>
  )
}

export default function Home() {
  const spotlight = useMouseSpotlight()
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 })
  const progressGradient = useTransform(
    scrollYProgress,
    [0, 0.5, 1],
    [
      'linear-gradient(to right, #9333ea, #7c3aed)',
      'linear-gradient(to right, #9333ea, #3b82f6)',
      'linear-gradient(to right, #9333ea, #3b82f6, #06b6d4)',
    ]
  )

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black selection:bg-purple-500 selection:text-white relative">

      {/* Animated Gradient Mesh Background */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <svg className="absolute w-full h-full opacity-30 dark:opacity-20" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
          <defs>
            <filter id="goo">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
              <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -10" result="goo" />
            </filter>
            <linearGradient id="meshGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#9333ea" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>
            <linearGradient id="meshGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#06b6d4" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>
          <g filter="url(#goo)">
            <motion.circle
              cx="20" cy="30" r="15"
              fill="url(#meshGrad1)"
              animate={{ cx: [20, 40, 25, 20], cy: [30, 50, 70, 30] }}
              transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.circle
              cx="70" cy="60" r="20"
              fill="url(#meshGrad2)"
              animate={{ cx: [70, 50, 80, 70], cy: [60, 30, 50, 60] }}
              transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.circle
              cx="50" cy="20" r="12"
              fill="url(#meshGrad1)"
              animate={{ cx: [50, 70, 30, 50], cy: [20, 40, 30, 20] }}
              transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.circle
              cx="80" cy="80" r="18"
              fill="url(#meshGrad2)"
              animate={{ cx: [80, 60, 90, 80], cy: [80, 60, 70, 80] }}
              transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
            />
          </g>
        </svg>
      </div>

      {/* Scroll Progress Bar */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-1 z-50 origin-left"
        style={{ scaleX, background: progressGradient }}
      />

      {/* Mouse-follow spotlight */}
      <motion.div
        className="fixed w-[600px] h-[600px] rounded-full pointer-events-none z-0 opacity-20 dark:opacity-15 blur-[100px]"
        style={{
          x: spotlight.x,
          y: spotlight.y,
          translateX: '-50%',
          translateY: '-50%',
          background: 'radial-gradient(circle, rgba(147,51,234,0.3) 0%, rgba(59,130,246,0.2) 40%, transparent 70%)',
        }}
      />

      {/* Ambient Background Glows with Scroll Parallax */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <motion.div
          style={{ y: useTransform(scrollYProgress, [0, 1], [0, -150]) }}
          className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-purple-600/10 rounded-full blur-[120px] animate-pulse-glow"
        />
        <motion.div
          style={{ y: useTransform(scrollYProgress, [0, 1], [0, 200]) }}
          className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px] animate-pulse-glow [animation-delay:2s]"
        />
      </div>

      {/* Floating Orbs */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        {[
          { size: 6, x: '10%', y: '20%', duration: 8, delay: 0, color: 'bg-purple-400/20' },
          { size: 4, x: '80%', y: '15%', duration: 10, delay: 1, color: 'bg-blue-400/20' },
          { size: 8, x: '70%', y: '60%', duration: 12, delay: 2, color: 'bg-purple-500/15' },
          { size: 3, x: '20%', y: '70%', duration: 9, delay: 0.5, color: 'bg-blue-500/20' },
          { size: 5, x: '50%', y: '40%', duration: 11, delay: 3, color: 'bg-indigo-400/15' },
          { size: 4, x: '90%', y: '80%', duration: 7, delay: 1.5, color: 'bg-purple-300/20' },
        ].map((orb, i) => (
          <motion.div
            key={i}
            className={`absolute rounded-full ${orb.color} blur-sm`}
            style={{
              width: orb.size * 4,
              height: orb.size * 4,
              left: orb.x,
              top: orb.y,
            }}
            animate={{
              y: [0, -30, 0, 20, 0],
              x: [0, 15, 0, -15, 0],
              scale: [1, 1.2, 1, 0.9, 1],
              opacity: [0.4, 0.7, 0.4, 0.6, 0.4],
            }}
            transition={{
              duration: orb.duration,
              repeat: Infinity,
              delay: orb.delay,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        {/* Navbar */}
        <motion.nav
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="flex items-center justify-between py-8"
        >
          <motion.div
            className="flex items-center gap-3"
            whileHover={{ scale: 1.02 }}
          >
            <motion.div
              initial={{ rotate: -180, scale: 0 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
              className="w-10 h-10 bg-gradient-to-tr from-purple-600 to-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-purple-500/20"
            >
              B
            </motion.div>
            <span className="text-2xl font-bold tracking-tight flex">
              {'BlinkTip'.split('').map((letter, i) => (
                <motion.span
                  key={i}
                  initial={{ opacity: 0, y: -20, rotateX: -90 }}
                  animate={{ opacity: 1, y: 0, rotateX: 0 }}
                  transition={{
                    duration: 0.4,
                    delay: 0.3 + i * 0.05,
                    type: 'spring',
                    stiffness: 200,
                  }}
                  className={i >= 5 ? 'text-gradient' : ''}
                >
                  {letter}
                </motion.span>
              ))}
            </span>
          </motion.div>
          <div className="flex items-center gap-4 md:gap-8">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <Link href="/login" className="hidden md:block text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors">
                Sign In
              </Link>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.6 }}
            >
              <RippleButton
                href="/register-new"
                className="px-6 py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-full font-bold text-sm hover:scale-105 transition-transform duration-200 shadow-xl inline-block"
              >
                Get Started
              </RippleButton>
            </motion.div>
          </div>
        </motion.nav>

        {/* Hero Section */}
        <header className="py-20 md:py-32 text-center relative">
          {/* Morphing blob behind hero */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
            <motion.div
              className="w-[500px] h-[500px] md:w-[700px] md:h-[700px] opacity-20 dark:opacity-10"
              animate={{
                borderRadius: [
                  '60% 40% 30% 70% / 60% 30% 70% 40%',
                  '30% 60% 70% 40% / 50% 60% 30% 60%',
                  '60% 40% 30% 70% / 60% 30% 70% 40%',
                ],
                rotate: [0, 180, 360],
              }}
              transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                background: 'linear-gradient(135deg, #9333ea 0%, #3b82f6 50%, #06b6d4 100%)',
                filter: 'blur(60px)',
              }}
            />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 text-purple-700 dark:text-purple-300 text-sm font-medium mb-8"
          >
            <span className="relative flex h-3 w-3">
              <motion.span
                animate={{ scale: [1, 2.5, 2.5], opacity: [0.7, 0.3, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
                className="absolute inset-0 rounded-full bg-purple-400"
              />
              <motion.span
                animate={{ scale: [1, 2, 2], opacity: [0.5, 0.2, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeOut', delay: 0.3 }}
                className="absolute inset-0 rounded-full bg-purple-500"
              />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-gradient-to-r from-purple-500 to-pink-500 shadow-lg shadow-purple-500/50" />
            </span>
            <span className="font-semibold">Live</span>
            <span className="text-purple-500/50">|</span>
            Tips from AI Agents via x402
          </motion.div>

          <h1 className="text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-8 leading-[1.1]">
            {heroWords.map((word, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, y: 40, filter: 'blur(10px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.5, delay: 0.3 + i * 0.1 }}
                className={`inline-block mr-[0.3em] ${
                  word === 'Humans' || word === 'AI' || word === 'Agents.' ? 'text-gradient' : ''
                }`}
              >
                {word}
                {word === 'Humans' && <br />}
              </motion.span>
            ))}
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 1, 0] }}
              transition={{ duration: 1, repeat: Infinity, delay: 1.2, times: [0, 0.1, 0.9, 1] }}
              className="inline-block w-[4px] h-[0.9em] bg-gradient-to-b from-purple-500 to-blue-500 ml-1 align-middle rounded-full"
            />
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.9 }}
            className="text-xl md:text-2xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-12 leading-relaxed"
          >
            The universal tipping layer for <RotatingText /> and beyond. One link, every chain.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.1 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <MagneticButton href="/register-new">
              Create Your Tip Page
            </MagneticButton>
            <Link
              href="#how-it-works"
              className="w-full sm:w-auto px-8 py-4 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 text-gray-900 dark:text-white rounded-full font-bold text-lg hover:bg-gray-50 dark:hover:bg-zinc-800 transition-all duration-300"
            >
              See How It Works
            </Link>
          </motion.div>
        </header>

        {/* Floating Glass Visual with 3D Tilt */}
        <motion.div
          initial={{ opacity: 0, y: 60, rotateX: 10 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ duration: 1, delay: 1.3, ease: 'easeOut' }}
          whileHover={{
            rotateY: 5,
            rotateX: -5,
            scale: 1.02,
            transition: { duration: 0.4 },
          }}
          style={{ perspective: 1000, transformStyle: 'preserve-3d' }}
          className="relative mx-auto max-w-4xl mb-32"
        >
          {/* Animated border trail */}
          <div className="absolute -inset-[2px] rounded-3xl overflow-hidden">
            <motion.div
              className="absolute w-[200%] h-[200%] top-[-50%] left-[-50%]"
              style={{
                background: 'conic-gradient(from 0deg, transparent, #9333ea, #3b82f6, #06b6d4, transparent)',
              }}
              animate={{ rotate: 360 }}
              transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
            />
          </div>
          <div className="glass-card rounded-3xl p-2 transform rotate-1 relative">
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
                <motion.div
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                  className="w-24 h-24 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full mx-auto mb-6 shadow-xl ring-4 ring-white dark:ring-black"
                />
                <h3 className="text-3xl font-bold mb-2">Nelly CyberPro</h3>
                <p className="text-gray-500 mb-10">Building the future of AI payments.</p>

                <div className="flex flex-wrap justify-center gap-4">
                  <motion.div
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 1.8, duration: 0.5 }}
                    className="flex items-center gap-3 px-6 py-4 rounded-2xl border border-purple-500/20 bg-purple-500/5 text-purple-700 dark:text-purple-300 font-bold shadow-sm"
                  >
                    <span className="text-xl">⚡</span>
                    <div>
                      <div className="text-xs opacity-70 uppercase tracking-wide">Received</div>
                      5.00 USDC (Solana)
                    </div>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 2.0, duration: 0.5 }}
                    className="flex items-center gap-3 px-6 py-4 rounded-2xl border border-blue-500/20 bg-blue-500/5 text-blue-700 dark:text-blue-300 font-bold shadow-sm"
                  >
                    <span className="text-xl">🤖</span>
                    <div>
                      <div className="text-xs opacity-70 uppercase tracking-wide">AI Agent Tip</div>
                      2.50 USDC (Base)
                    </div>
                  </motion.div>
                </div>
              </div>
            </div>
          </div>
          {/* Reflection glow beneath card */}
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-3/4 h-16 bg-purple-500/10 blur-[40px] rounded-full" />
        </motion.div>

        {/* Stats Section */}
        <motion.section
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.8 }}
          className="mb-32 grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8"
        >
          {[
            { value: 12000, suffix: '+', label: 'Creators Onboarded' },
            { value: 850, suffix: 'K', label: 'Tips Processed' },
            { value: 4, suffix: '', label: 'Chains Supported' },
            { value: 99, suffix: '%', label: 'Uptime' },
          ].map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, type: 'spring', stiffness: 150 }}
              className="text-center p-6 rounded-2xl bg-white/50 dark:bg-zinc-900/50 border border-gray-100 dark:border-zinc-800"
            >
              <div className="text-3xl md:text-4xl font-bold text-gradient mb-2">
                <AnimatedCounter target={stat.value} suffix={stat.suffix} />
              </div>
              <div className="text-sm text-gray-500 font-medium">{stat.label}</div>
            </motion.div>
          ))}
        </motion.section>

        {/* Supported Chains Marquee */}
        <div className="mb-32 overflow-hidden relative">
          <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-zinc-50 dark:from-black to-transparent z-10" />
          <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-zinc-50 dark:from-black to-transparent z-10" />
          <motion.div
            animate={{ x: ['0%', '-50%'] }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
            className="flex gap-8 items-center whitespace-nowrap"
          >
            {[...Array(2)].map((_, setIndex) => (
              <div key={setIndex} className="flex gap-8 items-center">
                {[
                  { name: 'Solana', color: 'from-purple-500 to-green-400' },
                  { name: 'Base', color: 'from-blue-500 to-blue-300' },
                  { name: 'Celo', color: 'from-yellow-400 to-green-500' },
                  { name: 'Ethereum', color: 'from-blue-400 to-purple-500' },
                  { name: 'USDC', color: 'from-blue-600 to-blue-400' },
                  { name: 'x402 Protocol', color: 'from-purple-600 to-pink-500' },
                  { name: 'Smart Wallets', color: 'from-indigo-500 to-blue-500' },
                  { name: 'Blinks', color: 'from-orange-500 to-yellow-400' },
                ].map((chain, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-6 py-3 rounded-full border border-gray-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 backdrop-blur-sm"
                  >
                    <div className={`w-3 h-3 rounded-full bg-gradient-to-r ${chain.color}`} />
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{chain.name}</span>
                  </div>
                ))}
              </div>
            ))}
          </motion.div>
        </div>

        {/* Features Grid */}
        <section id="how-it-works" className="mb-32">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.7 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Why Creators Choose BlinkTip</h2>
            <p className="text-gray-500 max-w-2xl mx-auto">The infrastructure layer for the next generation of content monetization.</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { title: "One Link, Any Chain", icon: "🌐", desc: "Forget Linktree. One URL accepts Solana, Base, Celo, and more. We route the crypto automatically to your preferred wallet.", gradient: 'from-purple-500/20 to-blue-500/20' },
              { title: "AI Native (x402)", icon: "🤖", desc: "First platform built for the Agent Economy. AI agents can autonomously discover your 402 endpoint and pay you for content.", gradient: 'from-blue-500/20 to-cyan-500/20' },
              { title: "Twitter Blinks", icon: "⚡", desc: "Paste your link on X and it turns into a native payment button. Followers tip instantly without leaving the timeline.", gradient: 'from-orange-500/20 to-yellow-500/20' },
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 50, scale: 0.9 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.5, delay: i * 0.15, type: 'spring', stiffness: 100 }}
              >
                <Tilt3DCard className="h-full">
                  <div className={`glass-card p-10 rounded-3xl group cursor-default h-full relative overflow-hidden`}>
                    <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                    <div className="relative z-10">
                      <motion.div
                        whileHover={{ scale: 1.15, rotate: 5 }}
                        transition={{ type: 'spring', stiffness: 300 }}
                        className="text-5xl mb-6 bg-gray-50 dark:bg-zinc-800 w-20 h-20 rounded-2xl flex items-center justify-center shadow-lg"
                      >
                        {feature.icon}
                      </motion.div>
                      <h3 className="text-xl font-bold mb-4">{feature.title}</h3>
                      <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                        {feature.desc}
                      </p>
                    </div>
                  </div>
                </Tilt3DCard>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Testimonials / Social Proof */}
        <section className="mb-32">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.7 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Loved by Creators</h2>
            <p className="text-gray-500 max-w-xl mx-auto">Hear from the people already earning with BlinkTip.</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                name: 'Sarah K.',
                handle: '@sarahcrypto',
                text: 'BlinkTip completely changed how I monetize my content. AI agents send me tips while I sleep!',
                gradient: 'from-purple-500 to-pink-500',
              },
              {
                name: 'Alex Chen',
                handle: '@alexbuilds',
                text: 'The x402 integration is genius. My API earns USDC from agents autonomously. No invoices, no friction.',
                gradient: 'from-blue-500 to-cyan-500',
              },
              {
                name: 'Maya R.',
                handle: '@mayaweb3',
                text: 'One link for Solana and Base tips? Yes please. My followers tip in 2 clicks right from Twitter.',
                gradient: 'from-orange-500 to-yellow-500',
              },
            ].map((testimonial, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 60, scale: 0.8, rotateX: 20 }}
                whileInView={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{
                  delay: i * 0.2,
                  duration: 0.7,
                  type: 'spring',
                  stiffness: 80,
                  damping: 15,
                }}
                whileHover={{
                  y: -8,
                  scale: 1.03,
                  boxShadow: '0 25px 50px -12px rgba(147, 51, 234, 0.25)',
                }}
                className="glass-card rounded-3xl p-8 relative overflow-hidden cursor-default"
                style={{ transformStyle: 'preserve-3d' }}
              >
                <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${testimonial.gradient}`} />
                <motion.div
                  initial={{ scale: 0 }}
                  whileInView={{ scale: 1 }}
                  transition={{ delay: i * 0.2 + 0.3, type: 'spring', stiffness: 200 }}
                  className="flex items-center gap-3 mb-4"
                >
                  <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${testimonial.gradient} flex items-center justify-center text-white font-bold text-sm shadow-lg`}>
                    {testimonial.name[0]}
                  </div>
                  <div>
                    <div className="font-bold text-sm">{testimonial.name}</div>
                    <div className="text-xs text-gray-500">{testimonial.handle}</div>
                  </div>
                </motion.div>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-sm">
                  &ldquo;{testimonial.text}&rdquo;
                </p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <motion.section
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.8 }}
          className="pb-32 text-center"
        >
          <div className="relative overflow-hidden rounded-[3rem] p-[2px] shadow-2xl">
            {/* Animated gradient border */}
            <div className="absolute inset-0 rounded-[3rem] bg-[conic-gradient(from_var(--angle),theme(colors.purple.600),theme(colors.blue.600),theme(colors.purple.400),theme(colors.blue.400),theme(colors.purple.600))] animate-[spin_4s_linear_infinite]" style={{ '--angle': '0deg' } as React.CSSProperties} />
            <div className="relative bg-gradient-to-br from-purple-900 to-blue-900 rounded-[calc(3rem-2px)] p-12 md:p-24 text-white overflow-hidden">
              <div className="relative z-10">
                <motion.h2
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2, duration: 0.6 }}
                  className="text-4xl md:text-6xl font-bold mb-6"
                >
                  Start Earning in Web3 & AI
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 0.9 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.4, duration: 0.6 }}
                  className="text-xl text-purple-100 mb-10 max-w-2xl mx-auto"
                >
                  Join thousands of creators receiving tips from humans and autonomous agents today.
                </motion.p>
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.6, type: 'spring', stiffness: 200 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Link
                    href="/register-new"
                    className="inline-block px-12 py-5 bg-white text-purple-900 rounded-full font-bold text-xl shadow-xl shadow-black/20"
                  >
                    Claim Your Username
                  </Link>
                </motion.div>
              </div>
              {/* Abstract Shapes */}
              <div className="absolute top-0 left-0 w-full h-full opacity-40 pointer-events-none mix-blend-overlay">
                <div className="absolute top-[-50%] left-[-20%] w-[600px] h-[600px] bg-purple-500 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-50%] right-[-20%] w-[600px] h-[600px] bg-blue-500 rounded-full blur-[120px]" />
              </div>
            </div>
          </div>
        </motion.section>
      </div>

      {/* Footer */}
      <footer className="relative border-t border-gray-200 dark:border-zinc-800">
        {/* Wave SVG divider */}
        <div className="absolute -top-px left-0 w-full overflow-hidden leading-none rotate-180">
          <svg className="relative block w-full h-12" viewBox="0 0 1200 60" preserveAspectRatio="none">
            <path d="M0,0 C300,60 900,0 1200,60 L1200,0 L0,0 Z" className="fill-zinc-50 dark:fill-black" />
          </svg>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-16">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="flex flex-col md:flex-row items-center justify-between gap-8"
          >
            {/* Logo & tagline */}
            <div className="flex flex-col items-center md:items-start gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-tr from-purple-600 to-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-purple-500/20">
                  B
                </div>
                <span className="text-lg font-bold">BlinkTip</span>
              </div>
              <p className="text-sm text-gray-500 text-center md:text-left">The tipping layer for humans & AI agents.</p>
            </div>

            {/* Social / links */}
            <div className="flex items-center gap-4">
              {[
                { label: 'X / Twitter', href: '#' },
                { label: 'GitHub', href: '#' },
                { label: 'Discord', href: '#' },
                { label: 'Docs', href: '#' },
              ].map((link, i) => (
                <motion.a
                  key={i}
                  href={link.href}
                  whileHover={{ y: -2, scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white bg-gray-100 dark:bg-zinc-900 rounded-full border border-gray-200 dark:border-zinc-800 transition-colors"
                >
                  {link.label}
                </motion.a>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="mt-12 pt-8 border-t border-gray-200 dark:border-zinc-800 text-center"
          >
            <p className="text-xs text-gray-400">
              Built with x402 protocol. Payments secured by blockchain.
            </p>
          </motion.div>
        </div>
      </footer>
    </div>
  )
}