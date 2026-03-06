export default function CrossSiteNav() {
  return (
    <nav style={{
      backgroundColor: '#f9fafb',
      borderBottom: '1px solid #e5e7eb',
      fontSize: '14px',
      padding: '8px 0'
    }}>
      <div style={{
        maxWidth: '1280px',
        margin: '0 auto',
        padding: '0 16px',
        display: 'flex',
        gap: '24px',
        alignItems: 'center'
      }}>
        <a 
          href="https://ankul01.github.io/profile/" 
          style={{ color: '#4b5563', textDecoration: 'none' }}
        >
          ← Home
        </a>
        <span style={{ color: '#d1d5db' }}>|</span>
        <a 
          href="https://ankul01.github.io/profile/" 
          style={{ color: '#4b5563', textDecoration: 'none' }}
        >
          Home
        </a>
        <a 
          href="https://ankul01.github.io/engineering-with-intent/" 
          style={{ color: '#111827', fontWeight: 500, textDecoration: 'none' }}
        >
          Engineering with Intent
        </a>
        <a 
          href="https://portfolio.ankul.co.in" 
          style={{ color: '#4b5563', textDecoration: 'none' }}
        >
          Portfolio
        </a>
      </div>
    </nav>
  )
}
