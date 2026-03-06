import nextra from 'nextra'

const withNextra = nextra({
  latex: true,
  defaultShowCopyCode: true
})

export default withNextra({
  output: 'export',
  basePath: '/engineering-with-intent',
  images: {
    unoptimized: true
  },
  trailingSlash: true
})
