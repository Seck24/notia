export default function Logo({ size = 'md', dark = false }) {
  const imgHeights = { sm: 'h-7', md: 'h-8', lg: 'h-16' }

  if (dark) {
    return (
      <div className="bg-white rounded-xl p-2 flex items-center justify-center">
        <img src="/logo-notia.jpg" alt="Notia" className={`${imgHeights[size]} w-auto object-contain`} />
      </div>
    )
  }

  return (
    <img src="/logo-notia.jpg" alt="Notia" className={`${imgHeights[size]} w-auto object-contain mix-blend-multiply`} />
  )
}
