import { Footer, Layout, Navbar } from 'nextra-theme-docs'
import { Head } from 'nextra/components'
import { getPageMap } from 'nextra/page-map'
import 'nextra-theme-docs/style.css'
import CrossSiteNav from '../components/CrossSiteNav'

export const metadata = {
  title: {
    default: 'Engineering with Intent',
    template: '%s | Engineering with Intent'
  },
  description: 'Architecture decisions and operating practices that hold up in production. For Staff engineers, Tech leads, and Engineering managers.',
  authors: [{ name: 'Ankul Choudhary' }]
}

const navbar = (
  <Navbar
    logo={<span style={{ fontWeight: 700 }}>Engineering with Intent</span>}
    projectLink="https://github.com/ankul01/leadership-learning"
  />
)

const footer = (
  <Footer>
    <span>
      MIT {new Date().getFullYear()} © Ankul Choudhary. Architecture decisions and operating practices that hold up in production.
    </span>
  </Footer>
)

export default async function RootLayout({ children }) {
  const pageMap = await getPageMap()
  
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>
      <body>
        <CrossSiteNav />
        <Layout
          navbar={navbar}
          pageMap={pageMap}
          docsRepositoryBase="https://github.com/ankul01/leadership-learning/tree/gh-pages"
          footer={footer}
          sidebar={{ defaultMenuCollapseLevel: 1, toggleButton: true }}
          toc={{ backToTop: true }}
          editLink={null}
          feedback={{ content: null }}
        >
          {children}
        </Layout>
      </body>
    </html>
  )
}
