export default function Logo({ size = 'md' }) {
  const sizes = { sm: 'text-xl', md: 'text-3xl', lg: 'text-5xl' }
  const sub = { sm: 'text-sm', md: 'text-lg', lg: 'text-2xl' }
  return (
    <span className="inline-flex items-baseline">
      <span className={`font-display italic text-gold font-bold ${sizes[size]}`}>N</span>
      <span className={`font-sans font-semibold text-navy ${sub[size]}`}>otia</span>
    </span>
  )
}
