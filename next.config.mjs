import nextra from 'nextra'

const withNextra = nextra({
  latex: true,
  defaultShowCopyCode: true
})

export default withNextra({
  output: 'export',
  basePath: '/leadership-learning',
  images: {
    unoptimized: true
  },
  trailingSlash: true
})
