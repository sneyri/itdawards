import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import type { Location } from 'react-router-dom'
import { Layout } from './components/Layout'
import { SecretGames } from './components/SecretGames'
import { NotFound } from './pages/NotFound'

import { category, home, myVotes, nominations, questions, signIn } from './lib/pageModules'

const CategoryDetail = lazy(() => category().then(({ CategoryDetail }) => ({ default: CategoryDetail })))
const Home = lazy(() => home().then(({ Home }) => ({ default: Home })))
const MyVotes = lazy(() => myVotes().then(({ MyVotes }) => ({ default: MyVotes })))
const Nominations = lazy(() => nominations().then(({ Nominations }) => ({ default: Nominations })))
const Questions = lazy(() => questions().then(({ Questions }) => ({ default: Questions })))
const SignIn = lazy(() => signIn().then(({ SignIn }) => ({ default: SignIn })))

export default function App() {
  const location = useLocation()
  const background = location.pathname === '/sign-in'
    ? (location.state as { backgroundLocation?: Location } | null)?.backgroundLocation
    : undefined

  return (
    <>
      <Routes location={background ?? location}>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="nominations" element={<Nominations />} />
          <Route path="nominations/:categoryId" element={<CategoryDetail />} />
          <Route path="questions" element={<Questions />} />
          <Route path="about" element={<Navigate to="/questions" replace />} />
          <Route path="my-votes" element={<MyVotes />} />
          <Route path="sign-in" element={<SignIn />} />
          <Route path="auth/login" element={<SignIn />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
      {background && <Suspense fallback={null}><SignIn modal /></Suspense>}
      <SecretGames />
    </>
  )
}
