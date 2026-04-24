export default function Logo({ size = 'md' }) {
  const heights = { sm: 'h-8', md: 'h-12', lg: 'h-20' }
  return <img src="/logo-notia.jpg" alt="Notia" className={`${heights[size]} w-auto object-contain`} />
}
