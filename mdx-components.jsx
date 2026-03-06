import { useMDXComponents as getDocsMDXComponents } from 'nextra-theme-docs'
import { StatusBadge, TopicCard, TopicGrid, ComingSoon } from './components/StatusBadge'

const docsComponents = getDocsMDXComponents()

export function useMDXComponents(components) {
  return {
    ...docsComponents,
    StatusBadge,
    TopicCard,
    TopicGrid,
    ComingSoon,
    ...components
  }
}
