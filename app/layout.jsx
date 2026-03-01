import { Footer, Layout, Navbar } from 'nextra-theme-docs'
import { Head } from 'nextra/components'
import { getPageMap } from 'nextra/page-map'
import 'nextra-theme-docs/style.css'

export const metadata = {
  title: {
    default: 'Leadership Learning',
    template: '%s | Leadership Learning'
  },
  description: 'Interview preparation for senior engineering and engineering leadership roles',
  authors: [{ name: 'Ankul Choudhary' }]
}

const navbar = (
  <Navbar
    logo={<span style={{ fontWeight: 700 }}>Leadership Learning</span>}
    projectLink="https://github.com/ankul01/leadership-learning"
  />
)

const footer = (
  <Footer>
    <span>
      MIT {new Date().getFullYear()} © Ankul Choudhary. Interview Preparation for Senior Engineering Roles.
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
