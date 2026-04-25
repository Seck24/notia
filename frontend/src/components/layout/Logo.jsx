export default function Logo({ size = 'md', dark = false }) {
  const heights = { sm: 'h-10', md: 'h-14', lg: 'h-20' }

  if (dark) {
    return (
      <div className="flex items-center justify-center py-1">
        <img src="/logo-notia.jpg" alt="Notia" className={`${heights[size]} w-auto object-contain rounded-lg`} />
      </div>
    )
  }

  return (
    <img src="/logo-notia.jpg" alt="Notia" className={`${heights[size]} w-auto object-contain`} />
  )
}
