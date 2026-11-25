import { matchPath } from 'react-router-dom'

export const home = () => import('../pages/Home')
export const nominations = () => import('../pages/Nominations')
export const category = () => import('../pages/CategoryDetail')
export const myVotes = () => import('../pages/MyVotes')
export const questions = () => import('../pages/Questions')
export const signIn = () => import('../pages/SignIn')

const routeModules = [
  ['/', home], ['/nominations', nominations], ['/nominations/:categoryId', category],
  ['/my-votes', myVotes], ['/questions', questions], ['/about', questions],
  ['/sign-in', signIn], ['/auth/login', signIn],
] as const

export function primePage(path: string) {
  const route = routeModules.find(([pattern]) => matchPath(pattern, path))
  if (route) void route[1]().catch(() => {})
}
