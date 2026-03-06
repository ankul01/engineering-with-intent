'use client'

import Link from 'next/link'

const statusConfig = {
  complete: {
    label: 'Complete',
    bgColor: '#dcfce7',
    textColor: '#166534',
    darkBgColor: '#14532d',
    darkTextColor: '#86efac',
    icon: '✓'
  },
  'in-progress': {
    label: 'In Progress',
    bgColor: '#fef3c7',
    textColor: '#92400e',
    darkBgColor: '#78350f',
    darkTextColor: '#fcd34d',
    icon: '⏳'
  },
  planned: {
    label: 'Planned',
    bgColor: '#f3f4f6',
    textColor: '#4b5563',
    darkBgColor: '#374151',
    darkTextColor: '#9ca3af',
    icon: '📋'
  }
}

export function StatusBadge({ status = 'planned' }) {
  const config = statusConfig[status] || statusConfig.planned
  return (
    <span 
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        borderRadius: '9999px',
        fontSize: '12px',
        fontWeight: '500',
        backgroundColor: config.bgColor,
        color: config.textColor,
        whiteSpace: 'nowrap'
      }}
    >
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  )
}

export function TopicCard({ title, description, href, status = 'planned', topics = [] }) {
  const isPlaceholder = href === '#'
  const CardWrapper = isPlaceholder ? 'div' : Link
  const wrapperProps = isPlaceholder ? {} : { href }
  
  return (
    <CardWrapper 
      {...wrapperProps}
      style={{
        display: 'block',
        padding: '16px',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        textDecoration: 'none',
        color: 'inherit',
        transition: 'all 0.2s ease',
        backgroundColor: 'var(--nextra-bg, #fff)',
        cursor: isPlaceholder ? 'default' : 'pointer',
        opacity: isPlaceholder ? 0.7 : 1
      }}
      onMouseOver={(e) => {
        if (!isPlaceholder) {
          e.currentTarget.style.borderColor = '#3b82f6'
          e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        }
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.borderColor = '#e5e7eb'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
        <h3 style={{ fontWeight: '600', fontSize: '18px', margin: 0 }}>{title}</h3>
        <StatusBadge status={status} />
      </div>
      {description && (
        <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '12px', margin: '0 0 12px 0' }}>{description}</p>
      )}
      {topics.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {topics.map((topic, i) => (
            <span 
              key={i} 
              style={{ 
                fontSize: '12px', 
                padding: '2px 8px', 
                backgroundColor: '#f3f4f6', 
                borderRadius: '4px',
                color: '#4b5563'
              }}
            >
              {topic}
            </span>
          ))}
        </div>
      )}
    </CardWrapper>
  )
}

export function TopicGrid({ children }) {
  return (
    <div 
      style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
        gap: '16px', 
        margin: '24px 0' 
      }}
    >
      {children}
    </div>
  )
}

export function ComingSoon({ title, expectedTopics = [] }) {
  return (
    <div 
      style={{ 
        borderLeft: '4px solid #fbbf24', 
        backgroundColor: '#fef3c7', 
        padding: '16px', 
        margin: '24px 0', 
        borderRadius: '0 8px 8px 0' 
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <span style={{ fontSize: '20px' }}>🚧</span>
        <h3 style={{ fontWeight: '600', margin: 0 }}>Coming Soon</h3>
      </div>
      <p style={{ color: '#92400e', fontSize: '14px', marginBottom: '12px' }}>
        This section is under development. Content will be added soon.
      </p>
      {expectedTopics.length > 0 && (
        <div>
          <p style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Expected topics:</p>
          <ul style={{ listStyleType: 'disc', paddingLeft: '20px', fontSize: '14px', color: '#92400e', margin: 0 }}>
            {expectedTopics.map((topic, i) => (
              <li key={i}>{topic}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
