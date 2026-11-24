import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import type { Location } from 'react-router-dom'
import { Layout } from './components/Layout'
import { SecretGames } from './components/SecretGames'
import { CategoryDetail } from './pages/CategoryDetail'
import { Home } from './pages/Home'
import { MyVotes } from './pages/MyVotes'
import { Nominations } from './pages/Nominations'
import { NotFound } from './pages/NotFound'
import { Questions } from './pages/Questions'
import { SignIn } from './pages/SignIn'

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
      {background && <SignIn modal />}
      <SecretGames />
    </>
  )
}
