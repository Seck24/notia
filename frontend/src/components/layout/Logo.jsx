export default function Logo({ size = 'md', dark = false }) {
  const imgHeights = { sm: 'h-9', md: 'h-14', lg: 'h-20' }

  if (dark) {
    // Sidebar navy: stylized text version that works on dark backgrounds
    const textSizes = { sm: 'text-2xl', md: 'text-3xl', lg: 'text-5xl' }
    const subSizes = { sm: 'text-[8px]', md: 'text-[10px]', lg: 'text-sm' }
    return (
      <div className="flex flex-col items-center">
        <span className={`${textSizes[size]} font-display italic text-gold font-bold leading-none`} style={{ fontFamily: 'Georgia, serif' }}>N</span>
        <span className={`${subSizes[size]} tracking-[0.3em] text-white/80 font-light mt-0.5`}>NOTIA</span>
      </div>
    )
  }

  // Light backgrounds: image logo with white blended away
  return (
    <img
      src="/logo-notia.jpg"
      alt="Notia"
      className={`${imgHeights[size]} w-auto object-contain mix-blend-multiply`}
    />
  )
}
