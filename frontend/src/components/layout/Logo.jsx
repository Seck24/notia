export default function Logo({ size = 'md', dark = false }) {
  const heights = { sm: 'h-7', md: 'h-10', lg: 'h-16' }
  if (dark) {
    return (
      <div className="bg-white rounded-lg px-3 py-1.5 inline-block">
        <img src="/logo-notia.jpg" alt="Notia" className={`${heights[size]} w-auto object-contain`} />
      </div>
    )
  }
  return <img src="/logo-notia.jpg" alt="Notia" className={`${heights[size]} w-auto object-contain`} />
}
