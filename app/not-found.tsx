import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center p-4">
      <div className="text-center space-y-6 animate-slide-up">
        <div className="text-9xl">🛸</div>
        <h2 className="text-4xl font-bold">Page Not Found</h2>
        <p className="text-gray-500">The link you are looking for has vanished into the blockchain.</p>
        <Link 
          href="/"
          className="inline-block px-8 py-3 bg-black dark:bg-white text-white dark:text-black rounded-full font-bold hover:scale-105 transition-transform"
        >
          Return Home
        </Link>
      </div>
    </div>
  )
}

