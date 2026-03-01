'use client'

const statusConfig = {
  complete: {
    label: 'Complete',
    color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    icon: '✓'
  },
  'in-progress': {
    label: 'In Progress',
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
    icon: '⏳'
  },
  planned: {
    label: 'Planned',
    color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    icon: '📋'
  }
}

export function StatusBadge({ status = 'planned' }) {
  const config = statusConfig[status] || statusConfig.planned
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  )
}

export function TopicCard({ title, description, href, status = 'planned', topics = [] }) {
  const config = statusConfig[status] || statusConfig.planned
  
  return (
    <a 
      href={href}
      className="block p-4 border rounded-lg hover:border-blue-500 hover:shadow-md transition-all dark:border-gray-700 dark:hover:border-blue-400"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-semibold text-lg">{title}</h3>
        <StatusBadge status={status} />
      </div>
      {description && (
        <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">{description}</p>
      )}
      {topics.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {topics.map((topic, i) => (
            <span key={i} className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">
              {topic}
            </span>
          ))}
        </div>
      )}
    </a>
  )
}

export function TopicGrid({ children }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
      {children}
    </div>
  )
}

export function ComingSoon({ title, expectedTopics = [] }) {
  return (
    <div className="border-l-4 border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 p-4 my-6 rounded-r">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">🚧</span>
        <h3 className="font-semibold">Coming Soon</h3>
      </div>
      <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
        This section is under development. Content will be added soon.
      </p>
      {expectedTopics.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-2">Expected topics:</p>
          <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400">
            {expectedTopics.map((topic, i) => (
              <li key={i}>{topic}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
