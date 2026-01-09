export default function Loading() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 font-medium animate-pulse">Loading BlinkTip...</p>
      </div>
    </div>
  )
}

