export default function Logo({ size = 'md', dark = false }) {
  const heights = { sm: 'h-9', md: 'h-14', lg: 'h-20' }
  if (dark) {
    return (
      <div className="bg-white rounded-xl px-4 py-2 inline-block">
        <img src="/logo-notia.jpg" alt="Notia" className={`${heights[size]} w-auto object-contain`} />
      </div>
    )
  }
  return <img src="/logo-notia.jpg" alt="Notia" className={`${heights[size]} w-auto object-contain`} />
}
