export default function Logo({ size = 'md', dark = false }) {
  const imgHeights = { sm: 'h-8', md: 'h-12', lg: 'h-20' }
  const textSizes = { sm: 'text-sm', md: 'text-base', lg: 'text-2xl' }

  if (dark) {
    return (
      <div className="flex flex-col items-center gap-1">
        <div className="bg-white/95 rounded-xl p-3 flex items-center justify-center">
          <img src="/logo-notia.jpg" alt="Notia" className={`${imgHeights[size]} w-auto object-contain`} />
        </div>
        <span className={`${textSizes[size]} font-display font-bold tracking-[0.2em] text-white/90`}>NOTIA</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <img src="/logo-notia.jpg" alt="Notia" className={`${imgHeights[size]} w-auto object-contain mix-blend-multiply`} />
    </div>
  )
}
